import { describe, expect, it } from 'vitest';
import { mulberry32, pick, randInt, shuffle } from '../rng';

describe('mulberry32', () => {
  it('is deterministic per seed', () => {
    const a = mulberry32(42), b = mulberry32(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
  it('differs across seeds', () => {
    expect(mulberry32(1)()).not.toBe(mulberry32(2)());
  });
  it('stays in [0,1)', () => {
    const r = mulberry32(7);
    for (let i = 0; i < 1000; i++) { const v = r(); expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThan(1); }
  });
  it('randInt is inclusive on both ends', () => {
    const r = mulberry32(3); const seen = new Set<number>();
    for (let i = 0; i < 500; i++) seen.add(randInt(r, 2, 4));
    expect([...seen].sort()).toEqual([2, 3, 4]);
  });
  it('shuffle is a permutation and does not mutate', () => {
    const src = [1, 2, 3, 4, 5]; const out = shuffle(mulberry32(9), src);
    expect(src).toEqual([1, 2, 3, 4, 5]);
    expect([...out].sort()).toEqual(src);
  });
  it('pick returns an element', () => {
    expect(['a', 'b']).toContain(pick(mulberry32(1), ['a', 'b']));
  });
});
