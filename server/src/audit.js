import { EventEmitter } from 'events';
import { Audit } from './models.js';
import { sha256 } from './crypto.js';

export const bus = new EventEmitter();

const digest = (a) =>
  sha256(`${a.seq}|${a.action}|${a.actor}|${JSON.stringify(a.details ?? {})}|${new Date(a.at).toISOString()}|${a.prevHash}`);

// Entries are appended one at a time so the hash chain never forks.
let queue = Promise.resolve();

export function log(action, actor, details = {}) {
  queue = queue
    .then(async () => {
      const last = await Audit.findOne().sort({ seq: -1 });
      const entry = {
        seq: (last?.seq ?? 0) + 1,
        action,
        actor,
        details,
        at: new Date(),
        prevHash: last?.hash ?? 'GENESIS',
      };
      entry.hash = digest(entry);
      const doc = await Audit.create(entry);
      bus.emit('audit', doc);
    })
    .catch((e) => console.error('Audit write failed:', e));
  return queue;
}

export async function verifyChain() {
  const all = await Audit.find().sort({ seq: 1 });
  let prev = 'GENESIS';
  for (const a of all) {
    if (a.prevHash !== prev || a.hash !== digest(a)) {
      return { ok: false, checked: all.length, brokenAt: a.seq };
    }
    prev = a.hash;
  }
  return { ok: true, checked: all.length };
}
