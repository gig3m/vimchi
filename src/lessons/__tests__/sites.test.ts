import { describe, expect, it } from 'vitest';
import { diffGoal } from '../goalDiff';
import { applySites, solutionSites } from '../sites';
import type { Round, Setup } from '../types';

const sites = (text: string[], solution: string, goal: string[], cursor = { line: 0, col: 0 }) => {
  const setup: Setup = { text, name: 'a.ts', cursor };
  const round: Round = { goal: { text: goal }, solution };
  return solutionSites(setup, round);
};

describe('solutionSites', () => {
  it('a change keeps the span the operator took and the text typed', () => {
    const [s] = sites(['  const usr = 1;'], 'wwcwuser<Esc>', ['  const user = 1;']);
    expect(s).toMatchObject({ del: [8, 10], ins: 'user', col: 8, num: 0 });
  });
  it('a delete is anchored where the command acted, not where a diff would slide it', () => {
    const [s] = sites(['Write the the tests'], 'wwdw', ['Write the tests']);
    expect(s.del).toEqual([10, 13]);
  });
  it('cc strikes from the indent to the end', () => {
    const [s] = sites(['if x:', "    raise E('bad')", 'y'], 'jccbreak<Esc>', ['if x:', '    break', 'y']);
    expect(s).toMatchObject({ del: [4, 17], ins: 'break', col: 4 });
  });
  it('a change and its . repeats are numbered in order', () => {
    const r = sites(['- [x] a', '- [x] b', '- [x] c'], 'f[lr j.j.', ['- [ ] a', '- [ ] b', '- [ ] c']);
    expect(r.map(s => [s.line, s.num, s.del, s.ins])).toEqual([[0, 1, [3, 3], ' '], [1, 2, [3, 3], ' '], [2, 3, [3, 3], ' ']]);
  });
  it('an append is an insertion at the end', () => {
    const [s] = sites(["x('a')", 'y'], 'A;<Esc>', ["x('a');", 'y']);
    expect(s).toMatchObject({ del: null, ins: ';', col: 6 });
  });
  it('line-level edits are left to the diff', () => {
    expect(sites(['a', 'b', 'c'], 'jdd', ['a', 'c'])).toEqual([]);
  });
});

describe('applySites', () => {
  it('replaces the diff marks on a pending line and numbers repeats; done lines drop out', () => {
    const goal = ['- [ ] a', '- [ ] b', '- [ ] c'];
    const r = sites(['- [x] a', '- [x] b', '- [x] c'], 'f[lr j.j.', goal);
    const cur = ['- [ ] a', '- [x] b', '- [x] c'];
    const v = diffGoal(cur, goal, { force: true });
    if (v.mode !== 'inline') throw new Error(v.mode);
    const a = applySites(v.ann, cur, r, 0);
    expect(a.del.get(0)).toBeUndefined();
    expect(a.num.get(1)).toBe(2);
    expect(a.num.get(2)).toBe(3);
    expect(a.ins.get(1)).toEqual([{ col: 3, text: ' ' }]);
  });
});
