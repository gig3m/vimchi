import { describe, expect, it } from 'vitest';
import { lessonIdFromHash, seedFromHash } from '../seed';

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
