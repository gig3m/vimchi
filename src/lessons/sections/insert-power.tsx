import { Code } from '../../components/Code';
import { BeforeAfter } from '../../components/diagrams';
import type { Vim } from '../../vim/editor';
import type { Section, Setup } from '../types';

/** A round that starts in insert mode. `‸` marks where the cursor sits. */
const typing = (text: string | string[]): Setup => {
  const lines = Array.isArray(text) ? text : [text];
  const line = lines.findIndex(l => l.includes('‸'));
  const col = lines[line].indexOf('‸');
  return {
    text: lines.map(l => l.replace('‸', '')),
    init: (vim: Vim) => vim.startInsert('i', { line, col }),
  };
}

export const insertPower: Section = {
  id: 'insert-power',
  title: 'Insert Mode Power',
  band: 'code',
  lessons: [
    {
      id: 'insert-delete-word',
      title: 'Deleting While Typing',
      chips: ['C-w', 'C-u'],
      keyCards: [
        { key: 'C-w', glyph: '←w', glyphColor: 'var(--red)', label: 'delete word back' },
        { key: 'C-u', glyph: '←|', glyphColor: 'var(--red)', label: 'delete to line start' },
      ],
      intro: (
        <>
          <p>
            In insert mode, <Code>C-w</Code> deletes the word before the cursor and <Code>C-u</Code> deletes everything
            before the cursor on the line, back to the indent.
          </p>
          <p>
            Mistakes happen mid-word. Instead of leaving insert mode or leaning on backspace, wipe the word and type it
            again.
          </p>
          <BeforeAfter
            lines={['  return formatPrice(totl);']}
            cursor={24}
            keys="a<C-w>subtotal<Esc>"
            caption="C-w takes the whole word back; type the right one."
          />
          <BeforeAfter
            lines={['  retrun nul;']}
            cursor={12}
            keys="i<C-u>return null<Esc>"
            caption="C-u clears back to the indent, so you start the line over."
          />
        </>
      ),
      practice: total => (
        <p>
          Each round starts in insert mode, just after a typo. Fix it with <Code>C-w</Code> or <Code>C-u</Code>, then
          press <Code>esc</Code>. (In the browser, <Code>Alt-w</Code> stands in for <Code>C-w</Code>.) {total} rounds.
        </p>
      ),
      aside: {
        title: 'You can take it back',
        body: (
          <p>
            Neovim maps both keys to start a new undo step first, so if you wipe too much, <Code>esc</Code> then{' '}
            <Code>u</Code> brings it back. Both also work on the <Code>:</Code> command line.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        base: { name: 'cart.ts' },
        rounds: [
          {
            prompt: 'You typed "totl". Make it "subtotal".',
            setup: {
              ...typing([
                'export function summary(lines: Line[]) {',
                '  const subtotal = total(lines);',
                '  return formatPrice(totl‸);',
                '}',
              ]),
            },
            goal: {
              text: [
                'export function summary(lines: Line[]) {',
                '  const subtotal = total(lines);',
                '  return formatPrice(subtotal);',
                '}',
              ],
            },
            solution: '<C-w>subtotal<Esc>',
          },
          {
            prompt: 'Fix "find_fils".',
            setup: {
              name: 'telescope.lua',
              ...typing([
                "local builtin = require('telescope.builtin')",
                "map('n', '<leader>ff', builtin.find_fils‸)",
                "map('n', '<leader>fg', builtin.live_grep)",
              ]),
            },
            goal: {
              text: [
                "local builtin = require('telescope.builtin')",
                "map('n', '<leader>ff', builtin.find_files)",
                "map('n', '<leader>fg', builtin.live_grep)",
              ],
            },
            solution: '<C-w>find_files<Esc>',
          },
          {
            prompt: 'Nothing on this line is right. Start it over.',
            setup: { ...typing(['function unwrap(value: string | null) {', '  retrun nul‸;', '}']) },
            goal: { text: ['function unwrap(value: string | null) {', '  return null;', '}'] },
            solution: '<C-u>return null<Esc>',
          },
          {
            prompt: 'Two typos in a row: make it "email address".',
            setup: {
              ...typing([
                'export function validate(input: string) {',
                "  if (!input.includes('@')) {",
                "    throw new Error('Invalid emial adress‸');",
                '  }',
                '}',
              ]),
            },
            goal: {
              text: [
                'export function validate(input: string) {',
                "  if (!input.includes('@')) {",
                "    throw new Error('Invalid email address');",
                '  }',
                '}',
              ],
            },
            solution: '<C-w><C-w>email address<Esc>',
          },
          {
            prompt: 'Change the last word to "README".',
            setup: {
              name: 'commit.sh',
              ...typing(['#!/usr/bin/env bash', 'git add README.md', 'git commit -m "fix typo in raedme‸"']),
            },
            goal: { text: ['#!/usr/bin/env bash', 'git add README.md', 'git commit -m "fix typo in README"'] },
            solution: '<C-w>README<Esc>',
          },
          {
            prompt: 'Retype this one from the indent.',
            setup: {
              name: 'plugins.lua',
              ...typing(['return {', "  'nvim-telescop/telscope.nvm'‸,", "  'nvim-lua/plenary.nvim',", '}']),
            },
            goal: { text: ['return {', "  'nvim-telescope/telescope.nvim',", "  'nvim-lua/plenary.nvim',", '}'] },
            solution: "<C-u>'nvim-telescope/telescope.nvim'<Esc>",
          },
        ],
      },
    },
    {
      id: 'insert-one-command',
      title: 'One Normal Command',
      chips: ['C-o'],
      keyCards: [{ key: 'C-o', glyph: 'n→i', label: 'one normal command', sub: 'then back to insert' }],
      intro: (
        <>
          <p>
            <Code>C-o</Code> in insert mode runs a single normal-mode command, then drops you straight back into insert
            mode where the cursor ends up.
          </p>
          <p>
            It saves the <Code>esc</Code>, command, <Code>i</Code> dance when you only need one thing: jump to the end
            of the line, delete a word ahead, change the case of what you just typed.
          </p>
          <BeforeAfter
            lines={['const total = add(subtotal, tax)']}
            cursor={31}
            keys="i<C-o>$;<Esc>"
            caption="From inside the parentheses, C-o $ hops to the end; the ; lands there."
          />
        </>
      ),
      practice: total => (
        <p>
          Each round starts in insert mode. Use <Code>C-o</Code> for the one normal-mode step, finish typing, then press{' '}
          <Code>esc</Code>. {total} rounds.
        </p>
      ),
      aside: {
        title: 'Keep your place on screen',
        body: (
          <p>
            <Code>C-o zz</Code> recentres the screen while you keep typing, which helps when you've drifted to the
            bottom edge.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        base: { name: 'app.ts' },
        rounds: [
          {
            prompt: 'Finish the line with a semicolon.',
            setup: {
              ...typing([
                'const subtotal = sum(prices);',
                'const tax = subtotal * TAX_RATE;',
                'const total = add(subtotal, tax‸)',
                'console.log(total);',
              ]),
            },
            goal: {
              text: [
                'const subtotal = sum(prices);',
                'const tax = subtotal * TAX_RATE;',
                'const total = add(subtotal, tax);',
                'console.log(total);',
              ],
            },
            solution: '<C-o>$;<Esc>',
          },
          {
            prompt: 'Replace "debugMessage" with "msg".',
            setup: {
              ...typing(['function onSave(doc: Doc) {', '  const msg = `saved ${doc.id}`;', '  logger.info(‸debugMessage);', '}']),
            },
            goal: { text: ['function onSave(doc: Doc) {', '  const msg = `saved ${doc.id}`;', '  logger.info(msg);', '}'] },
            solution: '<C-o>dwmsg<Esc>',
          },
          {
            prompt: 'Add "await " before the call.',
            setup: {
              ...typing(['export async function load(url: string) {', '  const data = fetchJson(url‸);', '  return data.items;', '}']),
            },
            goal: {
              text: ['export async function load(url: string) {', '  const data = await fetchJson(url);', '  return data.items;', '}'],
            },
            solution: '<C-o>T await <Esc>',
          },
          {
            prompt: 'You just typed max_retries. Make it upper case.',
            setup: { ...typing(['const max_retries‸ = 3;', 'const BACKOFF_MS = 250;', 'const TIMEOUT_MS = 5000;']) },
            goal: { text: ['const MAX_RETRIES = 3;', 'const BACKOFF_MS = 250;', 'const TIMEOUT_MS = 5000;'] },
            solution: '<C-o>gUb<Esc>',
          },
          {
            prompt: 'Type "v2", then delete the rest of the path up to the quote.',
            setup: {
              ...typing(['const base = process.env.API_URL;', "const url = base + '/api/‸v1/users';", 'const res = await fetch(url);']),
            },
            goal: { text: ['const base = process.env.API_URL;', "const url = base + '/api/v2';", 'const res = await fetch(url);'] },
            solution: "v2<C-o>dt'<Esc>",
          },
        ],
      },
    },
    {
      id: 'completion-menu',
      title: 'Completion Menu',
      chips: ['C-n', 'C-y', 'C-e'],
      keyCards: [
        { key: 'C-n', glyph: '↓', label: 'next candidate', sub: 'C-p: previous' },
        { key: 'C-y', glyph: '✓', label: 'accept' },
        { key: 'C-e', glyph: '✕', label: 'dismiss' },
      ],
      intro: (
        <>
          <p>
            In a starter config the completion menu (blink.cmp or nvim-cmp) pops up as you type: names from
            your buffers, the language server, snippets. <Code>C-n</Code> and <Code>C-p</Code> move through
            it, <Code>C-y</Code> takes the highlighted item, <Code>C-e</Code> closes it and keeps what you typed.
          </p>
          <p>
            Vim's own menu works the same way without a plugin: <Code>C-n</Code> opens it on words from open
            buffers, and the same <Code>C-y</Code> / <Code>C-e</Code> apply. That is what you practise here.
          </p>
        </>
      ),
      practice: total => (
        <p>
          Each round starts in insert mode. Open the menu, accept the right word, then <Code>esc</Code>. {total}{' '}
          rounds.
        </p>
      ),
      aside: {
        title: 'Enter or C-y?',
        body: (
          <p>
            LazyVim accepts with <Code>CR</Code> as well as <Code>C-y</Code>; kickstart uses <Code>C-y</Code> only,
            so a stray Enter never grabs a candidate you did not want. <Code>C-space</Code> opens the
            documentation for the highlighted item in both.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        base: { name: 'orders.ts' },
        rounds: [
          {
            prompt: 'Complete "cus" to customerName.',
            setup: typing(['const customerName = order.name;', 'const count = 1;', 'const label = cus‸']),
            goal: { text: ['const customerName = order.name;', 'const count = 1;', 'const label = customerName'] },
            solution: '<C-n><C-y><Esc>',
          },
          {
            prompt: 'Complete "inv" to invoiceTotal, not invoiceId (it comes first).',
            setup: typing(['let invoiceId = 1;', 'let invoiceTotal = 0;', 'return inv‸']),
            goal: { text: ['let invoiceId = 1;', 'let invoiceTotal = 0;', 'return invoiceTotal'] },
            solution: '<C-n><C-n><C-y><Esc>',
          },
          {
            prompt: 'Open the menu, then dismiss it and keep "ord".',
            setup: typing(['const orders = [];', 'const order = 1;', 'const x = ord‸']),
            goal: { text: ['const orders = [];', 'const order = 1;', 'const x = ord'] },
            solution: '<C-n><C-e><Esc>',
          },
        ],
      },
    },
    {
      id: 'snippets',
      title: 'Snippets',
      chips: ['tab', 'S-tab'],
      keyCards: [
        { key: 'tab', glyph: '⇥', label: 'expand / next field' },
        { key: 'S-tab', glyph: '⇤', label: 'previous field' },
      ],
      intro: (
        <>
          <p>
            A snippet turns a short trigger into a block with blanks to fill: type <Code>fn</Code>, press{' '}
            <Code>tab</Code>, and a whole function skeleton appears with the cursor on its name. Each{' '}
            <Code>tab</Code> jumps to the next blank; <Code>S-tab</Code> goes back.
          </p>
          <p>
            friendly-snippets ships hundreds of these for every language; both starters wire them into the
            completion menu. The tutor has four: <Code>fn</Code>, <Code>for</Code>, <Code>if</Code>,{' '}
            <Code>log</Code>.
          </p>
        </>
      ),
      practice: total => (
        <p>
          Each round starts in insert mode after a trigger. Expand it and fill its fields, then <Code>esc</Code>.{' '}
          {total} rounds.
        </p>
      ),
      aside: {
        title: 'Where tab goes',
        body: (
          <p>
            In both starters a snippet is an item in the completion menu: <Code>C-y</Code> accepts it, which
            expands it. The tutor's <Code>tab</Code> on the trigger word stands in for that step. Jumping
            between fields with <Code>tab</Code> / <Code>S-tab</Code> is blink.cmp's default in both.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        base: { name: 'util.ts', plugins: ['snippets'] },
        rounds: [
          {
            prompt: 'Expand fn into function greet(name) { return name; }.',
            setup: typing(['// greeting helper', '', 'fn‸']),
            goal: { text: ['// greeting helper', '', 'function greet(name) {', '  return name;', '}'] },
            solution: '<Tab>greet<Tab>name<Tab>return name;<Esc>',
          },
          {
            prompt: 'Expand log to print total.',
            setup: typing(['const prices = [1, 2];', 'const total = 3;', 'log‸']),
            goal: { text: ['const prices = [1, 2];', 'const total = 3;', 'console.log(total);'] },
            solution: '<Tab>total<Esc>',
          },
          {
            prompt: 'Expand for over items as item, with the body item.run().',
            setup: typing(['const items = load();', '', 'for‸']),
            goal: { text: ['const items = load();', '', 'for (const item of items) {', '  item.run();', '}'] },
            solution: '<Tab>item<Tab>items<Tab>item.run();<Esc>',
          },
        ],
      },
    },
  ],
};
