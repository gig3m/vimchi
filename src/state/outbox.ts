// Runs a signed-in learner finished but the server has not acknowledged yet. They live in
// localStorage, keyed by the account, until a POST answers 204, so a network blip, a deploy
// restart, a rate limit or an expired session never loses a run. Server dedup on
// (user, lesson, at) makes resends safe. An in-memory mirror keeps working when storage throws.
import { ApiError } from './api';
import type { CoachFields } from './coach';
import type { Run } from './store';

const KEY = 'vimchi.outbox.v1';
const sameRun = (a: Run, b: Run) => a.lesson === b.lesson && a.at === b.at;
const mirror = new Map<string, Run[]>();
/** Tests only: forget the in-memory mirror so each case starts from storage. */
export function resetOutboxMirror() { mirror.clear(); }

function read(owner: string): Run[] {
  const m = mirror.get(owner);
  if (m) return m;
  let v: unknown = [];
  try { v = JSON.parse(localStorage.getItem(`${KEY}:${owner}`) ?? '[]'); } catch { /* unavailable or corrupt */ }
  const runs = Array.isArray(v) ? (v as Run[]) : [];
  mirror.set(owner, runs);
  return runs;
}
function write(owner: string, runs: Run[]) {
  mirror.set(owner, runs);
  try {
    if (runs.length) localStorage.setItem(`${KEY}:${owner}`, JSON.stringify(runs));
    else localStorage.removeItem(`${KEY}:${owner}`);
  } catch { /* tab-only until storage comes back */ }
}

export function loadOutbox(owner: string): Run[] { return read(owner).slice(); }
export function pushOutbox(owner: string, run: Run) { const o = read(owner); if (!o.some(r => sameRun(r, run))) write(owner, [...o, run]); }
export function removeOutbox(owner: string, run: Run) { write(owner, read(owner).filter(r => !sameRun(r, run))); }
/** Empty the account's outbox and return what was in it (for moving runs to the guest list after a 401). */
export function takeOutbox(owner: string): Run[] { const o = read(owner).slice(); write(owner, []); return o; }

export type FlushResult = { status: 'ok' | 'retry' | 'unauthorized'; retryAfter: number };

/**
 * Send every pending run of the account in order. Stops at a 401 (session gone) or a 429 (wait,
 * then retry). A 400 is the server refusing the run as sent, which no retry changes: like the
 * guest import, the run goes again without its coach data, and one refused even then is dropped.
 */
export async function flushOutbox(owner: string, send: (run: Run) => Promise<void>): Promise<FlushResult> {
  let failed = false;
  for (const run of loadOutbox(owner)) {
    const { coach, mix, ...bare } = run as Run & CoachFields;
    const tries = coach || mix ? [run, bare] : [run];
    for (let i = 0; i < tries.length; i++) {
      try {
        await send(tries[i]);
        removeOutbox(owner, run);
        break;
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) return { status: 'unauthorized', retryAfter: 0 };
        if (e instanceof ApiError && e.status === 429) return { status: 'retry', retryAfter: e.retryAfter };
        if (e instanceof ApiError && e.status === 400) {
          if (i === tries.length - 1) removeOutbox(owner, run); // refused as bare as it gets
          continue;
        }
        failed = true; // keep it, try the next one, and come back later
        break;
      }
    }
  }
  return { status: failed ? 'retry' : 'ok', retryAfter: 0 };
}
