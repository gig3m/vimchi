import { describe, expect, it } from 'vitest';
import { MAX_RUN_TIME, clampRun } from '../store';
import type { Run } from '../store';

const run = (time: number): Run => ({ lesson: 'hjkl', at: 1_800_000_000_000, time, keys: 4, speed: 1, acc: 1, correct: 1, score: 100 });

describe('clampRun', () => {
  it('caps the time at the server limit (24 h), so a tab left open overnight still saves the run', () => {
    expect(MAX_RUN_TIME).toBe(24 * 60 * 60 * 1000);
    expect(clampRun(run(30 * 60 * 60 * 1000)).time).toBe(MAX_RUN_TIME);
    expect(clampRun(run(5000))).toEqual(run(5000));
  });
});
