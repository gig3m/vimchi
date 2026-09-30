// Runs a signed-in learner finished but the server has not acknowledged yet. They live in
// localStorage until a POST answers 204, so a network blip, a deploy restart, a rate limit or an
// expired session never loses a run. Server dedup on (user, lesson, at) makes resends safe.
import { ApiError } from './api';
import type { Run } from './store';

const KEY = 'vimchi.outbox.v1';
const sameRun = (a: Run, b: Run) => a.lesson === b.lesson && a.at === b.at;

export function loadOutbox(): Run[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(v) ? v : [];
  } catch { return []; }
}
function save(runs: Run[]) {
  try { runs.length ? localStorage.setItem(KEY, JSON.stringify(runs)) : localStorage.removeItem(KEY); } catch { /* tab-only */ }
}
export function pushOutbox(run: Run) { const o = loadOutbox(); if (!o.some(r => sameRun(r, run))) save([...o, run]); }
export function removeOutbox(run: Run) { save(loadOutbox().filter(r => !sameRun(r, run))); }
/** Empty the outbox and return what was in it (for moving runs to the guest list after a 401). */
export function takeOutbox(): Run[] { const o = loadOutbox(); save([]); return o; }

export type FlushResult = { status: 'ok' | 'retry' | 'unauthorized'; retryAfter: number };

/** Send every pending run in order. Stops at a 401 (session gone) or a 429 (wait, then retry). */
export async function flushOutbox(send: (run: Run) => Promise<void>): Promise<FlushResult> {
  let failed = false;
  for (const run of loadOutbox()) {
    try {
      await send(run);
      removeOutbox(run);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) return { status: 'unauthorized', retryAfter: 0 };
      if (e instanceof ApiError && e.status === 429) return { status: 'retry', retryAfter: e.retryAfter };
      failed = true; // keep it, try the next one, and come back later
    }
  }
  return { status: failed ? 'retry' : 'ok', retryAfter: 0 };
}
