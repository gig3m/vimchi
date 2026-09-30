import { beforeEach, describe, expect, it } from 'vitest';
import { ApiError, classify } from '../api';
import { flushOutbox, loadOutbox, pushOutbox, removeOutbox, resetOutboxMirror, takeOutbox } from '../outbox';

const A = 'alice', B = 'bob';
import type { Run } from '../store';
import { MAX_RUN_TIME } from '../store';

/** vitest runs in node: a minimal localStorage stand-in. */
const mem = new Map<string, string>();
(globalThis as { localStorage?: Storage }).localStorage = {
  getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v),
  removeItem: (k: string) => void mem.delete(k), clear: () => mem.clear(), key: () => null, length: 0,
} as Storage;

const run = (at: number): Run => ({ lesson: 'hjkl', at, time: 1000, keys: 4, speed: 1, acc: 1, correct: 1, score: 100 });

describe('outbox', () => {
  beforeEach(() => { mem.clear(); resetOutboxMirror(); });
  it('persists runs until they are removed', () => {
    pushOutbox(A, run(1)); pushOutbox(A, run(2));
    expect(loadOutbox(A).map(r => r.at)).toEqual([1, 2]);
    removeOutbox(A, run(1));
    expect(loadOutbox(A).map(r => r.at)).toEqual([2]);
  });
  it('flush clamps a stored run over the server limit instead of sending it as is', async () => {
    pushOutbox(A, { ...run(1), time: 30 * 60 * 60 * 1000 });
    const sent: number[] = [];
    const r = await flushOutbox(A, async run => { sent.push(run.time); });
    expect(sent).toEqual([MAX_RUN_TIME]);
    expect(r.status).toBe('ok');
    expect(loadOutbox(A)).toEqual([]);
  });
  it('flush removes what the server accepted and keeps what it did not', async () => {
    pushOutbox(A, run(1)); pushOutbox(A, run(2)); pushOutbox(A, run(3));
    const seen: number[] = [];
    const r = await flushOutbox(A, async run => { seen.push(run.at); if (run.at === 2) throw new ApiError(500, 'boom'); });
    expect(seen).toEqual([1, 2, 3]);
    expect(r).toEqual({ status: 'retry', retryAfter: 0 });
    expect(loadOutbox(A).map(x => x.at)).toEqual([2]);
  });
  it('flush stops on 401 and reports it; the runs stay for the guest import', async () => {
    pushOutbox(A, run(1)); pushOutbox(A, run(2));
    const r = await flushOutbox(A, async () => { throw new ApiError(401, 'unauthorized'); });
    expect(r.status).toBe('unauthorized');
    expect(loadOutbox(A).length).toBe(2);
    expect(takeOutbox(A).map(x => x.at)).toEqual([1, 2]);
    expect(loadOutbox(A)).toEqual([]);
  });
  it('flush honours Retry-After on 429 and stops', async () => {
    pushOutbox(A, run(1)); pushOutbox(A, run(2));
    let calls = 0;
    const r = await flushOutbox(A, async () => { calls++; throw new ApiError(429, 'slow down', 7); });
    expect(calls).toBe(1);
    expect(r).toEqual({ status: 'retry', retryAfter: 7 });
    expect(loadOutbox(A).length).toBe(2);
  });
  it('one account never flushes another account\'s runs', async () => {
    pushOutbox(A, run(1)); pushOutbox(B, run(9));
    const sent: number[] = [];
    await flushOutbox(B, async r => { sent.push(r.at); });
    expect(sent).toEqual([9]);
    expect(loadOutbox(A).map(r => r.at)).toEqual([1]);
  });
  it('keeps working in memory when storage throws', async () => {
    const real = (globalThis as { localStorage: Storage }).localStorage;
    (globalThis as { localStorage: Storage }).localStorage = { ...real, setItem: () => { throw new Error('quota'); } } as Storage;
    try {
      pushOutbox('carol', run(5));
      expect(loadOutbox('carol').map(r => r.at)).toEqual([5]);
      const r = await flushOutbox('carol', async () => { throw new ApiError(500, 'down'); });
      expect(r.status).toBe('retry');
      expect(loadOutbox('carol').length).toBe(1);
    } finally { (globalThis as { localStorage: Storage }).localStorage = real; }
  });
  it('a 400 (coach data the server rejects) resends the run without it, instead of retrying forever', async () => {
    const withCoach = { ...run(1), coach: [{ pattern: 'BAD', lesson: 'hjkl', unit: 0, you: 1, better: 0, used: 'motions' as const, at: 1 }], mix: { moving: 1, typing: 0, editing: 0 } };
    pushOutbox(A, withCoach);
    const sent: object[] = [];
    const r = await flushOutbox(A, async x => { sent.push(x); if ('coach' in x && x.coach) throw new ApiError(400, 'HTTP 400'); });
    expect(sent.length).toBe(2);
    expect(sent[1]).toEqual(run(1)); // the run itself, coach and mix stripped
    expect(r).toEqual({ status: 'ok', retryAfter: 0 });
    expect(loadOutbox(A)).toEqual([]);
  });
  it('a run the server rejects even without coach data is dropped, not retried forever', async () => {
    pushOutbox(A, run(1)); pushOutbox(A, run(2));
    let calls = 0;
    const r = await flushOutbox(A, async x => { calls++; if (x.at === 1) throw new ApiError(400, 'HTTP 400'); });
    expect(calls).toBe(2);
    expect(r).toEqual({ status: 'ok', retryAfter: 0 });
    expect(loadOutbox(A)).toEqual([]);
  });
  it('flush of an empty outbox is ok', async () => {
    expect(await flushOutbox(A, async () => {})).toEqual({ status: 'ok', retryAfter: 0 });
  });
});

describe('classify', () => {
  it('turns a response into a typed error with Retry-After', () => {
    const e = classify(429, { get: (h: string) => (h === 'Retry-After' ? '12' : null) });
    expect(e).toBeInstanceOf(ApiError);
    expect(e.status).toBe(429);
    expect(e.retryAfter).toBe(12);
    expect(classify(401, { get: () => null }).status).toBe(401);
  });
});
