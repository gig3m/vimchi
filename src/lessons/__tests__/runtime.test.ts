import { describe, expect, it } from 'vitest';
import { createVim, Session, marksOf } from '../runtime';
import { LESSONS } from '../index';
import type { MarksChallenge } from '../types';

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
