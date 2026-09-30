import { describe, expect, it } from 'vitest';
import { createVim } from '../../../lessons/runtime';

const vim = (text: string[]) => createVim({ text, name: 'a.ts', plugins: ['snippets'] });

describe('snippets', () => {
  it('Tab expands a trigger and jumps through its fields', () => {
    const v = vim(['']);
    v.feedKeys('ifn<Tab>');
    expect(v.buf.lines).toEqual(['function (params) {', '  body', '}']);
    expect(v.mode).toBe('insert');
    expect(v.cursor).toEqual({ line: 0, col: 9 });      // on the (deleted) "name" field
    v.feedKeys('greet<Tab>');                            // fill field 1, jump to field 2 (params)
    expect(v.buf.lines[0]).toBe('function greet() {');
    expect(v.cursor).toEqual({ line: 0, col: 15 });
    v.feedKeys('x<Tab>');                                // field 3: body
    expect(v.cursor).toEqual({ line: 1, col: 2 });
    v.feedKeys('return x;<Esc>');
    expect(v.buf.lines).toEqual(['function greet(x) {', '  return x;', '}']);
  });
  it('S-Tab jumps back', () => {
    const v = vim(['']);
    v.feedKeys('ifn<Tab>a<Tab><S-Tab>');
    expect(v.cursor).toEqual({ line: 0, col: 9 });
    expect(v.buf.lines[0]).toBe('function () {');       // field 1 re-selected: its text removed again
  });
  it('Tab without a trigger inserts a tab', () => {
    const v = vim(['x']);
    v.feedKeys('A<Tab>y<Esc>');
    expect(v.buf.lines[0]).toBe('x\ty');
  });
});
