import { describe, expect, it } from 'vitest';
import { Vim } from '../../editor';
import { conform, formatLines } from '../conform';

const make = (lines: string[], name = 'a.ts') => new Vim({ text: lines.join('\n'), name, plugins: [conform] });

describe('conform formatter', () => {
  it('re-indents by bracket level, 2 spaces, one level per line', () => {
    expect(formatLines([
      'export function formatMoney(cents: number) {',
      '      return new Intl.NumberFormat("en-US", {',
      ' style: "currency",',
      '        currency: "USD",',
      '    }).format(cents / 100);',
      '}',
    ])).toEqual([
      'export function formatMoney(cents: number) {',
      '  return new Intl.NumberFormat("en-US", {',
      '    style: "currency",',
      '    currency: "USD",',
      '  }).format(cents / 100);',
      '}',
    ]);
  });
  it('spaces = and its compounds, not inside strings or comments', () => {
    expect(formatLines([
      'let total=0;',
      "const url='a=b'; // x=y",
      'items.forEach((i)=>{ total+=i; });',
      'if (a===b) ok=a>=b;',
    ])).toEqual([
      'let total = 0;',
      "const url = 'a=b'; // x=y",
      'items.forEach((i) => { total += i; });',
      'if (a === b) ok = a >= b;',
    ]);
  });
  it('drops trailing whitespace and extra blank lines', () => {
    expect(formatLines(['', 'const a = 1;   ', '', '  ', '', 'const b = 2;', '/**', '* Doc', '   */'])).toEqual([
      'const a = 1;', '', 'const b = 2;', '/**', ' * Doc', ' */',
    ]);
  });
  it('formats only a range, with the indent the code above implies', () => {
    const lines = ['const A    = 1;', 'function f() {', 'if (x) {', 'y=1;', '}', '}'];
    expect(formatLines(lines, 2, 4)).toEqual(['const A    = 1;', 'function f() {', '  if (x) {', '    y = 1;', '  }', '}']);
  });
  it('JSON', () => {
    expect(formatLines(['{', '"name": "shop",', '    "scripts": {', '"dev": "tsx"', '  }', '}'])).toEqual([
      '{', '  "name": "shop",', '  "scripts": {', '    "dev": "tsx"', '  }', '}',
    ]);
  });
});

describe('conform keys', () => {
  it('<leader>f formats the buffer in one undo step', () => {
    const vim = make(['function f() {', 'return 1;', '}']);
    vim.feedKeys('<Space>f');
    expect(vim.buf.lines).toEqual(['function f() {', '  return 1;', '}']);
    vim.feedKeys('u');
    expect(vim.buf.lines).toEqual(['function f() {', 'return 1;', '}']);
  });
  it('<leader>cf (LazyVim) does the same', () => {
    const vim = make(['let a=1;', 'let b = 2;', 'let c = 3;']);
    vim.feedKeys('<Space>cf');
    expect(vim.buf.lines[0]).toBe('let a = 1;');
  });
  it('formats the Visual lines only and leaves Visual mode', () => {
    const vim = make(['let a=1;', 'let b=2;', 'let c=3;']);
    vim.feedKeys('jV<Space>f');
    expect(vim.buf.lines).toEqual(['let a=1;', 'let b = 2;', 'let c=3;']);
    expect(vim.mode).toBe('normal');
  });
  it('says so for a filetype it has no formatter for', () => {
    const vim = make(['x  ', 'y', 'z'], 'notes.txt');
    vim.feedKeys('<Space>f');
    expect(vim.buf.lines).toEqual(['x  ', 'y', 'z']);
    expect(vim.message?.text).toMatch(/No formatters/);
  });
});
