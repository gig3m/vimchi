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
    expect(a.ins.get(1)?.length).toBe(1);
  });
  it('a join keeps its first line and stays an edit', () => {
    const a = inline(['# Notes', 'This note', 'was wrapped', 'end'], ['# Notes', 'This note was wrapped', 'end']);
    expect(a.ins.get(1)).toEqual([{ col: 9, text: ' was wrapped' }]);
    expect([...a.delLines]).toEqual([2]);
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
});
