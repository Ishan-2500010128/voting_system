/* Front end: plain JavaScript, talks to the JSON API in server.js.
 * Content-Security-Policy blocks inline scripts, so events use delegation. */
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const S = { me: {}, page: 'main', flash: null, receipt: null, el: null, admin: null, verifyResult: null };

async function api(url, method = 'GET', body) {
  const headers = { 'Content-Type': 'application/json' };
  if (S.me.csrf) headers['X-CSRF-Token'] = S.me.csrf;
  const res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Something went wrong');
  return data;
}
const setFlash = (text, ok = false) => { S.flash = text ? { text, ok } : null; };

async function load() {
  S.me = await api('/api/me');
  if (S.me.role === 'admin') S.admin = await api('/api/admin/state');
  else if (S.me.role === 'voter') S.el = await api('/api/election');
  render();
}

// ---------------------------------------------------------------- views
function loginView() {
  return `<section class="panel narrow"><h1>Sign in</h1>
    <form data-form="login">
      <label>I am a <select name="role"><option value="voter">Voter</option><option value="admin">Administrator</option></select></label>
      <label>ID <input name="id" required autocomplete="username"></label>
      <label>Password <input name="password" type="password" required autocomplete="current-password"></label>
      <button>Sign in</button>
    </form>
    <p class="muted">Demo accounts: voter V001 / vote123, admin / admin123</p></section>`;
}

function resultsView(results, title) {
  const total = results.reduce((n, r) => n + r.votes, 0) || 1;
  return `<section class="panel"><h2>${title}</h2>` + results.map(r =>
    `<p>${esc(r.name)}: <strong>${r.votes}</strong> (${Math.round(r.votes * 100 / total)}%)</p>
     <meter min="0" max="${total}" value="${r.votes}"></meter>`).join('') + `</section>`;
}

function voterView() {
  const e = S.el;
  let h = `<h1>${esc(e.title)}</h1>`;
  if (S.receipt) {
    h += `<section class="panel"><h2>Your vote has been recorded</h2>
      <p>Save this receipt. It proves your ballot was counted without revealing your choice.</p>
      <p class="receipt">${esc(S.receipt)}</p></section>`;
  } else if (e.hasVoted) {
    h += `<section class="panel"><p>You have already voted. Thank you.</p></section>`;
  } else if (e.status === 'open') {
    h += `<section class="panel"><h2>Choose one</h2><form data-form="vote">` +
      e.candidates.map(c => `<label class="choice"><input type="radio" name="c" value="${c.id}" required> ${esc(c.name)}</label>`).join('') +
      `<button>Submit vote</button></form><p class="muted">Votes cannot be changed after submission.</p></section>`;
  } else {
    h += `<section class="panel"><p>Voting is ${e.status === 'draft' ? 'not open yet' : 'closed'}.</p></section>`;
  }
  if (e.results) h += resultsView(e.results, 'Results');
  return h;
}

function adminView() {
  const a = S.admin, e = a.election;
  const dis = c => (c ? 'disabled' : '');
  return `<h1>Administration</h1>
  <section class="panel"><h2>Live monitor</h2>
    <p>Status: <strong>${e.status}</strong>${e.published ? ' (results published)' : ''}</p>
    <p>Turnout: <strong>${a.voted} of ${a.voters.length}</strong> registered voters</p>
    <div class="row">
      <button data-action="open" ${dis(e.status !== 'draft')}>Open voting</button>
      <button data-action="close" ${dis(e.status !== 'open')}>Close voting</button>
      <button data-action="publish" ${dis(e.status !== 'closed' || e.published)}>Publish results</button>
    </div><p class="muted">Tallies stay hidden until voting is closed.</p></section>
  <section class="panel"><h2>Election setup</h2><form data-form="setup">
    <label>Title <input name="title" value="${esc(e.title)}" required></label>
    <label>Candidates or options, one per line <textarea name="candidates" rows="4">${esc(a.candidates.join('\n'))}</textarea></label>
    <button ${dis(e.status !== 'draft')}>Save election</button></form></section>
  ${a.results ? resultsView(a.results, 'Results (admin view)') : ''}
  <section class="panel"><h2>Voters</h2>
    <form data-form="voter" class="row"><input name="id" placeholder="Voter ID" required>
      <input name="password" type="password" placeholder="Password (6+ characters)" required><button>Register voter</button></form>
    <table><tr><th>Voter ID</th><th>Voted</th></tr>${a.voters.map(v => `<tr><td>${esc(v.id)}</td><td>${v.hasVoted ? 'Yes' : 'No'}</td></tr>`).join('')}</table></section>
  <section class="panel"><h2>Audit trail</h2><button data-action="verify-audit">Verify log integrity</button>
    <div class="scroll"><table><tr><th>#</th><th>Time (UTC)</th><th>Event</th><th>Hash</th></tr>
    ${a.audit.map(x => `<tr><td>${x.id}</td><td>${esc(x.ts)}</td><td>${esc(x.event)}</td><td><code>${x.hash.slice(0, 12)}</code></td></tr>`).join('')}</table></div></section>`;
}

