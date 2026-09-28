import { describe, expect, it } from 'vitest';
import { Vim } from '../../editor';
import { oil } from '../oil';

const files = {
  'src/app.ts': 'app\n',
  'src/lib/dates.ts': 'dates\n',
  'src/lib/money.ts': 'money\n',
  'src/routes/invoices.ts': 'invoices\n',
  'README.md': '# Shop\n',
};
const mk = (open = 'src/lib/money.ts') => new Vim({ files, open, plugins: [oil] });
const names = (vim: Vim) => vim.buf.lines.map(l => l.replace(/^\/\d+ /, ''));

describe('oil', () => {
  it('- opens the parent directory with the cursor on the file', () => {
    const vim = mk();
    vim.feedKeys('-');
    expect(vim.buf.name).toBe('oil:///src/lib/');
    expect(names(vim)).toEqual(['dates.ts', 'money.ts']);
    expect(vim.cursor).toEqual({ line: 1, col: 5 });
    vim.feedKeys('-');
    expect(vim.buf.name).toBe('oil:///src/');
    expect(names(vim)).toEqual(['lib/', 'routes/', 'app.ts']);
    expect(vim.line(vim.cursor.line)).toMatch(/lib\/$/);
    vim.feedKeys('j<CR>');
    expect(vim.buf.name).toBe('oil:///src/routes/');
    vim.feedKeys('<CR>');
    expect(vim.buf.name).toBe('src/routes/invoices.ts');
  });

  it('keeps the cursor off the hidden id', () => {
    const vim = mk();
    vim.feedKeys('-0');
    expect(vim.cursor.col).toBe(5);
    vim.feedKeys('ggdd');
    expect(vim.cursor.col).toBe(5);
  });

  it('renames, deletes and creates on :w after confirming', () => {
    const vim = mk();
    vim.feedKeys('-kcwtime<Esc>');
    vim.feedKeys(':w<CR>');
    expect(vim.floats[0].lines.map(l => l.text.trim())).toEqual(['MOVE    src/lib/dates.ts -> src/lib/time.ts']);
    vim.feedKeys('y');
    expect(vim.fs.read('src/lib/time.ts')).toBe('dates\n');
    expect(vim.fs.read('src/lib/dates.ts')).toBeNull();
    expect(names(vim)).toEqual(['money.ts', 'time.ts']);
    vim.feedKeys('ggddoformat.ts<Esc>:w<CR>');
    expect(vim.floats[0].lines.map(l => l.text.trim().split(/\s+/)[0])).toEqual(['DELETE', 'CREATE']);
    vim.feedKeys('Y');
    expect(vim.fs.list().filter(f => f.startsWith('src/lib/'))).toEqual(['src/lib/format.ts', 'src/lib/time.ts']);
  });

  it('n cancels and leaves the buffer edited', () => {
    const vim = mk();
    vim.feedKeys('-dd:w<CR>n');
    expect(vim.floats).toHaveLength(0);
    expect(vim.fs.read('src/lib/dates.ts')).toBe('dates\n');
    expect(vim.buf.modified).toBe(true);
  });

  it('moves a file between directories with dd and p', () => {
    const vim = mk();
    vim.feedKeys('-ggdd-/routes<CR><CR>p:w<CR>y');
    expect(vim.fs.read('src/routes/dates.ts')).toBe('dates\n');
    expect(vim.fs.read('src/lib/dates.ts')).toBeNull();
  });

  it('yyp copies', () => {
    const vim = mk();
    vim.feedKeys('-yypcwmoney2<Esc>:w<CR>y');
    expect(vim.fs.read('src/lib/money2.ts')).toBe('money\n');
    expect(vim.fs.read('src/lib/money.ts')).toBe('money\n');
  });
});
