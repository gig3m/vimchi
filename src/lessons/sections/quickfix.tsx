import { Code } from '../../components/Code';
import type { Vim } from '../../vim/editor';
import type { Section } from '../types';

const file = (...lines: string[]) => lines.join('\n') + '\n';

// A small shop front end.
export const SHOP: Record<string, string> = {
  'README.md': file('# shop', '', 'Cart, checkout and product listing for the storefront.', '', 'Run the tests with `npm test`.'),
  'src/format.ts': file(
    "export function formatPrice(cents: number, cur = 'USD') {",
    '  // TODO: cache Intl.NumberFormat instances',
    "  const fmt = new Intl.NumberFormat('en-US', {",
    "    style: 'currency',",
    '    currency: cur,',
    '  });',
    '  return fmt.format(cents / 100);',
    '}',
  ),
  'src/cart.ts': file(
    "import { formatPrice } from './format';",
    '',
    'export type Line = {',
    '  sku: string;',
    '  qty: number;',
    '  cents: number;',
    '};',
    '',
    'export function total(lines: Line[]) {',
    '  return lines.reduce((sum, l) => sum + l.qty * l.cents, 0);',
    '}',
    '',
    'export function summary(lines: Line[]) {',
    '  // TODO: show a discount line',
    '  const price = formatPrice(total(lines));',
    '  return `${lines.length} items, ${price}`;',
    '}',
  ),
  'src/checkout.ts': file(
    "import { total, type Line } from './cart';",
    "import { formatPrice } from './format';",
    '',
    'export async function checkout(lines: Line[]) {',
    '  const amount = total(lines);',
    '  // TODO: retry on network errors',
    "  const res = await fetch('/api/orders', {",
    "    method: 'POST',",
    '    body: JSON.stringify({ lines, amount }),',
    '  });',
    '  if (!res.ok) {',
    '    const price = formatPrice(amount);',
    '    throw new Error(`Payment of ${price} failed`);',
    '  }',
    '  return res.json();',
    '}',
  ),
  'src/api/products.ts': file(
    "import { formatPrice } from '../format';",
    '',
    'type Item = { name: string; cents: number };',
    '',
    'export async function listProducts() {',
    "  const res = await fetch('/api/products');",
    '  const items: Item[] = await res.json();',
    '  return items.map(',
    '    p => `${p.name}: ${formatPrice(p.cents)}`,',
    '  );',
    '}',
  ),
  'src/api/orders.ts': file(
    'export async function getOrder(id: string) {',
    '  // TODO: handle 404',
    '  const res = await fetch(`/api/orders/${id}`);',
    '  return res.json();',
    '}',
  ),
  'test/cart.test.ts': file(
    "import { expect, it } from 'vitest';",
    "import { total } from '../src/cart';",
    '',
    "it('adds up lines', () => {",
    "  const lines = [{ sku: 'a', qty: 2, cents: 150 }];",
    '  expect(total(lines)).toBe(300);',
    '});',
  ),
};

/** SHOP files after applying `fn` to each of `names`. */
export const edited = (names: string[], fn: (text: string) => string) =>
  Object.fromEntries(names.map(n => [n, fn(SHOP[n])]));

export const SRC = ['src/format.ts', 'src/cart.ts', 'src/checkout.ts', 'src/api/products.ts', 'src/api/orders.ts'];
export const USES_PRICE = ['src/format.ts', 'src/cart.ts', 'src/checkout.ts', 'src/api/products.ts'];

/** Fill the quickfix list, then (optionally) show it without leaving the file. */
export const qf = (cmd: string, open = false, at?: number) => (vim: Vim) => {
  vim.ex(cmd);
  if (at != null) vim.ex(`cc ${at}`);
  if (open) {
    const w = vim.win;
    vim.ex('copen');
    vim.focusWindow(w);
  }
};

/** Each named buffer holds `fn` applied to its file; unnamed files are left as they are on disk. */
export const buffersAre = (names: string[], fn: (text: string) => string) => (vim: Vim) =>
  names.every(n => vim.buffers.find(b => b.name === n)?.lines.join('\n') + '\n' === fn(SHOP[n]));

const qfLength = (vim: Vim) => vim.quickfix.items.length;
const qfWindow = (vim: Vim, loc = false) => vim.tab.windows().find(w => w.buf.kind === 'quickfix' && !!w.buf.data.loc === loc);

/** Where the match on a line of a file starts. */
const at = (name: string, line: number, word: string) => ({ line, col: SHOP[name].split('\n')[line].indexOf(word) });

