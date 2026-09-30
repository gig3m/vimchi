// The Warm-up challenge: one generated file mixing the picked lessons' Reps kinds, with a size
// of 8–10 edits, solvable by its par keys, and chosen so as many picked lessons as possible
// get an edit.
import { describe, expect, it } from 'vitest';
import { generate } from '../../challenges/generate';
import { repsChallenge } from '../../challenges/reps';
import { mulberry32, shuffle } from '../../challenges/rng';
import { createVim } from '../../lessons/runtime';
import { parseKeys } from '../../vim/keys';
import { coverage, warmUpChallenge } from '../build';
import { REPS_LESSONS, type WarmUpPick } from '../select';

const picksOf = (seed: number, n: number): WarmUpPick[] =>
  shuffle(mulberry32(seed), REPS_LESSONS).slice(0, n).map((lesson, i) => ({ lesson, seed: seed + i, due: true, ago: 1 }));
const CASES = Array.from({ length: 40 }, (_, i) => ({ picks: picksOf(i + 1, [1, 3, 8, 9, 10][i % 5]), seed: i * 7919 + 3 }));

describe('warmUpChallenge', () => {
  it('refuses an empty set', () => {
    expect(() => warmUpChallenge([], 1)).toThrow();
  });
  it('is a generated mix of the picks\' Reps kinds, sections and plugins', () => {
    const { picks, seed } = CASES[2];
    const c = warmUpChallenge(picks, seed);
    const reps = picks.map(p => repsChallenge(p.lesson));
    expect(c.kind).toBe('generated');
    expect(c.drill).toBeFalsy();
    expect(new Set(c.mutations)).toEqual(new Set(reps.flatMap(r => r.mutations)));
    expect(new Set(c.sections)).toEqual(new Set(reps.flatMap(r => r.sections)));
    expect(new Set(c.plugins ?? [])).toEqual(new Set(reps.flatMap(r => r.plugins ?? [])));
    expect(c.corpus.length).toBe(1);
    expect(warmUpChallenge(picks, seed)).toBe(c); // cached: Practice keys its session on identity
  });
  it('runs 8–10 edits on its seed and is deterministic', () => {
    for (const { picks, seed } of CASES) {
      const c = warmUpChallenge(picks, seed);
      const g = generate(c, seed);
      expect(g.items.length, picks.map(p => p.lesson.id).join()).toBeGreaterThanOrEqual(8);
      expect(g.items.length).toBeLessThanOrEqual(10);
      expect(generate(c, seed)).toEqual(g);
    }
  });
  it('covers most picked lessons on its seed', () => {
    let hit = 0, total = 0;
    for (const { picks, seed } of CASES) {
      const c = warmUpChallenge(picks, seed);
      const cov = coverage(picks, generate(c, seed));
      hit += cov; total += picks.length;
      expect(cov, picks.map(p => p.lesson.id).join()).toBeGreaterThanOrEqual(Math.min(picks.length, 1));
    }
    process.stderr.write(`\nwarm-up lesson coverage: ${hit}/${total} (${((100 * hit) / total).toFixed(1)}%)\n`);
    expect(hit / total).toBeGreaterThanOrEqual(0.7);
  });
  it('is solved by its par keys', () => {
    for (const { picks, seed } of CASES) {
      const c = warmUpChallenge(picks, seed);
      const g = generate(c, seed);
      const vim = createVim({ text: g.start, name: g.file, plugins: c.plugins });
      let keys = 0;
      for (const item of g.items) {
        vim.win.cursor = { line: item.fixAt.line + vim.buf.lines.length - g.start.length, col: item.fixAt.col };
        for (const k of parseKeys(item.fixKeys)) vim.feed(k);
        keys += parseKeys(item.fixKeys).length;
      }
      expect(vim.mode).toBe('normal');
      expect(vim.buf.lines, `seed ${seed}`).toEqual(g.goal);
      expect(keys).toBeLessThanOrEqual(g.parKeys);
    }
  });
});
