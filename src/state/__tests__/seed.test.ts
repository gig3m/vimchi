import { describe, expect, it } from 'vitest';
import { isWarmUpHash, lessonIdFromHash, repsFromHash, repsHref, seedFromHash, warmUpHref } from '../seed';

describe('seed in hash', () => {
  it('parses a valid seed', () => {
    expect(seedFromHash('#challenge-fix-the-file?seed=12345')).toBe(12345);
    expect(seedFromHash('#/challenge-fix-the-file?seed=0')).toBe(0);
  });
  it('rejects garbage', () => {
    expect(seedFromHash('#challenge-fix-the-file')).toBeNull();
    expect(seedFromHash('#x?seed=abc')).toBeNull();
    expect(seedFromHash('#x?seed=-1')).toBeNull();
    expect(seedFromHash('#x?seed=4294967296')).toBeNull();
    expect(seedFromHash('#x?seed=1.5')).toBeNull();
  });
  it('strips the query from the lesson id', () => {
    expect(lessonIdFromHash('#challenge-operators?seed=7')).toBe('challenge-operators');
    expect(lessonIdFromHash('#/x')).toBe('x');
    expect(lessonIdFromHash('')).toBe('');
  });
});

describe('reps in hash', () => {
  it('parses a reps seed', () => {
    expect(repsFromHash('#delete-words?reps=42')).toBe(42);
    expect(repsFromHash('#/delete-words?reps=0')).toBe(0);
    expect(lessonIdFromHash('#delete-words?reps=42')).toBe('delete-words');
  });
  it('is null without reps or with garbage, and does not read seed=', () => {
    expect(repsFromHash('#delete-words')).toBeNull();
    expect(repsFromHash('#delete-words?seed=5')).toBeNull();
    expect(repsFromHash('#x?reps=abc')).toBeNull();
    expect(repsFromHash('#x?reps=4294967296')).toBeNull();
    expect(seedFromHash('#x?reps=5')).toBeNull();
  });
  it('round-trips through repsHref', () => {
    expect(repsHref('word-objects', 99)).toBe('#word-objects?reps=99');
    expect(repsFromHash(repsHref('word-objects', 99))).toBe(99);
  });
});

describe('warm-up in hash', () => {
  it('routes #warm-up with and without a seed', () => {
    expect(isWarmUpHash('#warm-up')).toBe(true);
    expect(isWarmUpHash('#/warm-up?seed=9')).toBe(true);
    expect(isWarmUpHash('#warm-up-reps')).toBe(false);
    expect(isWarmUpHash('#delete-words')).toBe(false);
    expect(warmUpHref()).toBe('#warm-up');
    expect(warmUpHref(9)).toBe('#warm-up?seed=9');
    expect(seedFromHash(warmUpHref(4294967295))).toBe(4294967295);
  });
});
