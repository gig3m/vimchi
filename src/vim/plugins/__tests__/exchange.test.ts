import { describe, expect, it } from 'vitest';
import { Vim } from '../../editor';
import { exchange } from '../exchange';

function run(text: string, keys: string, cursor = { line: 0, col: 0 }) {
  const vim = new Vim({ text, name: 'a.ts', plugins: [exchange] });
  vim.win.cursor = { ...cursor };
  vim.feedKeys(keys);
  return vim;
}

describe('vim-exchange', () => {
  // Examples from the vim-exchange README.
  it('exchanges two words with cxiw … cxiw', () => {
    expect(run('Hello world!', 'cxiwwcxiw').buf.text()).toBe('world Hello!');
  });
  it('exchanges two lines with cxx', () => {
    expect(run('one\ntwo\nthree', 'cxxjjcxx').buf.text()).toBe('three\ntwo\none');
  });
  it('exchanges visual selections with X', () => {
    expect(run('a + b', 'vXwwvX').buf.text()).toBe('b + a');
  });
  it('is repeatable with .', () => {
    expect(run('first second', 'cxiww.').buf.text()).toBe('second first');
  });
  it('cxc clears the pending exchange', () => {
    const vim = run('aa bb cc', 'cxiwcxcwcxiwwcxiw');
    expect(vim.buf.text()).toBe('aa cc bb');
  });
  it('swaps arguments of different lengths, forwards or backwards', () => {
    expect(run('f(alpha, b)', 'fbcxiwFacxiw').buf.text()).toBe('f(b, alpha)');
    expect(run('f(alpha, b)', 'facxiwfbcxiw').buf.text()).toBe('f(b, alpha)');
  });
  it('replaces the larger region when one contains the other', () => {
    expect(run('keep (inner) text', 'ficxa)lcxiw').buf.text()).toBe('keep inner text');
  });
  it('undoes the swap in one step', () => {
    const vim = run('x y', 'cxiwwcxiw');
    vim.feedKeys('u');
    expect(vim.buf.text()).toBe('x y');
  });
  it('puts the cursor on the second region', () => {
    const vim = run('ab cdef gh', 'cxiwwwcxiw');
    expect(vim.buf.text()).toBe('gh cdef ab');
    expect(vim.cursor).toEqual({ line: 0, col: 8 });
  });
});
