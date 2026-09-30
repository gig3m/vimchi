import { Code, Mono } from '../../components/Code';
import { BeforeAfter } from '../../components/diagrams';
import type { Section } from '../types';

// The boss: one messy Neovim config, cleaned up a step per round.
const BOSS_COMMENT = [
  '-- Editor options. Keep these in sync with .editorconfig',
  '-- so other editors agree with Neovim.',
];
const bossMessy = [
  'local opts = {',
  'tabstop = 4,',
  '    shiftwidth = 4,',
  '  scrolloff = 8,',
  '}',
  '',
  'if vim.g.neovide then',
  "vim.o.guifont = 'jetbrains mono:h14'",
  'end',
];
const bossIndented = [
  'local opts = {',
  '  tabstop = 4,',
  '  shiftwidth = 4,',
  '  scrolloff = 8,',
  '}',
  '',
  'if vim.g.neovide then',
  "  vim.o.guifont = 'jetbrains mono:h14'",
  'end',
];
const bossNumbers = bossIndented.map(l => l.replace(/(tabstop|shiftwidth) = 4/, '$1 = 2'));
const bossFont = bossNumbers.map(l => l.replace('jetbrains mono', 'JetBrains Mono'));
const bossWrapped = [
  '-- Editor options. Keep these in sync with',
  '-- .editorconfig so other editors agree with',
  '-- Neovim.',
];

