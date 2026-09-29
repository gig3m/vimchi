import { describe, expect, it } from 'vitest';
import { CORPUS } from '../../challenges/corpus';
import { mulberry32, randInt } from '../../challenges/rng';
import { createVim } from '../../lessons/runtime';
import { betterMotions } from '../motion';

const ALL = new Set(['h', 'j', 'k', 'l', 'w', 'b', 'e', 'W', 'B', 'E', '0', '^', '$', 'f', 't', 'F', 'T', ';', ',', 'G', 'gg', '{', '}', 'ge', 'gE', '/', '?', 'COUNT']);
const line = (s: string) => [s];

describe('betterMotions', () => {
  it('hhhhhh → 6h or F', () => {
    const c = betterMotions(line('abcdefgh'), { line: 0, col: 7 }, 7, { line: 0, col: 1 }, 6, ALL);
    expect(c.map(x => x.keys)).toContain('6h');
    expect(c.every(x => x.cost < 6)).toBe(true);
  });
  it('nothing when the input is already optimal', () => {
    expect(betterMotions(line('abc def'), { line: 0, col: 0 }, 0, { line: 0, col: 4 }, 1, ALL)).toEqual([]);
    expect(betterMotions(line('ab;c,d'), { line: 0, col: 0 }, 0, { line: 0, col: 4 }, 2, ALL)).toEqual([]); // f, has no 1-key rival
  });
  it('never counts f, caps word counts at 3, and only uses G/{ at their targets', () => {
    const lines = ['a b c d e f g h i', 'x', 'y', '', 'z'];
    const c = betterMotions(lines, { line: 0, col: 0 }, 0, { line: 0, col: 16 }, 9, ALL);
    expect(c.some(x => /^\d+[ftFT]/.test(x.keys))).toBe(false);
    expect(c.some(x => /^[4-9][wbeWBE]/.test(x.keys))).toBe(false);
    const g = betterMotions(lines, { line: 0, col: 0 }, 0, { line: 3, col: 0 }, 3, ALL);
    expect(g.some(x => x.keys === 'G')).toBe(false);
    expect(g.some(x => x.keys === '}')).toBe(true);
  });
  it('respects the taught set', () => {
    const c = betterMotions(line('abcdefgh'), { line: 0, col: 7 }, 7, { line: 0, col: 1 }, 6, new Set(['h', 'l']));
    expect(c).toEqual([]);
  });
  it('every candidate replays on the engine to the target and is shorter (corpus property)', () => {
    const rng = mulberry32(7);
    let checked = 0;
    for (const f of CORPUS) for (let n = 0; n < 15; n++) {
      const a = { line: randInt(rng, 0, f.lines.length - 1), col: 0 }, b = { line: randInt(rng, 0, f.lines.length - 1), col: 0 };
      a.col = randInt(rng, 0, Math.max(0, f.lines[a.line].length - 1)); b.col = randInt(rng, 0, Math.max(0, f.lines[b.line].length - 1));
      const learner = Math.abs(a.line - b.line) + Math.abs(a.col - b.col);
      for (const c of betterMotions(f.lines, a, a.col, b, learner, ALL)) {
        const v = createVim({ text: f.lines, name: f.name }); v.win.cursor = { ...a }; v.win.want = a.col;
        v.feedKeys(c.keys);
        expect(v.cursor, `${f.name} ${JSON.stringify(a)}→${JSON.stringify(b)} via ${c.keys}`).toEqual(b);
        expect(c.cost).toBeLessThan(learner);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(50);
  });
});

describe('betterMotions heuristics from the reference audit', () => {
  it('word motions do not cross lines (B wrapping to the previous line is a coincidence, not advice)', () => {
    const lines = ["const DB_URL = 'postgres';", "const KEY = 'X';", 'const PORT = 8080;'];
    const c = betterMotions(lines, { line: 2, col: 0 }, 0, { line: 0, col: 15 }, 4, ALL);
    expect(c.some(x => /^k?[bB]$/.test(x.keys))).toBe(false);
  });
});
