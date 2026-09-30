import { Code } from '../../components/Code';
import { BeforeAfter } from '../../components/diagrams';
import type { Section } from '../types';

const INIT_LUA = [
  '-- init.lua',
  "vim.g.mapleader = ' '",
  "vim.g.maplocalleader = ' '",
  '',
  'local opt = vim.opt',
  'opt.number = true',
  'opt.relativenumber = true',
  "opt.signcolumn = 'yes'",
  'opt.expandtab = true',
  'opt.shiftwidth = 2',
  'opt.tabstop = 2',
  'opt.ignorecase = true',
  'opt.smartcase = true',
  'opt.undofile = true',
  'opt.updatetime = 250',
  'opt.splitright = true',
  'opt.splitbelow = true',
  'opt.scrolloff = 8',
  '',
  'local map = vim.keymap.set',
  "map('n', '<Esc>', '<Cmd>nohlsearch<CR>')",
  "map('n', '<leader>w', '<Cmd>write<CR>', { desc = 'Write' })",
  "map('n', '<leader>q', '<Cmd>quit<CR>', { desc = 'Quit' })",
  "map('n', '[q', '<Cmd>cprevious<CR>')",
  "map('n', ']q', '<Cmd>cnext<CR>')",
  "map('v', '<', '<gv')",
  "map('v', '>', '>gv')",
  '',
  'local group =',
  "  vim.api.nvim_create_augroup('user', { clear = true })",
  '',
  "vim.api.nvim_create_autocmd('TextYankPost', {",
  '  group = group,',
  '  callback = function()',
  '    vim.hl.on_yank({ timeout = 150 })',
  '  end,',
  '})',
  '',
  "vim.api.nvim_create_autocmd('BufWritePre', {",
  '  group = group,',
  "  pattern = { '*.lua', '*.ts' },",
  '  callback = function(args)',
  '    vim.lsp.buf.format({ bufnr = args.buf })',
  '  end,',
  '})',
];

const RETRY_FN = [
  'export async function retry<T>(',
  '  fn: () => Promise<T>,',
  '  times = 3,',
  '): Promise<T> {',
  '  for (let i = 1; ; i++) {',
  '    try {',
  '      return await fn();',
  '    } catch (err) {',
  '      if (i >= times) throw err;',
  '      log.warn(`retry ${i}/${times}`);',
  '    }',
  '  }',
  '}',
];

const SLEEP_FN = [
  'export const sleep = (ms: number) =>',
  '  new Promise(r => setTimeout(r, ms));',
];

const RETRY_TS = [
  "import { log } from './log';",
  '',
  ...RETRY_FN,
  '',
  ...SLEEP_FN,
];

const SERVER_TS = [
  "import express from 'express';",
  "import cors from 'cors';",
  "import { orders } from './routes/orders';",
  "import { users } from './routes/users';",
  '',
  'const app = express();',
  'app.use(cors());',
  'app.use(express.json());',
  '',
  '// debug',
  'app.use((req, _res, next) => {',
  '  console.log(req.method, req.url);',
  '  next();',
  '});',
  '',
  "app.use('/orders', orders);",
  "app.use('/users', users);",
  '',
  'app.listen(3000);',
];

