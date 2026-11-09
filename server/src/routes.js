import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { User, Election, Participation, Ballot, Audit } from './models.js';
import { requireAuth, requireAdmin, signToken } from './auth.js';
import { encrypt, decrypt, sha256, newReceipt } from './crypto.js';
import { log, verifyChain, bus } from './audit.js';

const r = Router();
const wrap = (fn) => (req, res, next) => fn(req, res, next).catch(next);
const bad = (msg, status = 400) => Object.assign(new Error(msg), { status });
const admin = [requireAuth, requireAdmin];

const statusOf = (e) => {
  const now = Date.now();
  if (now < e.startsAt) return 'upcoming';
  return now <= e.endsAt ? 'open' : 'closed';
};

const present = (e, voted = false) => ({
  id: e.id,
  title: e.title,
  description: e.description,
  kind: e.kind,
  startsAt: e.startsAt,
  endsAt: e.endsAt,
  status: statusOf(e),
  resultsPublished: e.resultsPublished,
  options: e.options.map((o) => ({ id: o.id, name: o.name, description: o.description })),
  results: e.resultsPublished ? e.results : undefined,
  totalVotes: e.resultsPublished ? e.totalVotes : undefined,
  voted,
});

function parseWindow(b) {
  const startsAt = new Date(b.startsAt);
  const endsAt = new Date(b.endsAt);
  if (isNaN(startsAt) || isNaN(endsAt)) throw bad('Enter a valid start and end time.');
  if (endsAt <= startsAt) throw bad('The end time must be after the start time.');
  return { startsAt, endsAt };
}

/* ---------- auth ---------- */
r.post('/auth/login', wrap(async (req, res) => {
  const { voterId, password } = req.body || {};
  const id = String(voterId || '').trim().toLowerCase();
  const u = await User.findOne({ voterId: id });
  const ok = u && u.active && (await bcrypt.compare(String(password || ''), u.passwordHash));
  if (!ok) {
    await log('LOGIN_FAILED', id || 'unknown');
    throw bad('Voter ID or password is incorrect.', 401);
  }
  await log('LOGIN', u.voterId, { role: u.role });
  res.json({ token: signToken(u), user: { id: u.id, voterId: u.voterId, name: u.name, role: u.role } });
}));

/* ---------- voter ---------- */
r.get('/elections', requireAuth, wrap(async (req, res) => {
  const [els, mine] = await Promise.all([
    Election.find().sort({ startsAt: -1 }),
    Participation.find({ user: req.user.id }).select('election'),
  ]);
  const voted = new Set(mine.map((p) => String(p.election)));
  res.json(els.map((e) => present(e, voted.has(e.id))));
}));

r.get('/elections/:id', requireAuth, wrap(async (req, res) => {
  const e = await Election.findById(req.params.id);
  if (!e) throw bad('Election not found.', 404);
  const voted = !!(await Participation.exists({ election: e._id, user: req.user.id }));
  res.json(present(e, voted));
}));

r.post('/elections/:id/vote', requireAuth, wrap(async (req, res) => {
  const [u, e] = await Promise.all([User.findById(req.user.id), Election.findById(req.params.id)]);
  if (!u?.active) throw bad('Your voter account is not active.', 403);
  if (u.role !== 'voter') throw bad('Admin accounts cannot vote.', 403);
  if (!e) throw bad('Election not found.', 404);
  if (statusOf(e) !== 'open') throw bad('This election is not open for voting.');
  const option = e.options.id(req.body?.optionId);
  if (!option) throw bad('Choose one of the listed options.');

  try {
    await Participation.create({ election: e._id, user: u._id });
  } catch (err) {
    if (err.code === 11000) throw bad('You have already voted in this election.', 409);
    throw err;
  }

  const receipt = newReceipt();
  try {
    const payload = JSON.stringify({ optionId: option.id, nonce: crypto.randomBytes(8).toString('hex') });
    await Ballot.create({ election: e._id, ...encrypt(payload), receiptHash: sha256(receipt) });
  } catch (err) {
    await Participation.deleteOne({ election: e._id, user: u._id });
    throw err;
  }

  await log('VOTE_CAST', u.voterId, { election: e.id }); // who voted, never what
  res.status(201).json({ receipt, castAt: new Date() });
}));

r.get('/elections/:id/receipt/:code', requireAuth, wrap(async (req, res) => {
  const hash = sha256(req.params.code.trim().toUpperCase());
  const found = await Ballot.exists({ election: req.params.id, receiptHash: hash });
  res.json({ counted: !!found });
}));

/* ---------- admin: voters ---------- */
r.get('/admin/voters', ...admin, wrap(async (req, res) => {
  const list = await User.find({ role: 'voter' }).sort({ createdAt: -1 }).select('-passwordHash');
  res.json(list.map((u) => ({ id: u.id, voterId: u.voterId, name: u.name, email: u.email, active: u.active })));
}));

