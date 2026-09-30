import { describe, expect, it } from 'vitest';
import { createVim, Session, marksOf, solutionKeys } from '../runtime';
import { LESSONS } from '../index';
import type { MarksChallenge, RoundsChallenge } from '../types';

describe('createVim', () => {
  it('keeps an insert-mode start at the end of the line', () => {
    const v = createVim({ text: ['fn'], name: 'a.ts', init: vim => vim.startInsert('i', { line: 0, col: 2 }) });
    expect(v.mode).toBe('insert');
    expect(v.cursor).toEqual({ line: 0, col: 2 });
  });
});

describe('fix / replace scoring after undo', () => {
  it('replace: u after a wrong r is not a second mistake', () => {
    const l = LESSONS['r'] as { challenge: MarksChallenge };
    const s = new Session(l.challenge);
    const vim = s.vim!;
    const [first] = [...marksOf(vim.buf.lines, l.challenge).marks];
    const [ml, mc] = first.split(':').map(Number);
    vim.win.cursor = { line: ml, col: mc };
    s.key('r'); s.key('z');           // wrong character
    expect(s.result().correctText).toBe('0 of 1 edits right');
    s.key('u');
    expect(s.result().correctText).toBe('0 of 1 edits right');
  });
  it('fix: u after a wrong x does not count as an edit', () => {
    const l = LESSONS['x'] as { challenge: MarksChallenge };
    const s = new Session(l.challenge);
    const vim = s.vim!;
    const [first] = [...marksOf(vim.buf.lines, l.challenge).marks];
    const [ml, mc] = first.split(':').map(Number);
    // A column on the same line whose character differs from the typo's, away from it: deleting it is wrong.
    const line = vim.buf.lines[ml];
    const wrong = [...line].findIndex((ch, i) => Math.abs(i - mc) > 1 && ch !== line[mc] && ch !== ' ');
    vim.win.cursor = { line: ml, col: wrong };
    s.key('x');
    expect(s.result().correctText).toBe('0 of 1 edits right');
    s.key('u');
    expect(s.result().correctText).toBe('0 of 1 edits right');
  });
});

describe('cursor carry and folds', () => {
  const text = ['top', '', 'function a() {', '  body', '}', 'end'];
  it('does not carry the cursor into a round that sets up folds', () => {
    const c: RoundsChallenge = {
      kind: 'rounds', base: { name: 'a.ts', text },
      rounds: [
        { setup: { cursor: { line: 0, col: 0 } }, goal: { cursor: { line: 3, col: 2 } }, solution: '3jw' },
        { setup: { cursor: { line: 0, col: 0 }, folds: [{ start: 2, end: 4 }] }, goal: { cursor: { line: 5, col: 0 } }, solution: '2j' },
      ],
    };
    const s = new Session(c);
    for (const k of solutionKeys('3jw')) s.key(k, 100);
    s.advance();
    expect(s.vim!.cursor).toEqual({ line: 0, col: 0 });
    expect(s.vim!.closedFoldAt(s.vim!.cursor.line)).toBeNull();
  });
  it('the Folds lesson solves every round in order with the cursor carried', () => {
    const lesson = LESSONS['toggle-folds'];
    const c = lesson.challenge as RoundsChallenge;
    const s = new Session(c);
    let t = 0;
    c.rounds.forEach((r, i) => {
      for (const k of solutionKeys(r.solution)) s.key(k, (t += 100));
      expect(s.done || s.roundDone, `round ${i + 1} (${r.solution}) not solved`).toBe(true);
      if (!s.done) s.advance();
    });
    expect(s.done).toBe(true);
  });
});
