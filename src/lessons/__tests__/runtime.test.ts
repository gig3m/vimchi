import { describe, expect, it } from 'vitest';
import { createVim } from '../runtime';

describe('createVim', () => {
  it('keeps an insert-mode start at the end of the line', () => {
    const v = createVim({ text: ['fn'], name: 'a.ts', init: vim => vim.startInsert('i', { line: 0, col: 2 }) });
    expect(v.mode).toBe('insert');
    expect(v.cursor).toEqual({ line: 0, col: 2 });
  });
});
