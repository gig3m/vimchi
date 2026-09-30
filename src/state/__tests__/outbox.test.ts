import { beforeEach, describe, expect, it } from 'vitest';
import { ApiError, classify } from '../api';
import { flushOutbox, loadOutbox, pushOutbox, removeOutbox, takeOutbox } from '../outbox';
import type { Run } from '../store';

/** vitest runs in node: a minimal localStorage stand-in. */
const mem = new Map<string, string>();
(globalThis as { localStorage?: Storage }).localStorage = {
  getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v),
  removeItem: (k: string) => void mem.delete(k), clear: () => mem.clear(), key: () => null, length: 0,
} as Storage;

const run = (at: number): Run => ({ lesson: 'hjkl', at, time: 1000, keys: 4, speed: 1, acc: 1, correct: 1, score: 100 });

describe('outbox', () => {
  beforeEach(() => mem.clear());
  it('persists runs until they are removed', () => {
    pushOutbox(run(1)); pushOutbox(run(2));
    expect(loadOutbox().map(r => r.at)).toEqual([1, 2]);
    removeOutbox(run(1));
    expect(loadOutbox().map(r => r.at)).toEqual([2]);
  });
  it('flush removes what the server accepted and keeps what it did not', async () => {
    pushOutbox(run(1)); pushOutbox(run(2)); pushOutbox(run(3));
    const seen: number[] = [];
    const r = await flushOutbox(async run => { seen.push(run.at); if (run.at === 2) throw new ApiError(500, 'boom'); });
    expect(seen).toEqual([1, 2, 3]);
    expect(r).toEqual({ status: 'retry', retryAfter: 0 });
    expect(loadOutbox().map(x => x.at)).toEqual([2]);
  });
  it('flush stops on 401 and reports it; the runs stay for the guest import', async () => {
    pushOutbox(run(1)); pushOutbox(run(2));
    const r = await flushOutbox(async () => { throw new ApiError(401, 'unauthorized'); });
    expect(r.status).toBe('unauthorized');
    expect(loadOutbox().length).toBe(2);
    expect(takeOutbox().map(x => x.at)).toEqual([1, 2]);
    expect(loadOutbox()).toEqual([]);
  });
  it('flush honours Retry-After on 429 and stops', async () => {
    pushOutbox(run(1)); pushOutbox(run(2));
    let calls = 0;
    const r = await flushOutbox(async () => { calls++; throw new ApiError(429, 'slow down', 7); });
    expect(calls).toBe(1);
    expect(r).toEqual({ status: 'retry', retryAfter: 7 });
    expect(loadOutbox().length).toBe(2);
  });
  it('flush of an empty outbox is ok', async () => {
    expect(await flushOutbox(async () => {})).toEqual({ status: 'ok', retryAfter: 0 });
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
