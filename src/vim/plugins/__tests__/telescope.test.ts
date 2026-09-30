import { describe, expect, it } from 'vitest';
import { Vim } from '../../editor';
import { fzy, telescope } from '../telescope';

const files = {
  'src/app.ts': "import { money } from './lib/money';\n// TODO: routes\n",
  'src/lib/money.ts': 'export const TAX_RATE = 0.2;\n// TODO: rounding\n',
  'src/lib/logger.ts': 'export const log = console.log;\n',
  'test/money.test.ts': "import { TAX_RATE } from '../src/lib/money';\n",
  'README.md': '# Shop\n',
};
const mk = () => new Vim({ files, open: 'src/app.ts', plugins: [telescope] });

describe('fzy', () => {
  it('prefers consecutive matches and word starts', () => {
    expect(fzy('money', 'src/lib/money.ts')!).toBeGreaterThan(fzy('money', 'test/money.test.ts')!);
    expect(fzy('lm', 'src/lib/money.ts')).not.toBeNull();
    expect(fzy('xyz', 'src/app.ts')).toBeNull();
  });
  it('is smart-case', () => {
    expect(fzy('Readme', 'README.md')).toBeNull();
    expect(fzy('readme', 'README.md')).not.toBeNull();
  });
});

describe('telescope', () => {
  it('<leader>ff opens a picker and <CR> opens the best match', () => {
    const vim = mk();
    vim.feedKeys(' ff');
    expect(vim.floats[0].title).toBe('Find Files');
    expect(vim.floats[0].lines).toHaveLength(5);
    vim.feedKeys('money');
    expect(vim.floats[0].lines.map(l => l.text)).toEqual(['src/lib/money.ts', 'test/money.test.ts']);
    expect(vim.floats[0].preview?.lines[0]).toContain('TAX_RATE');
    vim.feedKeys('<CR>');
    expect(vim.buf.name).toBe('src/lib/money.ts');
    expect(vim.floats).toHaveLength(0);
    expect(vim.modal).toBeNull();
  });

  it('<C-n> moves the selection and <C-v> opens in a vertical split', () => {
    const vim = mk();
    vim.feedKeys(' ffmoney<C-n><C-v>');
    expect(vim.buf.name).toBe('test/money.test.ts');
    expect(vim.tab.windows()).toHaveLength(2);
  });

  it('<Esc> goes to normal mode; j/k move; <Esc> closes', () => {
    const vim = mk();
    vim.feedKeys(' ff<Esc>jj');
    expect(vim.floats[0].sel).toBe(2);
    vim.feedKeys('k<Esc>');
    expect(vim.floats).toHaveLength(0);
    expect(vim.buf.name).toBe('src/app.ts');
  });

  it('<leader>fg greps and jumps to the line', () => {
    const vim = mk();
    vim.feedKeys(' fgTODO');
    expect(vim.floats[0].lines.map(l => l.text)).toEqual(['src/app.ts:2:4:// TODO: routes', 'src/lib/money.ts:2:4:// TODO: rounding']);
    vim.feedKeys('<C-n><CR>');
    expect(vim.buf.name).toBe('src/lib/money.ts');
    expect(vim.cursor).toEqual({ line: 1, col: 3 });
  });

  it('<C-q> sends all results to the quickfix list and opens it', () => {
    const vim = mk();
    vim.feedKeys(' fgTAX_RATE<C-q>');
    expect(vim.quickfix.items.map(i => i.file)).toEqual(['src/lib/money.ts', 'test/money.test.ts']);
    expect(vim.buf.kind).toBe('quickfix');
  });

  it('<leader>fb lists buffers and dd deletes one', () => {
    const vim = mk();
    vim.ex('e src/lib/logger.ts');
    vim.ex('e README.md');
    vim.feedKeys(' fb');
    expect(vim.floats[0].lines).toHaveLength(3);
    vim.feedKeys('log<CR>');
    expect(vim.buf.name).toBe('src/lib/logger.ts');
    vim.feedKeys(' fbread<Esc>dd');
    expect(vim.floats[0].lines).toHaveLength(0);
    vim.feedKeys('q');
    expect(vim.findBuffer('README.md')).toBeUndefined();
  });
});

describe('shared bindings', () => {
  it('<leader>sf and <leader>sg open the pickers', () => {
    const v = mk();
    v.feedKeys('<Space>sf');
    expect(v.floats.some(f => f.id === 'telescope' && f.title === 'Find Files')).toBe(true);
    v.feedKeys('<Esc>q'); // Esc: picker normal mode; q: close
    v.feedKeys('<Space>sg');
    expect(v.floats.some(f => f.id === 'telescope' && f.title === 'Live Grep')).toBe(true);
  });
  it('<leader>sw greps the word under the cursor', () => {
    const v = mk();
    v.feedKeys('jw'); // line 2 "// TODO: routes", on TODO
    v.feedKeys('<Space>sw');
    const f = v.floats.find(x => x.id === 'telescope')!;
    expect(f.prompt?.text).toBe('TODO');
    expect(f.lines.length).toBe(2);
  });
  it('sw on whitespace opens an empty grep', () => {
    const v = mk();
    v.feedKeys('jl'); // on the space after "//"... col 2 is a space
    v.feedKeys('<Space>sw');
    const f = v.floats.find(x => x.id === 'telescope')!;
    expect(f.prompt?.text).toBe('');
  });
});
