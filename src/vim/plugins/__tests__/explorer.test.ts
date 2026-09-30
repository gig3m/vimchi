import { describe, expect, it } from 'vitest';
import { Vim } from '../../editor';
import { EXPLORER_BUF, explorer, explorerOpen, mainFile, treeLines } from '../explorer';

const files = {
  'src/app.ts': 'app\n',
  'src/lib/dates.ts': 'dates\n',
  'src/lib/money.ts': 'money\n',
  'src/routes/invoices.ts': 'invoices\n',
  'README.md': '# Shop\n',
  '.env': 'X=1\n',
};
const mk = (open = 'src/lib/money.ts') => new Vim({ files, open, plugins: [explorer] });
/** The entry under the cursor, trimmed of indent and arrow. */
const at = (vim: Vim) => vim.line().trim().replace(/^[▸▾] /, '');

describe('explorer', () => {
  it('Space e opens a sidebar on the left, revealing the current file', () => {
    const vim = mk();
    vim.feedKeys(' e');
    expect(vim.buf.name).toBe(EXPLORER_BUF);
    const wins = vim.tab.windows();
    expect(wins).toHaveLength(2);
    expect(wins[0].buf.name).toBe(EXPLORER_BUF);
    const rects = vim.tab.rects(20, 120);
    expect(rects.get(wins[0])!.width).toBeLessThan(rects.get(wins[1])!.width / 2);
    expect(treeLines(vim)).toEqual([
      '▾ ~/project',
      '▾ src',
      '  ▾ lib',
      '      dates.ts',
      '      money.ts',
      '  ▸ routes',
      '    app.ts',
      '  README.md',
    ]);
    expect(at(vim)).toBe('money.ts');
    expect(vim.cursor.col).toBe(6);
  });

  it('hides dotfiles and lists directories first', () => {
    const vim = mk('README.md');
    vim.feedKeys(' e');
    expect(treeLines(vim)).toEqual(['▾ ~/project', '▸ src', '  README.md']);
    expect(at(vim)).toBe('README.md');
  });

  it('l expands a directory and opens a file in the main window, keeping the tree', () => {
    const vim = mk('README.md');
    vim.feedKeys(' ekl');
    expect(treeLines(vim)).toContain('  ▸ lib');
    expect(at(vim)).toBe('src');
    vim.feedKeys('jl');
    expect(at(vim)).toBe('lib');
    vim.feedKeys('jl');
    expect(vim.buf.name).toBe('src/lib/dates.ts');
    expect(explorerOpen(vim)).toBe(true);
    expect(vim.tab.windows()).toHaveLength(2);
    expect(vim.tab.windows()[1]).toBe(vim.win);
  });

  it('h collapses a directory, or closes the parent and moves to it', () => {
    const vim = mk();
    vim.feedKeys(' eh');
    expect(at(vim)).toBe('lib');
    expect(treeLines(vim)).toContain('  ▸ lib');
    vim.feedKeys('l');
    expect(treeLines(vim)).toContain('  ▾ lib');
    vim.feedKeys('h');
    expect(treeLines(vim)).toContain('  ▸ lib');
    vim.feedKeys('h');
    expect(at(vim)).toBe('src');
    expect(treeLines(vim)).toEqual(['▾ ~/project', '▸ src', '  README.md']);
  });

  it('<CR> toggles a directory and opens a file', () => {
    const vim = mk('README.md');
    vim.feedKeys(' ek<CR>');
    expect(treeLines(vim)[1]).toBe('▾ src');
    vim.feedKeys('<CR>');
    expect(treeLines(vim)[1]).toBe('▸ src');
    vim.feedKeys('<CR>G<CR>');
    expect(vim.buf.name).toBe('README.md');
    expect(mainFile(vim)).toBe('README.md');
  });

  it('q closes the tree; Space e toggles it from either window; \\ is the neo-tree alias', () => {
    const vim = mk();
    vim.feedKeys(' eq');
    expect(explorerOpen(vim)).toBe(false);
    expect(vim.buf.name).toBe('src/lib/money.ts');
    vim.feedKeys(' e e');
    expect(explorerOpen(vim)).toBe(false);
    vim.feedKeys(' ekl');
    expect(vim.buf.name).toBe('src/lib/dates.ts');
    vim.feedKeys(' e');
    expect(explorerOpen(vim)).toBe(false);
    expect(vim.tab.windows()).toHaveLength(1);
    vim.feedKeys('\\');
    expect(vim.buf.name).toBe(EXPLORER_BUF);
    expect(at(vim)).toBe('dates.ts');
    vim.feedKeys('<C-w>l\\');
    expect(vim.buf.name).toBe(EXPLORER_BUF);
    vim.feedKeys('\\');
    expect(explorerOpen(vim)).toBe(false);
  });

  it('a adds a file in the directory under the cursor and moves to it', () => {
    const vim = mk();
    vim.feedKeys(' ea');
    expect(vim.mode).toBe('cmdline');
    vim.feedKeys('fmt.ts<CR>');
    expect(vim.fs.read('src/lib/fmt.ts')).toBe('');
    expect(at(vim)).toBe('fmt.ts');
    expect(treeLines(vim).slice(3, 6).map(l => l.trim())).toEqual(['dates.ts', 'fmt.ts', 'money.ts']);
  });

  it('a with a trailing / adds a directory, and a nested path opens its parents', () => {
    const vim = mk('README.md');
    vim.feedKeys(' ea');
    vim.feedKeys('docs/<CR>');
    expect(at(vim)).toBe('docs');
    expect(treeLines(vim)).toEqual(['▾ ~/project', '▸ docs', '▸ src', '  README.md']);
    vim.feedKeys('aapi/v1.md<CR>');
    expect(vim.fs.read('docs/api/v1.md')).toBe('');
    expect(at(vim)).toBe('v1.md');
    expect(treeLines(vim).slice(1, 4)).toEqual(['▾ docs', '  ▾ api', '      v1.md']);
  });

  it('d deletes after y, keeping the cursor on the next entry; n keeps the file', () => {
    const vim = mk();
    vim.feedKeys(' ekd');
    expect(vim.mode).toBe('confirm');
    vim.feedKeys('n');
    expect(vim.fs.read('src/lib/dates.ts')).toBe('dates\n');
    vim.feedKeys('dy');
    expect(vim.fs.read('src/lib/dates.ts')).toBeNull();
    expect(at(vim)).toBe('money.ts');
    expect(vim.mode).toBe('normal');
  });

  it('deleting an open file wipes its buffer from the main window', () => {
    const vim = mk();
    vim.feedKeys(' edy');
    expect(vim.fs.read('src/lib/money.ts')).toBeNull();
    expect(vim.buffers.some(b => b.name === 'src/lib/money.ts')).toBe(false);
    expect(mainFile(vim)).not.toBe('src/lib/money.ts');
  });

  it('deleting a directory removes everything under it', () => {
    const vim = mk();
    vim.feedKeys(' ehdy');
    expect(vim.fs.list()).toEqual(['.env', 'README.md', 'src/app.ts', 'src/routes/invoices.ts']);
    expect(at(vim)).toBe('routes');
  });

  it('r renames with the name prefilled and follows the entry', () => {
    const vim = mk();
    vim.feedKeys(' ekr');
    expect(vim.cmdline?.text).toBe('dates.ts');
    vim.feedKeys('<C-u>time.ts<CR>');
    expect(vim.fs.read('src/lib/time.ts')).toBe('dates\n');
    expect(vim.fs.read('src/lib/dates.ts')).toBeNull();
    expect(at(vim)).toBe('time.ts');
    expect(treeLines(vim).slice(3, 5).map(l => l.trim())).toEqual(['money.ts', 'time.ts']);
  });

  it('renaming a directory renames open buffers under it and keeps it expanded', () => {
    const vim = mk();
    vim.feedKeys(' ehr<C-u>util<CR>');
    expect(vim.fs.read('src/util/money.ts')).toBe('money\n');
    expect(vim.findBuffer('src/util/money.ts')).toBeTruthy();
    expect(at(vim)).toBe('util');
    vim.feedKeys('l');
    expect(treeLines(vim)).toContain('      money.ts');
  });

  it('follows changes made outside the tree', () => {
    const vim = mk();
    vim.feedKeys(' e');
    vim.fs.write('src/lib/tax.ts', '');
    vim.feedKeys('j');
    expect(treeLines(vim).map(l => l.trim())).toContain('tax.ts');
  });

  it('the tree is not editable', () => {
    const vim = mk();
    vim.feedKeys(' exx');
    expect(vim.message?.text).toMatch(/E21/);
    expect(treeLines(vim)).toContain('      money.ts');
  });
});