function verifyView() {
  const r = S.verifyResult;
  return `<section class="panel narrow"><h1>Verify your receipt</h1>
    <form data-form="verify"><label>Receipt code <input name="receipt" required></label><button>Check</button></form>
    ${r === null ? '' : `<p class="flash ${r ? 'ok' : 'error'}">${r ? 'Found. Your ballot is in the ballot box.' : 'No ballot matches that receipt.'}</p>`}
    <button class="ghost" data-action="back">Back</button></section>`;
}

function render() {
  $('nav').innerHTML = `<button class="ghost" data-action="to-verify">Verify receipt</button>` +
    (S.me.role ? `<button class="ghost" data-action="logout">Sign out</button>` : '');
  const flash = S.flash ? `<p class="flash ${S.flash.ok ? 'ok' : 'error'}">${esc(S.flash.text)}</p>` : '';
  let view;
  if (S.page === 'verify') view = verifyView();
  else if (!S.me.role) view = loginView();
  else view = S.me.role === 'admin' ? adminView() : voterView();
  $('app').innerHTML = flash + view;
}

// ------------------------------------------------------------- handlers
async function run(fn, okMsg) {
  try { await fn(); if (okMsg) setFlash(okMsg, true); else setFlash(null); }
  catch (err) { setFlash(err.message); }
  await load();
}

const forms = {
  login: f => run(async () => { S.me = await api('/api/login', 'POST', Object.fromEntries(f)); S.receipt = null; }),
  vote: f => run(async () => { S.receipt = (await api('/api/vote', 'POST', { candidateId: f.get('c') })).receipt; }),
  setup: f => run(() => api('/api/admin/setup', 'POST', Object.fromEntries(f)), 'Election saved.'),
  voter: f => run(() => api('/api/admin/voters', 'POST', Object.fromEntries(f)), 'Voter registered.'),
  verify: async f => { try { S.verifyResult = (await api('/api/verify', 'POST', { receipt: f.get('receipt') })).found; } catch (e) { setFlash(e.message); } render(); },
};
const actions = {
  logout: () => run(async () => { await api('/api/logout', 'POST'); S.me = {}; S.receipt = null; S.page = 'main'; }),
  'to-verify': () => { S.page = 'verify'; S.verifyResult = null; setFlash(null); render(); },
  back: () => { S.page = 'main'; render(); },
  open: () => run(() => api('/api/admin/status', 'POST', { action: 'open' }), 'Voting is open.'),
  close: () => run(() => api('/api/admin/status', 'POST', { action: 'close' }), 'Voting is closed.'),
  publish: () => run(() => api('/api/admin/status', 'POST', { action: 'publish' }), 'Results published.'),
  'verify-audit': async () => {
    try { const r = await api('/api/admin/verify-audit', 'POST'); setFlash(r.message, r.ok); } catch (e) { setFlash(e.message); }
    render();
  },
};

document.addEventListener('submit', e => {
  const name = e.target.dataset.form;
  if (name && forms[name]) { e.preventDefault(); forms[name](new FormData(e.target)); }
});
document.addEventListener('click', e => {
  const b = e.target.closest('[data-action]');
  if (b && actions[b.dataset.action]) actions[b.dataset.action]();
});

load();
setInterval(() => { if (S.me.role === 'admin' && S.page === 'main' && !document.activeElement.matches('input,textarea')) load(); }, 10000);
