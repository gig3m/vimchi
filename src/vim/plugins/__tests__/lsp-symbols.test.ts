import { describe, expect, it } from 'vitest';
import { Vim } from '../../editor';
import { documentSymbols, lsp } from '../lsp';

const ts = [
  "import { db } from './db';",
  '',
  'export const TAX_RATE = 0.2;',
  'let cache = new Map();',
  '',
  'export interface Payment {',
  '  id: string;',
  '  refund?(): void;',
  '}',
  '',
  'export class Invoices {',
  '  private rows: Row[] = [];',
  '  constructor(private db: Db) {}',
  '  async total(id: string) {',
  '    const rows = await this.load(id);',
  '    if (rows) {',
  '      return rows.length;',
  '    }',
  '  }',
  '}',
  '',
  'export async function sendReminder(to: string) {',
  '  function inner() {}',
  '  const x = 1;',
  '}',
];

describe('document symbols (gO)', () => {
  it('lists TypeScript symbols at their names, in document order', () => {
    const vim = new Vim({ text: ts.join('\n'), name: 'invoices.ts', plugins: [lsp] });
    expect(documentSymbols(vim.buf).map(i => `${i.line}:${i.col} ${i.text}`)).toEqual([
      '2:13 [Constant] TAX_RATE',
      '3:4 [Variable] cache',
      '5:17 [Interface] Payment',
      '6:2 [Property] id',
      '7:2 [Method] refund',
      '10:13 [Class] Invoices',
      '11:10 [Property] rows',
      '12:2 [Constructor] constructor',
      '13:8 [Method] total',
      '21:22 [Function] sendReminder',
      '22:11 [Function] inner',
    ]);
  });
  it('lists Lua functions and top-level locals', () => {
    const vim = new Vim({ text: 'local M = {}\nlocal function helper()\nend\nfunction M.setup(opts)\n  local x = 1\nend\nreturn M', name: 'init.lua', plugins: [lsp] });
    expect(documentSymbols(vim.buf).map(i => `${i.line}:${i.col} ${i.text}`)).toEqual([
      '0:6 [Variable] M', '1:15 [Function] helper', '3:9 [Function] M.setup',
    ]);
  });
  it('gO opens them in the location list; <CR> jumps to the symbol', () => {
    const vim = new Vim({ text: ts.join('\n'), name: 'invoices.ts', plugins: [lsp] });
    vim.feedKeys('gO');
    expect(vim.buf.kind).toBe('quickfix');
    expect(vim.buf.lines[0]).toBe('invoices.ts|3 col 14| [Constant] TAX_RATE');
    vim.feedKeys('/total<CR><CR>');
    expect(vim.buf.name).toBe('invoices.ts');
    expect(vim.cursor).toEqual({ line: 13, col: 8 });
    expect(vim.tab.windows().length).toBe(2);
  });
});