export const commandLine: Section = {
  id: 'command-line',
  title: 'Command Line',
  band: 'patterns',
  lessons: [
    {
      id: 'jump-to-line',
      title: 'Jump to Line',
      chips: [':42', ':$'],
      keyCards: [
        { key: ':42', glyph: '→42', label: 'go to line 42' },
        { key: ':$', glyph: '→$', label: 'go to last line' },
      ],
      intro: (
        <>
          <p>
            <Code>:</Code> opens the command line; <Code>esc</Code> leaves it, <Code>tab</Code> completes, and{' '}
            <Code>:w</Code> / <Code>:q</Code> / <Code>ZZ</Code> save and quit. A bare line number on the command line jumps there: <Code>:42</Code> then <Code>Enter</Code> lands on line
            42, at its first non-blank character. <Code>:$</Code> goes to the last line.
          </p>
          <p>
            Error messages, stack traces and code review comments all come with line numbers. Type the number instead
            of scrolling to it.
          </p>
        </>
      ),
      practice: total => (
        <p>
          Jump to each line with <Code>:</Code> and its number. Line numbers are on the left. {total} rounds.
        </p>
      ),
      aside: {
        title: 'Or 42G',
        body: (
          <p>
            <Code>42G</Code> does the same from normal mode. Both add to the jumplist, so <Code>C-o</Code> takes you
            back to where you were.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        showGoal: false,
        base: { name: 'init.lua', text: INIT_LUA, height: 12, cursor: { line: 0, col: 0 } },
        rounds: [
          {
            prompt: 'The yank highlight is on line 35. Go there.',
            goal: { cursor: { line: 34, col: 0 } },
            solution: ':35<CR>',
          },
          {
            prompt: 'Go to line 14.',
            setup: { cursor: { line: 34, col: 4 } },
            goal: { cursor: { line: 13, col: 4 } },
            solution: ':14<CR>',
          },
          {
            prompt: 'Go to the last line.',
            setup: { cursor: { line: 13, col: 0 } },
            goal: { cursor: { line: 44, col: 0 } },
            solution: ':$<CR>',
          },
          {
            prompt: 'The format call is on line 43.',
            setup: { cursor: { line: 5, col: 0 } },
            goal: { cursor: { line: 42, col: 0 } },
            solution: ':43<CR>',
          },
          {
            prompt: 'Go to line 22.',
            setup: { cursor: { line: 44, col: 0 } },
            goal: { cursor: { line: 21, col: 0 } },
            solution: ':22<CR>',
          },
          {
            prompt: 'Go to line 8.',
            setup: { cursor: { line: 21, col: 0 } },
            goal: { cursor: { line: 7, col: 0 } },
            solution: ':8<CR>',
          },
        ],
      },
    },
    {
      id: 'ex-ranges',
      title: 'Ranges',
      chips: ['%', '.', '$'],
      keyCards: [
        { key: '5,8', glyph: '5–8', label: 'lines 5 to 8' },
        { key: '.', glyph: '•', label: 'current line' },
        { key: '$', glyph: '→|', label: 'last line' },
        { key: '%', glyph: '1–$', label: 'whole file' },
      ],
      intro: (
        <>
          <p>
            Most Ex commands take a range in front: <Code>:5,8d</Code> deletes lines 5 to 8. Besides numbers there are
            three shorthands: <Code>.</Code> is the current line, <Code>$</Code> the last line, and <Code>%</Code> the
            whole file.
          </p>
          <p>
            A range lets you change lines without moving to them. <Code>:d</Code> deletes, <Code>:&gt;</Code> indents
            and <Code>:j</Code> joins; everything later in this section takes a range too.
          </p>
          <BeforeAfter
            lines={['# todo', '- buy milk', '- call Sam', '- fix bike', '- pay rent']}
            cursor={[4, 0]}
            keys=":2,3d<CR>"
            caption="The cursor is on line 5. :2,3d removes lines 2 and 3 without going there."
          />
        </>
      ),
      practice: total => (
        <p>
          Make each change with one Ex command and a range. {total} rounds.
        </p>
      ),
      aside: {
        title: 'Offsets',
        body: (
          <p>
            Addresses take offsets: <Code>:.,+3d</Code> deletes this line and the three below it, and <Code>$-1</Code>{' '}
            is the second-to-last line.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        rounds: [
          {
            prompt: 'Delete from the restart marker to the end.',
            setup: {
              name: 'server.log',
              text: [
                '2026-09-14 09:12:01 INFO  listening on :8080',
                '2026-09-14 09:12:04 INFO  connected to postgres',
                '2026-09-14 09:13:22 WARN  slow query (412ms) on /orders',
                '--- restart ---',
                '2026-09-14 09:15:40 INFO  listening on :8080',
                '2026-09-14 09:15:41 ERROR config: missing STRIPE_KEY',
              ],
              cursor: { line: 3, col: 0 },
            },
            goal: {
              text: [
                '2026-09-14 09:12:01 INFO  listening on :8080',
                '2026-09-14 09:12:04 INFO  connected to postgres',
                '2026-09-14 09:13:22 WARN  slow query (412ms) on /orders',
              ],
            },
            solution: ':.,$d<CR>',
          },
          {
            prompt: 'These are moving into a class. Indent the whole file.',
            setup: {
              name: 'handlers.ts',
              text: [
                'onSave(doc: Doc) {',
                '  this.store.put(doc);',
                '}',
                '',
                'onDelete(id: string) {',
                '  this.store.remove(id);',
                '}',
              ],
              cursor: { line: 0, col: 0 },
            },
            goal: {
              text: [
                '  onSave(doc: Doc) {',
                '    this.store.put(doc);',
                '  }',
                '',
                '  onDelete(id: string) {',
                '    this.store.remove(id);',
                '  }',
              ],
            },
            solution: ':%><CR>',
          },
          {
            prompt: 'Delete the internal notes, lines 3 to 7.',
            setup: {
              name: 'README.md',
              text: [
                '# billing-service',
                '',
                '<!-- TODO: remove before release -->',
                'Internal notes:',
                '- rotate the test keys',
                '- ask Priya about retries',
                '',
                'Handles invoices and payment webhooks.',
              ],
              cursor: { line: 7, col: 0 },
            },
            goal: { text: ['# billing-service', '', 'Handles invoices and payment webhooks.'] },
            solution: ':3,7d<CR>',
          },
          {
            prompt: 'Join the query, lines 2 to 5, onto one line.',
            setup: {
              name: 'report.sql',
              text: [
                '-- monthly revenue',
                'SELECT id,',
                '  SUM(amount) AS total',
                'FROM payments',
                'GROUP BY id;',
                '',
                '-- refunds',
                'SELECT * FROM refunds;',
              ],
              cursor: { line: 7, col: 0 },
            },
            goal: {
              text: [
                '-- monthly revenue',
                'SELECT id, SUM(amount) AS total FROM payments GROUP BY id;',
                '',
                '-- refunds',
                'SELECT * FROM refunds;',
              ],
            },
            solution: ':2,5j<CR>',
          },
          {
            prompt: 'Delete the local overrides: this line through line 7.',
            setup: {
              name: '.env',
              text: [
                '# production',
                'DATABASE_URL=postgres://db.internal:5432/app',
                'REDIS_URL=redis://cache.internal:6379',
                '# local overrides (do not commit)',
                'DATABASE_URL=postgres://localhost:5432/app',
                'REDIS_URL=redis://localhost:6379',
                'DEBUG=true',
                'LOG_LEVEL=info',
              ],
              cursor: { line: 3, col: 0 },
            },
            goal: {
              text: [
                '# production',
                'DATABASE_URL=postgres://db.internal:5432/app',
                'REDIS_URL=redis://cache.internal:6379',
                'LOG_LEVEL=info',
              ],
            },
            solution: ':.,7d<CR>',
          },
        ],
        base: {},
      },
    },
    {
      id: 'visual-ranges',
      title: 'Visual Ranges',
      chips: ["'<,'>", 'gv'],
      keyCards: [
        { key: 'V :', glyph: "'<,'>", label: 'selected lines' },
        { key: "'<", glyph: '⌈', label: 'selection start' },
        { key: "'>", glyph: '⌋', label: 'selection end' },
        { key: 'gv', glyph: '↺', label: 'reselect' },
      ],
      intro: (
        <>
          <p>
            Press <Code>:</Code> with text selected and Vim fills in <Code>{"'<,'>"}</Code>: the marks for the first and
            last selected lines. Whatever command you type runs over those lines.
          </p>
          <p>
            Selecting is often easier than counting line numbers, especially with text objects like <Code>ip</Code>.
            The range is always whole lines, even from a characterwise selection.
          </p>
        </>
      ),
      practice: total => (
        <p>
          Select the lines, press <Code>:</Code>, and finish the command. {total} rounds.
        </p>
      ),
      aside: {
        title: 'The marks stay',
        body: (
          <p>
            <Code>{"'<"}</Code> and <Code>{"'>"}</Code> survive after the selection ends, so you can type{' '}
            <Code>{":'<,'>"}</Code> by hand later. <Code>gv</Code> then <Code>:</Code> is usually quicker.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        base: {},
        rounds: [
          {
            prompt: 'Write the retry function to retry.ts.',
            setup: { name: 'utils.ts', text: RETRY_TS, cursor: { line: 7, col: 4 } },
            goal: { files: { 'retry.ts': RETRY_FN.join('\n') } },
            solution: 'vip:w retry.ts<CR>',
          },
          {
            prompt: 'Write the March rows to march.csv.',
            setup: {
              name: 'sales.csv',
              text: [
                'date,region,total',
                '2026-02-27,north,1840',
                '2026-02-28,south,2210',
                '2026-03-01,north,1975',
                '2026-03-02,south,2430',
                '2026-03-03,west,1210',
              ],
              cursor: { line: 3, col: 0 },
            },
            goal: { files: { 'march.csv': '2026-03-01,north,1975\n2026-03-02,south,2430\n2026-03-03,west,1210' } },
            solution: 'Vjj:w march.csv<CR>',
          },
          {
            prompt: 'You just selected the sleep helper. Reselect it and write it to sleep.ts.',
            setup: {
              name: 'utils.ts',
              text: RETRY_TS,
              cursor: { line: 0, col: 0 },
              init: vim => vim.feedKeys('GVk<Esc>gg'),
            },
            goal: { files: { 'sleep.ts': SLEEP_FN.join('\n') } },
            solution: 'gv:w sleep.ts<CR>',
          },
          {
            prompt: 'Join the paragraph into one line.',
            setup: {
              name: 'DEPLOY.md',
              text: [
                '## Deploys',
                '',
                'Deploys run from main',
                'after CI is green.',
                'Tag to ship.',
                '',
                '## Rollback',
                'Revert the tag.',
              ],
              cursor: { line: 3, col: 6 },
            },
            goal: {
              text: [
                '## Deploys',
                '',
                'Deploys run from main after CI is green. Tag to ship.',
                '',
                '## Rollback',
                'Revert the tag.',
              ],
            },
            solution: 'vip:j<CR>',
          },
        ],
      },
    },
    {
      id: 'ex-delete-yank',
      title: 'Delete & Yank Lines',
      chips: [':d', ':y'],
      keyCards: [
        { key: ':d', glyph: 'del', label: 'delete lines' },
        { key: ':y', glyph: 'cpy', label: 'yank lines' },
      ],
      intro: (
        <>
          <p>
            <Code>:d</Code> deletes lines and <Code>:y</Code> yanks them, both into the usual registers. Give them a
            range: <Code>:10,15d</Code>, <Code>:3,4y</Code>. Add a register name after: <Code>:3,4y a</Code>.
          </p>
          <p>
            You don't have to go there first. Read the line numbers off the screen and act on them from wherever you
            are.
          </p>
        </>
      ),
      practice: total => <p>Delete or yank by line number. {total} rounds.</p>,
      aside: {
        title: 'Search addresses',
        body: (
          <p>
            An address can be a pattern: <Code>{':/^}/d'}</Code> deletes the next line that starts with a brace, and{' '}
            <Code>:.,/^$/d</Code> deletes up to the next blank line.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        base: { name: 'server.ts', text: SERVER_TS, cursor: { line: 18, col: 0 } },
        rounds: [
          {
            prompt: 'Delete the debug middleware, lines 10 to 15.',
            goal: { text: [...SERVER_TS.slice(0, 9), ...SERVER_TS.slice(15)] },
            solution: ':10,15d<CR>',
          },
          {
            prompt: 'Yank the route imports, lines 3 and 4, into register a.',
            goal: { registers: { a: SERVER_TS.slice(2, 4).join('\n') + '\n' } },
            solution: ':3,4y a<CR>',
          },
          {
            prompt: 'Delete the leftover test line at the end.',
            setup: {
              name: 'deploy.sh',
              text: [
                '#!/usr/bin/env bash',
                'set -euo pipefail',
                'npm ci',
                'npm run build',
                'rsync -a dist/ web:/srv/app/',
                'echo "deploy test, remove me"',
              ],
              cursor: { line: 0, col: 0 },
            },
            goal: {
              text: ['#!/usr/bin/env bash', 'set -euo pipefail', 'npm ci', 'npm run build', 'rsync -a dist/ web:/srv/app/'],
            },
            solution: ':$d<CR>',
          },
          {
            prompt: 'Start a second table: copy the header from line 1 and put it below the cursor.',
            setup: {
              name: 'prices.csv',
              text: ['sku,name,price', 'A-100,desk lamp,24.00', 'A-101,monitor arm,79.00', '', '# discontinued'],
              cursor: { line: 4, col: 0 },
            },
            goal: {
              text: ['sku,name,price', 'A-100,desk lamp,24.00', 'A-101,monitor arm,79.00', '', '# discontinued', 'sku,name,price'],
            },
            solution: ':1y<CR>p',
          },
          {
            prompt: 'Delete line 7, the cors middleware.',
            setup: { cursor: { line: 2, col: 0 } },
            goal: { text: [...SERVER_TS.slice(0, 6), ...SERVER_TS.slice(7)] },
            solution: ':7d<CR>',
          },
        ],
      },
    },
    {
      id: 'ex-move-copy',
      title: 'Move & Copy Lines',
      chips: [':m', ':t'],
      keyCards: [
        { key: ':m', glyph: '⇅', label: 'move lines', sub: 'below address' },
        { key: ':t', glyph: '⧉', label: 'copy lines', sub: 'below address' },
      ],
      intro: (
        <>
          <p>
            <Code>:m</Code> moves lines and <Code>:t</Code> copies them. The address after the command is the line they
            land below: <Code>:m0</Code> moves the current line to the top, <Code>:5,7t$</Code> copies lines 5 to 7 to
            the end.
          </p>
          <p>
            Neither touches a register, so whatever you yanked earlier is still waiting in <Code>"</Code>.
          </p>
          <BeforeAfter
            lines={["import { a } from './a';", "import { b } from './b';", "import 'dotenv/config';"]}
            cursor={[2, 0]}
            keys=":m0<CR>"
            caption=":m0 moves the current line below line 0, which is the top of the file."
          />
          <BeforeAfter
            lines={['PORT=3000', 'HOST=localhost', '', '# staging']}
            cursor={[3, 0]}
            keys=":1,2t$<CR>"
            caption=":1,2t$ copies lines 1 and 2 below the last line. The originals stay put."
          />
        </>
      ),
      practice: total => <p>Move or copy lines with one command each. {total} rounds.</p>,
      aside: {
        title: 'Why t?',
        body: (
          <p>
            <Code>:t</Code> is short for "to", and it's the same command as <Code>:co[py]</Code>. <Code>:t.</Code>{' '}
            duplicates the current line.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        base: {},
        rounds: [
          {
            prompt: 'Move this import to the top.',
            setup: {
              name: 'Cart.tsx',
              text: [
                "import { Button } from './Button';",
                "import { formatPrice } from '../lib/money';",
                "import { useState } from 'react';",
                '',
                'export function Cart() {',
              ],
              cursor: { line: 2, col: 0 },
            },
            goal: {
              text: [
                "import { useState } from 'react';",
                "import { Button } from './Button';",
                "import { formatPrice } from '../lib/money';",
                '',
                'export function Cart() {',
              ],
            },
            solution: ':m0<CR>',
          },
          {
            prompt: 'Copy DATABASE_URL (line 2) below the cursor.',
            setup: {
              name: '.env.example',
              text: ['PORT=3000', 'DATABASE_URL=postgres://localhost:5432/app', 'SESSION_SECRET=change-me', '', '# staging', 'PORT=8080'],
              cursor: { line: 5, col: 0 },
            },
            goal: {
              text: [
                'PORT=3000',
                'DATABASE_URL=postgres://localhost:5432/app',
                'SESSION_SECRET=change-me',
                '',
                '# staging',
                'PORT=8080',
                'DATABASE_URL=postgres://localhost:5432/app',
              ],
            },
            solution: ':2t.<CR>',
          },
          {
            prompt: 'Move lines 2 to 4, the License section, to the end.',
            setup: {
              name: 'README.md',
              text: ['# vimchi', '', '## License', 'MIT', '', '## Install', 'npm install', 'npm run dev'],
              cursor: { line: 0, col: 0 },
            },
            goal: { text: ['# vimchi', '', '## Install', 'npm install', 'npm run dev', '', '## License', 'MIT'] },
            solution: ':2,4m$<CR>',
          },
          {
            prompt: 'Move which-key to the top of the list, below line 1.',
            setup: {
              name: 'plugins.lua',
              text: [
                'return {',
                "  { 'nvim-treesitter/nvim-treesitter' },",
                "  { 'neovim/nvim-lspconfig' },",
                "  { 'stevearc/conform.nvim', event = 'BufWritePre' },",
                "  { 'folke/which-key.nvim', event = 'VeryLazy' },",
                '}',
              ],
              cursor: { line: 4, col: 2 },
            },
            goal: {
              text: [
                'return {',
                "  { 'folke/which-key.nvim', event = 'VeryLazy' },",
                "  { 'nvim-treesitter/nvim-treesitter' },",
                "  { 'neovim/nvim-lspconfig' },",
                "  { 'stevearc/conform.nvim', event = 'BufWritePre' },",
                '}',
              ],
            },
            solution: ':m1<CR>',
          },
          {
            prompt: 'Copy the two March rows (lines 4 and 5) to the end.',
            setup: {
              name: 'sales.csv',
              text: [
                'date,region,total',
                '2026-02-27,north,1840',
                '2026-02-28,south,2210',
                '2026-03-01,north,1975',
                '2026-03-02,south,2430',
                '',
                '# March only',
              ],
              cursor: { line: 0, col: 0 },
            },
            goal: {
              text: [
                'date,region,total',
                '2026-02-27,north,1840',
                '2026-02-28,south,2210',
                '2026-03-01,north,1975',
                '2026-03-02,south,2430',
                '',
                '# March only',
                '2026-03-01,north,1975',
                '2026-03-02,south,2430',
              ],
            },
            solution: ':4,5t$<CR>',
          },
        ],
      },
    },
    {
      id: 'ex-normal',
      title: 'Normal over a Range',
      chips: [':norm'],
      keyCards: [{ key: ':norm', glyph: '↻', label: 'run keys per line' }],
      intro: (
        <>
          <p>
            <Code>:normal</Code> runs normal-mode keys on every line of a range, with the cursor starting at column 0
            each time. <Code>:%norm A;</Code> appends a semicolon to every line.
          </p>
          <p>
            Anything you can type once, you can now apply to fifty lines. It pairs well with <Code>.</Code> and with
            macros: <Code>:norm .</Code> and <Code>:norm @q</Code>.
          </p>
          <BeforeAfter
            lines={["const a = 1", "const b = 'two'", 'const c = [3]']}
            cursor={[0, 0]}
            keys=":%norm A;<CR>"
            caption="A; runs once per line in the range, each time from column 0."
          />
        </>
      ),
      practice: total => (
        <p>
          Use <Code>:norm</Code> over a range to make each change. {total} rounds.
        </p>
      ),
      aside: {
        title: 'Insert mode ends itself',
        body: (
          <p>
            <Code>:norm</Code> presses <Code>esc</Code> for you after each line, so <Code>:%norm I- </Code> needs no
            escape at the end. Trailing spaces count, so type exactly what you want inserted.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        base: {},
        rounds: [
          {
            prompt: 'Add a semicolon to the end of every line.',
            setup: {
              name: 'env.ts',
              text: [
                "const host = process.env.HOST ?? 'localhost'",
                'const port = Number(process.env.PORT ?? 3000)',
                "const debug = process.env.DEBUG === '1'",
              ],
              cursor: { line: 0, col: 0 },
            },
            goal: {
              text: [
                "const host = process.env.HOST ?? 'localhost';",
                'const port = Number(process.env.PORT ?? 3000);',
                "const debug = process.env.DEBUG === '1';",
              ],
            },
            solution: ':%norm A;<CR>',
          },
          {
            prompt: 'Turn the paragraph into a list: prefix each line with "- ".',
            setup: {
              name: 'RUNBOOK.md',
              text: ['## Before a release', '', 'back up the database', 'run migrations', 'restart the workers'],
              cursor: { line: 2, col: 0 },
            },
            goal: { text: ['## Before a release', '', '- back up the database', '- run migrations', '- restart the workers'] },
            solution: 'vip:norm I- <CR>',
          },
          {
            prompt: 'Strip the timestamp from every line.',
            setup: {
              name: 'worker.log',
              text: [
                '09:12:01 INFO job 311 started',
                '09:12:04 INFO job 311 finished in 3.1s',
                '09:13:22 WARN job 312 retrying (1/3)',
                '09:13:30 ERROR job 312 failed: timeout',
              ],
              cursor: { line: 0, col: 0 },
            },
            goal: {
              text: ['INFO job 311 started', 'INFO job 311 finished in 3.1s', 'WARN job 312 retrying (1/3)', 'ERROR job 312 failed: timeout'],
            },
            solution: ':%norm dW<CR>',
          },
          {
            prompt: 'Register q quotes one line. Run it on lines 2 to 4.',
            setup: {
              name: 'routes.ts',
              text: ['const allowed = [', 'dashboard', 'settings', 'billing', '];'],
              registers: { q: 'I  "\x1bA",\x1b' },
              cursor: { line: 0, col: 0 },
            },
            goal: { text: ['const allowed = [', '  "dashboard",', '  "settings",', '  "billing",', '];'] },
            solution: ':2,4norm @q<CR>',
          },
          {
            prompt: 'Make host readonly with I, then repeat it on lines 3 and 4 with :norm .',
            setup: {
              name: 'config.ts',
              text: ['interface Config {', '  host: string;', '  port: number;', '  tls: boolean;', '}'],
              cursor: { line: 1, col: 2 },
            },
            goal: {
              text: ['interface Config {', '  readonly host: string;', '  readonly port: number;', '  readonly tls: boolean;', '}'],
            },
            solution: 'Ireadonly <Esc>:3,4norm .<CR>',
          },
        ],
      },
    },
    {
      id: 'repeat-ex',
      title: 'Repeat a Command',
      chips: ['@:', '@@'],
      keyCards: [
        { key: '@:', glyph: '↻:', label: 'repeat last Ex' },
        { key: '@@', glyph: '↻', label: 'repeat again' },
      ],
      intro: (
        <>
          <p>
            <Code>@:</Code> runs the last command-line command again. After that, <Code>@@</Code> repeats it once more,
            and a count works too: <Code>3@:</Code>.
          </p>
          <p>
            It's the <Code>.</Code> of the command line. Run a command once, move, and replay it where it's needed next.
          </p>
        </>
      ),
      practice: total => (
        <p>
          Run the command once (or reuse the one you just ran) and repeat it with <Code>@:</Code>. {total} rounds.
        </p>
      ),
      aside: {
        title: 'Register :',
        body: (
          <p>
            The last command lives in the read-only <Code>:</Code> register. <Code>":p</Code> pastes it, which is a quick
            way to put a command you just tested into your config.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        base: {},
        rounds: [
          {
            prompt: 'You just ran :norm A; on the line above. Repeat it here and on the next line.',
            setup: {
              name: 'totals.js',
              text: ['let subtotal = 0', 'let tax = 0', 'let shipping = 0', 'const TAX_RATE = 0.2;'],
              init: vim => {
                vim.ex('norm A;');
                vim.win.cursor = { line: 1, col: 0 };
              },
            },
            goal: { text: ['let subtotal = 0;', 'let tax = 0;', 'let shipping = 0;', 'const TAX_RATE = 0.2;'] },
            solution: '@:j@@',
          },
          {
            prompt: 'Delete the next console.log line with :/console/d, then the one after it.',
            setup: {
              name: 'checkout.ts',
              text: [
                'export async function checkout(cart: Cart) {',
                '  console.log(cart);',
                '  const total = sum(cart.items);',
                "  console.log('total', total);",
                '  return pay(total);',
                '}',
              ],
              cursor: { line: 0, col: 0 },
            },
            goal: {
              text: [
                'export async function checkout(cart: Cart) {',
                '  const total = sum(cart.items);',
                '  return pay(total);',
                '}',
              ],
            },
            solution: ':/console/d<CR>@:',
          },
          {
            prompt: 'Duplicate the fixture row with :t., then make three more copies.',
            setup: {
              name: 'fixtures.csv',
              text: ['id,email,plan', '1,test@example.com,free', '2,ops@example.com,team'],
              cursor: { line: 1, col: 0 },
            },
            goal: {
              text: [
                'id,email,plan',
                '1,test@example.com,free',
                '1,test@example.com,free',
                '1,test@example.com,free',
                '1,test@example.com,free',
                '1,test@example.com,free',
                '2,ops@example.com,team',
              ],
            },
            solution: ':t.<CR>3@:',
          },
          {
            prompt: 'The last command changed var to let on line 1. Repeat it on lines 2 and 4.',
            setup: {
              name: 'legacy.js',
              text: ['var total = 0;', 'var count = 0;', 'const MAX = 10;', 'var items = [];'],
              init: vim => {
                vim.ex('s/var/let/');
                vim.win.cursor = { line: 0, col: 0 };
              },
            },
            goal: { text: ['let total = 0;', 'let count = 0;', 'const MAX = 10;', 'let items = [];'] },
            solution: 'j@:jj@@',
          },
        ],
      },
    },
    {
      id: 'cmdline-word',
      title: 'Insert Word Under Cursor',
      chips: ['C-r C-w', 'C-r C-a'],
      keyCards: [
        { key: 'C-r C-w', glyph: '⎀w', label: 'insert word' },
        { key: 'C-r C-a', glyph: '⎀W', label: 'insert WORD' },
      ],
      intro: (
        <>
          <p>
            On the command line, <Code>C-r C-w</Code> inserts the word under the cursor. <Code>C-r C-a</Code> inserts
            the WORD, which includes dots and other punctuation.
          </p>
          <p>
            Put the cursor on a name, then build the command around it without retyping (or mistyping) it:{' '}
            <Code>:%s/</Code>, <Code>C-r C-w</Code>, <Code>/newName/g</Code>.
          </p>
        </>
      ),
      practice: total => (
        <p>
          The cursor is already on the word. Pull it into the command with <Code>C-r</Code>. {total} rounds.
        </p>
      ),
      aside: {
        title: 'Registers too',
        body: (
          <p>
            <Code>C-r</Code> followed by any register name pastes it: <Code>C-r "</Code> for the last yank,{' '}
            <Code>C-r /</Code> for the last search. It works in insert mode as well.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        base: {},
        rounds: [
          {
            prompt: 'Rename sm to sum everywhere.',
            setup: {
              name: 'total.ts',
              text: [
                'function total(items: Item[]) {',
                '  let sm = 0;',
                '  for (const it of items) sm += it.price * it.qty;',
                '  return sm;',
                '}',
              ],
              cursor: { line: 1, col: 6 },
            },
            goal: {
              text: [
                'function total(items: Item[]) {',
                '  let sum = 0;',
                '  for (const it of items) sum += it.price * it.qty;',
                '  return sum;',
                '}',
              ],
            },
            solution: ':%s/<C-r><C-w>/sum/g<CR>',
          },
          {
            prompt: 'Delete every line that mentions this flag.',
            setup: {
              name: 'flags.ts',
              text: [
                'const flags = {',
                '  newCheckout: true,',
                '  legacyExport: false,',
                '  darkMode: true,',
                '};',
                'if (flags.legacyExport) exportCsv();',
                'render(flags);',
              ],
              cursor: { line: 2, col: 4 },
            },
            goal: { text: ['const flags = {', '  newCheckout: true,', '  darkMode: true,', '};', 'render(flags);'] },
            solution: ':g/<C-r><C-w>/d<CR>',
          },
          {
            prompt: 'Change cfg.retries to cfg.http.retries everywhere.',
            setup: {
              name: 'client.ts',
              text: [
                "import { cfg } from './config';",
                '',
                'const retries = cfg.retries ?? 3;',
                'log.info(`retrying up to ${cfg.retries} times`);',
              ],
              cursor: { line: 2, col: 16 },
            },
            goal: {
              text: [
                "import { cfg } from './config';",
                '',
                'const retries = cfg.http.retries ?? 3;',
                'log.info(`retrying up to ${cfg.http.retries} times`);',
              ],
            },
            solution: ':%s/<C-r><C-a>/cfg.http.retries/g<CR>',
          },
          {
            prompt: 'Rename the userName key to username.',
            setup: {
              name: 'user.json',
              text: ['{', '  "id": 7,', '  "userName": "ada",', '  "email": "ada@example.com"', '}'],
              cursor: { line: 2, col: 5 },
            },
            goal: { text: ['{', '  "id": 7,', '  "username": "ada",', '  "email": "ada@example.com"', '}'] },
            solution: ':s/<C-r><C-w>/username/<CR>',
          },
        ],
      },
    },
    {
      id: 'command-window',
      title: 'Command Window',
      chips: ['q:'],
      keyCards: [
        { key: 'q:', glyph: '▤:', label: 'command history window' },
        { key: 'enter', glyph: '⏎', label: 'run this line' },
      ],
      intro: (
        <>
          <p>
            <Code>q:</Code> opens your command history in a small window, one command per line, newest at the bottom.
            Move and edit with normal Vim keys, then press <Code>Enter</Code> to run the line under the cursor.
          </p>
          <p>
            Long commands are painful to fix on the command line. Here you get <Code>cw</Code>, <Code>f</Code>,{' '}
            <Code>.</Code> and everything else.
          </p>
        </>
      ),
      practice: total => (
        <p>
          Open the history with <Code>q:</Code>, find or fix the command, and run it. {total} rounds.
        </p>
      ),
      aside: {
        title: 'From the command line',
        body: (
          <p>
            Already typing a command? <Code>C-f</Code> opens the same window with it. <Code>q/</Code> does the same for
            search history.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        base: {},
        rounds: [
          {
            prompt: 'Rerun the sort from your history.',
            setup: {
              name: 'scores.txt',
              text: ['42 alice', '7 bob', '19 carol', '3 dan'],
              cursor: { line: 0, col: 0 },
              init: vim => vim.history[':'].push('sort n', 'w', 'set wrap'),
            },
            goal: { text: ['3 dan', '7 bob', '19 carol', '42 alice'] },
            solution: 'q:gg<CR>',
          },
          {
            prompt: 'Rerun the :g command, but delete the INFO lines instead of DEBUG.',
            setup: {
              name: 'api.log',
              text: [
                'INFO  GET /health 200',
                'WARN  GET /orders 504 (upstream timeout)',
                'INFO  GET /users/7 200',
                'ERROR POST /checkout 500',
              ],
              cursor: { line: 0, col: 0 },
              init: vim => vim.history[':'].push('g/DEBUG/d', 'w'),
            },
            goal: { text: ['WARN  GET /orders 504 (upstream timeout)', 'ERROR POST /checkout 500'] },
            solution: 'q:ggfDcwINFO<Esc><CR>',
          },
          {
            prompt: 'Rerun the :norm command, this time over lines 2 to 4.',
            setup: {
              name: 'colors.css',
              text: [':root {', '  --bg: #101418', '  --fg: #e6e1cf', '  --accent: #ffb454', '}'],
              cursor: { line: 0, col: 0 },
              init: vim => vim.history[':'].push('norm A;', 'set list', 'nohlsearch'),
            },
            goal: { text: [':root {', '  --bg: #101418;', '  --fg: #e6e1cf;', '  --accent: #ffb454;', '}'] },
            solution: 'q:ggI2,4<Esc><CR>',
          },
          {
            prompt: 'Rerun the :m command, four entries up.',
            setup: {
              name: 'app.ts',
              text: [
                "import { serve } from './server';",
                "import { db } from './db';",
                "import 'dotenv/config';",
                '',
                'await db.connect();',
                'serve(3000);',
              ],
              cursor: { line: 0, col: 0 },
              init: vim => vim.history[':'].push('set number', 'set nowrap', '3m0', 'w', 'set list', 'nohlsearch'),
            },
            goal: {
              text: [
                "import 'dotenv/config';",
                "import { serve } from './server';",
                "import { db } from './db';",
                '',
                'await db.connect();',
                'serve(3000);',
              ],
            },
            solution: 'q:4k<CR>',
          },
        ],
      },
    },
  ],
};
