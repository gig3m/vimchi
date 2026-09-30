import { describe, expect, it } from 'vitest';
import { Vim } from '../editor';
import { HELP_FILES, findHelp, helpTags, helpWordAt } from '../help';

const CODE = ['const a = 1;', 'const b = 2;', 'const c = 3;', 'export { a, b, c };'];
const fresh = () => {
  const vim = new Vim({ text: CODE.join('\n'), name: 'app.ts' });
  vim.feedKeys('jj');
  return vim;
};
const at = (vim: Vim) => ({ buf: vim.buf.name, ...vim.cursor, wins: vim.tab.windows().length });
const tag = (name: string) => helpTags().get(name)!;

describe('help pages', () => {
  it('fit the tutor: lines of at most 60 columns, no tabs', () => {
    for (const [file, lines] of Object.entries(HELP_FILES)) {
      lines.forEach((l, i) => expect(l.length, `${file}:${i + 1} ${l}`).toBeLessThanOrEqual(60));
      expect(lines.join('').includes('\t'), file).toBe(false);
    }
  });
  it('every |link| lands on a *tag*', () => {
    const tags = helpTags();
    for (const [file, lines] of Object.entries(HELP_FILES)) {
      for (const l of lines) for (const m of l.matchAll(/\|([^\s*|"]+)\|/g)) expect(tags.has(m[1]), `${file}: |${m[1]}|`).toBe(true);
    }
  });
  it('every page starts with its own tag', () => {
    for (const file of Object.keys(HELP_FILES)) expect(tag(file)).toEqual({ file, pos: { line: 0, col: 0 } });
  });
});

describe(':help lookup (as Neovim 0.12 resolves these subjects)', () => {
  it.each([
    ['x', 'change.txt', 'x'],
    ['dd', 'change.txt', 'dd'],
    ['d', 'change.txt', 'd'],
    ['g-', 'undo.txt', 'g-'],
    ['CTRL-E', 'scroll.txt', 'CTRL-E'],
    ['^]', 'tagsrch.txt', 'CTRL-]'],
    ['ctrl-o', 'motion.txt', 'CTRL-O'],
    ['wrap', 'options.txt', "'wrap'"],
    ["'ic'", 'options.txt', "'ic'"],
    ['ic', 'options.txt', "'ic'"],
    ['set', 'options.txt', ':set'],
    ['earlier', 'undo.txt', ':earlier'],
    ['wr', 'options.txt', "'wrap'"],
    ['', 'help.txt', 'help.txt'],
  ])(':h %s', (subject, file, name) => {
    expect(findHelp(subject)).toEqual({ file, pos: tag(name).pos });
  });
  it('unknown subjects fail with E149', () => {
    const vim = fresh();
    vim.feedKeys(':h nosuchthing<CR>');
    expect(vim.message?.text).toBe('E149: No help for nosuchthing');
    expect(at(vim)).toEqual({ buf: 'app.ts', line: 2, col: 0, wins: 1 });
  });
});

describe(':help and CTRL-]', () => {
  it(':h x opens a help window above, on the tag', () => {
    const vim = fresh();
    vim.feedKeys(':h x<CR>');
    expect(at(vim)).toEqual({ buf: 'change.txt', ...tag('x').pos, wins: 2 });
    expect(vim.buf.filetype).toBe('help');
    expect(vim.tab.windows()[0]).toBe(vim.win);
    expect(vim.tab.windows()[1].buf.name).toBe('app.ts');
  });
  it('a second :help reuses the help window', () => {
    const vim = fresh();
    vim.feedKeys(':h x<CR>:h g-<CR>');
    expect(at(vim)).toEqual({ buf: 'undo.txt', ...tag('g-').pos, wins: 2 });
    vim.feedKeys('<C-w>j:help zz<CR>');
    expect(at(vim)).toEqual({ buf: 'scroll.txt', ...tag('zz').pos, wins: 2 });
  });
  it('CTRL-O after :help goes to the top of the page, then back to the file (Neovim)', () => {
    const vim = fresh();
    vim.feedKeys(':h d<CR><C-o>');
    expect(at(vim)).toEqual({ buf: 'change.txt', line: 0, col: 0, wins: 2 });
    vim.feedKeys('<C-o>');
    expect(at(vim).buf).toBe('app.ts');
  });
  it('CTRL-] follows the link under the cursor, from a bar or inside the word', () => {
    const vim = fresh();
    vim.feedKeys(':h dd<CR>2j0f|');
    const link = { ...vim.cursor };
    expect(vim.line().slice(link.col)).toBe('|linewise|.');
    vim.feedKeys('<C-]>');
    expect(at(vim)).toEqual({ buf: 'motion.txt', ...tag('linewise').pos, wins: 2 });
    vim.feedKeys('<C-o>');
    expect(at(vim)).toEqual({ buf: 'change.txt', ...link, wins: 2 });
    vim.feedKeys('4l<C-]><C-o>');
    expect(vim.cursor).toEqual({ line: link.line, col: link.col + 4 });
  });
  it('CTRL-] within a page, then CTRL-O and CTRL-I', () => {
    const vim = fresh();
    vim.feedKeys(':h undo-branches<CR>4j0<C-]>');
    expect(at(vim)).toEqual({ buf: 'undo.txt', ...tag('g-').pos, wins: 2 });
    vim.feedKeys('<C-o>');
    expect(vim.line(vim.cursor.line)).toBe('|g-| and |g+| walk every state in time order.');
    vim.feedKeys('<C-i>');
    expect(vim.cursor).toEqual(tag('g-').pos);
  });
  it('reads the word under the cursor the way help does', () => {
    expect(helpWordAt('see |linewise|.', 4)).toBe('linewise');
    expect(helpWordAt('see |linewise|.', 13)).toBe('linewise');
    expect(helpWordAt('  *zz*', 0)).toBe('zz');
    expect(helpWordAt('CTRL-E  Scroll', 2)).toBe('CTRL-E');
    expect(helpWordAt('   ', 1)).toBeNull();
  });
  it('CTRL-] outside help has no tags file', () => {
    const vim = fresh();
    vim.feedKeys('<C-]>');
    expect(vim.message?.text).toMatch(/E433/);
  });
});

describe('the help window', () => {
  it(':h puts the tag line at the top of the window, like zt (Neovim: :h CTRL-E -> w0 = tag line)', () => {
    const vim = fresh();
    vim.feedKeys(':h CTRL-E<CR>');
    expect(vim.win.top).toBe(tag('CTRL-E').pos.line);
    vim.feedKeys(':h zb<CR>');
    expect(vim.win.top).toBe(tag('zb').pos.line);
  });
  it('CTRL-] puts the tag line at the top too', () => {
    const vim = fresh();
    vim.feedKeys(':h dd<CR>2j0f|<C-]>');
    expect(vim.win.top).toBe(tag('linewise').pos.line);
  });
  it.each(['x', 'dd', 'i', 'o', 'O', 'A', 'R', 'p', '>>', 'J', 'rX', '~', 'cw', 'u', ':s/dd/X/<CR>', ':d<CR>'])(
    'is not modifiable: %s fails with E21 and changes nothing',
    keys => {
      const vim = fresh();
      vim.feedKeys('yy:h dd<CR>');
      const before = vim.buf.lines.slice();
      vim.feedKeys(keys);
      expect(vim.message?.text).toBe("E21: Cannot make changes, 'modifiable' is off");
      expect(vim.buf.lines).toEqual(before);
      expect(vim.buf.modified).toBe(false);
      expect(vim.mode).toBe('normal');
    },
  );
  it('a later lookup still lands on the tag after a refused edit', () => {
    const vim = fresh();
    vim.feedKeys(':h dd<CR>x:h D<CR>');
    expect(vim.cursor).toEqual(tag('D').pos);
    expect(vim.line()).toContain('*D*');
  });
  it('yanking from help still works', () => {
    const vim = fresh();
    vim.feedKeys(':h dd<CR>yy');
    expect(vim.registers.get('"').text).toContain('*dd*');
  });
});
