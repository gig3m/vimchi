import { describe, expect, it } from 'vitest';
import { Vim } from '../../editor';
import { harpoon, harpoonList } from '../harpoon';

const files = { 'src/app.ts': 'a\nb\nc\n', 'src/lib/money.ts': 'm\n', 'src/lib/dates.ts': 'd\n', 'README.md': '# x\n' };
const mk = () => new Vim({ files, open: 'src/app.ts', plugins: [harpoon] });

describe('harpoon', () => {
  it('<leader>a adds the current file once', () => {
    const vim = mk();
    vim.feedKeys(' a a');
    vim.ex('e src/lib/money.ts');
    vim.feedKeys(' a');
    expect(harpoonList(vim)).toEqual(['src/app.ts', 'src/lib/money.ts']);
  });

  it('<leader>1..4 jump to entries and restore the cursor', () => {
    const vim = mk();
    vim.pluginData.harpoon = { list: ['src/app.ts', 'src/lib/money.ts', 'README.md'] };
    vim.feedKeys('jj 3');
    expect(vim.buf.name).toBe('README.md');
    vim.feedKeys(' 1');
    expect(vim.buf.name).toBe('src/app.ts');
    expect(vim.cursor.line).toBe(2);
    vim.feedKeys(' 4');
    expect(vim.buf.name).toBe('src/app.ts');
  });

  it('<C-e> opens an editable menu; q saves the edits', () => {
    const vim = mk();
    vim.pluginData.harpoon = { list: ['src/app.ts', 'src/lib/money.ts', 'README.md'] };
    vim.feedKeys('<C-e>');
    expect(vim.floats[0].title).toBe('Harpoon');
    expect(vim.buf.lines).toEqual(['src/app.ts', 'src/lib/money.ts', 'README.md']);
    vim.feedKeys('GddggP');
    expect(harpoonList(vim)).toEqual(['src/app.ts', 'src/lib/money.ts', 'README.md']);
    vim.feedKeys('q');
    expect(vim.floats).toHaveLength(0);
    expect(vim.buf.name).toBe('src/app.ts');
    expect(harpoonList(vim)).toEqual(['README.md', 'src/app.ts', 'src/lib/money.ts']);
  });

  it('<CR> in the menu opens the entry', () => {
    const vim = mk();
    vim.pluginData.harpoon = { list: ['src/app.ts', 'src/lib/money.ts'] };
    vim.feedKeys('<C-e>j<CR>');
    expect(vim.buf.name).toBe('src/lib/money.ts');
    expect(vim.floats).toHaveLength(0);
    expect(vim.tab.windows()).toHaveLength(1);
  });
});
