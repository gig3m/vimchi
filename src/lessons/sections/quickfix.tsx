import { Code } from '../../components/Code';
import type { Vim } from '../../vim/editor';
import type { Section } from '../types';

const file = (...lines: string[]) => lines.join('\n') + '\n';

// A small shop front end.
const SHOP: Record<string, string> = {
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
const edited = (names: string[], fn: (text: string) => string) =>
  Object.fromEntries(names.map(n => [n, fn(SHOP[n])]));

const SRC = ['src/format.ts', 'src/cart.ts', 'src/checkout.ts', 'src/api/products.ts', 'src/api/orders.ts'];
const USES_PRICE = ['src/format.ts', 'src/cart.ts', 'src/checkout.ts', 'src/api/products.ts'];

/** Fill the quickfix list, then (optionally) show it without leaving the file. */
const qf = (cmd: string, open = false, at?: number) => (vim: Vim) => {
  vim.ex(cmd);
  if (at != null) vim.ex(`cc ${at}`);
  if (open) {
    const w = vim.win;
    vim.ex('copen');
    vim.focusWindow(w);
  }
};

const qfLength = (vim: Vim) => vim.quickfix.items.length;
const qfWindow = (vim: Vim, loc = false) => vim.tab.windows().find(w => w.buf.kind === 'quickfix' && !!w.buf.data.loc === loc);

/** Where the match on a line of a file starts. */
const at = (name: string, line: number, word: string) => ({ line, col: SHOP[name].split('\n')[line].indexOf(word) });

export const quickfix: Section = {
  id: 'quickfix',
  title: 'Quickfix & Multi-File',
  band: 'deep',
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
            quickfix list, then jumps to the first one. <Code>**</Code> reaches into subdirectories and <Code>%</Code>{' '}
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
            prompt: 'Find the fetch calls in src/api only.',
            goal: { check: vim => qfLength(vim) === 2 && vim.quickfix.items.every(it => it.file.startsWith('src/api/')) },
            solution: ':vimgrep /fetch(/ src/api/*.ts<CR>',
          },
          {
            prompt: 'Find the word "total" in this file only.',
            goal: { check: vim => qfLength(vim) === 2 && vim.quickfix.items.every(it => it.file === 'src/cart.ts') },
            solution: ':vimgrep /\\<lt>total\\>/ %<CR>',
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
            prompt: 'Open the list and jump to the third TODO.',
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
            prompt: 'Go to the formatPrice call in products.ts, not its import.',
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
            prompt: 'On to the next TODO.',
            setup: { init: qf('vimgrep /TODO/ **/*.ts', false, 2) },
            goal: { buffer: 'src/checkout.ts', cursor: at('src/checkout.ts', 5, 'TODO') },
            solution: ']q',
          },
        ],
      },
    },
    {
      id: 'edit-every-match',
      title: 'Edit Every Match',
      chips: [':cdo'],
      keyCards: [{ key: ':cdo', glyph: '∀', label: 'run on each entry', sub: ':cdo s/a/b/ | update' }],
      intro: (
        <>
          <p>
            <Code>:cdo</Code> runs a command at every entry in the quickfix list, one after another. With{' '}
            <Code>:s</Code> it becomes a project-wide search and replace that only touches the lines you found.
          </p>
          <p>
            Add <Code>| update</Code> so each file is saved after its change: <Code>:cdo s/old/new/ | update</Code>.
          </p>
        </>
      ),
      practice: total => (
        <p>
          The quickfix list is open with the matches. Change every one with a single <Code>:cdo</Code> and save the
          files. {total} rounds.
        </p>
      ),
      aside: {
        title: 'Once per file',
        body: (
          <p>
            <Code>:cfdo</Code> runs the command once per file instead of once per entry, so it pairs with{' '}
            <Code>%s</Code>: <Code>:cfdo %s/old/new/g | update</Code>.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        base: { files: SHOP, open: 'src/cart.ts', height: 18 },
        rounds: [
          {
            prompt: 'Rename formatPrice to formatMoney everywhere.',
            setup: { init: qf('vimgrep /formatPrice/ **/*.ts', true) },
            goal: { files: edited(USES_PRICE, t => t.replaceAll('formatPrice', 'formatMoney')) },
            solution: ':cdo s/formatPrice/formatMoney/ | update<CR>',
          },
          {
            prompt: 'The TODOs are done. Delete each TODO line.',
            setup: { init: qf('vimgrep /TODO/ **/*.ts', true) },
            goal: { files: edited(SRC, t => t.replace(/^ *\/\/ TODO.*\n/m, '')) },
            solution: ':cdo d | update<CR>',
          },
          {
            prompt: 'Rename total to cartTotal, tests included.',
            setup: { init: qf('vimgrep /\\<total\\>/ **/*.ts', true) },
            goal: {
              files: edited(['src/cart.ts', 'src/checkout.ts', 'test/cart.test.ts'], t => t.replace(/\btotal\b/g, 'cartTotal')),
            },
            solution: ':cdo s/total/cartTotal/ | update<CR>',
          },
          {
            prompt: 'Rename the Line type to CartLine.',
            setup: { init: qf('vimgrep /\\<Line\\>/ **/*.ts', true) },
            goal: { files: edited(['src/cart.ts', 'src/checkout.ts'], t => t.replace(/\bLine\b/g, 'CartLine')) },
            solution: ':cdo s/\\<lt>Line\\>/CartLine/ | update<CR>',
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
          The location list for this window holds every <Code>lines</Code> in cart.ts. Open it and walk it. {total}{' '}
          rounds.
        </p>
      ),
      aside: {
        title: 'Diagnostics too',
        body: (
          <p>
            <Code>vim.diagnostic.setloclist()</Code> puts the LSP's errors for the current buffer in the location list,
            and <Code>[d</Code> <Code>]d</Code> walk them directly.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        base: { files: SHOP, open: 'src/cart.ts', height: 18, init: vim => vim.ex('lvimgrep /\\<lines\\>/ %') },
        rounds: [
          {
            prompt: 'Go to the next entry.',
            goal: { cursor: at('src/cart.ts', 9, 'lines') },
            solution: ']l',
          },
          {
            prompt: 'Go back one entry.',
            setup: { init: vim => { vim.ex('lvimgrep /\\<lines\\>/ %'); vim.ex('ll 3'); } },
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
            prompt: 'Build a location list of formatPrice in this file.',
            setup: { init: () => {} },
            goal: { check: vim => vim.win.loclist?.items.length === 2 },
            solution: ':lvimgrep /formatPrice/ %<CR>',
          },
        ],
      },
    },
    {
      id: 'argument-list',
      title: 'Argument List',
      chips: [':args', ':argdo'],
      keyCards: [
        { key: ':args', glyph: '[…]', label: 'set the file list', sub: ':args src/*.ts' },
        { key: ':argdo', glyph: '∀', label: 'run in each file' },
      ],
      intro: (
        <>
          <p>
            The argument list is the set of files you'd pass to <Code>nvim</Code> on the command line. Replace it at
            any time with <Code>:args src/api/*.ts</Code>; globs and <Code>**</Code> work.
          </p>
          <p>
            <Code>:argdo</Code> then runs a command in each of those files. It's the tool for a batch edit over a set of
            files you choose by name rather than by search.
          </p>
        </>
      ),
      practice: total => (
        <p>
          Set the argument list, or run a command over it and save with <Code>| update</Code>. {total} rounds.
        </p>
      ),
      aside: {
        title: 'Where am I?',
        body: (
          <p>
            <Code>:args</Code> on its own prints the list with the current file in brackets. <Code>]a</Code> and{' '}
            <Code>[a</Code> step through it.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        base: { files: SHOP, open: 'README.md', height: 16 },
        rounds: [
          {
            prompt: 'Make the argument list the two files in src/api.',
            goal: { check: vim => vim.args.join(' ') === 'src/api/orders.ts src/api/products.ts' },
            solution: ':args src/api/*.ts<CR>',
          },
          {
            prompt: 'Make it every .ts file directly in src (not src/api).',
            goal: { check: vim => vim.args.join(' ') === 'src/cart.ts src/checkout.ts src/format.ts' },
            solution: ':args src/*.ts<CR>',
          },
          {
            prompt: 'Rename formatPrice to formatMoney in every file in the list.',
            setup: { init: vim => vim.ex('args src/**/*.ts') },
            goal: { files: edited(USES_PRICE, t => t.replaceAll('formatPrice', 'formatMoney')) },
            solution: ':argdo %s/formatPrice/formatMoney/ge | update<CR>',
          },
          {
            prompt: 'Delete the TODO lines in every file in the list.',
            setup: { init: vim => vim.ex('args src/*.ts') },
            goal: { files: edited(['src/cart.ts', 'src/checkout.ts', 'src/format.ts'], t => t.replace(/^ *\/\/ TODO.*\n/m, '')) },
            solution: ':argdo g/TODO/d | update<CR>',
          },
        ],
      },
    },
    {
      id: 'every-buffer',
      title: 'Every Buffer',
      chips: [':bufdo'],
      keyCards: [{ key: ':bufdo', glyph: '∀', label: 'run in each buffer' }],
      intro: (
        <>
          <p>
            <Code>:bufdo</Code> runs a command in every buffer in <Code>:ls</Code>. The files you have open are often
            exactly the ones a change is about.
          </p>
          <p>
            Use <Code>%s</Code> with the <Code>e</Code> flag so buffers without a match don't stop the run, and end with{' '}
            <Code>| update</Code> to save each one.
          </p>
        </>
      ),
      practice: total => (
        <p>
          A few files are open as buffers. Change them all with one <Code>:bufdo</Code>. Files that aren't open must stay
          as they are. {total} rounds.
        </p>
      ),
      aside: {
        title: 'Every window',
        body: (
          <p>
            <Code>:windo</Code> does the same for the windows in the current tab, which suits window options:{' '}
            <Code>:windo set wrap</Code>.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        base: { files: SHOP, open: 'src/cart.ts', height: 16 },
        rounds: [
          {
            prompt: 'Rename formatPrice to formatMoney in the open buffers.',
            setup: { init: vim => { vim.ex('e src/checkout.ts'); vim.ex('e src/format.ts'); } },
            goal: {
              files: {
                ...edited(['src/cart.ts', 'src/checkout.ts', 'src/format.ts'], t => t.replaceAll('formatPrice', 'formatMoney')),
                'src/api/products.ts': SHOP['src/api/products.ts'],
              },
            },
            solution: ':bufdo %s/formatPrice/formatMoney/ge | update<CR>',
          },
          {
            prompt: 'Point both API modules at /api/v2/.',
            setup: { open: 'src/api/orders.ts', init: vim => vim.ex('e src/api/products.ts') },
            goal: { files: edited(['src/api/orders.ts', 'src/api/products.ts'], t => t.replace('/api/', '/api/v2/')) },
            solution: ':bufdo %s#/api/#/api/v2/#e | update<CR>',
          },
          {
            prompt: 'Switch the open files to euros: USD becomes EUR.',
            setup: { open: 'src/format.ts', init: vim => { vim.ex('e src/cart.ts'); vim.ex('e README.md'); } },
            goal: { files: edited(['src/format.ts'], t => t.replace('USD', 'EUR')) },
            solution: ':bufdo %s/USD/EUR/ge | update<CR>',
          },
          {
            prompt: 'Delete the TODO lines in the open buffers.',
            setup: { open: 'src/api/orders.ts', init: vim => { vim.ex('e src/cart.ts'); vim.ex('e src/checkout.ts'); } },
            goal: {
              files: {
                ...edited(['src/api/orders.ts', 'src/cart.ts', 'src/checkout.ts'], t => t.replace(/^ *\/\/ TODO.*\n/m, '')),
                'src/format.ts': SHOP['src/format.ts'],
              },
            },
            solution: ':bufdo g/TODO/d | update<CR>',
          },
        ],
      },
    },
  ],
};
