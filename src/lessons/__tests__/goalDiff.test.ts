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
  it('line deletion', () => {
    const a = inline(['a', 'b', 'c'], ['a', 'c']);
    expect([...a.delLines]).toEqual([1]);
  });
  it('big reshuffles fall back to the pane', () => {
    expect(diffGoal(['c', 'a', 'd', 'b', 'f', 'e', 'h', 'g'], ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']).mode).toBe('pane');
    expect(diffGoal(['x', 'y'], ['  x', '  y']).mode).toBe('pane');
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
