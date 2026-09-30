// Reps file eligibility is a precomputed table (src/challenges/repsTable.ts). These tests pin
// what each lesson's Reps and a set of Warm-ups resolve to, check the table against a live
// recomputation (REPS_TABLE_WRITE=1 rewrites it), and bound the cost of a first open.
import { writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ORDER } from '../../lessons';
import { REPS_LESSONS, type WarmUpPick } from '../../warmup/select';
import { warmUpChallenge } from '../../warmup/build';
import { generate } from '../generate';
import { computeRepsFit, repsChallenge } from '../reps';
import { mulberry32, shuffle } from '../rng';
import { REPS_TABLE } from '../repsTable';

const WITH_REPS = ORDER.filter(l => l.reps);
const ALL = ['lcs.ts', 'quick_select.ts', 'stack.ts', 'query.ts', 'version1.go', 'kmp.go', 'util.go', 'version.lua', 'permissions.lua', 'minicyan.lua'];
const NO_QS = ALL.filter(f => f !== 'quick_select.ts');

// Captured from the live (pre-table) computation on 2026-09-30.
const PINNED: Record<string, { files: string[]; edits: [number, number]; runs: [number, string, number][] }> = {
  'change-words': { files: ALL, edits: [10, 15], runs: [[1, 'util.go', 10], [42, 'util.go', 12], [9001, 'permissions.lua', 12]] },
  'intro-operators': { files: ALL, edits: [10, 15], runs: [[1, 'util.go', 10], [42, 'util.go', 12], [9001, 'permissions.lua', 11]] },
  'delete-words': { files: ALL, edits: [10, 15], runs: [[1, 'util.go', 10], [42, 'util.go', 12], [9001, 'permissions.lua', 11]] },
  'delete-lines': { files: ALL, edits: [10, 15], runs: [[1, 'util.go', 10], [42, 'util.go', 12], [9001, 'permissions.lua', 12]] },
  'repeat-last-change': { files: NO_QS, edits: [10, 15], runs: [[1, 'util.go', 10], [42, 'util.go', 12], [9001, 'permissions.lua', 10]] },
  'counts-operators': { files: ALL, edits: [10, 15], runs: [[1, 'util.go', 10], [42, 'util.go', 12], [9001, 'permissions.lua', 11]] },
  'word-objects': { files: NO_QS, edits: [10, 15], runs: [[1, 'util.go', 10], [42, 'util.go', 12], [9001, 'permissions.lua', 10]] },
  'text-objects-quotes': { files: ['reps.lua'], edits: [10, 15], runs: [[1, 'reps.lua', 10], [42, 'reps.lua', 11], [9001, 'reps.lua', 10]] },
  'text-objects-parens': { files: ['reps.ts', 'reps.go'], edits: [10, 15], runs: [[1, 'reps.go', 10], [42, 'reps.go', 12], [9001, 'reps.go', 12]] },
  'search-forward': { files: NO_QS, edits: [10, 15], runs: [[1, 'util.go', 10], [42, 'util.go', 12], [9001, 'permissions.lua', 11]] },
  'word-under-cursor': { files: NO_QS, edits: [10, 15], runs: [[1, 'util.go', 10], [42, 'util.go', 12], [9001, 'permissions.lua', 11]] },
  'argument-objects': { files: ['reps.ts', 'reps.go'], edits: [10, 15], runs: [[1, 'reps.go', 10], [42, 'reps.go', 12], [9001, 'reps.go', 12]] },
  'indent-objects': { files: ['reps.ts', 'reps.go', 'reps.lua'], edits: [10, 15], runs: [[1, 'reps.go', 10], [42, 'reps.go', 12], [9001, 'reps.lua', 12]] },
  'function-class-objects': { files: ['reps.ts'], edits: [9, 11], runs: [[1, 'reps.ts', 9], [42, 'reps.ts', 9], [9001, 'reps.ts', 9]] },
};

const picksOf = (seed: number, n: number): WarmUpPick[] =>
  shuffle(mulberry32(seed), REPS_LESSONS).slice(0, n).map((lesson, i) => ({ lesson, seed: seed + i, due: true, ago: 1 }));
