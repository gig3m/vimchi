import { describe, expect, it } from 'vitest';
import { diffGoal } from '../goalDiff';

const inline = (cur: string[], goal: string[]) => {
  const v = diffGoal(cur, goal);
  if (v.mode !== 'inline') throw new Error('expected inline, got ' + v.mode);
  return v.ann;
};

describe('diffGoal', () => {
  it('pure insertion is ghost text at the spot', () => {
    const a = inline(['a', "log('Helo')", 'b'], ['a', "log('Hello')", 'b']);
    expect(a.ins.get(1)).toEqual([{ col: 8, text: 'l' }]);
    expect(a.del.size).toBe(0);
  });
  it('replacement strikes the whole word and ghosts the new one', () => {
    const a = inline(['x', 'let total = 1', 'y'], ['x', 'const total = 1', 'y']);
    expect(a.del.get(1)).toEqual([[0, 2]]);
    expect(a.ins.get(1)).toEqual([{ col: 0, text: 'const' }]);
  });
  it('new line goes after the previous line', () => {
    const a = inline(['birds:', '  jay', 'mammals:'], ['birds:', '  emu', '  jay', 'mammals:']);
    expect(a.newLines.get(0)).toEqual(['  emu']);
  });
  it('two lines replaced by a different one are whole lines out and in, not a retype', () => {
    const a = inline(['app.use(auth);', 'app.get("/a", legacyA);', 'app.get("/b", legacyB);', 'app.listen(3000);'], ['app.use(auth);', 'app.use("/api", router);', 'app.listen(3000);']);
    expect([...a.delLines]).toEqual([1, 2]);
    expect(a.newLines.get(2)).toEqual(['app.use("/api", router);']);
    expect(a.del.size + a.ins.size).toBe(0);
  });
  it('a line being typed into the block stays an edit, not a struck line', () => {
    const goal = ['app.use(auth);', 'app.use("/api", router);', 'app.listen(3000);'];
    for (const typed of ['', 'app.', 'app.use(']) {
      const a = inline(['app.use(auth);', typed, 'app.get("/b", legacyB);', 'app.listen(3000);'], goal);
      expect(a.delLines.has(1), JSON.stringify(typed)).toBe(false);
      expect(a.ins.get(1)?.length, JSON.stringify(typed)).toBe(1); // the rest of the line, as ghost text on it
    }
  });
  it('once the block is being typed into, it is the plain pairing again (as before the block view)', () => {
    const goal = ['app.use(auth);', 'app.use("/api", router);', 'app.listen(3000);'];
    const a = inline(['app.use(auth);', 'app.get("/a", legacyA);', '', 'app.listen(3000);'], goal);
    expect([...a.delLines]).toEqual([2]);
    // Word by word, not one retype of the line (a pure insertion stays minimal: "a" + "pi").
    expect(a.ins.get(1)?.map(t => t.text)).toEqual(['use', 'pi', 'router']);
  });
  it('a join is drawn as a join, not as the next line retyped', () => {
    const a = inline(['# Notes', 'This note', 'was wrapped', 'end'], ['# Notes', 'This note was wrapped', 'end']);
    expect([...a.joins!]).toEqual([[1, 'space']]);
    expect(a.ins.size + a.del.size + a.delLines.size).toBe(0);
    const g = inline(['f(', '  a,', '  b)'], ['f(  a,  b)']);
    expect([...g.joins!]).toEqual([[0, 'none'], [1, 'none']]);
  });
  it('a join that also changes text stays an edit', () => {
    const a = inline(['This note', 'was wrapped'], ['This note is wrapped']);
    expect(a.joins!.size).toBe(0);
  });
  it('several changes on one line are each marked', () => {
    const a = inline(['getting started', 'x'], ['Getting Started', 'x']);
    expect(a.ins.get(0)?.map(t => [t.col, t.text, t.kind])).toEqual([[0, 'Getting', 'case'], [8, 'Started', 'case']]);
    expect(a.cases!.get(0)).toEqual([[0, 6], [8, 14]]);
    const p = inline(['return (total);', 'x'], ['return total;', 'x']);
    expect(p.del.get(0)).toEqual([[7, 7], [13, 13]]);
    expect(p.ins.get(0)).toBeUndefined();
  });
  it('swapped quotes are two marks, and a bracketed prefix goes whole', () => {
    const q = inline(["import x from 'express';", 'y'], ['import x from "express";', 'y']);
    expect(q.del.get(0)).toEqual([[14, 14], [22, 22]]);
    const b = inline(['[10:14:02] [INFO] up', 'y'], ['[INFO] up', 'y']);
    expect(b.del.get(0)).toEqual([[0, 10]]);
  });
  it('a word edit stays one edit: cfg becomes config, not two inserts', () => {
    const a = inline(['load(cfg);', 'x'], ['load(config);', 'x']);
    expect(a.del.get(0)).toEqual([[5, 7]]);
    expect(a.ins.get(0)?.map(t => t.text)).toEqual(['config']);
  });
  it('deleting a line between repeated lines is still inline, not a sort', () => {
    const code = ['function a() {', '  return 1;', '}', '', 'function b() {', '  return 2;', '}'];
    expect(diffGoal(code, code.filter((_, i) => i !== 1)).mode).toBe('inline');
    expect(diffGoal(['', 'x', '', 'y'], ['x', '', 'y']).mode).toBe('inline');
    // A copied line is new, not moved.
    expect(diffGoal(['x', 'y', 'z'], ['x', 'x']).mode).toBe('inline');
  });
  it('sorted lines and rewrapped text go to the pane', () => {
    expect(diffGoal(['pear', 'apple', 'fig', 'kiwi', 'date'], ['apple', 'date', 'fig', 'kiwi', 'pear']).mode).toBe('pane');
    expect(diffGoal(['one two three four', 'five six', 'seven'], ['one two three four five', 'six seven']).mode).toBe('pane');
  });
  it('line deletion', () => {
    const a = inline(['a', 'b', 'c'], ['a', 'c']);
    expect([...a.delLines]).toEqual([1]);
  });
  it('big reshuffles fall back to the pane', () => {
    expect(diffGoal(['c', 'a', 'd', 'b', 'f', 'e', 'h', 'g'], ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']).mode).toBe('pane');
    expect(diffGoal(['x', 'y'], ['  x', '  y']).mode).toBe('pane');
  });
  it('a repeated word is struck whole, not across the seam', () => {
    const a = inline(['- [ ] Write the the tests'], ['- [ ] Write the tests']);
    expect(a.del.get(0)).toEqual([[16, 19]]); // the second "the "
  });
  it('a repeated word is ghosted whole', () => {
    const a = inline(['Write the tests'], ['Write the the tests']);
    expect(a.ins.get(0)).toEqual([{ col: 10, text: 'the ' }]);
  });
  it('done means none', () => expect(diffGoal(['a'], ['a']).mode).toBe('none'));
});

describe('diffGoal force', () => {
  const cur = ['a1', 'b', 'c1', 'd', 'e1', 'f', 'g1', 'h', 'i1', 'j'];
  const goal = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'];
  it('falls back to the pane for many hunks by default', () => {
    expect(diffGoal(cur, goal).mode).toBe('pane');
  });
  it('stays inline when forced', () => {
    const v = diffGoal(cur, goal, { force: true });
    expect(v.mode).toBe('inline');
    if (v.mode === 'inline') expect(v.ann.del.size).toBe(5);
  });
  it('a snake_case prefix change marks the prefix, a number change the whole number', () => {
    const v = diffGoal(['x = old_b;', 'n = 1000;'], ['x = new_b;', 'n = 500;'], { force: true });
    if (v.mode !== 'inline') throw new Error(v.mode);
    expect(v.ann.del.get(0)).toEqual([[4, 6]]);
    expect(v.ann.ins.get(0)?.[0].text).toBe('new');
    expect(v.ann.del.get(1)).toEqual([[4, 7]]);
    expect(v.ann.ins.get(1)?.[0].text).toBe('500');
  });
  it('a delete across a line break is one strike over the break', () => {
    const v = diffGoal(['# x', 'Install it. It takes a', 'while. Then run it.', 'end'], ['# x', 'Install it. Then run it.', 'end'], { force: true });
    if (v.mode !== 'inline') throw new Error(v.mode);
    expect(v.ann.del.get(1)).toEqual([[12, 21]]);
    expect(v.ann.del.get(2)).toEqual([[0, 6]]);
    expect(v.ann.ins.size).toBe(0);
  });
  it('a line that keeps little of itself is drawn out and in, not spliced', () => {
    const v = diffGoal(['class C {', '  inc() {', '    this.n++;', '  }', '}'], ['class C {', '  n = 0;', '}'], { force: true });
    if (v.mode !== 'inline') throw new Error(v.mode);
    expect([...v.ann.delLines].sort()).toEqual([1, 2, 3]);
    expect([...v.ann.newLines.values()].flat()).toEqual(['  n = 0;']);
    expect(v.ann.del.size + v.ann.ins.size).toBe(0);
  });
});
