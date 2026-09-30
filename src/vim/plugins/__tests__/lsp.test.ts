import { describe, expect, it } from 'vitest';
import { Vim } from '../../editor';
import { lsp, type LspData } from '../lsp';

const files = {
  'src/cart.ts': [
    "import { formatPrice } from './format';",
    '',
    'export function cartTotal(items: Item[]) {',
    '  const total = items.reduce((sum, i) => sum + i.price, 0);',
    '  return formatPrice(total);',
    '}',
  ].join('\n'),
  'src/format.ts': [
    'export function formatPrice(cents: number) {',
    '  return `$${(cents / 100).toFixed(2)}`;',
    '}',
  ].join('\n'),
  'src/order.ts': [
    "import { formatPrice } from './format';",
    'const shipping = formatPrice(499);',
  ].join('\n'),
};

function setup(lspData: LspData = {}, open = 'src/cart.ts') {
  const vim = new Vim({ files, open, plugins: [lsp] });
  vim.pluginData.lsp = lspData;
  return vim;
}

describe('lsp: diagnostics', () => {
  const diagnostics = [
    { file: 'src/cart.ts', line: 2, col: 32, message: "Cannot find name 'Item'.", severity: 'error' as const },
    { file: 'src/cart.ts', line: 3, col: 26, message: "'sum' is declared but never read.", severity: 'hint' as const },
    { file: 'src/format.ts', line: 0, col: 0, message: 'elsewhere', severity: 'warn' as const },
  ];

  it(']d and [d jump between diagnostics and wrap', () => {
    const vim = setup({ diagnostics });
    vim.feedKeys(']d');
    expect(vim.cursor).toEqual({ line: 2, col: 32 });
    vim.feedKeys(']d');
    expect(vim.cursor).toEqual({ line: 3, col: 26 });
    vim.feedKeys(']d');
    expect(vim.cursor).toEqual({ line: 2, col: 32 });
    vim.feedKeys('[d');
    expect(vim.cursor).toEqual({ line: 3, col: 26 });
    vim.feedKeys('gg2]d');
    expect(vim.cursor).toEqual({ line: 3, col: 26 });
    vim.feedKeys('[D');
    expect(vim.cursor).toEqual({ line: 2, col: 32 });
  });

  it('[d is a jump (<C-o> comes back)', () => {
    const vim = setup({ diagnostics });
    vim.feedKeys('G]d<C-o>');
    expect(vim.cursor.line).toBe(5);
  });

  it('decorates the buffer with signs and virtual text', () => {
    const vim = setup({ diagnostics });
    const d = vim.decorators.map(f => f(vim.buf, vim.win)).find(Boolean)!;
    expect(d.signs!.get(2)!.text).toBe('E');
    expect(d.signs!.get(3)!.text).toBe('H');
    expect(d.virt!.get(2)!.text).toContain("Cannot find name 'Item'.");
  });

  it('<C-w>d opens the diagnostic float; any key closes it', () => {
    const vim = setup({ diagnostics });
    vim.feedKeys(']d<C-w>d');
    expect(vim.floats[0].lines[0].text).toContain('Item');
    vim.feedKeys('j');
    expect(vim.floats).toEqual([]);
    expect(vim.cursor.line).toBe(3);
  });
});

describe('lsp: hover and definitions', () => {
  it('K opens a hover float at the cursor', () => {
    const vim = setup({ hover: { formatPrice: 'function formatPrice(cents: number): string' } });
    vim.feedKeys('5G^wK');
    expect(vim.floats[0].anchor).toBe('cursor');
    expect(vim.floats[0].lines[0].text).toBe('function formatPrice(cents: number): string');
    vim.feedKeys('<Esc>');
    expect(vim.floats).toEqual([]);
    expect(vim.mode).toBe('normal');
  });

  it('K without hover info says so', () => {
    const vim = setup({});
    vim.feedKeys('3G^w');
    vim.feedKeys('K');
    expect(vim.message?.text).toBe('No information available');
  });

  it('gd jumps to a definition in another file, <C-o> comes back', () => {
    const vim = setup();
    vim.feedKeys('5G^w');
    vim.feedKeys('gd');
    expect(vim.buf.name).toBe('src/format.ts');
    expect(vim.cursor).toEqual({ line: 0, col: 16 });
    vim.feedKeys('<C-o>');
    expect(vim.buf.name).toBe('src/cart.ts');
    expect(vim.cursor.line).toBe(4);
  });

  it('gd finds a const in the current file', () => {
    const vim = setup();
    vim.feedKeys('5G$bbgd');
    expect(vim.cursor).toEqual({ line: 3, col: 8 });
  });

  it('gd finds Lua local functions and module functions', () => {
    const vim = new Vim({
      text: ['local function setup(opts)', 'end', 'function M.attach(buf)', 'end', 'setup({})', 'M.attach(0)'].join('\n'),
      name: 'init.lua',
      plugins: [lsp],
    });
    vim.feedKeys('5G^gd');
    expect(vim.cursor).toEqual({ line: 0, col: 15 });
    vim.feedKeys('6G^wgd');
    expect(vim.cursor).toEqual({ line: 2, col: 11 });
  });
});