export const indentCase: Section = {
  id: 'indent-case',
  title: 'Indent & Case',
  band: 'core',
  lessons: [
    {
      id: 'indenting',
      title: 'Indenting',
      chips: ['>>', '<<', '>'],
      keyCards: [
        { key: '>>', glyph: '→≡', label: 'indent line' },
        { key: '<<', glyph: '≡←', label: 'dedent line' },
        { key: '>', glyph: '→', label: 'indent operator' },
      ],
      intro: (
        <>
          <p>
            <Code>&gt;&gt;</Code> shifts the current line right by one <Mono>shiftwidth</Mono> (the indent size), <Code>&lt;&lt;</Code>{' '}
            shifts it left. A count shifts that many lines: <Code>3&gt;&gt;</Code>.
          </p>
          <p>
            <Code>&gt;</Code> and <Code>&lt;</Code> are operators, so they take any motion or text object.{' '}
            <Code>&gt;i{'{'}</Code> indents the body of a block, <Code>&lt;2j</Code> this line and the two below.
          </p>
          <BeforeAfter lines={['if (ok) {', 'run();', 'done();', '}']} cursor={[1, 0]} keys=">j" />
        </>
      ),
      practice: total => (
        <p>
          Shift lines until the indentation matches the goal. Shiftwidth is 2 here. {total} rounds.
        </p>
      ),
      aside: {
        title: 'Deeper in one go',
        body: (
          <p>
            In visual mode a count means levels: <Code>V</Code> <Code>3&gt;</Code> shifts the selection three times. In
            normal mode, press <Code>.</Code> to shift again.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        base: { name: 'greet.ts' },
        rounds: [
          {
            prompt: 'Indent the "return" line one level.',
            setup: { text: ['function greet(name: string) {', 'return `Hello, ${name}`;', '}'], cursor: { line: 1, col: 0 } },
            goal: { text: ['function greet(name: string) {', '  return `Hello, ${name}`;', '}'] },
            solution: '>>',
          },
          {
            prompt: 'Shift the "vim.o.guifont" line one level left.',
            setup: {
              name: 'gui.lua',
              text: ['if vim.g.neovide then', "    vim.o.guifont = 'JetBrains Mono:h14'", 'end'],
              cursor: { line: 1, col: 4 },
            },
            goal: { text: ['if vim.g.neovide then', "  vim.o.guifont = 'JetBrains Mono:h14'", 'end'] },
            solution: '<<',
          },
          {
            prompt: 'Indent everything inside the braces.',
            setup: {
              name: 'theme.ts',
              text: ['const theme = {', "bg: '#1e1e2e',", "fg: '#cdd6f4',", "accent: '#89b4fa',", '};'],
              cursor: { line: 2, col: 0 },
            },
            goal: { text: ['const theme = {', "  bg: '#1e1e2e',", "  fg: '#cdd6f4',", "  accent: '#89b4fa',", '};'] },
            solution: '>i{',
          },
          {
            prompt: 'Indent "setup(server)" two levels.',
            setup: {
              name: 'lsp.lua',
              text: ['for _, server in ipairs(servers) do', '  if server.enabled then', 'setup(server)', '  end', 'end'],
              cursor: { line: 2, col: 0 },
            },
            goal: { text: ['for _, server in ipairs(servers) do', '  if server.enabled then', '    setup(server)', '  end', 'end'] },
            solution: '>>.',
          },
          {
            prompt: 'Pull the three lines under "test:" back one level.',
            setup: {
              name: 'ci.yml',
              text: ['jobs:', '  test:', '      runs-on: ubuntu-latest', '      steps:', '        - uses: actions/checkout@v4'],
              cursor: { line: 2, col: 6 },
            },
            goal: { text: ['jobs:', '  test:', '    runs-on: ubuntu-latest', '    steps:', '      - uses: actions/checkout@v4'] },
            solution: '<2j',
          },
        ],
      },
    },
    {
      id: 'auto-indent',
      title: 'Auto-Indent',
      chips: ['=', '=='],
      keyCards: [
        { key: '=', glyph: '⇥', label: 'reindent operator' },
        { key: '==', glyph: '⇥≡', label: 'reindent line' },
      ],
      intro: (
        <>
          <p>
            <Code>=</Code> re-indents lines the way the filetype says they should be. <Code>==</Code> fixes the current
            line; <Code>=i{'{'}</Code> fixes a block; <Code>gg=G</Code> fixes the whole file.
          </p>
          <p>
            Use it after pasting code from somewhere else, or when an edit has left a block ragged. You don't count
            levels; Vim works them out from the brackets and keywords around.
          </p>
          <BeforeAfter lines={['if (ready) {', 'start();', '      log(1);', '}']} cursor={[0, 0]} keys="=G" />
        </>
      ),
      practice: total => (
        <p>
          Let <Code>=</Code> fix the indentation. {total} rounds.
        </p>
      ),
      aside: {
        title: 'Formatters',
        body: (
          <p>
            <Code>=</Code> only moves lines left and right. For full formatting (line breaks, quotes, spacing) most setups
            run a formatter such as Prettier or stylua through conform.nvim or the LSP.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        base: { name: 'math.ts' },
        rounds: [
          {
            prompt: 'Fix the indentation of the "return" line.',
            setup: {
              text: ['export function clamp(n: number, lo: number, hi: number) {', '        return Math.min(hi, Math.max(lo, n));', '}'],
              cursor: { line: 1, col: 8 },
            },
            goal: { text: ['export function clamp(n: number, lo: number, hi: number) {', '  return Math.min(hi, Math.max(lo, n));', '}'] },
            solution: '==',
          },
          {
            prompt: 'Fix the indentation inside the outermost { }.',
            setup: {
              name: 'routes.ts',
              text: [
                'export const routes = {',
                "home: '/',",
                "    about: '/about',",
                '  blog: {',
                "index: '/blog',",
                "      post: '/blog/:slug',",
                '  },',
                '};',
              ],
              cursor: { line: 1, col: 0 },
            },
            goal: {
              text: [
                'export const routes = {',
                "  home: '/',",
                "  about: '/about',",
                '  blog: {',
                "    index: '/blog',",
                "    post: '/blog/:slug',",
                '  },',
                '};',
              ],
            },
            solution: '=i{',
          },
          {
            prompt: 'Fix the indentation of the "function logAll" block.',
            setup: {
              text: [
                'function first(xs: number[]) {',
                '  return xs[0];',
                '}',
                '',
                'function logAll(xs: number[]) {',
                '    for (const x of xs) {',
                'console.log(x);',
                '        }',
                '}',
              ],
              cursor: { line: 6, col: 0 },
            },
            goal: {
              text: [
                'function first(xs: number[]) {',
                '  return xs[0];',
                '}',
                '',
                'function logAll(xs: number[]) {',
                '  for (const x of xs) {',
                '    console.log(x);',
                '  }',
                '}',
              ],
            },
            solution: '=ap',
          },
          {
            prompt: 'Re-indent the whole file.',
            setup: {
              name: 'lsp.lua',
              text: [
                'local function on_attach(client, bufnr)',
                'local map = function(keys, fn)',
                "vim.keymap.set('n', keys, fn, { buffer = bufnr })",
                'end',
                "if client.supports_method('textDocument/formatting') then",
                "map('<leader>f', vim.lsp.buf.format)",
                'else',
                "map('<leader>f', function() end)",
                'end',
                'end',
              ],
              cursor: { line: 5, col: 0 },
            },
            goal: {
              text: [
                'local function on_attach(client, bufnr)',
                '  local map = function(keys, fn)',
                "    vim.keymap.set('n', keys, fn, { buffer = bufnr })",
                '  end',
                "  if client.supports_method('textDocument/formatting') then",
                "    map('<leader>f', vim.lsp.buf.format)",
                '  else',
                "    map('<leader>f', function() end)",
                '  end',
                'end',
              ],
            },
            solution: 'gg=G',
          },
        ],
      },
    },
    {
      id: 'toggle-case',
      title: 'Toggle Case',
      chips: ['~'],
      keyCards: [{ key: '~', glyph: 'a⇄A', label: 'toggle case' }],
      intro: (
        <>
          <p>
            <Code>~</Code> flips the case of the character under the cursor and moves one to the right. A count flips
            that many: <Code>4~</Code>.
          </p>
          <p>
            It's the quick fix for one wrong capital, and since it moves along as it goes, repeated presses walk across a
            word.
          </p>
          <BeforeAfter lines={["const api_url = '/v1';"]} cursor={6} keys="3~" />
        </>
      ),
      practice: total => (
        <p>
          Move to the wrong letters and flip them with <Code>~</Code>. {total} rounds.
        </p>
      ),
      aside: {
        title: 'The tildeop option',
        body: (
          <p>
            With <Code>:set tildeop</Code>, <Code>~</Code> becomes an operator like <Code>g~</Code> and needs a motion.
            It's off by default in both Vim and Neovim.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        base: { name: 'app.ts' },
        rounds: [
          {
            prompt: 'Change "userService" to "UserService".',
            setup: {
              text: ["import { db } from './db';", '', 'class userService {', '  find = (id: string) => db.get(id);', '}'],
              cursor: { line: 4, col: 0 },
            },
            goal: {
              text: ["import { db } from './db';", '', 'class UserService {', '  find = (id: string) => db.get(id);', '}'],
            },
            solution: 'kkw~',
          },
          {
            prompt: 'Change "getting started" to "Getting Started".',
            setup: {
              name: 'README.md',
              text: ['# getting started', '', 'Clone the repo, then run npm install.'],
              cursor: { line: 0, col: 0 },
            },
            goal: { text: ['# Getting Started', '', 'Clone the repo, then run npm install.'] },
            solution: 'w~w~',
          },
          {
            prompt: 'Change "innerHtml" to "innerHTML".',
            setup: {
              text: ["const el = document.querySelector('#app');", "el.innerHtml = '';", 'el.append(view());'],
              cursor: { line: 0, col: 0 },
            },
            goal: { text: ["const el = document.querySelector('#app');", "el.innerHTML = '';", 'el.append(view());'] },
            solution: 'jft3~',
          },
          {
            prompt: 'Change "API_url" to "API_URL".',
            setup: {
              text: ['// Shared constants', "const API_url = 'https://api.example.com';", 'const TIMEOUT_MS = 5000;'],
              cursor: { line: 2, col: 0 },
            },
            goal: { text: ['// Shared constants', "const API_URL = 'https://api.example.com';", 'const TIMEOUT_MS = 5000;'] },
            solution: 'kfu3~',
          },
          {
            prompt: 'Uppercase "select" and "from".',
            setup: {
              name: 'query.sql',
              text: ['-- active users', 'select * from users', 'WHERE active = true;'],
              cursor: { line: 1, col: 0 },
            },
            goal: { text: ['-- active users', 'SELECT * FROM users', 'WHERE active = true;'] },
            solution: '6~2w4~',
          },
        ],
      },
    },
    {
      id: 'case-operators',
      title: 'Case Operators',
      chips: ['gu', 'gU', 'g~'],
      keyCards: [
        { key: 'gu', glyph: 'A→a', label: 'lowercase' },
        { key: 'gU', glyph: 'a→A', label: 'uppercase' },
        { key: 'g~', glyph: 'a⇄A', label: 'toggle case' },
      ],
      intro: (
        <>
          <p>
            <Code>gu</Code>, <Code>gU</Code> and <Code>g~</Code> are operators: lowercase, uppercase and toggle, over any
            motion or text object. <Code>gUiw</Code> uppercases a word, <Code>gu$</Code> lowercases to the end of the
            line.
          </p>
          <p>
            Doubled, they work on the whole line: <Code>guu</Code>, <Code>gUU</Code>, <Code>g~~</Code>.
          </p>
          <BeforeAfter lines={["local log_level = 'warn'"]} cursor={8} keys="gUiw" />
        </>
      ),
      practice: total => (
        <p>
          Fix the case with one operator and a motion or text object. {total} rounds.
        </p>
      ),
      aside: {
        title: 'In visual mode',
        body: (
          <p>
            With a selection, <Code>u</Code> lowercases, <Code>U</Code> uppercases and <Code>~</Code> toggles. Handy after{' '}
            <Code>C-v</Code> when the text sits in a column.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        base: { name: 'config.ts' },
        rounds: [
          {
            prompt: 'Uppercase "max_retries".',
            setup: {
              text: ['export const max_retries = 5;', 'export const TIMEOUT_MS = 3000;', "export const BASE_URL = '/api';"],
              cursor: { line: 0, col: 15 },
            },
            goal: {
              text: ['export const MAX_RETRIES = 5;', 'export const TIMEOUT_MS = 3000;', "export const BASE_URL = '/api';"],
            },
            solution: 'gUiw',
          },
          {
            prompt: 'Lowercase "Lin@Example.COM".',
            setup: {
              name: 'CONTRIBUTING.md',
              text: ['## Questions', '', 'Contact: Lin@Example.COM', 'Replies within a week.'],
              cursor: { line: 2, col: 9 },
            },
            goal: { text: ['## Questions', '', 'Contact: lin@example.com', 'Replies within a week.'] },
            solution: 'gu$',
          },
          {
            prompt: 'Uppercase the variable name, up to the "=".',
            setup: {
              name: 'env.sh',
              text: ['#!/bin/sh', 'export database_url=postgres://localhost/app', 'export PORT=3000'],
              cursor: { line: 1, col: 7 },
            },
            goal: { text: ['#!/bin/sh', 'export DATABASE_URL=postgres://localhost/app', 'export PORT=3000'] },
            solution: 'gUt=',
          },
          {
            prompt: 'Flip the case of every letter in "hELLO, wORLD".',
            setup: { name: 'hello.sh', text: ['#!/bin/sh', 'echo "hELLO, wORLD"', 'exit 0'], cursor: { line: 1, col: 7 } },
            goal: { text: ['#!/bin/sh', 'echo "Hello, World"', 'exit 0'] },
            solution: 'g~i"',
          },
          {
            prompt: "Uppercase '#1e1e2e'.",
            setup: {
              name: 'colors.lua',
              text: ['local hl = vim.api.nvim_set_hl', "hl(0, 'Normal', { bg = '#1e1e2e' })", "hl(0, 'Comment', { fg = '#6C7086' })"],
              cursor: { line: 1, col: 25 },
            },
            goal: {
              text: ['local hl = vim.api.nvim_set_hl', "hl(0, 'Normal', { bg = '#1E1E2E' })", "hl(0, 'Comment', { fg = '#6C7086' })"],
            },
            solution: "gUi'",
          },
        ],
      },
    },
    {
      id: 'formatting-text',
      title: 'Formatting Text',
      chips: ['gq', 'gw'],
      keyCards: [
        { key: 'gq', glyph: '¶', label: 'format lines' },
        { key: 'gw', glyph: '¶|', label: 'format, stay put' },
      ],
      intro: (
        <>
          <p>
            <Code>gq</Code> re-wraps text to <Mono>textwidth</Mono>: long lines break, short lines join up. It keeps the comment
            marker at the start of each line, so a wrapped <Mono>//</Mono> comment stays a comment. <Code>gqq</Code> does one line,{' '}
            <Code>gqip</Code> a paragraph.
          </p>
          <p>
            <Code>gw</Code> does the same but leaves the cursor where it was, so you can keep typing where you left off.
          </p>
        </>
      ),
      practice: total => (
        <p>
          Wrap the text to the goal. <Mono>textwidth</Mono> is 40 here. {total} rounds.
        </p>
      ),
      aside: {
        title: 'No textwidth set',
        body: (
          <p>
            With <Code>textwidth=0</Code>, <Code>gq</Code> wraps at 79 columns. Set it per filetype, for example{' '}
            <Code>vim.opt_local.textwidth = 72</Code> for git commit messages.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        base: { name: 'retry.ts', options: { textwidth: 40 } },
        rounds: [
          {
            prompt: 'Wrap the long "//" comment on the line above.',
            setup: {
              text: [
                "import { sleep } from './time';",
                '',
                '// Retry with exponential backoff, capped at 30 seconds.',
                'export async function retry() {}',
              ],
              cursor: { line: 3, col: 0 },
            },
            goal: {
              text: [
                "import { sleep } from './time';",
                '',
                '// Retry with exponential backoff,',
                '// capped at 30 seconds.',
                'export async function retry() {}',
              ],
            },
            solution: 'kgqq',
          },
          {
            prompt: 'Reflow the whole paragraph.',
            setup: {
              name: 'intro.md',
              text: [
                'Vim is a modal',
                'editor. You',
                'spend most of your time in normal mode, where keys',
                'move and edit instead of typing.',
                '',
                '## Next',
              ],
              cursor: { line: 1, col: 3 },
            },
            goal: {
              text: [
                'Vim is a modal editor. You spend most of',
                'your time in normal mode, where keys',
                'move and edit instead of typing.',
                '',
                '## Next',
              ],
            },
            solution: 'gqip',
          },
          {
            prompt: 'Reflow the paragraph without moving the cursor.',
            setup: {
              name: 'notes.md',
              text: [
                'Search offsets let you land at the end of a match,',
                'or on the line below it, without an extra motion.',
                '',
                'See :help search-offset.',
              ],
              cursor: { line: 0, col: 7 },
            },
            goal: {
              text: [
                'Search offsets let you land at the end',
                'of a match, or on the line below it,',
                'without an extra motion.',
                '',
                'See :help search-offset.',
              ],
              cursor: { line: 0, col: 7 },
            },
            solution: 'gwip',
          },
          {
            prompt: 'Rewrap the four "--" comment lines into fuller lines.',
            setup: {
              name: 'init.lua',
              text: ['-- Leader is space.', '-- Set it before', '-- loading plugins', '-- so their maps use it.', "vim.g.mapleader = ' '"],
              cursor: { line: 0, col: 0 },
            },
            goal: {
              text: ['-- Leader is space. Set it before', '-- loading plugins so their maps use it.', "vim.g.mapleader = ' '"],
            },
            solution: 'gqip',
          },
        ],
      },
    },
    {
      id: 'incrementing-numbers',
      title: 'Incrementing Numbers',
      chips: ['C-a', 'C-x'],
      keyCards: [
        { key: 'C-a', glyph: '+1', label: 'add' },
        { key: 'C-x', glyph: '−1', label: 'subtract' },
      ],
      intro: (
        <>
          <p>
            <Code>C-a</Code> adds one to the number under the cursor, <Code>C-x</Code> subtracts one. With a count they add
            or subtract that much: <Code>5C-a</Code>.
          </p>
          <p>
            The cursor doesn't have to be on the number. From anywhere before it on the line, they find the next number
            and change that.
          </p>
          <BeforeAfter
            lines={['.btn { padding: 4px 8px; }']}
            cursor={0}
            keys="4<C-a>"
            caption="From the start of the line, C-a finds the first number."
          />
        </>
      ),
      practice: total => (
        <p>
          Change the numbers with <Code>C-a</Code> and <Code>C-x</Code>, no typing. {total} rounds.
        </p>
      ),
      aside: {
        title: 'Other bases',
        body: (
          <p>
            Hex like <Mono>0xff</Mono> and binary like <Mono>0b101</Mono> count in their own base. Neovim leaves out octal
            by default, so <Mono>007</Mono> becomes <Mono>008</Mono>.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        base: { name: 'layout.css' },
        rounds: [
          {
            prompt: 'Make the margin 12px.',
            setup: { text: ['.card {', '  margin: 8px;', '  padding: 16px;', '}'], cursor: { line: 0, col: 0 } },
            goal: { text: ['.card {', '  margin: 12px;', '  padding: 16px;', '}'] },
            solution: 'j4<C-a>',
          },
          {
            prompt: 'Change "1000" to "500". A count on C-x subtracts that much.',
            setup: {
              name: 'client.ts',
              text: ['const client = createClient({', "  baseUrl: '/api',", '  timeout: 1000,', '});'],
              cursor: { line: 2, col: 0 },
            },
            goal: { text: ['const client = createClient({', "  baseUrl: '/api',", '  timeout: 500,', '});'] },
            solution: '500<C-x>',
          },
          {
            prompt: 'Change "-1" to "1". A count on C-a adds that much.',
            setup: {
              name: 'pager.ts',
              text: ['export function pick(items: Item[]) {', '  const offset = -1;', '  return items.at(offset);', '}'],
              cursor: { line: 3, col: 0 },
            },
            goal: { text: ['export function pick(items: Item[]) {', '  const offset = 1;', '  return items.at(offset);', '}'] },
            solution: 'kk2<C-a>',
          },
          {
            prompt: 'Add 2 to each font size.',
            setup: {
              text: ['h1 { font-size: 32px; }', 'h2 { font-size: 24px; }', 'h3 { font-size: 20px; }'],
              cursor: { line: 0, col: 3 },
            },
            goal: { text: ['h1 { font-size: 34px; }', 'h2 { font-size: 26px; }', 'h3 { font-size: 22px; }'] },
            solution: '2<C-a>j.j.',
          },
          {
            prompt: 'Change "retries = 3" to "retries = 2".',
            setup: {
              name: 'retry.lua',
              text: ['-- network', 'local opts = { retries = 3, delay = 250 }', "require('fetch').setup(opts)"],
              cursor: { line: 1, col: 0 },
            },
            goal: { text: ['-- network', 'local opts = { retries = 2, delay = 250 }', "require('fetch').setup(opts)"] },
            solution: '<C-x>',
          },
        ],
      },
    },
    {
      id: 'number-sequences',
      title: 'Number Sequences',
      chips: ['g C-a'],
      keyCards: [{ key: 'g C-a', glyph: '1 2 3', label: 'count up' }],
      intro: (
        <>
          <p>
            In visual mode, <Code>C-a</Code> adds one to the first number on every selected line. <Code>g C-a</Code> adds
            progressively: one to the first line, two to the second, three to the third.
          </p>
          <p>
            Write the same line several times, select them, press <Code>g C-a</Code>, and you have a numbered sequence. A
            count sets the step: <Code>10g C-a</Code> counts in tens.
          </p>
          <BeforeAfter lines={['item 0', 'item 0', 'item 0']} cursor={0} keys="VGg<C-a>" />
        </>
      ),
      practice: total => (
        <p>
          Select the lines and turn the repeated numbers into a sequence. {total} rounds.
        </p>
      ),
      aside: {
        title: 'Block selections',
        body: (
          <p>
            Only the selected columns count. With <Code>C-v</Code> you can skip numbers earlier in the line, like the{' '}
            <Mono>1</Mono> in <Mono>h1</Mono>.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        base: { name: 'steps.md' },
        rounds: [
          {
            prompt: 'Number the steps 1 to 4.',
            setup: { text: ['1. Clone the repo', '1. Install deps', '1. Copy .env.example', '1. Run the dev server'], cursor: { line: 0, col: 0 } },
            goal: { text: ['1. Clone the repo', '2. Install deps', '3. Copy .env.example', '4. Run the dev server'] },
            solution: 'jVGg<C-a>',
          },
          {
            prompt: 'Change the three "(0," values to 1, 2 and 3.',
            setup: {
              name: 'seed.sql',
              text: ["INSERT INTO users VALUES (0, 'ada');", "INSERT INTO users VALUES (0, 'grace');", "INSERT INTO users VALUES (0, 'linus');"],
              cursor: { line: 0, col: 0 },
            },
            goal: { text: ["INSERT INTO users VALUES (1, 'ada');", "INSERT INTO users VALUES (2, 'grace');", "INSERT INTO users VALUES (3, 'linus');"] },
            solution: 'VGg<C-a>',
          },
          {
            prompt: 'Set the values to 1, 2, 3 without touching h1, h2, h3.',
            setup: { name: 'levels.ts', text: ['const h1 = 0;', 'const h2 = 0;', 'const h3 = 0;'], cursor: { line: 0, col: 11 } },
            goal: { text: ['const h1 = 1;', 'const h2 = 2;', 'const h3 = 3;'] },
            solution: '<C-v>jjg<C-a>',
          },
          {
            prompt: 'Set the z-index values to 10, 20 and 30.',
            setup: {
              name: 'layers.css',
              text: ['.dropdown { z-index: 0; }', '.modal { z-index: 0; }', '.toast { z-index: 0; }'],
              cursor: { line: 0, col: 0 },
            },
            goal: { text: ['.dropdown { z-index: 10; }', '.modal { z-index: 20; }', '.toast { z-index: 30; }'] },
            solution: 'VG10g<C-a>',
          },
          {
            prompt: 'Change the worker and admin ports to 8001 and 8002.',
            setup: { name: 'servers.yml', text: ['api: 8000', 'worker: 8000', 'admin: 8000'], cursor: { line: 0, col: 0 } },
            goal: { text: ['api: 8000', 'worker: 8001', 'admin: 8002'] },
            solution: 'jVjg<C-a>',
          },
        ],
      },
    },
    {
      id: 'boss-clean-config',
      title: 'Boss: Clean Up a Config File',
      boss: true,
      chips: ['=', 'C-x', '~', 'gq'],
      keyCards: [
        { key: '=', glyph: '⇥', label: 'reindent' },
        { key: 'C-x', glyph: '−1', label: 'subtract' },
        { key: '~', glyph: 'a⇄A', label: 'toggle case' },
        { key: 'gq', glyph: '¶', label: 'format lines' },
      ],
      intro: (
        <>
          <p>
            Someone pasted this Neovim config together from three places. The indentation is all over the place, the
            numbers are wrong, the font name is lowercase and the header comment is too wide.
          </p>
          <p>Fix it one step at a time with this section's keys and the motions you already know.</p>
        </>
      ),
      practice: total => (
        <p>
          Each round is one clean-up step on the same file. <Mono>textwidth</Mono> is 50. {total} rounds.
        </p>
      ),
      aside: {
        title: 'Real life',
        body: (
          <p>
            On a real file you'd start with <Code>gg=G</Code> too: fixed indentation makes every other problem easier to
            see.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        base: { name: 'init.lua', options: { textwidth: 50 } },
        rounds: [
          {
            prompt: 'Re-indent the whole file.',
            setup: { text: [...BOSS_COMMENT, ...bossMessy], cursor: { line: 4, col: 4 } },
            goal: { text: [...BOSS_COMMENT, ...bossIndented] },
            solution: 'gg=G',
          },
          {
            prompt: 'Set tabstop and shiftwidth to 2.',
            setup: { text: [...BOSS_COMMENT, ...bossIndented], cursor: { line: 3, col: 0 } },
            goal: { text: [...BOSS_COMMENT, ...bossNumbers] },
            solution: '2<C-x>j.',
          },
          {
            prompt: 'Change "jetbrains mono" to "JetBrains Mono".',
            setup: { text: [...BOSS_COMMENT, ...bossNumbers], cursor: { line: 9, col: 0 } },
            goal: { text: [...BOSS_COMMENT, ...bossFont] },
            solution: 'fj~fb~w~',
          },
          {
            prompt: 'Rewrap the two "--" lines at the top.',
            setup: { text: [...BOSS_COMMENT, ...bossFont], cursor: { line: 0, col: 0 } },
            goal: { text: [...bossWrapped, ...bossFont] },
            solution: 'gqj',
          },
        ],
      },
    },
  ],
};
