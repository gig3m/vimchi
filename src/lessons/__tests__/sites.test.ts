import { describe, expect, it } from 'vitest';
import { diffGoal } from '../goalDiff';
import { applySites, focusTags, solutionSites } from '../sites';
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
  it('a . repeat of a change marks the whole word it retyped, like the change', () => {
    const r = sites(['a = false;', 'b = false;'], 'wwcwtrue<Esc>jb.', ['a = true;', 'b = true;']);
    expect(r.map(s => [s.line, s.del, s.ins])).toEqual([[0, [4, 8], 'true'], [1, [4, 8], 'true']]);
  });
  it('a replacement from :s is the whole word, not the letters that differ', () => {
    const [s] = sites(['debug = True'], ':s/True/False/<CR>', ['debug = False']);
    expect(s).toMatchObject({ del: [8, 11], ins: 'False' });
  });
  it('a punctuation replacement stays punctuation', () => {
    const [s] = sites(['URL=postgres'], ':s/=/: /<CR>', ['URL: postgres']);
    expect(s).toMatchObject({ del: [3, 3], ins: ': ' });
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
    expect(a.ins.get(1)).toEqual([{ col: 3, text: ' ', done: 0, quiet: false }]);
    expect(a.ins.get(2)?.[0].quiet).toBe(true); // only the edit in hand carries a tag
  });
});

describe('applySites for a change and its . on two lines', () => {
  it('ci( then . on the next line keeps both edits, numbered', () => {
    const before = ['greet(user.firstName, user.lastName);', 'track(user.firstName, user.lastName);'];
    const goal = ['greet(user);', 'track(user);'];
    const r = sites(before, 'f(ci(user<Esc>j.', goal);
    const v = diffGoal(before, goal, { force: true });
    if (v.mode !== 'inline') throw new Error(v.mode);
    const a = applySites(v.ann, before, r, 0);
    expect(a.delLines.size + a.newLines.size).toBe(0);
    expect([a.num.get(0), a.num.get(1)]).toEqual([1, 2]);
    expect(a.del.get(0)).toEqual([[6, 34]]);
  });
});

describe('applySites taking back a line drawn out-and-in', () => {
  it('removes the row from its own block, not another with the same text', () => {
    const before = ['inc() {', 'this.n++;', '}', 'same', 'dec() {', 'this.n--;', '}'], goal = ['n = 0;', 'same', 'n = 0;'];
    const v = diffGoal(before, goal, { force: true });
    if (v.mode !== 'inline') throw new Error(v.mode);
    expect([...v.ann.newLines.entries()]).toEqual([[2, ['n = 0;']], [6, ['n = 0;']]]);
    // The first block goes by whole lines (no site); only the second is a cc the site takes back.
    const a = applySites(v.ann, before, sites(before, '3ddOn = 0;<Esc>jjccn = 0;<Esc>j2dd', goal), 0);
    expect([...a.newLines.entries()]).toEqual([[2, ['n = 0;']]]);
    expect([...a.delLines].sort()).toEqual([0, 1, 2, 5, 6]);
  });
});

describe('applySites for repeats on one line', () => {
  it('two matches of a cgn on one line share a 2–3 badge', () => {
    const before = ['a cfg', 'b cfg cfg', 'c cfg'], goal = ['a config', 'b config config', 'c config'];
    const r = sites(before, '/cfg<CR>cgnconfig<Esc>...', goal);
    const v = diffGoal(before, goal, { force: true });
    if (v.mode !== 'inline') throw new Error(v.mode);
    const a = applySites(v.ann, before, r, 0);
    expect([a.num.get(0), a.num.get(1), a.numTo?.get(1), a.num.get(2)]).toEqual([1, 2, 3, 4]);
  });
});

describe('applySites for a cut and a put on one line', () => {
  it('xp strikes the letter and shows where it lands', () => {
    const before = ['  retrun x;'], goal = ['  return x;'];
    const r = sites(before, 'fuhxp', goal);
    const v = diffGoal(before, goal, { force: true });
    if (v.mode !== 'inline') throw new Error(v.mode);
    const a = applySites(v.ann, before, r, 0);
    expect(a.del.get(0)).toEqual([[5, 5]]);
    expect(a.ins.get(0)).toEqual([{ col: 7, text: 'r', done: 0, quiet: false }]);
  });
});

describe('applySites while typing', () => {
  it('keeps the whole text in the tag and counts what is typed', () => {
    const before = ['  const usr = 1;', 'x'];
    const goal = ['  const user = 1;', 'x'];
    const r = sites(before, 'wwcwuser<Esc>', goal);
    for (const [cur, done, struck] of [
      ['  const usr = 1;', 0, true],
      ['  const  = 1;', 0, false],
      ['  const us = 1;', 2, false],
    ] as const) {
      const lines = [cur, 'x'];
      const v = diffGoal(lines, goal, { force: true });
      if (v.mode !== 'inline') throw new Error(v.mode);
      const a = applySites(v.ann, lines, r, 0);
      expect(a.ins.get(0), cur).toEqual([{ col: 8, text: 'user', done, quiet: false }]);
      expect(a.del.has(0), cur).toBe(struck);
    }
  });
});

describe('applySites while retyping the same character', () => {
  it('cl on "=" then "=" reads as 1 of 3 typed, not untouched', () => {
    const before = ['if (a = b) run();'];
    const goal = ['if (a === b) run();'];
    const r = sites(before, 'f=cl===<Esc>', goal);
    const v = diffGoal(before, goal, { force: true });
    if (v.mode !== 'inline') throw new Error(v.mode);
    const typing = { start: { line: 0, col: 6 }, cursor: { line: 0, col: 7 } };
    const a = applySites(v.ann, before, r, 0, typing);
    expect(a.ins.get(0)).toEqual([{ col: 6, text: '===', done: 1, quiet: false }]);
    expect(a.del.has(0)).toBe(false);
    // In normal mode the same text is the untouched line.
    expect(applySites(v.ann, before, r, 0).del.has(0)).toBe(true);
  });
});

describe('focusTags', () => {
  const inline = (cur: string[], goal: string[]) => {
    const v = diffGoal(cur, goal, { force: true });
    if (v.mode !== 'inline') throw new Error(v.mode);
    return v.ann;
  };
  it('a diff tag being typed shows the whole text with the typed part counted', () => {
    // After `o` and typing "fo" of "foo();" on the new line.
    const cur = ['a', '  fo', 'b'];
    const a = focusTags(inline(cur, ['a', '  foo();', 'b']), { line: 1, col: 4 }, { line: 1, col: 2 }, cur);
    expect(a.ins.get(1)).toEqual([{ col: 2, text: 'foo();', done: 2 }]);
  });
  it('only the tag nearest the cursor stays; the rest are quiet', () => {
    const cur = ['x = 1', 'y = 2', 'z = 3'];
    const a = focusTags(inline(cur, ['x = 1;', 'y = 2', 'z = 3;']), { line: 2, col: 0 }, null, cur);
    expect(a.ins.get(0)?.[0].quiet).toBe(true);
    expect(a.ins.get(2)?.[0].quiet).toBeFalsy();
  });
});
