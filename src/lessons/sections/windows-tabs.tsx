import { Code } from '../../components/Code';
import type { Vim } from '../../vim/editor';
import type { LayoutNode } from '../../vim/layout';
import type { Section } from '../types';

const file = (...lines: string[]) => lines.join('\n') + '\n';

// A small Neovim config.
const CONFIG: Record<string, string> = {
  'init.lua': file(
    "vim.g.mapleader = ' '",
    '',
    "require('options')",
    "require('keymaps')",
    "require('bootstrap')",
  ),
  'lua/options.lua': file(
    'local opt = vim.opt',
    '',
    'opt.number = true',
    'opt.relativenumber = true',
    'opt.expandtab = true',
    'opt.shiftwidth = 2',
    'opt.ignorecase = true',
    'opt.smartcase = true',
    'opt.scrolloff = 8',
    'opt.undofile = true',
  ),
  'lua/keymaps.lua': file(
    'local map = vim.keymap.set',
    '',
    "map('n', '<Esc>', '<cmd>nohlsearch<CR>')",
    "map('n', '<leader>w', '<cmd>write<CR>', { desc = 'Save' })",
    "map('n', '<C-h>', '<C-w>h', { desc = 'Window left' })",
    "map('n', '<C-j>', '<C-w>j', { desc = 'Window down' })",
    "map('n', '<C-k>', '<C-w>k', { desc = 'Window up' })",
    "map('n', '<C-l>', '<C-w>l', { desc = 'Window right' })",
  ),
  'lua/bootstrap.lua': file(
    "local path = vim.fn.stdpath('data') .. '/lazy/lazy.nvim'",
    'vim.opt.rtp:prepend(path)',
    '',
    "require('lazy').setup('plugins')",
  ),
  'lua/plugins/telescope.lua': file(
    'return {',
    "  'nvim-telescope/telescope.nvim',",
    "  dependencies = { 'nvim-lua/plenary.nvim' },",
    '  keys = {',
    "    { '<leader>ff', '<cmd>Telescope find_files<CR>' },",
    "    { '<leader>fg', '<cmd>Telescope live_grep<CR>' },",
    '  },',
    '}',
  ),
  'lua/plugins/lsp.lua': file(
    'return {',
    "  'neovim/nvim-lspconfig',",
    '  config = function()',
    "    vim.lsp.enable({ 'lua_ls', 'ts_ls' })",
    '  end,',
    '}',
  ),
};

const OPT = 'lua/options.lua';
const KEY = 'lua/keymaps.lua';
const LSP = 'lua/plugins/lsp.lua';
const TEL = 'lua/plugins/telescope.lua';

/** The layout as a string, e.g. "row(col(keymaps,options),init)". */
const shape = (vim: Vim) => {
  const walk = (n: LayoutNode): string =>
    n.type === 'leaf' ? n.win.buf.name.split('/').pop()!.replace(/\.lua$/, '') : `${n.type}(${n.children.map(walk).join(',')})`;
  return walk(vim.tab.root);
};

const focus = (vim: Vim, name: string) => {
  const w = vim.tab.windows().find(w => w.buf.name === name);
  if (w) vim.focusWindow(w);
};

/**
 * Four windows (starting from options.lua):
 *   keymaps | lsp
 *   options | init
 */
const grid = (at: string) => (vim: Vim) => {
  const opt = vim.win;
  vim.ex('vs init.lua');
  vim.tab.moveToEdge(vim.win, 'L');
  vim.ex(`sp ${LSP}`);
  vim.focusWindow(opt);
  vim.ex(`sp ${KEY}`);
  focus(vim, at);
};

/** Every split in the layout has equal shares. */
const balanced = (vim: Vim) => {
  const ok = (n: LayoutNode): boolean => n.type === 'leaf' || n.children.every(c => c.size === n.children[0].size && ok(c));
  return ok(vim.tab.root);
};