export const quickfix: Section = {
  id: 'quickfix',
  title: 'Quickfix & Multi-File',
  band: 'project',
  lessons: [
    {
      id: 'grep',
      title: 'Grep',
      chips: [':grep', ':vimgrep'],
      keyCards: [
        { key: ':grep', glyph: 'rg', label: 'external search', sub: ':grep word' },
        { key: ':vimgrep', glyph: '/…/', label: 'Vim regex search', sub: ':vim /pat/ files' },
      ],
      intro: (
        <>
          <p>
            <Code>:vimgrep /TODO/ **/*.ts</Code> searches files with a Vim pattern and collects every match in the
            quickfix list, Vim's list of places to visit, then jumps to the first one. <Code>**</Code> reaches into subdirectories and <Code>%</Code>{' '}
            means the current file.
          </p>
          <p>
            <Code>:grep formatPrice</Code> does the same through an external program, searching the whole project by
            default. It is the faster choice for big trees.
          </p>
        </>
      ),
      practice: total => (
        <p>
          Search the shop project and fill the quickfix list. The message line shows how many matches you got.{' '}
          {total} rounds.
        </p>
      ),
      aside: {
        title: 'ripgrep inside',
        body: (
          <p>
            When ripgrep is installed, Neovim sets <Code>grepprg</Code> to <Code>rg --vimgrep -uu</Code>, so{' '}
            <Code>:grep</Code> takes ripgrep's regex syntax. <Code>:vimgrep</Code> always uses Vim's own patterns.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        base: { files: SHOP, open: 'src/cart.ts', height: 16 },
        rounds: [
          {
            prompt: 'Find every TODO in the .ts files.',
            goal: { check: vim => qfLength(vim) === 4 },
            solution: ':vimgrep /TODO/ **/*.ts<CR>',
          },
          {
            prompt: 'Find every use of formatPrice with :grep.',
            goal: { check: vim => qfLength(vim) === 7 },
            solution: ':grep formatPrice<CR>',
          },
          {
            prompt: 'Find every "fetch" in the files under src/api.',
            goal: { check: vim => qfLength(vim) === 2 && vim.quickfix.items.every(it => it.file.startsWith('src/api/')) },
            solution: ':vim /fetch/ src/api/*<CR>',
          },
          {
            prompt: 'Find "total" in this file only.',
            goal: { check: vim => qfLength(vim) === 2 && vim.quickfix.items.every(it => it.file === 'src/cart.ts') },
            solution: ':vim /total/ %<CR>',
          },
        ],
      },
    },
    {
      id: 'quickfix-list',
      title: 'Quickfix List',
      chips: [':copen', ':cclose'],
      keyCards: [
        { key: ':copen', glyph: '▤', label: 'open the list' },
        { key: 'CR', glyph: '⏎', label: 'jump to entry' },
        { key: ':cclose', glyph: '✕', label: 'close the list' },
      ],
      intro: (
        <>
          <p>
            <Code>:copen</Code> shows the quickfix list in a window along the bottom, one match per line with its file
            and line number. Move with <Code>j</Code> and <Code>k</Code>, and press <Code>Enter</Code> to jump to an
            entry in the window above.
          </p>
          <p>
            <Code>:cclose</Code> hides the list again. The list itself stays, ready for the next <Code>:copen</Code>.
          </p>
        </>
      ),
      practice: total => (
        <p>
          The quickfix list already holds search results. Open it, pick entries and close it. {total} rounds.
        </p>
      ),
      aside: {
        title: 'Only when needed',
        body: (
          <p>
            <Code>:cwindow</Code> opens the list only if it has entries, which makes it a good follow-up to{' '}
            <Code>:grep</Code> in a mapping: <Code>:grep foo | cwindow</Code>.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        base: { files: SHOP, open: 'src/cart.ts', height: 18, init: qf('vimgrep /TODO/ **/*.ts') },
        rounds: [
          {
            prompt: 'Open the quickfix window.',
            goal: { check: vim => vim.buf.kind === 'quickfix' },
            solution: ':copen<CR>',
          },
          {
            prompt: 'Open the list and jump to the third entry.',
            goal: { buffer: 'src/checkout.ts', cursor: at('src/checkout.ts', 5, 'TODO') },
            solution: ':copen<CR>jj<CR>',
          },
          {
            prompt: 'Open the list and jump to the last TODO.',
            goal: { buffer: 'src/format.ts', cursor: at('src/format.ts', 1, 'TODO') },
            solution: ':copen<CR>G<CR>',
          },
          {
            prompt: 'Close the quickfix window.',
            setup: { init: qf('vimgrep /TODO/ **/*.ts', true) },
            goal: { check: vim => !qfWindow(vim) },
            solution: ':cclose<CR>',
          },
          {
            prompt: 'This list holds every formatPrice. Jump to the one on line 9 of products.ts.',
            setup: { init: qf('vimgrep /formatPrice/ **/*.ts') },
            goal: { buffer: 'src/api/products.ts', cursor: at('src/api/products.ts', 8, 'formatPrice') },
            solution: ':copen<CR>j<CR>',
          },
        ],
      },
    },
    {
      id: 'walking-results',
      title: 'Walking Results',
      chips: ['[q', ']q'],
      keyCards: [
        { key: '[q', glyph: '↑', label: 'previous match' },
        { key: ']q', glyph: '↓', label: 'next match' },
        { key: '[Q', glyph: '⇈', label: 'first match' },
        { key: ']Q', glyph: '⇊', label: 'last match' },
      ],
      intro: (
        <>
          <p>
            <Code>]q</Code> jumps to the next entry in the quickfix list and <Code>[q</Code> to the previous one,
            opening other files as needed. A count skips entries: <Code>3]q</Code>.
          </p>
          <p>
            It's the loop for reviewing search results: jump, read or fix, jump again. You don't need the quickfix
            window open.
          </p>
        </>
      ),
      practice: total => (
        <p>
          The list holds every <Code>formatPrice</Code> in the project. Walk to the match each round asks for; the
          message line shows where you are. {total} rounds.
        </p>
      ),
      aside: {
        title: 'In classic Vim',
        body: (
          <p>
            These maps are built in since Neovim 0.11, with <Code>[Q</Code> and <Code>]Q</Code> for the first and last
            entry. In Vim use <Code>:cnext</Code> and <Code>:cprev</Code>, or install vim-unimpaired.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        showGoal: false,
        base: { files: SHOP, open: 'src/cart.ts', height: 16 },
        rounds: [
          {
            prompt: 'Go to the next match.',
            setup: { init: qf('vimgrep /formatPrice/ **/*.ts') },
            goal: { buffer: 'src/api/products.ts', cursor: at('src/api/products.ts', 8, 'formatPrice') },
            solution: ']q',
          },
          {
            prompt: 'Go back one match.',
            setup: { init: qf('vimgrep /formatPrice/ **/*.ts', false, 4) },
            goal: { buffer: 'src/cart.ts', cursor: at('src/cart.ts', 0, 'formatPrice') },
            solution: '[q',
          },
          {
            prompt: 'Skip ahead three matches.',
            setup: { init: qf('vimgrep /formatPrice/ **/*.ts') },
            goal: { buffer: 'src/cart.ts', cursor: at('src/cart.ts', 14, 'formatPrice') },
            solution: '3]q',
          },
          {
            prompt: 'Back two matches, into checkout.ts.',
            setup: { init: qf('vimgrep /formatPrice/ **/*.ts', false, 7) },
            goal: { buffer: 'src/checkout.ts', cursor: at('src/checkout.ts', 1, 'formatPrice') },
            solution: '[q[q',
          },
          {
            prompt: 'This list holds the TODOs. Go to the next one.',
            setup: { init: qf('vimgrep /TODO/ **/*.ts', false, 2) },
            goal: { buffer: 'src/checkout.ts', cursor: at('src/checkout.ts', 5, 'TODO') },
            solution: ']q',
          },
        ],
      },
    },
    {
      id: 'location-list',
      title: 'Location List',
      chips: [':lopen', '[l', ']l'],
      keyCards: [
        { key: ':lopen', glyph: '▤', label: 'open location list' },
        { key: '[l', glyph: '↑', label: 'previous entry' },
        { key: ']l', glyph: '↓', label: 'next entry' },
      ],
      intro: (
        <>
          <p>
            The location list is a quickfix list that belongs to one window. Commands that fill or walk it start with{' '}
            <Code>l</Code>: <Code>:lvimgrep</Code>, <Code>:lopen</Code>, and <Code>[l</Code> <Code>]l</Code> to step
            through it.
          </p>
          <p>
            Use it for searches that only matter where you are, like every reference in this file, and keep the
            quickfix list for the project-wide ones.
          </p>
        </>
      ),
      practice: total => (
        <p>
          The location list for this window holds every <Code>lines.</Code> in cart.ts. Open it and walk it.{' '}
          {total} rounds.
        </p>
      ),
      aside: {
        title: 'Diagnostics too',
        body: (
          <p>
            <Code>vim.diagnostic.setloclist()</Code> puts the LSP's errors for the current buffer in the location list,
            and <Code>[d</Code> <Code>]d</Code>, from Code Navigation, walk them directly.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        base: { files: SHOP, open: 'src/cart.ts', height: 18, init: vim => vim.ex('lvimgrep /lines\\./ %') },
        rounds: [
          {
            prompt: 'Go to the next entry.',
            goal: { cursor: at('src/cart.ts', 15, 'lines') },
            solution: ']l',
          },
          {
            prompt: 'Go back one entry.',
            setup: { init: vim => { vim.ex('lvimgrep /lines\\./ %'); vim.ex('ll 2'); } },
            goal: { cursor: at('src/cart.ts', 9, 'lines') },
            solution: '[l',
          },
          {
            prompt: 'Open the location list.',
            goal: { check: vim => vim.buf.kind === 'quickfix' && vim.buf.data.loc === true },
            solution: ':lopen<CR>',
          },
          {
            prompt: 'Open the list and jump to the last entry.',
            goal: { cursor: at('src/cart.ts', 15, 'lines') },
            solution: ':lopen<CR>G<CR>',
          },
          {
            prompt: 'Fill the location list with every formatPrice in this file, using :lvimgrep.',
            setup: { init: () => {} },
            goal: { check: vim => vim.win.loclist?.items.length === 2 },
            solution: ':lvimgrep /formatPrice/ %<CR>',
          },
        ],
      },
    },
  ],
};
