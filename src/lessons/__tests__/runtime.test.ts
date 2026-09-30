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
  it('always has flash: s is a label jump in every lesson, S a treesitter select', () => {
    const v = createVim({ text: ['alpha beta', 'gamma delta'], name: 'a.ts' });
    v.feedKeys('sde');
    expect(v.pluginData.flash).toBeTruthy();
    v.feedKeys('<CR>');
    expect(v.cursor).toEqual({ line: 1, col: 6 });
    expect(v.buf.lines).toEqual(['alpha beta', 'gamma delta']);
  });
  it('a lesson Session in an early lesson jumps with s and stays playable', () => {
    const l = LESSONS['delete-words'] as { challenge: RoundsChallenge };
    const s = new Session(l.challenge);
    const vim = s.vim!;
    const before = vim.buf.lines.slice();
    const target = vim.buf.lines.findIndex((t, i) => i > vim.cursor.line && t.trim().length > 2);
    const word = vim.buf.lines[target].trim().slice(0, 2);
    for (const k of ['s', ...word, '<CR>']) s.key(k);
    expect(vim.cursor.line).toBeGreaterThan(0);
    expect(vim.buf.lines).toEqual(before);
    expect(vim.mode).toBe('normal');
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
