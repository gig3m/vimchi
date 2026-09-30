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
    expect(v.buf.lines[0]).toBe('function a() {');      // what was typed stays
    expect(v.cursor).toEqual({ line: 0, col: 10 });     // cursor after it, ready to keep typing
  });
  it('stepping back and forward keeps every field the learner filled', () => {
    const v = vim(['']);
    v.feedKeys('ifn<Tab>greet<Tab>x<S-Tab><Tab><Tab>body<Esc>');
    expect(v.buf.lines).toEqual(['function greet(x) {', '  body', '}']);
  });
  it('forgets the snippet once insert mode ends', () => {
    const v = vim(['', 'keep this text']);
    v.feedKeys('ifn<Tab>greet<Esc>jdd');
    const before = v.buf.lines.slice();
    v.feedKeys('Goabc<Tab>');
    expect(v.buf.lines.slice(0, before.length)).toEqual(before);
    expect(v.buf.lines[before.length]).toMatch(/^abc\s+$/);
    expect(v.cursor.line).toBe(before.length);
  });
  it('Tab without a trigger does what the engine does without the plugin', () => {
    const plain = createVim({ text: ['x'], name: 'a.ts' });
    plain.feedKeys('A<Tab>y<Esc>');
    const v = vim(['x']);
    v.feedKeys('A<Tab>y<Esc>');
    expect(v.buf.lines[0]).toBe(plain.buf.lines[0]);
    expect(v.buf.lines[0]).not.toBe('x\ty');            // expandtab is on by default
  });
});