const WARM_UPS: [number, number, number, string][] = [
  [1, 1, 3, 'reps.ts'], [2, 3, 7922, 'kmp.go'], [3, 8, 15841, 'query.ts'], [4, 9, 23760, 'version.lua'],
  [5, 10, 31679, 'permissions.lua'], [6, 1, 39598, 'minicyan.lua'], [7, 3, 47517, 'quick_select.ts'],
  [8, 8, 55436, 'minicyan.lua'], [9, 9, 63355, 'permissions.lua'], [10, 10, 71274, 'reps.lua'],
  [11, 1, 79193, 'reps.lua'], [12, 3, 87112, 'stack.ts'],
];

describe('reps table: first open is cheap', () => {
  // Runs first, on cold module caches. Before the table these were ~535 ms and ~1,300 ms.
  it('repsChallenge(function-class-objects) on a cold cache runs under 250 ms (was ~556 ms; the bound leaves room for a loaded suite)', () => {
    const t = performance.now();
    repsChallenge(WITH_REPS.find(l => l.id === 'function-class-objects')!);
    expect(performance.now() - t).toBeLessThan(250);
  });
  it('warmUpChallenge with 9 lessons on a cold cache runs under 500 ms (was ~1,755 ms; the bound leaves room for a loaded suite)', () => {
    const picks = shuffle(mulberry32(777), REPS_LESSONS).filter(l => l.id !== 'function-class-objects').slice(0, 9)
      .map((lesson, i) => ({ lesson, seed: i, due: true, ago: 1 }));
    const t = performance.now();
    warmUpChallenge(picks, 424242);
    expect(performance.now() - t).toBeLessThan(500);
  });
});

describe('reps table: behaviour pinned', () => {
  it.each(Object.keys(PINNED))('%s: same files, edits and seeded runs', id => {
    const c = repsChallenge(WITH_REPS.find(l => l.id === id)!);
    expect(c.corpus.map(f => f.name)).toEqual(PINNED[id].files);
    expect(c.edits).toEqual(PINNED[id].edits);
    for (const [seed, file, n] of PINNED[id].runs) {
      const g = generate(c, seed);
      expect([g.file, g.items.length]).toEqual([file, n]);
    }
  });
  it('covers every lesson with reps', () => {
    expect(Object.keys(PINNED).sort()).toEqual(WITH_REPS.map(l => l.id).sort());
  });
  it.each(WARM_UPS)('warm-up picks(%i, %i) on seed %i runs %s', (ps, n, seed, file) => {
    expect(warmUpChallenge(picksOf(ps, n), seed).corpus[0].name).toBe(file);
  });
});

describe('reps table: matches a live recomputation', () => {
  it('every lesson with reps', () => {
    const live = Object.fromEntries(WITH_REPS.map(l => [l.id, computeRepsFit(l)]));
    if (process.env.REPS_TABLE_WRITE) {
      const rows = Object.entries(live).map(([id, v]) => `  ${JSON.stringify(id)}: { files: ${JSON.stringify(v.files)}, edits: [${v.edits.join(', ')}] },`);
      writeFileSync(new URL('../repsTable.ts', import.meta.url), HEADER + rows.join('\n') + '\n};\n');
      return; // the imported table is the old one until the next run
    }
    expect(live).toEqual(REPS_TABLE);
  }, 30_000);
});

const HEADER = `// GENERATED by src/challenges/__tests__/repsTable.test.ts — do not edit by hand.
// Regenerate after changing the corpus, a Reps kind or a lesson's reps spec:
//   REPS_TABLE_WRITE=1 npx vitest run src/challenges/__tests__/repsTable.test.ts
// Per lesson: the corpus files (by name, in order) a Reps run may draw on, and its edit range.
// Computing this live costs up to ~0.5 s per lesson (8 probe seeds x every file), so the first
// Reps or Warm-up open would block the main thread; the test above keeps it in sync.
export type RepsFit = { files: string[]; edits: [number, number] };

export const REPS_TABLE: Record<string, RepsFit> = {
`;
