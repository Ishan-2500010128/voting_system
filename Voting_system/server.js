/* Online Voting System - Node.js, zero dependencies.
 * Run:  node server.js     Open: http://localhost:3000
 * Data is stored in data.json (delete it to reset). */
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'data.json');
const PUBLIC = path.join(__dirname, 'public');

// ------------------------------------------------------------ passwords
function hashPw(pw) {
  const salt = crypto.randomBytes(16).toString('hex');
  return salt + ':' + crypto.scryptSync(pw, salt, 32).toString('hex');
}
function checkPw(pw, stored) {
  const [salt, hash] = (stored || 'x:x').split(':');
  const test = crypto.scryptSync(pw, salt, 32);
  const real = Buffer.from(hash, 'hex');
  return real.length === test.length && crypto.timingSafeEqual(test, real);
}

// ------------------------------------------------------------- database
let db;
function save() {                       // atomic write: temp file, then rename
  fs.writeFileSync(DB_FILE + '.tmp', JSON.stringify(db, null, 2));
  fs.renameSync(DB_FILE + '.tmp', DB_FILE);
}
function sha(s) { return crypto.createHash('sha256').update(s).digest('hex'); }

/* Hash-chained audit log: every entry's hash covers the previous hash,
 * so editing or deleting any past entry breaks the chain. */
function audit(event) {
  const prev = db.audit.length ? db.audit[db.audit.length - 1].hash : '0';
  const ts = new Date().toISOString().slice(0, 19);
  db.audit.push({ id: db.audit.length + 1, ts, event, prev, hash: sha(`${prev}|${ts}|${event}`) });
}
function verifyChain() {
  let prev = '0';
  for (const a of db.audit) {
    if (a.prev !== prev || a.hash !== sha(`${prev}|${a.ts}|${a.event}`)) return a.id;
    prev = a.hash;
  }
  return 0;
}
function initDb() {
  if (fs.existsSync(DB_FILE)) { db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); return; }
  db = {
    admin: { username: 'admin', hash: hashPw(process.env.ADMIN_PASSWORD || 'admin123') },
    voters: {},
    election: { title: 'Student Council Election', status: 'draft', published: false },
    candidates: ['Alice', 'Bob', 'Chitra'].map((name, i) => ({ id: i + 1, name })),
    ballots: [],          // { receipt, candidateId }  - NO voter identity stored here
    audit: [],
  };
  for (const id of ['V001', 'V002', 'V003']) db.voters[id] = { hash: hashPw('vote123'), hasVoted: false };
  audit('System initialised');
  save();
}

// ------------------------------------------------------------- sessions
const sessions = new Map();             // sid -> { role, id, csrf }
const failures = new Map();             // ip -> { n, first }
const MAX_FAILS = 5, WINDOW_MS = 5 * 60 * 1000;

function getSession(req) {
  const m = /(?:^|;\s*)sid=([a-f0-9]+)/.exec(req.headers.cookie || '');
  return m ? sessions.get(m[1]) : undefined;
}
function lockedOut(ip) {
  const f = failures.get(ip);
  if (f && Date.now() - f.first > WINDOW_MS) { failures.delete(ip); return false; }
  return !!f && f.n >= MAX_FAILS;
}

// -------------------------------------------------------------- helpers
const SEC_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Content-Security-Policy': "default-src 'self'",
  'Cache-Control': 'no-store',
};
function send(res, code, body, extra = {}) {
  const isJson = typeof body !== 'string' && !Buffer.isBuffer(body);
  res.writeHead(code, { ...SEC_HEADERS, 'Content-Type': isJson ? 'application/json' : 'text/plain', ...extra });
  res.end(isJson ? JSON.stringify(body) : body);
}
const fail = (res, code, error) => send(res, code, { error });
function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', c => { data += c; if (data.length > 20000) { reject(new Error('too large')); req.destroy(); } });
    req.on('end', () => { try { resolve(data ? JSON.parse(data) : {}); } catch { reject(new Error('bad json')); } });
  });
}
function tally() {
  return db.candidates
    .map(c => ({ name: c.name, votes: db.ballots.filter(b => b.candidateId === c.id).length }))
    .sort((a, b) => b.votes - a.votes || a.name.localeCompare(b.name));
}
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = crypto.randomInt(i + 1); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