describe('lsp: references and implementations', () => {
  it('grr fills the quickfix list with every reference and opens it', () => {
    const vim = setup();
    vim.feedKeys('5G^w');
    vim.feedKeys('grr');
    expect(vim.quickfix.items.map(i => `${i.file}:${i.line + 1}:${i.col + 1}`)).toEqual([
      'src/cart.ts:1:10', 'src/cart.ts:5:10', 'src/format.ts:1:17', 'src/order.ts:1:10', 'src/order.ts:2:18',
    ]);
    expect(vim.buf.kind).toBe('quickfix');
    vim.feedKeys(']q');
    expect(vim.buf.name).toBe('src/cart.ts');
    expect(vim.cursor).toEqual({ line: 4, col: 9 });
  });

  it('gri lists classes implementing an interface', () => {
    const vim = new Vim({
      text: [
        'interface Shape { area(): number; }',
        'class Circle implements Shape {',
        '  area() { return 1; }',
        '}',
        'class Square implements Shape {',
        '  area(): number { return 2; }',
        '}',
      ].join('\n'),
      name: 'shapes.ts',
      plugins: [lsp],
    });
    vim.feedKeys('w');
    vim.feedKeys('gri');
    expect(vim.quickfix.items.map(i => [i.line, i.col])).toEqual([[1, 6], [4, 6]]);
    vim.feedKeys(':cclose<CR>gg/area<CR>gri');
    expect(vim.quickfix.items.map(i => [i.line, i.col])).toEqual([[2, 2], [5, 2]]);
  });
});

describe('lsp: rename', () => {
  it('grn renames across files as one undoable change', () => {
    const vim = setup();
    vim.feedKeys('5G^w');
    vim.feedKeys('grn');
    expect(vim.cmdline?.prompt).toBe('New Name: ');
    expect(vim.cmdline?.text).toBe('formatPrice');
    vim.feedKeys('<C-u>formatCents<CR>');
    expect(vim.line(4)).toBe('  return formatCents(total);');
    expect(vim.line(0)).toBe("import { formatCents } from './format';");
    expect(vim.cursor).toEqual({ line: 4, col: 9 });
    const other = vim.findBuffer('src/order.ts')!;
    expect(other.lines[1]).toBe('const shipping = formatCents(499);');
    expect(other.modified).toBe(true);
    vim.feedKeys(':wa<CR>');
    expect(vim.fs.read('src/format.ts')).toContain('function formatCents');
    vim.feedKeys('u');
    expect(vim.line(4)).toBe('  return formatPrice(total);');
  });

  it('grn only renames whole words and appends to the default', () => {
    const vim = new Vim({ text: 'const user = users[0];\nlog(user);', name: 'a.ts', plugins: [lsp] });
    vim.feedKeys('wgrnId<CR>');
    expect(vim.buf.text()).toBe('const userId = users[0];\nlog(userId);');
  });

  it('<Esc> cancels the rename', () => {
    const vim = new Vim({ text: 'const a = 1;', name: 'a.ts', plugins: [lsp] });
    vim.feedKeys('wgrnb<Esc>');
    expect(vim.buf.text()).toBe('const a = 1;');
    expect(vim.mode).toBe('normal');
  });
});

describe('lsp: code actions', () => {
  const actions = [
    { title: 'Add missing import', apply: (v: Vim) => v.insertLines(0, ["import { Item } from './item';"]) },
    { title: 'Remove unused variable', apply: (v: Vim) => v.buf.splice(3, 1, []), line: 3 },
  ];

  it('gra lists actions; <CR> applies the selection as one undoable change', () => {
    const vim = setup({ actions });
    vim.feedKeys('3Ggra');
    expect(vim.floats[0].lines.map(l => l.text)).toEqual(['1. Add missing import']);
    vim.feedKeys('<CR>');
    expect(vim.floats).toEqual([]);
    expect(vim.line(0)).toBe("import { Item } from './item';");
    vim.feedKeys('u');
    expect(vim.line(0)).toBe("import { formatPrice } from './format';");
  });

  it('j/k move and a number picks directly', () => {
    const vim = setup({ actions });
    vim.feedKeys('4Ggrajk');
    expect(vim.floats[0].sel).toBe(0);
    vim.feedKeys('2');
    expect(vim.buf.lineCount).toBe(5);
  });

  it('q closes without applying; no actions says so', () => {
    const vim = setup({ actions });
    vim.feedKeys('4Ggraq');
    expect(vim.floats).toEqual([]);
    expect(vim.buf.lineCount).toBe(6);
    const bare = setup({});
    bare.feedKeys('gra');
    expect(bare.message?.text).toBe('No code actions available');
  });
});

describe('without the plugin', () => {
  it('gd stays the builtin local declaration and gr* do nothing', () => {
    const vim = new Vim({ text: 'const total = 1;\nlog(total);', name: 'a.ts' });
    vim.feedKeys('jwgd');
    expect(vim.cursor).toEqual({ line: 0, col: 6 });
    vim.feedKeys('grn');
    expect(vim.mode).toBe('normal');
    expect(vim.buf.text()).toBe('const total = 1;\nlog(total);');
  });
});