r.post('/admin/voters', ...admin, wrap(async (req, res) => {
  const { voterId, name, email, password } = req.body || {};
  if (!voterId?.trim() || !name?.trim()) throw bad('Voter ID and name are required.');
  if (!password || password.length < 8) throw bad('Password must be at least 8 characters.');
  try {
    const u = await User.create({
      voterId, name, email, role: 'voter',
      passwordHash: await bcrypt.hash(password, 10),
    });
    await log('VOTER_REGISTERED', req.user.voterId, { voterId: u.voterId });
    res.status(201).json({ id: u.id, voterId: u.voterId, name: u.name, email: u.email, active: u.active });
  } catch (err) {
    if (err.code === 11000) throw bad('That voter ID is already registered.', 409);
    throw err;
  }
}));

r.patch('/admin/voters/:id', ...admin, wrap(async (req, res) => {
  const u = await User.findOneAndUpdate(
    { _id: req.params.id, role: 'voter' },
    { active: !!req.body.active },
    { new: true },
  );
  if (!u) throw bad('Voter not found.', 404);
  await log(u.active ? 'VOTER_ACTIVATED' : 'VOTER_DEACTIVATED', req.user.voterId, { voterId: u.voterId });
  res.json({ id: u.id, active: u.active });
}));

/* ---------- admin: elections ---------- */
r.post('/admin/elections', ...admin, wrap(async (req, res) => {
  const b = req.body || {};
  if (!b.title?.trim()) throw bad('Give the election a title.');
  const options = (b.options || [])
    .map((o) => (typeof o === 'string' ? { name: o.trim() } : { name: String(o.name || '').trim(), description: o.description }))
    .filter((o) => o.name);
  if (options.length < 2) throw bad('Add at least two options.');
  const e = await Election.create({
    title: b.title, description: b.description, kind: b.kind === 'proposal' ? 'proposal' : 'candidates',
    options, ...parseWindow(b),
  });
  await log('ELECTION_CREATED', req.user.voterId, { election: e.id, title: e.title });
  res.status(201).json(present(e));
}));

r.patch('/admin/elections/:id/schedule', ...admin, wrap(async (req, res) => {
  const e = await Election.findById(req.params.id);
  if (!e) throw bad('Election not found.', 404);
  if (statusOf(e) === 'closed') throw bad('A closed election cannot be rescheduled.');
  Object.assign(e, parseWindow(req.body || {}));
  await e.save();
  await log('SCHEDULE_CHANGED', req.user.voterId, { election: e.id, startsAt: e.startsAt, endsAt: e.endsAt });
  res.json(present(e));
}));

r.post('/admin/elections/:id/publish', ...admin, wrap(async (req, res) => {
  const e = await Election.findById(req.params.id);
  if (!e) throw bad('Election not found.', 404);
  if (statusOf(e) !== 'closed') throw bad('Results can be published only after voting closes.');
  if (e.resultsPublished) throw bad('Results are already published.');

  const counts = Object.fromEntries(e.options.map((o) => [o.id, 0]));
  const ballots = await Ballot.find({ election: e._id });
  for (const b of ballots) {
    const { optionId } = JSON.parse(decrypt(b));
    if (optionId in counts) counts[optionId]++;
  }
  e.results = e.options.map((o) => ({ optionId: o.id, name: o.name, votes: counts[o.id] }));
  e.totalVotes = ballots.length;
  e.resultsPublished = true;
  await e.save();
  await log('RESULTS_PUBLISHED', req.user.voterId, { election: e.id, totalVotes: e.totalVotes });
  res.json(present(e));
}));

/* ---------- admin: monitoring and audit ---------- */
r.get('/admin/stats', ...admin, wrap(async (req, res) => {
  const eligible = await User.countDocuments({ role: 'voter', active: true });
  const els = await Election.find().sort({ startsAt: -1 });
  const elections = await Promise.all(els.map(async (e) => ({
    id: e.id, title: e.title, status: statusOf(e), resultsPublished: e.resultsPublished,
    votes: await Participation.countDocuments({ election: e._id }),
  })));
  res.json({ eligible, elections, auditEntries: await Audit.countDocuments() });
}));

r.get('/admin/audit', ...admin, wrap(async (req, res) => {
  const list = await Audit.find().sort({ seq: -1 }).limit(100);
  res.json(list.map((a) => ({ seq: a.seq, action: a.action, actor: a.actor, details: a.details, at: a.at, hash: a.hash })));
}));

r.get('/admin/audit/verify', ...admin, wrap(async (req, res) => res.json(await verifyChain())));

r.get('/admin/stream', ...admin, (req, res) => {
  res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
  res.flushHeaders();
  const onAudit = (a) =>
    res.write(`data: ${JSON.stringify({ seq: a.seq, action: a.action, actor: a.actor, details: a.details, at: a.at })}\n\n`);
  bus.on('audit', onAudit);
  const ping = setInterval(() => res.write(': ping\n\n'), 25000);
  req.on('close', () => { bus.off('audit', onAudit); clearInterval(ping); });
});

export default r;