// ------------------------------------------------------------------ API
async function api(req, res, url) {
  const s = getSession(req);
  const route = req.method + ' ' + url;
  const body = req.method === 'POST' ? await readBody(req) : {};

  // CSRF: every state-changing call from a signed-in user needs the session token
  const needsCsrf = req.method === 'POST' && s && route !== 'POST /api/login';
  if (needsCsrf && req.headers['x-csrf-token'] !== s.csrf) return fail(res, 403, 'Invalid CSRF token');

  switch (route) {
    case 'POST /api/login': {
      const ip = req.socket.remoteAddress;
      if (lockedOut(ip)) return fail(res, 429, 'Too many failed attempts. Try again in a few minutes.');
      const { role, id = '', password = '' } = body;
      let stored;
      if (role === 'admin') stored = id === db.admin.username ? db.admin.hash : undefined;
      else if (role === 'voter') stored = db.voters[id]?.hash;
      else return fail(res, 400, 'Choose a role');
      if (!checkPw(String(password), stored)) {
        const f = failures.get(ip) || { n: 0, first: Date.now() };
        failures.set(ip, { n: f.n + 1, first: f.first });
        audit(`Failed ${role} login attempt`); save();
        return fail(res, 401, 'Invalid ID or password');
      }
      failures.delete(ip);
      const sid = crypto.randomBytes(24).toString('hex');
      const sess = { role, id, csrf: crypto.randomBytes(16).toString('hex') };
      sessions.set(sid, sess);
      audit(`${role} login${role === 'admin' ? ': ' + id : ''}`); save();
      return send(res, 200, { role, id, csrf: sess.csrf },
        { 'Set-Cookie': `sid=${sid}; HttpOnly; SameSite=Strict; Path=/` });
    }
    case 'POST /api/logout': {
      const m = /sid=([a-f0-9]+)/.exec(req.headers.cookie || '');
      if (m) sessions.delete(m[1]);
      return send(res, 200, { ok: true }, { 'Set-Cookie': 'sid=; Max-Age=0; Path=/' });
    }
    case 'GET /api/me':
      return send(res, 200, s ? { role: s.role, id: s.id, csrf: s.csrf } : {});

    case 'GET /api/election': {
      if (!s) return fail(res, 401, 'Sign in first');
      const e = db.election;
      const out = { title: e.title, status: e.status, published: e.published };
      if (s.role === 'voter') {
        out.hasVoted = db.voters[s.id].hasVoted;
        out.candidates = out.hasVoted || e.status !== 'open' ? [] : shuffle(db.candidates);
      }
      if (e.published) out.results = tally();
      return send(res, 200, out);
    }
    case 'POST /api/vote': {
      if (!s || s.role !== 'voter') return fail(res, 401, 'Sign in as a voter');
      const voter = db.voters[s.id];
      const cand = db.candidates.find(c => c.id === Number(body.candidateId));
      if (db.election.status !== 'open' || voter.hasVoted || !cand)
        return fail(res, 400, 'Your vote could not be recorded');
      // Node runs this block without interruption, so check + insert + flag is atomic.
      const receipt = crypto.randomBytes(8).toString('hex');
      db.ballots.push({ receipt, candidateId: cand.id });
      voter.hasVoted = true;
      audit(`Ballot recorded, receipt ${receipt}`); save();
      return send(res, 200, { receipt });
    }
    case 'POST /api/verify': {
      const found = db.ballots.some(b => b.receipt === String(body.receipt || '').trim());
      return send(res, 200, { found });
    }
  }

  // ---- admin only
  if (url.startsWith('/api/admin/')) {
    if (!s || s.role !== 'admin') return fail(res, 401, 'Sign in as administrator');
    const e = db.election;
    switch (route) {
      case 'GET /api/admin/state': {
        const voters = Object.entries(db.voters).map(([id, v]) => ({ id, hasVoted: v.hasVoted }))
          .sort((a, b) => a.id.localeCompare(b.id));
        return send(res, 200, {
          election: e, candidates: db.candidates.map(c => c.name), voters,
          voted: voters.filter(v => v.hasVoted).length,
          results: e.status === 'closed' ? tally() : null,        // hidden until closed
          audit: db.audit.slice(-30).reverse(),
        });
      }
      case 'POST /api/admin/setup': {
        if (e.status !== 'draft') return fail(res, 400, 'Setup is locked once voting has opened');
        const names = [...new Set(String(body.candidates || '').split('\n').map(x => x.trim()).filter(Boolean))];
        const title = String(body.title || '').trim().slice(0, 100);
        if (!title || names.length < 2) return fail(res, 400, 'Enter a title and at least two different options');
        e.title = title;
        db.candidates = names.slice(0, 50).map((name, i) => ({ id: i + 1, name: name.slice(0, 80) }));
        audit('Election configured'); save();
        return send(res, 200, { ok: true });
      }
      case 'POST /api/admin/status': {
        const a = body.action;
        if (a === 'open' && e.status === 'draft') e.status = 'open';
        else if (a === 'close' && e.status === 'open') e.status = 'closed';
        else if (a === 'publish' && e.status === 'closed') e.published = true;
        else return fail(res, 400, 'That action is not available right now');
        audit(`Admin action: ${a}`); save();
        return send(res, 200, { ok: true });
      }
      case 'POST /api/admin/voters': {
        const id = String(body.id || '').trim().slice(0, 40), pw = String(body.password || '');
        if (!id || pw.length < 6) return fail(res, 400, 'Voter ID and a password of 6+ characters are required');
        if (db.voters[id]) return fail(res, 400, 'That voter ID already exists');
        db.voters[id] = { hash: hashPw(pw), hasVoted: false };
        audit('Voter registered'); save();
        return send(res, 200, { ok: true });
      }
      case 'POST /api/admin/verify-audit': {
        const bad = verifyChain();
        return send(res, 200, { ok: !bad, message: bad ? `Audit log was altered at entry #${bad}` : 'Audit log is intact' });
      }
    }
  }
  return fail(res, 404, 'Not found');
}

// --------------------------------------------------------- static files
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
function serveStatic(res, urlPath) {
  const file = path.normalize(path.join(PUBLIC, urlPath === '/' ? 'index.html' : urlPath));
  if (!file.startsWith(PUBLIC + path.sep)) return fail(res, 403, 'Forbidden');
  fs.readFile(file, (err, data) => {
    if (err) return fail(res, 404, 'Not found');
    send(res, 200, data, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
  });
}

initDb();
http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost').pathname;
    if (url.startsWith('/api/')) await api(req, res, url);
    else serveStatic(res, url);
  } catch (err) {
    fail(res, 400, err.message === 'too large' ? 'Request too large' : 'Bad request');
  }
}).listen(PORT, () => console.log(`Voting system running at http://localhost:${PORT}`));
