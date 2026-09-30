import { describe, expect, it } from 'vitest';
import { Vim } from '../../editor';
import { gitsigns } from '../gitsigns';
import { helpTags as bundledTags } from '../../help';
import { helpTagEntries, telescope } from '../telescope';
import { whichKey } from '../which-key';

const files = { 'src/app.ts': 'const port = 3000;\nlisten(port);\n', 'src/lib/money.ts': 'export const TAX = 0.2;\n' };
const make = () => {
  const vim = new Vim({ files, plugins: [telescope, whichKey] });
  vim.edit('src/app.ts');
  return vim;
};
const popup = (vim: Vim) => vim.floats.find(f => f.id === 'which-key');

describe('which-key', () => {
  it('the leader shows what can follow it: keys, then +groups', () => {
    const vim = make();
    vim.feedKeys('<Space>');
    const f = popup(vim)!;
    expect(f.title).toBe('<Space>');
    expect(f.lines.map(l => l.text)).toEqual([
      '<Space> ➜ [ ] Find existing buffers',
      '/       ➜ [/] Fuzzily search in current buffer',
      's       ➜ +[S]earch',
    ]);
  });
  it('a group narrows the popup; finishing a mapping runs it and closes the popup', () => {
    const vim = make();
    vim.feedKeys('<Space>s');
    expect(popup(vim)!.lines.map(l => l.text)).toEqual([
      'f ➜ [S]earch [F]iles',
      'g ➜ [S]earch by [G]rep',
      'h ➜ [S]earch [H]elp',
      'k ➜ [S]earch [K]eymaps',
      'w ➜ [S]earch current [W]ord',
    ]);
    vim.feedKeys('h');
    expect(popup(vim)).toBeUndefined();
    expect(vim.floats.find(f => f.id === 'telescope')?.title).toBe('Help');
  });
  it('<BS> goes back a level, <Esc> closes and cancels', () => {
    const vim = make();
    vim.feedKeys('<Space>s<BS>');
    expect(popup(vim)!.title).toBe('<Space>');
    vim.feedKeys('<Esc>');
    expect(popup(vim)).toBeUndefined();
    expect(vim.pending).toEqual([]);
    expect(vim.cursor).toEqual({ line: 0, col: 0 });
    vim.feedKeys('w');
    expect(vim.cursor.col).toBe(6);
  });
  it('shows only keys an enabled plugin maps', () => {
    const vim = new Vim({ text: 'a\nb\nc', name: 'a.ts', plugins: [gitsigns, whichKey] });
    vim.feedKeys('<Space>');
    expect(popup(vim)!.lines.map(l => l.text)).toEqual(['h ➜ +Git [H]unk']);
  });
});

describe('telescope keymaps and help', () => {
  it('<leader>sk lists described keys; <CR> runs the one picked', () => {
    const vim = make();
    vim.feedKeys('<Space>skfiles');
    const t = vim.floats.find(f => f.id === 'telescope')!;
    expect(t.title).toBe('Key Maps');
    expect(t.lines[0].text).toMatch(/<Space>sf\s+\[S\]earch \[F\]iles/);
    vim.feedKeys('<CR>');
    expect(vim.floats.find(f => f.id === 'telescope')?.title).toBe('Find Files');
    vim.feedKeys('money<CR>');
    expect(vim.buf.name).toBe('src/lib/money.ts');
  });
  it('<leader>sh opens help tags; <CR> opens the help page on the tag', () => {
    const vim = make();
    vim.feedKeys('<Space>shCTRL-E<CR>');
    expect(vim.floats).toEqual([]);
    expect(vim.message).toBeNull();
    expect(vim.buf.filetype).toBe('help');
    expect(vim.buf.name).toBe('scroll.txt');
    expect(vim.cursor).toEqual(bundledTags().get('CTRL-E')!.pos);
  });
  it('every help-tags entry opens a bundled help page on its tag', () => {
    const tags = bundledTags();
    const entries = helpTagEntries(make());
    expect(entries.map(e => e.display).sort()).toEqual([...tags.keys()].sort());
    for (const e of entries) {
      const vim = make();
      helpTagEntries(vim).find(x => x.display === e.display)!.run!();
      expect(vim.message?.text ?? '', e.display).toBe('');
      expect(vim.buf.filetype, e.display).toBe('help');
      expect({ file: vim.buf.name, pos: vim.cursor }, e.display).toEqual(tags.get(e.display));
    }
  });
});