/** The current window has (nearly) all the height or width its column/row allows. */
const maxed = (vim: Vim, dir: 'tall' | 'wide') => {
  const rects = vim.tab.rects(vim.screenRows, vim.screenCols);
  const me = rects.get(vim.win)!;
  for (const [w, r] of rects) {
    if (w === vim.win) continue;
    const sameColumn = r.left < me.left + me.width && r.left + r.width > me.left;
    const sameRow = r.top < me.top + me.height && r.top + r.height > me.top;
    if (dir === 'tall' && sameColumn && r.height > 2) return false;
    if (dir === 'wide' && sameRow && r.width > 2) return false;
  }
  return true;
};

const ALT_NOTE = (
  <>
    (In the browser, <Code>Alt-w</Code> stands in for <Code>C-w</Code>; full screen captures the real key.)
  </>
);

export const windowsTabs: Section = {
  id: 'windows-tabs',
  title: 'Windows & Tabs',
  band: 'project',
  lessons: [
    {
      id: 'splitting',
      title: 'Splitting',
      chips: [':sp', ':vs'],
      keyCards: [
        { key: ':sp', glyph: '⬒', label: 'split above', sub: ':sp file' },
        { key: ':vs', glyph: '◧', label: 'split beside', sub: ':vs file' },
      ],
      intro: (
        <>
          <p>
            <Code>:sp</Code> splits the window in two, one above the other. <Code>:vs</Code> splits it side by side.
            Both leave the cursor in the new window.
          </p>
          <p>
            Give either a file name to open that file in the new window: <Code>:vs init.lua</Code> puts init.lua next
            to what you are editing. Without a name you get a second view of the same buffer.
          </p>
        </>
      ),
      practice: total => (
        <p>
          Your Neovim config is open. Split the screen the way each round asks. {total} rounds.
        </p>
      ),
      aside: {
        title: 'Without the command line',
        body: (
          <p>
            <Code>C-w s</Code> and <Code>C-w v</Code> split without typing a command, just like <Code>:sp</Code> and{' '}
            <Code>:vs</Code> with no file name.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        base: { files: CONFIG, open: OPT, height: 16 },
        rounds: [
          {
            prompt: 'Split the window side by side.',
            goal: { check: vim => shape(vim) === 'row(options,options)' },
            solution: ':vs<CR>',
          },
          {
            prompt: 'Open keymaps.lua in a split above this one.',
            goal: { buffer: KEY, check: vim => shape(vim) === 'col(keymaps,options)' },
            solution: `:sp ${KEY}<CR>`,
          },
          {
            prompt: 'Put init.lua beside this file.',
            goal: { buffer: 'init.lua', check: vim => shape(vim) === 'row(init,options)' },
            solution: ':vs init.lua<CR>',
          },
          {
            prompt: 'You are in telescope.lua, on the left. Open lsp.lua above it.',
            setup: { init: vim => vim.ex(`vs ${TEL}`) },
            goal: { buffer: LSP, check: vim => shape(vim) === 'row(col(lsp,telescope),options)' },
            solution: `:sp ${LSP}<CR>`,
          },
          {
            prompt: 'Split this window in two, one above the other.',
            setup: { open: KEY },
            goal: { check: vim => shape(vim) === 'col(keymaps,keymaps)' },
            solution: ':sp<CR>',
          },
        ],
      },
    },
    {
      id: 'moving-between-windows',
      title: 'Moving Between Windows',
      chips: ['C-w h', 'C-w j', 'C-w k', 'C-w l'],
      keyCards: [
        { key: 'C-w h', glyph: '←', label: 'left' },
        { key: 'C-w j', glyph: '↓', label: 'down' },
        { key: 'C-w k', glyph: '↑', label: 'up' },
        { key: 'C-w l', glyph: '→', label: 'right' },
      ],
      intro: (
        <>
          <p>
            <Code>C-w</Code> starts a window command. Follow it with <Code>h</Code>, <Code>j</Code>, <Code>k</Code> or{' '}
            <Code>l</Code> to move to the window in that direction.
          </p>
          <p>They are the same directions as the cursor keys, one level up: moving between windows, not characters.</p>
        </>
      ),
      practice: total => (
        <p>
          Four windows are open: keymaps and options on the left, lsp and init on the right. Move to the one each
          round names. {ALT_NOTE} {total} rounds.
        </p>
      ),
      aside: {
        title: 'The remap everyone makes',
        body: (
          <p>
            Both kickstart and LazyVim map <Code>C-h</Code> <Code>C-j</Code> <Code>C-k</Code> <Code>C-l</Code> to{' '}
            <Code>C-w</Code> plus the same letter, so one chord moves between splits. The lesson uses the built-in
            form so it works in plain Vim too.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        base: { files: CONFIG, open: OPT, height: 18 },
        rounds: [
          { prompt: 'Move right to lsp.lua.', setup: { init: grid(KEY) }, goal: { buffer: LSP }, solution: '<C-w>l' },
          { prompt: 'Move down to init.lua.', setup: { init: grid(LSP) }, goal: { buffer: 'init.lua' }, solution: '<C-w>j' },
          { prompt: 'Move left to options.lua.', setup: { init: grid('init.lua') }, goal: { buffer: OPT }, solution: '<C-w>h' },
          { prompt: 'Move up to keymaps.lua.', setup: { init: grid(OPT) }, goal: { buffer: KEY }, solution: '<C-w>k' },
          {
            prompt: 'Get to init.lua, bottom right.',
            setup: { init: grid(KEY) },
            goal: { buffer: 'init.lua' },
            solution: '<C-w>j<C-w>l',
          },
          {
            prompt: 'Get to keymaps.lua, top left.',
            setup: { init: grid('init.lua') },
            goal: { buffer: KEY },
            solution: '<C-w>k<C-w>h',
          },
        ],
      },
    },
    {
      id: 'closing-windows',
      title: 'Closing Windows',
      chips: ['C-w c', 'C-w o'],
      keyCards: [
        { key: 'C-w c', glyph: '✕', label: 'close window' },
        { key: 'C-w o', glyph: '□', label: 'only this one' },
      ],
      intro: (
        <>
          <p>
            <Code>C-w c</Code> closes the current window. The buffer stays loaded, so nothing is lost.{' '}
            <Code>C-w o</Code> does the opposite: it closes every other window and keeps this one.
          </p>
          <p>
            Reach for <Code>C-w o</Code> when a layout has served its purpose and you want the whole screen back.
          </p>
        </>
      ),
      practice: total => (
        <p>
          Four windows: keymaps and options on the left, lsp and init on the right. Close the ones each round asks
          for. {ALT_NOTE} {total} rounds.
        </p>
      ),
      aside: {
        title: 'The last window',
        body: (
          <p>
            <Code>C-w c</Code> won't close the last window (E444), so it can't quit Neovim by accident.{' '}
            <Code>C-w q</Code> is <Code>:q</Code> and will.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        base: { files: CONFIG, open: OPT, height: 18 },
        rounds: [
          {
            prompt: 'Close this window (lsp.lua).',
            setup: { init: grid(LSP) },
            goal: { check: vim => vim.tab.windows().length === 3 && !vim.tab.windows().some(w => w.buf.name === LSP) },
            solution: '<C-w>c',
          },
          {
            prompt: 'Keep only options.lua.',
            setup: { init: grid(OPT) },
            goal: { buffer: OPT, check: vim => vim.tab.windows().length === 1 },
            solution: '<C-w>o',
          },
          {
            prompt: 'You are in keymaps.lua. Close options.lua, the window below.',
            setup: { init: grid(KEY) },
            goal: { check: vim => vim.tab.windows().length === 3 && !vim.tab.windows().some(w => w.buf.name === OPT) },
            solution: '<C-w>j<C-w>c',
          },
          {
            prompt: 'Make lsp.lua the only window.',
            setup: { init: grid('init.lua') },
            goal: { buffer: LSP, check: vim => vim.tab.windows().length === 1 },
            solution: '<C-w>k<C-w>o',
          },
          {
            prompt: 'Close init.lua, the window to the left.',
            setup: { init: vim => { vim.ex('vs init.lua'); focus(vim, OPT); } },
            goal: { buffer: OPT, check: vim => vim.tab.windows().length === 1 },
            solution: '<C-w>h<C-w>c',
          },
        ],
      },
    },
    {
      id: 'resizing-windows',
      title: 'Resizing',
      chips: ['C-w =', 'C-w _', 'C-w |'],
      keyCards: [
        { key: 'C-w =', glyph: '=', label: 'equal sizes' },
        { key: 'C-w _', glyph: '↕', label: 'max height' },
        { key: 'C-w |', glyph: '↔', label: 'max width' },
      ],
      intro: (
        <>
          <p>
            <Code>C-w _</Code> makes the current window as tall as it can be, and <Code>C-w |</Code> as wide. The other
            windows shrink to a line or a column but stay open.
          </p>
          <p>
            <Code>C-w =</Code> evens everything out again. Use the pair to zoom into one file for a while, then restore
            the layout.
          </p>
        </>
      ),
      practice: total => (
        <p>
          Resize the windows the way each round asks. The four-window rounds have keymaps and options on the left,
          lsp and init on the right. {ALT_NOTE} {total} rounds.
        </p>
      ),
      aside: {
        title: 'Small steps',
        body: (
          <p>
            <Code>C-w +</Code> and <Code>C-w -</Code> grow and shrink the height a little; <Code>C-w &gt;</Code> and{' '}
            <Code>C-w &lt;</Code> do the width. A count sets the size outright: <Code>10 C-w _</Code> gives 10 rows.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        base: { files: CONFIG, open: OPT, height: 18 },
        rounds: [
          {
            prompt: 'Give keymaps.lua all the height.',
            setup: { init: vim => vim.ex(`sp ${KEY}`) },
            goal: { buffer: KEY, check: vim => maxed(vim, 'tall') },
            solution: '<C-w>_',
          },
          {
            prompt: 'Make init.lua as wide as it goes.',
            setup: { init: vim => vim.ex('vs init.lua') },
            goal: { buffer: 'init.lua', check: vim => maxed(vim, 'wide') },
            solution: '<C-w>|',
          },
          {
            prompt: 'Even out all four windows.',
            setup: { init: vim => { grid(KEY)(vim); vim.tab.maximize(vim.win, 'col'); vim.tab.maximize(vim.win, 'row'); } },
            goal: { check: balanced },
            solution: '<C-w>=',
          },
          {
            prompt: 'You are in keymaps.lua. Give options.lua, the window below, all the height.',
            setup: { init: grid(KEY) },
            goal: { buffer: OPT, check: vim => maxed(vim, 'tall') },
            solution: '<C-w>j<C-w>_',
          },
          {
            prompt: 'Make lsp.lua as wide as it goes.',
            setup: { init: grid(KEY) },
            goal: { buffer: LSP, check: vim => maxed(vim, 'wide') },
            solution: '<C-w>l<C-w>|',
          },
        ],
      },
    },
    {
      id: 'rearranging-windows',
      title: 'Rearranging',
      chips: ['C-w H', 'C-w J', 'C-w K', 'C-w L'],
      keyCards: [
        { key: 'C-w H', glyph: '⇤', label: 'far left' },
        { key: 'C-w J', glyph: '⤓', label: 'bottom' },
        { key: 'C-w K', glyph: '⤒', label: 'top' },
        { key: 'C-w L', glyph: '⇥', label: 'far right' },
      ],
      intro: (
        <>
          <p>
            Capital <Code>H</Code> <Code>J</Code> <Code>K</Code> <Code>L</Code> after <Code>C-w</Code> move the current
            window to that edge of the screen. <Code>H</Code> and <Code>L</Code> make it full height,{' '}
            <Code>J</Code> and <Code>K</Code> full width.
          </p>
          <p>
            This is how you turn a stacked split into a side-by-side one without closing anything: <Code>C-w L</Code>{' '}
            on the top window.
          </p>
        </>
      ),
      practice: total => (
        <p>
          Move the current window to the edge each round asks for. {ALT_NOTE} {total} rounds.
        </p>
      ),
      aside: {
        title: 'Swapping',
        body: (
          <p>
            <Code>C-w x</Code> swaps the current window with the next one, and <Code>C-w r</Code> rotates windows in a
            row or column. <Code>C-w T</Code> moves the window into a tab of its own.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        base: { files: CONFIG, open: OPT, height: 18 },
        rounds: [
          {
            prompt: 'keymaps.lua is above options.lua. Move keymaps to the right, side by side.',
            setup: { init: vim => vim.ex(`sp ${KEY}`) },
            goal: { check: vim => shape(vim) === 'row(options,keymaps)' },
            solution: '<C-w>L',
          },
          {
            prompt: 'You are in init.lua. Put it on top, full width.',
            setup: { init: vim => vim.ex('vs init.lua') },
            goal: { check: vim => shape(vim) === 'col(init,options)' },
            solution: '<C-w>K',
          },
          {
            prompt: 'Make lsp.lua a full-width window at the bottom.',
            setup: { init: grid(LSP) },
            goal: { check: vim => shape(vim) === 'col(row(col(keymaps,options),init),lsp)' },
            solution: '<C-w>J',
          },
          {
            prompt: 'Make options.lua a full-height window on the left.',
            setup: { init: grid(OPT) },
            goal: { check: vim => shape(vim) === 'row(options,keymaps,col(lsp,init))' },
            solution: '<C-w>H',
          },
          {
            prompt: 'Move init.lua to the far right.',
            setup: { init: vim => { vim.ex('vs init.lua'); } },
            goal: { check: vim => shape(vim) === 'row(options,init)' },
            solution: '<C-w>L',
          },
        ],
      },
    },
    {
      id: 'tab-pages',
      title: 'Tab Pages',
      chips: [':tabnew', 'gt', 'gT'],
      keyCards: [
        { key: ':tabnew', glyph: '+', label: 'new tab', sub: ':tabnew file' },
        { key: 'gt', glyph: '→', label: 'next tab', sub: '3gt: tab 3' },
        { key: 'gT', glyph: '←', label: 'previous tab' },
      ],
      intro: (
        <>
          <p>
            A tab page holds a whole layout of windows. <Code>:tabnew lsp.lua</Code> opens a file in a new tab;{' '}
            <Code>gt</Code> and <Code>gT</Code> move to the next and previous tab, and <Code>3gt</Code> goes straight to
            the third.
          </p>
          <p>
            Tabs are not one-per-file like in other editors. Use them for separate workspaces: code in one, tests in
            another, a diff in a third.
          </p>
        </>
      ),
      practice: total => (
        <p>
          Open and switch tabs as each round asks. {total} rounds.
        </p>
      ),
      aside: {
        title: 'Closing tabs',
        body: (
          <p>
            <Code>:tabclose</Code> closes the current tab and its windows; <Code>:tabonly</Code> keeps just this one.
            Closing the last window in a tab closes the tab too.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        base: { files: CONFIG, open: OPT, height: 16 },
        rounds: [
          {
            prompt: 'Open keymaps.lua in a new tab.',
            goal: { buffer: KEY, check: vim => vim.tabs.length === 2 && vim.tabIdx === 1 },
            solution: `:tabnew ${KEY}<CR>`,
          },
          {
            prompt: 'Go to the next tab.',
            setup: { init: vim => { vim.ex(`tabnew ${TEL}`); vim.ex('tabfirst'); } },
            goal: { buffer: TEL },
            solution: 'gt',
          },
          {
            prompt: 'Go back one tab.',
            setup: { init: vim => { vim.ex(`tabnew ${KEY}`); vim.ex(`tabnew ${LSP}`); } },
            goal: { buffer: KEY },
            solution: 'gT',
          },
          {
            prompt: 'Jump straight to tab 3.',
            setup: { init: vim => { vim.ex(`tabnew ${KEY}`); vim.ex(`tabnew ${LSP}`); vim.ex('tabfirst'); } },
            goal: { buffer: LSP, check: vim => vim.tabIdx === 2 },
            solution: '3gt',
          },
          {
            prompt: "You're on the last tab. Go forward: it wraps to the first.",
            setup: { init: vim => { vim.ex(`tabnew ${KEY}`); vim.ex(`tabnew ${LSP}`); } },
            goal: { buffer: OPT, check: vim => vim.tabIdx === 0 },
            solution: 'gt',
          },
          {
            prompt: 'Open init.lua in a new tab, then come back.',
            goal: { buffer: OPT, check: vim => vim.tabs.length === 2 && vim.tabs[1].cur.buf.name === 'init.lua' },
            solution: ':tabnew init.lua<CR>gT',
          },
        ],
      },
    },
  ],
};
