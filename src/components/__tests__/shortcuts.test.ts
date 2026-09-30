import { describe, expect, it } from 'vitest';
import { resultsShortcut, type ShortcutCtx } from '../shortcuts';

const lesson: ShortcutCtx = { inReps: false, inWarmUp: false, hasReps: true, hasSeed: true, hasNext: true };
const reps: ShortcutCtx = { ...lesson, inReps: true };
const warmUp: ShortcutCtx = { inReps: false, inWarmUp: true, hasReps: false, hasSeed: true, hasNext: false };

describe('resultsShortcut', () => {
  it('lesson results: n goes to the next lesson, f gives a new file, p opens Reps', () => {
    expect(resultsShortcut('n', lesson)).toBe('next');
    expect(resultsShortcut('f', lesson)).toBe('new-file');
    expect(resultsShortcut('p', lesson)).toBe('reps');
    expect(resultsShortcut('<CR>', lesson)).toBe('restart');
    expect(resultsShortcut('r', lesson)).toBe('restart');
    expect(resultsShortcut('s', lesson)).toBe('stats');
  });

  it('n does nothing without a next lesson', () => {
    expect(resultsShortcut('n', { ...lesson, hasNext: false })).toBeNull();
  });

  it('Reps results: n does nothing though the lesson has a next one (no Next button is shown)', () => {
    expect(resultsShortcut('n', reps)).toBeNull();
  });

  it('Reps results: Enter/a is another Reps seed, f too, b leaves Reps, p is inert', () => {
    expect(resultsShortcut('<CR>', reps)).toBe('reps-again');
    expect(resultsShortcut('a', reps)).toBe('reps-again');
    expect(resultsShortcut('f', reps)).toBe('reps-again');
    expect(resultsShortcut('b', reps)).toBe('back-to-lesson');
    expect(resultsShortcut('p', reps)).toBeNull();
  });

  it('Warm-up results: f is a whole new Warm-up (new seed in the hash), not a re-roll of the same file', () => {
    expect(resultsShortcut('f', warmUp)).toBe('warm-up-again');
  });

  it('f does nothing on an authored (unseeded) challenge', () => {
    expect(resultsShortcut('f', { ...lesson, hasSeed: false })).toBeNull();
  });

  it('unmapped keys do nothing', () => {
    expect(resultsShortcut('x', lesson)).toBeNull();
  });
});
