import { describe, expect, it } from 'vitest';
import { resultsShortcut, tabToBrowser, type ShortcutCtx } from '../shortcuts';

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

  it('j / k and the arrows scroll the Better ways list (every key goes to the editor, so it needs its own)', () => {
    expect(resultsShortcut('j', lesson)).toBe('scroll-down');
    expect(resultsShortcut('<Down>', lesson)).toBe('scroll-down');
    expect(resultsShortcut('k', reps)).toBe('scroll-up');
    expect(resultsShortcut('<Up>', warmUp)).toBe('scroll-up');
  });
});

describe('tabToBrowser', () => {
  const at = (o: Partial<Parameters<typeof tabToBrowser>[1]>) => ({ vimWantsTab: false, done: false, quiz: false, ...o });
  it('Results: Tab moves focus on to the result buttons', () => {
    expect(tabToBrowser('<Tab>', at({ done: true }))).toBe(true);
    expect(tabToBrowser('<S-Tab>', at({ done: true, vimWantsTab: true }))).toBe(true);
  });
  it('Normal mode leaves Tab to the browser; Insert, the command line and the quiz keep it', () => {
    expect(tabToBrowser('<Tab>', at({}))).toBe(true);
    expect(tabToBrowser('<Tab>', at({ vimWantsTab: true }))).toBe(false);
    expect(tabToBrowser('<Tab>', at({ quiz: true }))).toBe(false);
    expect(tabToBrowser('x', at({ done: true }))).toBe(false);
  });
});
