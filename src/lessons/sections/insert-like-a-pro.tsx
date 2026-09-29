import { Code } from '../../components/Code';
import { BeforeAfter } from '../../components/diagrams';
import type { Section } from '../types';

export const insertLikeAPro: Section = {
  id: 'insert-like-a-pro',
  title: 'Ways Into Insert',
  band: 'core',
  lessons: [
    {
      id: 'insert-line-ends',
      title: 'Insert at Line Ends',
      chips: ['I', 'A'],
      keyCards: [
        { key: 'I', glyph: '|←', label: 'insert at start' },
        { key: 'A', glyph: '→|', label: 'append at end' },
      ],
      intro: (
        <>
          <p>
            <Code>I</Code> starts insert mode at the first non-blank character of the line. <Code>A</Code> starts it after
            the last character. The cursor can be anywhere on the line.
          </p>
          <BeforeAfter lines={['function parse(raw) {']} cursor={10} keys="Iexport <Esc>" />
          <BeforeAfter lines={['  return total']} cursor={4} keys="A;<Esc>" />
          <p>
            A missing semicolon, a trailing comma, an <Code>export</Code> in front of a function: most edits at a line's
            edges are one of these two keys and some typing.
          </p>
        </>
      ),
      practice: total => (
        <p>
          Make each line match the goal. <Code>I</Code> and <Code>A</Code> work from anywhere on the line, so you
          only need to get to the right line. {total} rounds.
        </p>
      ),
      aside: {
        title: 'The very first column',
        body: (
          <p>
            <Code>I</Code> skips indentation. To insert in column 0, before the indent, use <Code>gI</Code>.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        base: { name: 'server.ts' },
        rounds: [
          {
            prompt: 'Add the missing semicolon.',
            setup: {
              text: [
                "import express from 'express';",
                '',
                'const app = express();',
                'const port = Number(process.env.PORT ?? 3000)',
                'app.listen(port);',
              ],
              cursor: { line: 3, col: 8 },
            },
            goal: {
              text: [
                "import express from 'express';",
                '',
                'const app = express();',
                'const port = Number(process.env.PORT ?? 3000);',
                'app.listen(port);',
              ],
            },
            solution: 'A;<Esc>',
          },
          {
            prompt: 'Export the function.',
            setup: {
              text: [
                'type Token = { sub: string; exp: number };',
                '',
                'function parseToken(raw: string): Token | null {',
                '  return decode(raw);',
                '}',
              ],
              cursor: { line: 2, col: 20 },
            },
            goal: {
              text: [
                'type Token = { sub: string; exp: number };',
                '',
                'export function parseToken(raw: string): Token | null {',
                '  return decode(raw);',
                '}',
              ],
            },
            solution: 'Iexport <Esc>',
          },
          {
            prompt: 'Comment out the option.',
            setup: {
              name: 'init.lua',
              text: ['vim.opt.number = true', '  vim.opt.relativenumber = true', 'vim.opt.signcolumn = "yes"'],
              cursor: { line: 1, col: 20 },
            },
            goal: { text: ['vim.opt.number = true', '  -- vim.opt.relativenumber = true', 'vim.opt.signcolumn = "yes"'] },
            solution: 'I-- <Esc>',
          },
          {
            prompt: 'Add the trailing comma.',
            setup: {
              name: 'package.json',
              text: ['{', '  "name": "vimchi",', '  "private": true', '  "type": "module"', '}'],
              cursor: { line: 2, col: 4 },
            },
            goal: { text: ['{', '  "name": "vimchi",', '  "private": true,', '  "type": "module"', '}'] },
            solution: 'A,<Esc>',
          },
          {
            prompt: 'Make the line a second-level heading.',
            setup: {
              name: 'README.md',
              text: ['# vimchi', '', 'Installation', '', 'Run `npm install`, then `npm run dev`.'],
              cursor: { line: 2, col: 6 },
            },
            goal: { text: ['# vimchi', '', '## Installation', '', 'Run `npm install`, then `npm run dev`.'] },
            solution: 'I## <Esc>',
          },
          {
            prompt: 'Store the result and end the statement.',
            setup: {
              text: ['function visibleRows(items: Item[]) {', '  items.filter(isVisible).map(toRow)', '  return rows;', '}'],
              cursor: { line: 2, col: 4 },
            },
            goal: {
              text: [
                'function visibleRows(items: Item[]) {',
                '  const rows = items.filter(isVisible).map(toRow);',
                '  return rows;',
                '}',
              ],
            },
            solution: 'kIconst rows = <Esc>A;<Esc>',
          },
        ],
      },
    },
    {
      id: 'open-lines',
      title: 'Opening New Lines',
      chips: ['o', 'O'],
      keyCards: [
        { key: 'o', glyph: '↓+', label: 'open line below' },
        { key: 'O', glyph: '↑+', label: 'open line above' },
      ],
      intro: (
        <>
          <p>
            <Code>o</Code> opens a new line below the cursor and starts insert mode on it. <Code>O</Code> opens one above.
            The new line gets the same indentation as the current one.
          </p>
          <p>
            You never need to reach for the end of a line and press Enter. Pick the neighbouring line, then <Code>o</Code>{' '}
            or <Code>O</Code>.
          </p>
          <BeforeAfter lines={['const user = {', "  name: 'Ada',", '};']} cursor={[1, 3]} keys="orole: 'admin',<Esc>" />
        </>
      ),
      practice: total => (
        <p>
          Add the missing line from the goal. The cursor is already on a neighbouring line. {total} rounds.
        </p>
      ),
      aside: {
        title: 'Blank lines',
        body: (
          <p>
            <Code>o</Code> then <Code>esc</Code> adds an empty line below. Neovim 0.11 also maps <Code>]␣</Code> and{' '}
            <Code>[␣</Code> to add blank lines below and above without leaving normal mode.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        base: { name: 'user.ts' },
        rounds: [
          {
            prompt: 'Add an email field below the name.',
            setup: {
              text: ['const user = {', "  name: 'Ada',", "  role: 'admin',", '};'],
              cursor: { line: 1, col: 5 },
            },
            goal: { text: ['const user = {', "  name: 'Ada',", "  email: 'ada@example.com',", "  role: 'admin',", '};'] },
            solution: "oemail: 'ada@example.com',<Esc>",
          },
          {
            prompt: 'Add a title above the list.',
            setup: {
              name: 'TODO.md',
              text: ['- [ ] Write the migration', '- [ ] Update the docs', '- [ ] Tag the release'],
              cursor: { line: 0, col: 8 },
            },
            goal: { text: ['## This week', '- [ ] Write the migration', '- [ ] Update the docs', '- [ ] Tag the release'] },
            solution: 'O## This week<Esc>',
          },
          {
            prompt: 'Set the leader before the plugins load.',
            setup: {
              name: 'init.lua',
              text: ["require('config.options')", "require('config.lazy')", "require('config.keymaps')"],
              cursor: { line: 1, col: 10 },
            },
            goal: {
              text: ["require('config.options')", "vim.g.mapleader = ' '", "require('config.lazy')", "require('config.keymaps')"],
            },
            solution: "Ovim.g.mapleader = ' '<Esc>",
          },
          {
            prompt: 'Add a blank line after the imports.',
            setup: {
              text: ["import { db } from './db';", 'export async function listUsers() {', '  return db.user.findMany();', '}'],
              cursor: { line: 1, col: 3 },
            },
            goal: { text: ["import { db } from './db';", '', 'export async function listUsers() {', '  return db.user.findMany();', '}'] },
            solution: 'O<Esc>',
          },
          {
            prompt: 'Log the id before the query.',
            setup: {
              text: ['async function getUser(id: string) {', '  const row = await db.user.find(id);', '  return row;', '}'],
              cursor: { line: 1, col: 14 },
            },
            goal: {
              text: ['async function getUser(id: string) {', "  log.debug('getUser', id);", '  const row = await db.user.find(id);', '  return row;', '}'],
            },
            solution: "Olog.debug('getUser', id);<Esc>",
          },
          {
            prompt: 'Add a "lint" script under "build".',
            setup: {
              name: 'package.json',
              text: ['{', '  "scripts": {', '    "build": "vite build",', '    "test": "vitest"', '  }', '}'],
              cursor: { line: 2, col: 6 },
            },
            goal: { text: ['{', '  "scripts": {', '    "build": "vite build",', '    "lint": "eslint .",', '    "test": "vitest"', '  }', '}'] },
            solution: 'o"lint": "eslint .",<Esc>',
          },
        ],
      },
    },
    {
      id: 'substitute',
      title: 'Substitute',
      chips: ['s', 'S'],
      keyCards: [
        { key: 's', glyph: 'x→…', label: 'substitute character' },
        { key: 'S', glyph: '⎯→…', label: 'substitute line' },
      ],
      intro: (
        <>
          <p>
            <Code>s</Code> deletes the character under the cursor and starts insert mode, so one character becomes
            whatever you type. <Code>S</Code> clears the whole line, keeping its indentation, and starts insert mode.
          </p>
          <p>
            Use <Code>r</Code> when one character becomes one character. Use <Code>s</Code> when it becomes several, and{' '}
            <Code>S</Code> when the line needs rewriting from scratch.
          </p>
          <BeforeAfter lines={['if (a = b) run();']} cursor={6} keys="s===<Esc>" />
          <BeforeAfter lines={['  console.log(x);']} cursor={8} keys="Sreturn x;<Esc>" />
        </>
      ),
      practice: total => (
        <p>
          Fix each line with <Code>s</Code> or <Code>S</Code>. A count before <Code>s</Code> replaces that many
          characters. {total} rounds.
        </p>
      ),
      aside: {
        title: 'S is cc',
        body: (
          <p>
            <Code>S</Code> and <Code>cc</Code> do the same thing. You'll meet <Code>cc</Code> again in Change Lines,
            alongside <Code>C</Code>.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        base: { name: 'check.ts' },
        rounds: [
          {
            prompt: 'Turn the assignment into a strict comparison.',
            setup: {
              text: ['function authorize(user: User) {', '  if (user.role = ADMIN) grant(user);', '  else deny(user);', '}'],
              cursor: { line: 1, col: 16 },
            },
            goal: { text: ['function authorize(user: User) {', '  if (user.role === ADMIN) grant(user);', '  else deny(user);', '}'] },
            solution: 's===<Esc>',
          },
          {
            prompt: 'Spell out "&".',
            setup: {
              name: 'recipe.md',
              text: ['## Steps', '- Heat the oil in a pan.', '- Season with salt & pepper.', '- Serve warm.'],
              cursor: { line: 0, col: 0 },
            },
            goal: { text: ['## Steps', '- Heat the oil in a pan.', '- Season with salt and pepper.', '- Serve warm.'] },
            solution: 'jjf&sand<Esc>',
          },
          {
            prompt: 'Change "14px" to "0.875rem".',
            setup: {
              name: 'theme.ts',
              text: ['export const body = {', "  fontFamily: 'Inter, sans-serif',", "  fontSize: '14px',", '  lineHeight: 1.5,', '};'],
              cursor: { line: 1, col: 13 },
            },
            goal: {
              text: ['export const body = {', "  fontFamily: 'Inter, sans-serif',", "  fontSize: '0.875rem',", '  lineHeight: 1.5,', '};'],
            },
            solution: 'j4s0.875rem<Esc>',
          },
          {
            prompt: 'Replace the debug print with a logger call.',
            setup: {
              text: ['function save(order: Order) {', "  console.log('saving', order);", '  return db.orders.put(order);', '}'],
              cursor: { line: 1, col: 10 },
            },
            goal: { text: ['function save(order: Order) {', "  logger.info({ order }, 'saving');", '  return db.orders.put(order);', '}'] },
            solution: "Slogger.info({ order }, 'saving');<Esc>",
          },
          {
            prompt: 'Rewrite the mapping.',
            setup: {
              name: 'keymaps.lua',
              text: ['local map = vim.keymap.set', "map('n', '<leader>w', ':w<CR>')", "map('n', '<leader>q', ':q<CR>')"],
              cursor: { line: 1, col: 12 },
            },
            goal: { text: ['local map = vim.keymap.set', "map('n', '<leader>w', '<cmd>write<CR>')", "map('n', '<leader>q', ':q<CR>')"] },
            solution: "Smap('n', '<lt>leader>w', '<lt>cmd>write<lt>CR>')<Esc>",
          },
          {
            prompt: 'Write the missing step.',
            setup: {
              name: 'deploy.md',
              text: ['1. Build the image.', '2. TODO', '3. Restart the service.'],
              cursor: { line: 1, col: 4 },
            },
            goal: { text: ['1. Build the image.', '2. Push it to the registry.', '3. Restart the service.'] },
            solution: 'S2. Push it to the registry.<Esc>',
          },
        ],
      },
    },
    {
      id: 'replace-mode',
      title: 'Replace Mode',
      chips: ['R'],
      keyCards: [{ key: 'R', glyph: 'ab→xy', glyphColor: 'var(--orange)', label: 'overwrite text' }],
      intro: (
        <>
          <p>
            <Code>R</Code> enters Replace mode: every character you type overwrites the one under the cursor, like the
            Insert key on a PC keyboard. Typing past the end of the line adds new text.
          </p>
          <p>
            It's <Code>r</Code> for more than one character. Reach for it when new text should sit exactly over old text of
            the same width: dates, versions, colours, times.
          </p>
          <BeforeAfter lines={['"version": "1.4.2"']} cursor={12} keys="R2.0.0<Esc>" />
        </>
      ),
      practice: total => (
        <p>
          Overwrite the old value with the new one using <Code>R</Code>, then press <Code>esc</Code>. {total} rounds.
        </p>
      ),
      aside: {
        title: 'Backspace undoes, not deletes',
        body: (
          <p>
            In Replace mode <Code>Backspace</Code> puts back the original character instead of deleting, so a typo costs
            nothing: back up and type it again.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        base: { name: 'config.json' },
        rounds: [
          {
            prompt: 'Bump the version to 2.0.0.',
            setup: { text: ['{', '  "name": "vimchi",', '  "version": "1.4.2"', '}'], cursor: { line: 2, col: 2 } },
            goal: { text: ['{', '  "name": "vimchi",', '  "version": "2.0.0"', '}'] },
            solution: 'f1R2.0.0<Esc>',
          },
          {
            prompt: 'Change the colour to #1e90ff.',
            setup: {
              name: 'button.css',
              text: ['.btn-primary {', '  color: #ff8800;', '  padding: 4px 12px;', '}'],
              cursor: { line: 0, col: 0 },
            },
            goal: { text: ['.btn-primary {', '  color: #1e90ff;', '  padding: 4px 12px;', '}'] },
            solution: 'jf#lR1e90ff<Esc>',
          },
          {
            prompt: 'Move the meeting to 14:45.',
            setup: {
              name: 'standup.ts',
              text: ['const standup = {', "  day: 'Mon',", "  at: '09:30',", '};'],
              cursor: { line: 0, col: 0 },
            },
            goal: { text: ['const standup = {', "  day: 'Mon',", "  at: '14:45',", '};'] },
            solution: '2jf0R14:45<Esc>',
          },
          {
            prompt: 'Set the expiry to 06/15/2027.',
            setup: { text: ['{', '  "card": "visa",', '  "expires": "12/31/2025"', '}'], cursor: { line: 2, col: 2 } },
            goal: { text: ['{', '  "card": "visa",', '  "expires": "06/15/2027"', '}'] },
            solution: 'f1R06/15/2027<Esc>',
          },
          {
            prompt: 'Mark the task done and say when.',
            setup: {
              name: 'notes.ts',
              text: ['// TODO', 'export const retries = 3;', 'export const timeoutMs = 5_000;'],
              cursor: { line: 0, col: 3 },
            },
            goal: { text: ['// DONE in v1.2', 'export const retries = 3;', 'export const timeoutMs = 5_000;'] },
            solution: 'RDONE in v1.2<Esc>',
          },
        ],
      },
    },
    {
      id: 'undo-redo',
      title: 'Undo & Redo',
      chips: ['u', 'C-r'],
      keyCards: [
        { key: 'u', glyph: '↺', label: 'undo' },
        { key: 'C-r', glyph: '↻', label: 'redo' },
      ],
      intro: (
        <>
          <p>
            <Code>u</Code> undoes the last change. <Code>C-r</Code> redoes what you just undid. Both take a count:{' '}
            <Code>3u</Code> undoes three changes.
          </p>
          <p>
            A change is one command, however much text it touches. Everything you type between <Code>i</Code> and{' '}
            <Code>esc</Code> is one change, so a whole line of typing goes with a single <Code>u</Code>.
          </p>
        </>
      ),
      practice: total => (
        <p>
          Someone has been editing these files. Undo and redo until the buffer matches the goal. {total} rounds.
        </p>
      ),
      aside: {
        title: 'Undo is a tree',
        body: (
          <p>
            Undo, then make a new change, and the undone branch isn't lost. <Code>g-</Code> and <Code>g+</Code> walk
            through every state the buffer has been in, in time order.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        base: { name: 'cart.ts' },
        rounds: [
          {
            prompt: 'The return line was deleted by mistake. Bring it back.',
            setup: {
              text: [
                'export function total(items: Item[]) {',
                '  const sum = items.reduce((a, i) => a + i.price, 0);',
                '  return sum;',
                '}',
              ],
              cursor: { line: 2, col: 0 },
              init: vim => vim.feedKeys('dd'),
            },
            goal: {
              text: [
                'export function total(items: Item[]) {',
                '  const sum = items.reduce((a, i) => a + i.price, 0);',
                '  return sum;',
                '}',
              ],
            },
            solution: 'u',
          },
          {
            prompt: 'Undo the whole line that was typed in.',
            setup: {
              name: 'init.lua',
              text: ['vim.opt.number = true', 'vim.opt.wrap = false', 'vim.opt.tabstop = 2'],
              cursor: { line: 0, col: 0 },
              init: vim => vim.feedKeys('ovim.opt.mouse = ""<Esc>'),
            },
            goal: { text: ['vim.opt.number = true', 'vim.opt.wrap = false', 'vim.opt.tabstop = 2'] },
            solution: 'u',
          },
          {
            prompt: 'Undo both renames.',
            setup: {
              text: [
                'function lineTotal(price: number, quantity: number) {',
                '  const total = price * quantity;',
                '  return total;',
                '}',
              ],
              cursor: { line: 1, col: 2 },
              init: vim => vim.feedKeys('wcwsum<Esc>4wcwqty<Esc>'),
            },
            goal: {
              text: [
                'function lineTotal(price: number, quantity: number) {',
                '  const total = price * quantity;',
                '  return total;',
                '}',
              ],
            },
            solution: 'uu',
          },
          {
            prompt: 'You undid one step too many. Redo it.',
            setup: {
              name: 'README.md',
              text: ['# vimchi', 'A Vim tutor.', '', '## Install'],
              cursor: { line: 1, col: 0 },
              init: vim => vim.feedKeys('A It runs in the browser.<Esc>oMIT licensed.<Esc>uu'),
            },
            goal: { text: ['# vimchi', 'A Vim tutor. It runs in the browser.', '', '## Install'] },
            solution: '<C-r>',
          },
          {
            prompt: 'Undo all three edits, then redo only the first.',
            setup: {
              name: 'routes.ts',
              text: [
                "app.get('/users', listUsers);",
                "app.get('/users/:id', getUser);",
                "app.post('/users', createUser);",
                "app.delete('/users/:id', removeUser);",
              ],
              cursor: { line: 0, col: 0 },
              init: vim => vim.feedKeys("f/aapi/<Esc>jdd0x"),
            },
            goal: {
              text: [
                "app.get('/api/users', listUsers);",
                "app.get('/users/:id', getUser);",
                "app.post('/users', createUser);",
                "app.delete('/users/:id', removeUser);",
              ],
            },
            solution: '3u<C-r>',
          },
        ],
      },
    },
  ],
};
