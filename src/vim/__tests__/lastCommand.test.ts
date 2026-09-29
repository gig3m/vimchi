import { describe, expect, it } from 'vitest';
import { createVim } from '../../lessons/runtime';

const vim = (text: string[]) => createVim({ text, name: 'a.ts' });
const after = (text: string[], keys: string) => { const v = vim(text); v.feedKeys(keys); return { v, lc: v.lastCommand }; };

describe('lastCommand', () => {
  it('is null after a pending key and set by the key that completes a motion', () => {
    const v = vim(['abc def']);
    v.feed('f'); expect(v.lastCommand).toBeNull();
    v.feed('d'); expect(v.lastCommand).toEqual({ keys: ['f', 'd'], kind: 'motion', error: false });
  });
  it('classifies counts with the motion', () => {
    expect(after(['abcdefgh'], '3l').lc).toEqual({ keys: ['3', 'l'], kind: 'motion', error: false });
  });
  it('classifies operators, actions, undo and inserts', () => {
    expect(after(['abc def'], 'dw').lc?.kind).toBe('operator');
    expect(after(['abc def'], 'x').lc?.kind).toBe('action');
    expect(after(['abc def'], 'xu').lc?.kind).toBe('undo');
    const { v, lc } = after(['abc'], 'i');
    expect(lc?.kind).toBe('insert'); expect(v.mode).toBe('insert');
    v.feed('z'); expect(v.lastCommand).toBeNull();
    v.feed('<Esc>'); expect(v.lastCommand?.kind).toBe('insert');
  });
  it('classifies yank, marks and z as other; v as visual', () => {
    expect(after(['abc'], 'yy').lc?.kind).toBe('other');
    expect(after(['abc'], 'ma').lc?.kind).toBe('other');
    expect(after(['abc'], 'zz').lc?.kind).toBe('other');
    expect(after(['abc'], 'v').lc?.kind).toBe('visual');
  });
  it('marks an errored command', () => {
    expect(after(['abc'], 'fz').lc).toEqual({ keys: ['f', 'z'], kind: 'motion', error: true });
  });
  it('a completed search is a motion with the typed keys', () => {
    const { v, lc } = after(['abc', 'xyz foo'], '/foo<CR>');
    expect(v.cursor).toEqual({ line: 1, col: 4 });
    expect(lc).toEqual({ keys: ['/', 'f', 'o', 'o', '<CR>'], kind: 'motion', error: false });
  });
});

describe('lastCommand fix pass', () => {
  it('a replayed change (.) reports only its own key, not the replayed insert text', () => {
    expect(after(['abc', 'def'], 'xiz<Esc>j0.').lc?.keys).toEqual(['.']);
  });
  it('a bare <Esc>, a cancelled pending key and the q that stops a recording complete as other', () => {
    expect(after(['abc'], '<Esc>').lc).toEqual({ keys: ['<Esc>'], kind: 'other', error: false });
    expect(after(['abc'], 'd<Esc>').lc).toEqual({ keys: ['d', '<Esc>'], kind: 'other', error: false });
    expect(after(['abc'], 'qaxq').lc).toEqual({ keys: ['q'], kind: 'other', error: false });
  });
});
