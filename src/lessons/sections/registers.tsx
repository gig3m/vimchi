import { Code, Mono } from '../../components/Code';
import { BeforeAfter } from '../../components/diagrams';
import type { Section } from '../types';

export const registers: Section = {
  id: 'registers',
  title: 'Registers',
  band: 'repeat',
  lessons: [
    {
      id: 'unnamed-register',
      title: 'The Unnamed Register',
      chips: ['""', 'xp', 'ddp'],
      keyCards: [
        { key: '""', glyph: '⎘', label: 'unnamed register', sub: 'what p puts' },
        { key: 'xp', glyph: 'ab→ba', label: 'swap two chars' },
        { key: 'ddp', glyph: '↓', label: 'move line down' },
      ],
      intro: (
        <>
          <p>
            Every yank, delete and change lands in the unnamed register, <Code>{'""'}</Code>, and <Code>p</Code> and{' '}
            <Code>P</Code> put from it. So <Code>dd</Code> is really cut: <Code>ddp</Code> moves a line down and{' '}
            <Code>xp</Code> swaps two characters.
          </p>
          <p>
            You rarely type <Code>{'""p'}</Code>, because plain <Code>p</Code> means the same thing. What matters is
            knowing that <Code>x</Code>, <Code>dw</Code> and <Code>cw</Code> all overwrite it.
          </p>
          <BeforeAfter
            lines={['if (!items.length)', '  retrun 0;']}
            cursor={[1, 5]}
            keys="xp"
            caption={<><Code>x</Code> cuts the r into <Code>{'""'}</Code>, <Code>p</Code> puts it back one to the right.</>}
          />
        </>
      ),
      practice: total => (
        <p>
          Cut and put to make the buffer match the goal. {total} rounds.
        </p>
      ),
      aside: {
        title: 'Where did my yank go?',
        body: (
          <p>
            Yank a word, delete the one you meant to replace, press <Code>p</Code>: you get the deleted word back. The
            next lesson shows where the yank went.{' '}
            <Code>:reg</Code> lists every register; <Code>"+</Code> is the system clipboard.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        base: { name: 'cart.ts' },
        rounds: [
          {
            prompt: 'Fix "retrun".',
            setup: {
              text: [
                'export function cartTotal(cart: Cart) {',
                '  if (!cart.items.length) retrun 0;',
                '  return sum(cart.items);',
                '}',
              ],
              cursor: { line: 2, col: 2 },
            },
            goal: {
              text: [
                'export function cartTotal(cart: Cart) {',
                '  if (!cart.items.length) return 0;',
                '  return sum(cart.items);',
                '}',
              ],
            },
            solution: 'kfuhxp',
          },
          {
            prompt: 'Sort the imports: move the first line down one.',
            setup: {
              text: ["import { useState } from 'react';", "import clsx from 'clsx';", '', 'export function Cart() {}'],
              cursor: { line: 0, col: 0 },
            },
            goal: { text: ["import clsx from 'clsx';", "import { useState } from 'react';", '', 'export function Cart() {}'] },
            solution: 'ddp',
          },
          {
            prompt: 'Move "async " so it comes after "default".',
            setup: {
              text: [
                "import { api } from './api';",
                '',
                'export async default function loadCart() {',
                "  return api.get('/cart');",
                '}',
              ],
              cursor: { line: 4, col: 0 },
            },
            goal: {
              text: [
                "import { api } from './api';",
                '',
                'export default async function loadCart() {',
                "  return api.get('/cart');",
                '}',
              ],
            },
            solution: '2kwdwwP',
          },
          {
            prompt: 'Move the "const tax" line up one, above "const total".',
            setup: {
              text: ['const subtotal = sum(items);', 'const total = subtotal + tax;', 'const tax = subtotal * TAX_RATE;', 'return total;'],
              cursor: { line: 2, col: 0 },
            },
            goal: { text: ['const subtotal = sum(items);', 'const tax = subtotal * TAX_RATE;', 'const total = subtotal + tax;', 'return total;'] },
            solution: 'ddkP',
          },
          {
            prompt: 'Move the "function format" block below the "function sum" block.',
            setup: {
              text: [
                'function format(n) {',
                '  return n.toFixed(2);',
                '}',
                '',
                'function sum(xs) {',
                '  return xs.reduce((a, b) => a + b, 0);',
                '}',
                '',
                'export { format, sum };',
              ],
              cursor: { line: 0, col: 0 },
            },
            goal: {
              text: [
                'function sum(xs) {',
                '  return xs.reduce((a, b) => a + b, 0);',
                '}',
                '',
                'function format(n) {',
                '  return n.toFixed(2);',
                '}',
                '',
                'export { format, sum };',
              ],
            },
            solution: 'dap}p',
          },
        ],
      },
    },
    {
      id: 'yank-register',
      title: 'The Yank Register',
      chips: ['"0'],
      keyCards: [{ key: '"0', glyph: 'y', label: 'last yank', sub: 'deletes leave it alone' }],
      intro: (
        <>
          <p>
            A yank also goes into register <Code>0</Code>, and deletes never touch it. After <Code>yy</Code>, then{' '}
            <Code>dd</Code>, the unnamed register holds the deleted line but <Code>{'"0p'}</Code> still puts the yank.
          </p>
          <p>
            That's the fix for the most common register surprise: yank the good text, delete the bad text, then put
            from <Code>{'"0'}</Code>.
          </p>
          <BeforeAfter
            lines={['  retries: 5,', '  retries: 1,', '};']}
            cursor={[0, 0]}
            keys={'yyjdd"0P'}
            caption={<><Code>dd</Code> overwrote <Code>{'""'}</Code>, but <Code>{'"0'}</Code> still holds the yank.</>}
          />
        </>
      ),
      practice: total => (
        <p>
          Yank the right text, delete what it replaces, then put with <Code>{'"0'}</Code>. {total} rounds.
        </p>
      ),
      aside: {
        title: 'Replacing many words',
        body: (
          <p>
            Replacing the same word in several places? Yank it once, then <Code>{'viw"0p'}</Code> on each target. Plain{' '}
            <Code>viwp</Code> works the first time only, because it puts the replaced word in <Code>{'""'}</Code>.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        base: { name: 'config.ts' },
        rounds: [
          {
            prompt: 'Replace the "retries: 1" line with a copy of "retries: 5".',
            setup: {
              text: [
                'const prod = {',
                '  timeout: 10_000,',
                '  retries: 5,',
                '};',
                'const staging = {',
                '  timeout: 10_000,',
                '  retries: 1,',
                '};',
              ],
              cursor: { line: 2, col: 0 },
            },
            goal: {
              text: [
                'const prod = {',
                '  timeout: 10_000,',
                '  retries: 5,',
                '};',
                'const staging = {',
                '  timeout: 10_000,',
                '  retries: 5,',
                '};',
              ],
            },
            solution: 'yy4jdd"0P',
          },
          {
            prompt: 'Replace the TODO with a copy of the first expect line.',
            setup: {
              name: 'math.test.ts',
              text: [
                "it('adds', () => {",
                '  expect(add(1, 2)).toBe(3);',
                '});',
                "it('adds negatives', () => {",
                '  // TODO',
                '});',
              ],
              cursor: { line: 1, col: 0 },
            },
            goal: {
              text: [
                "it('adds', () => {",
                '  expect(add(1, 2)).toBe(3);',
                '});',
                "it('adds negatives', () => {",
                '  expect(add(1, 2)).toBe(3);',
                '});',
              ],
            },
            solution: 'yy3jdd"0P',
          },
          {
            prompt: 'Change "^18.3.1" to "^19.1.0", copied from the line above.',
            setup: {
              name: 'package.json',
              text: ['{', '  "dependencies": {', '    "react": "^19.1.0",', '    "react-dom": "^18.3.1"', '  }', '}'],
              cursor: { line: 2, col: 4 },
            },
            goal: { text: ['{', '  "dependencies": {', '    "react": "^19.1.0",', '    "react-dom": "^19.1.0"', '  }', '}'] },
            solution: 'f^yi"jf^di""0P',
          },
          {
            prompt: 'Replace "vim.keymap.set" with "map" on the last two lines. The cursor is on "map".',
            setup: {
              name: 'keymaps.lua',
              text: [
                'local map = vim.keymap.set',
                "map('n', '<leader>w', '<cmd>write<cr>')",
                "vim.keymap.set('n', '<leader>q', '<cmd>quit<cr>')",
                "vim.keymap.set('n', '<leader>e', vim.diagnostic.open_float)",
              ],
              cursor: { line: 1, col: 0 },
            },
            goal: {
              text: [
                'local map = vim.keymap.set',
                "map('n', '<leader>w', '<cmd>write<cr>')",
                "map('n', '<leader>q', '<cmd>quit<cr>')",
                "map('n', '<leader>e', vim.diagnostic.open_float)",
              ],
            },
            solution: 'yiwjvt(pj0vt("0p',
          },
          {
            prompt: 'Replace the last two lines with one copy of the first line.',
            setup: {
              name: 'index.ts',
              text: [
                "export * from './client';",
                '',
                "const client = require('./client');",
                'module.exports = client;',
              ],
              cursor: { line: 0, col: 0 },
            },
            goal: { text: ["export * from './client';", '', "export * from './client';"] },
            solution: 'yyGdk"0p',
          },
        ],
      },
    },
    {
      id: 'named-registers',
      title: 'Named Registers',
      chips: ['"a', '"b'],
      keyCards: [
        { key: '"a', glyph: 'a–z', label: 'use register a', sub: 'before y, d, c or p' },
        { key: '"b', glyph: 'a–z', label: 'use register b' },
      ],
      intro: (
        <>
          <p>
            Put <Code>{'"'}</Code> and a letter in front of a yank, delete or put to use one of 26 named registers.{' '}
            <Code>{'"ayy'}</Code> yanks the line into <Code>a</Code>, <Code>{'"ap'}</Code> puts it back.
          </p>
          <p>
            Named registers only change when you ask, so they're the place to park text you'll need a few edits from
            now, or two snippets you need at once.
          </p>
        </>
      ),
      practice: total => (
        <p>
          Yank into the named registers each round asks for, then put them where they belong. {total} rounds.
        </p>
      ),
      aside: {
        title: 'Registers survive restarts',
        body: (
          <p>
            Neovim saves registers in the ShaDa file, so text in <Code>a</Code> is still there tomorrow. Handy for a
            snippet you paste every day.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        base: { name: 'db.test.ts' },
        rounds: [
          {
            prompt: 'Yank the "sql =" line into register q.',
            setup: {
              name: 'report.py',
              text: [
                'def monthly(db):',
                '    cutoff = days_ago(30)',
                "    sql = 'SELECT * FROM orders WHERE created_at > %s'",
                '    return db.all(sql, cutoff)',
              ],
              cursor: { line: 3, col: 4 },
            },
            goal: { registers: { q: "    sql = 'SELECT * FROM orders WHERE created_at > %s'\n" } },
            solution: 'k"qyy',
          },
          {
            prompt: 'Yank the text inside the quotes: the postgres URL into u, "X-Api-Key" into k.',
            setup: {
              name: 'env.ts',
              text: [
                '// local development only',
                "const DB_URL = 'postgres://localhost:5432/app';",
                "const KEY_NAME = 'X-Api-Key';",
                'const PORT = 8080;',
              ],
              cursor: { line: 3, col: 0 },
            },
            goal: { registers: { u: 'postgres://localhost:5432/app', k: 'X-Api-Key' } },
            solution: `2kf'"uyi'jf'"kyi'`,
          },
          {
            prompt: 'Copy the beforeEach line above "lists orders" and the afterAll line below it.',
            setup: {
              text: [
                "describe('users', () => {",
                '  beforeEach(() => db.reset());',
                "  it('creates a user', async () => {});",
                '  afterAll(() => db.close());',
                '});',
                '',
                "describe('orders', () => {",
                "  it('lists orders', async () => {});",
                '});',
              ],
              cursor: { line: 1, col: 0 },
            },
            goal: {
              text: [
                "describe('users', () => {",
                '  beforeEach(() => db.reset());',
                "  it('creates a user', async () => {});",
                '  afterAll(() => db.close());',
                '});',
                '',
                "describe('orders', () => {",
                '  beforeEach(() => db.reset());',
                "  it('lists orders', async () => {});",
                '  afterAll(() => db.close());',
                '});',
              ],
            },
            solution: '"ayy2j"byy4j"aPj"bp',
          },
          {
            prompt: 'Registers h and s each hold one line. Put both at the top of the file, h first.',
            setup: {
              name: 'server.js',
              text: ["const http = require('node:http');", '', 'http.createServer(handler).listen(8080);'],
              registers: { h: '// SPDX-License-Identifier: MIT\n', s: "'use strict';\n" },
              cursor: { line: 2, col: 0 },
            },
            goal: {
              text: [
                '// SPDX-License-Identifier: MIT',
                "'use strict';",
                "const http = require('node:http');",
                '',
                'http.createServer(handler).listen(8080);',
              ],
            },
            solution: 'gg"sP"hP',
          },
        ],
      },
    },
    {
      id: 'appending-registers',
      title: 'Appending to Registers',
      chips: ['"A'],
      keyCards: [{ key: '"A', glyph: 'a+', label: 'append to a', sub: 'uppercase name' }],
      intro: (
        <>
          <p>
            Name a register in uppercase to add to it instead of replacing it. <Code>{'"ayy'}</Code> starts a
            collection, and each <Code>{'"Ayy'}</Code> after that adds another line.
          </p>
          <p>
            It turns scattered lines into one paste: gather every TODO, every import, every failing test name, then{' '}
            <Code>{'"ap'}</Code> once.
          </p>
          <BeforeAfter
            lines={['- TODO: rotate keys', 'Deployed 2.4.1.', '- TODO: fix CI', '## Open']}
            cursor={[0, 0]}
            keys={'"ayy2j"AyyG"ap'}
          />
        </>
      ),
      practice: total => (
        <p>
          Collect the lines into one register with <Code>{'"a'}</Code> then <Code>{'"A'}</Code>, and put them where
          the goal shows. {total} rounds.
        </p>
      ),
      aside: {
        title: 'Collect with :g',
        body: (
          <p>
            A preview of Global Commands: clear the register with <Code>qaq</Code>, then{' '}
            <Code>:g/TODO/y A</Code> appends every matching line in one command.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        base: { name: 'notes.md' },
        rounds: [
          {
            prompt: 'Copy the three TODO lines under "Open TODOs".',
            setup: {
              text: [
                '# Sprint notes',
                '- TODO: rotate the API keys',
                'Deployed 2.4.1 on Tuesday.',
                '- TODO: fix the flaky checkout test',
                'Retro moved to Friday.',
                '- TODO: update the onboarding doc',
                '',
                '## Open TODOs',
              ],
              cursor: { line: 0, col: 0 },
            },
            goal: {
              text: [
                '# Sprint notes',
                '- TODO: rotate the API keys',
                'Deployed 2.4.1 on Tuesday.',
                '- TODO: fix the flaky checkout test',
                'Retro moved to Friday.',
                '- TODO: update the onboarding doc',
                '',
                '## Open TODOs',
                '- TODO: rotate the API keys',
                '- TODO: fix the flaky checkout test',
                '- TODO: update the onboarding doc',
              ],
            },
            solution: 'j"ayy2j"Ayy2j"AyyG"ap',
          },
          {
            prompt: 'Move both "import" lines to the top of the file.',
            setup: {
              name: 'app.ts',
              text: [
                'const app = express();',
                "import express from 'express';",
                'app.use(json());',
                "import { json } from 'body-parser';",
                'app.listen(3000);',
              ],
              cursor: { line: 1, col: 0 },
            },
            goal: {
              text: [
                "import express from 'express';",
                "import { json } from 'body-parser';",
                'const app = express();',
                'app.use(json());',
                'app.listen(3000);',
              ],
            },
            solution: '"addj"Addgg"aP',
          },
          {
            prompt: 'Register e already holds an export line. Append the parse and validate lines to it, in that order.',
            setup: {
              name: 'index.ts',
              text: ["export { parse } from './parse';", "export { format } from './format';", "export { validate } from './validate';"],
              registers: { e: "export { tokenize } from './tokenize';\n" },
              cursor: { line: 0, col: 0 },
            },
            goal: {
              registers: {
                e: "export { tokenize } from './tokenize';\nexport { parse } from './parse';\nexport { validate } from './validate';\n",
              },
            },
            solution: '"Eyy2j"Eyy',
          },
          {
            prompt: 'Cut the two DEBUG lines into t and put them at the bottom.',
            setup: {
              name: 'worker.py',
              text: [
                'def run(job):',
                "    print('DEBUG start', job.id)",
                '    result = job.execute()',
                "    print('DEBUG done', result)",
                '    return result',
                '',
                '# parked:',
              ],
              cursor: { line: 1, col: 0 },
            },
            goal: {
              text: [
                'def run(job):',
                '    result = job.execute()',
                '    return result',
                '',
                '# parked:',
                "    print('DEBUG start', job.id)",
                "    print('DEBUG done', result)",
              ],
            },
            solution: '"tddj"TddG"tp',
          },
        ],
      },
    },
    {
      id: 'delete-history',
      title: 'Delete History',
      chips: ['"2', '"-'],
      keyCards: [
        { key: '"1', glyph: '1–9', label: 'recent line deletes', sub: '"1 newest, "9 oldest' },
        { key: '"-', glyph: 'del', label: 'small delete', sub: 'within one line' },
      ],
      intro: (
        <>
          <p>
            Deleting a line or more pushes it onto a stack: the newest in <Code>{'"1'}</Code>, the one before in{' '}
            <Code>{'"2'}</Code>, down to <Code>{'"9'}</Code>. Deletes inside a line, like <Code>dw</Code> or{' '}
            <Code>x</Code>, go to <Code>{'"-'}</Code> instead.
          </p>
          <p>
            So nothing you deleted recently is gone. <Code>{'"3p'}</Code> brings back the line you cut three deletes
            ago, without undoing the two since.
          </p>
          <BeforeAfter
            lines={['- rotate the API keys', '- fix the flaky test', '- update the docs']}
            cursor={[0, 0]}
            keys={'dddd"2p'}
            caption={<>Two deletes later, <Code>{'"2'}</Code> still holds the first line.</>}
          />
        </>
      ),
      practice: total => (
        <p>
          Some text has already been deleted in each round. Put back the piece the prompt asks for from the
          delete registers. {total} rounds.
        </p>
      ),
      aside: {
        title: 'Walking the stack',
        body: (
          <p>
            Not sure which number? Type <Code>{'"1p'}</Code>, then <Code>u.</Code> repeatedly: each <Code>.</Code>{' '}
            after a numbered put moves on to the next register.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        base: { name: 'routes.ts' },
        rounds: [
          {
            prompt: 'Three lines were deleted, the router.post line first. Put it back below the cursor.',
            setup: {
              text: [
                "router.get('/users', listUsers);",
                "router.post('/users', createUser);",
                "router.get('/users/:id', getUser);",
                "router.delete('/users/:id', deleteUser);",
                "router.patch('/users/:id', updateUser);",
                'export default router;',
              ],
              cursor: { line: 0, col: 0 },
              init: vim => {
                vim.feedKeys('jddjdddd');
                vim.setCursor({ line: 1, col: 0 });
                vim.typedKeys = 0;
              },
            },
            goal: {
              text: [
                "router.get('/users', listUsers);",
                "router.get('/users/:id', getUser);",
                "router.post('/users', createUser);",
                'export default router;',
              ],
            },
            solution: '"3p',
          },
          {
            prompt: 'The "return" line was deleted, then "# FIXME". Put the return line back below the cursor.',
            setup: {
              name: 'user.py',
              text: [
                'def full_name(user):',
                '    first = user.first.strip()',
                '    last = user.last.strip()',
                '    # FIXME',
                '    return f"{first} {last}"',
              ],
              cursor: { line: 4, col: 0 },
              init: vim => {
                vim.feedKeys('dddd');
                vim.typedKeys = 0;
              },
            },
            goal: {
              text: ['def full_name(user):', '    first = user.first.strip()', '    last = user.last.strip()', '    return f"{first} {last}"'],
            },
            solution: '"2p',
          },
          {
            prompt: 'A word was cut, then a line. Put the word back before "function", where the cursor is.',
            setup: {
              name: 'load.ts',
              text: ['// fetch the user', 'export async function loadUser(id: string) {', '  return api.get(`/users/${id}`);', '}'],
              cursor: { line: 1, col: 7 },
              init: vim => {
                vim.feedKeys('dwggdd');
                vim.typedKeys = 0;
              },
            },
            goal: { text: ['export async function loadUser(id: string) {', '  return api.get(`/users/${id}`);', '}'] },
            solution: '"-P',
          },
          {
            prompt: 'Delete the "old:" line, then put the "benchmark" line, deleted earlier, back at the end.',
            setup: {
              name: 'todo.md',
              text: ['- [x] ship v2', '- [ ] old: migrate to webpack', '- [ ] write release notes'],
              cursor: { line: 1, col: 0 },
              init: vim => {
                vim.setCursor({ line: 2, col: 0 });
                vim.feedKeys('o- [ ] benchmark the parser<Esc>dd');
                vim.setCursor({ line: 1, col: 0 });
                vim.typedKeys = 0;
              },
            },
            goal: { text: ['- [x] ship v2', '- [ ] write release notes', '- [ ] benchmark the parser'] },
            solution: 'dd"2p',
          },
        ],
      },
    },
    {
      id: 'black-hole-register',
      title: 'The Black Hole',
      chips: ['"_'],
      keyCards: [{ key: '"_', glyph: '∅', label: 'black hole', sub: 'delete without saving' }],
      intro: (
        <>
          <p>
            Text deleted into <Code>{'"_'}</Code> goes nowhere. <Code>{'"_dd'}</Code> removes a line and leaves every
            other register, including <Code>{'""'}</Code>, exactly as it was.
          </p>
          <p>
            Use it when you yank first and clear space second: the plain <Code>p</Code> afterwards still puts your yank.
          </p>
        </>
      ),
      practice: total => (
        <p>
          Yank the good text, delete the bad text into <Code>{'"_'}</Code>, then put with plain <Code>p</Code> or{' '}
          <Code>P</Code>. {total} rounds.
        </p>
      ),
      aside: {
        title: 'Visual P',
        body: (
          <p>
            In visual mode, <Code>P</Code> replaces the selection and keeps the register as it was, so{' '}
            <Code>viwP</Code> can replace word after word. Vim before 8.2.4242 doesn't have it.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        base: { name: 'handler.go' },
        rounds: [
          {
            prompt: 'Replace the log.Println and os.Exit lines with a copy of the return line.',
            setup: {
              text: [
                'if err != nil {',
                '	return fmt.Errorf("load config: %w", err)',
                '}',
                'if err := cfg.Validate(); err != nil {',
                '	log.Println(err)',
                '	os.Exit(1)',
                '}',
              ],
              cursor: { line: 1, col: 0 },
            },
            goal: {
              text: [
                'if err != nil {',
                '	return fmt.Errorf("load config: %w", err)',
                '}',
                'if err := cfg.Validate(); err != nil {',
                '	return fmt.Errorf("load config: %w", err)',
                '}',
              ],
            },
            solution: 'yy3j"_2ddP',
          },
          {
            prompt: 'Replace "ctx2" with "ctx", copied from the line above. The cursor is on it.',
            setup: {
              text: [
                '// Get loads one user by id.',
                'func (s *Store) Get(ctx context.Context, id string) *User {',
                '	return s.db.QueryUser(ctx2, id)',
                '}',
              ],
              cursor: { line: 1, col: 20 },
            },
            goal: {
              text: [
                '// Get loads one user by id.',
                'func (s *Store) Get(ctx context.Context, id string) *User {',
                '	return s.db.QueryUser(ctx, id)',
                '}',
              ],
            },
            solution: 'yiwjfc"_diwP',
          },
          {
            prompt: 'Replace "tmp" with "start_date". The cursor is on start_date.',
            setup: {
              name: 'dates.py',
              text: [
                'start_date = parse(args.start)',
                'end_date = parse(args.end)',
                'report = build(tmp, end_date)',
                'print(report.summary())',
              ],
              cursor: { line: 0, col: 0 },
            },
            goal: {
              text: [
                'start_date = parse(args.start)',
                'end_date = parse(args.end)',
                'report = build(start_date, end_date)',
                'print(report.summary())',
              ],
            },
            solution: 'yiw2jf(l"_dt,P',
          },
          {
            prompt: 'Replace the "Lorem ipsum" paragraph with a copy of the line the cursor is on.',
            setup: {
              name: 'README.md',
              text: [
                '# vimchi',
                '',
                'A browser Vim tutor built from short lessons.',
                '',
                'Lorem ipsum dolor sit amet,',
                'consectetur adipiscing elit.',
              ],
              cursor: { line: 2, col: 0 },
            },
            goal: {
              text: ['# vimchi', '', 'A browser Vim tutor built from short lessons.', '', 'A browser Vim tutor built from short lessons.'],
            },
            solution: 'yyG"_dipp',
          },
        ],
      },
    },
    {
      id: 'read-only-registers',
      title: 'Read-Only Registers',
      chips: ['".', '"%', '":'],
      keyCards: [
        { key: '".', glyph: 'ins', label: 'last inserted text' },
        { key: '"%', glyph: 'file', label: 'current file name' },
        { key: '":', glyph: ':', label: 'last command line' },
      ],
      intro: (
        <>
          <p>
            Vim fills a few registers for you. <Code>{'".'}</Code> holds the text you last typed in insert mode,{' '}
            <Code>{'"%'}</Code> the current file name, and <Code>{'":'}</Code> the last command you ran.
          </p>
          <p>
            You can't yank into them, but you can put from them: <Code>{'"%p'}</Code> writes the file name into a
            comment, <Code>{'":p'}</Code> pastes a command into your notes.
          </p>
        </>
      ),
      practice: total => (
        <p>
          Put from the read-only register the prompt describes. {total} rounds.
        </p>
      ),
      aside: {
        title: 'Run it again',
        body: (
          <p>
            <Code>@:</Code> runs the <Code>{'":'}</Code> register as a command again, and <Code>@@</Code> repeats that:
            dot-repeat for Ex commands. Repeat a Command, in the Command Line section, drills it.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        base: { name: 'Button.tsx' },
        rounds: [
          {
            prompt: 'You just changed "sum" to "subtotal" with cw. Do the same to "return sum", and put subtotal inside log().',
            setup: {
              name: 'total.ts',
              text: ['function total(items: Item[]) {', '  const sum = items.reduce(add, 0);', '  log();', '  return sum;', '}'],
              cursor: { line: 1, col: 8 },
              init: vim => {
                vim.feedKeys('cwsubtotal<Esc>');
                vim.typedKeys = 0;
              },
            },
            goal: {
              text: ['function total(items: Item[]) {', '  const subtotal = items.reduce(add, 0);', '  log(subtotal);', '  return subtotal;', '}'],
            },
            solution: 'jjb.kF(".p',
          },
          {
            prompt: 'Add the file name after "// File: ".',
            setup: {
              name: 'src/api/client.ts',
              text: [
                '// File: ',
                "import { createClient } from './http';",
                '',
                "export const client = createClient({ baseUrl: '/api' });",
              ],
              cursor: { line: 3, col: 0 },
            },
            goal: {
              text: [
                '// File: src/api/client.ts',
                "import { createClient } from './http';",
                '',
                "export const client = createClient({ baseUrl: '/api' });",
              ],
            },
            solution: 'gg$"%p',
          },
          {
            prompt: 'Put the command you just ran on a new line between the ``` lines, with a ":" in front.',
            setup: {
              name: 'cheatsheet.md',
              text: ['## Strip trailing whitespace', '', '```vim', '```'],
              cursor: { line: 0, col: 0 },
              init: vim => {
                vim.feedKeys(':%s/\\s\\+$//e<CR>');
                vim.setCursor({ line: 2, col: 0 });
                vim.typedKeys = 0;
              },
            },
            goal: { text: ['## Strip trailing whitespace', '', '```vim', ':%s/\\s\\+$//e', '```'] },
            solution: 'o:<Esc>":p',
          },
          {
            prompt: "Put the file name between the empty quotes ''.",
            setup: {
              name: 'billing.lua',
              text: ['local M = {}', '', "M.name = ''", '', 'return M'],
              cursor: { line: 0, col: 0 },
            },
            goal: { text: ['local M = {}', '', "M.name = 'billing.lua'", '', 'return M'] },
            solution: `2jf'"%p`,
          },
        ],
      },
    },
    {
      id: 'paste-while-typing',
      title: 'Paste While Typing',
      typing: true,
      chips: ['C-r'],
      keyCards: [
        { key: 'C-r', glyph: '⎘', label: 'insert a register', sub: 'then its name' },
        { key: 'C-r "', glyph: '""', label: 'what you just cut' },
        { key: 'C-r 0', glyph: 'y', label: 'your last yank' },
      ],
      intro: (
        <>
          <p>
            In insert mode, <Code>C-r</Code> followed by a register name types that register's contents at the cursor.{' '}
            <Code>C-r 0</Code> inserts your last yank, <Code>C-r "</Code> what you just deleted.
          </p>
          <p>
            It saves the leave-insert, put, re-enter dance, and it works on the command line too: yank a word, then{' '}
            <Code>/</Code> and <Code>C-r 0</Code> searches for it.
          </p>
        </>
      ),
      practice: total => (
        <p>
          Build each line with <Code>C-r</Code> instead of retyping. {total} rounds.
        </p>
      ),
      aside: {
        title: 'Word under the cursor',
        body: (
          <p>
            On the command line, <Code>C-r C-w</Code> inserts the word under the cursor without yanking it first.
            The Command Line section drills it; with Substitute it becomes the classic rename.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        base: { name: 'checkout.ts' },
        rounds: [
          {
            prompt: "Make the log line read console.log('orderTotal', orderTotal). The cursor is on orderTotal.",
            setup: {
              text: [
                'export function checkout(items: Item[]) {',
                '  const orderTotal = items.reduce(sum, 0);',
                '  console.log();',
                '  return charge(orderTotal);',
                '}',
              ],
              cursor: { line: 3, col: 16 },
            },
            goal: {
              text: [
                'export function checkout(items: Item[]) {',
                '  const orderTotal = items.reduce(sum, 0);',
                "  console.log('orderTotal', orderTotal);",
                '  return charge(orderTotal);',
                '}',
              ],
            },
            solution: "yiwkF(a'<C-r>0', <C-r>0<Esc>",
          },
          {
            prompt: 'Change "cache.set(order_id," to "cache.set(str(order_id),".',
            setup: {
              name: 'receipts.py',
              text: [
                'def save_receipt(order_id: int):',
                '    receipt = create_receipt(order_id)',
                '    cache.set(order_id, receipt)',
                '    return receipt',
              ],
              cursor: { line: 3, col: 4 },
            },
            goal: {
              text: [
                'def save_receipt(order_id: int):',
                '    receipt = create_receipt(order_id)',
                '    cache.set(str(order_id), receipt)',
                '    return receipt',
              ],
            },
            solution: 'kf(wciwstr(<C-r>")<Esc>',
          },
          {
            prompt: 'Register u holds a URL. Put it between the empty quotes on the first line.',
            setup: {
              text: [
                "const url = '';",
                'const res = await fetch(url, {',
                "  method: 'POST',",
                '  body: JSON.stringify(intent),',
                '});',
              ],
              registers: { u: 'https://api.stripe.com/v1/payment_intents' },
              cursor: { line: 2, col: 2 },
            },
            goal: {
              text: [
                "const url = 'https://api.stripe.com/v1/payment_intents';",
                'const res = await fetch(url, {',
                "  method: 'POST',",
                '  body: JSON.stringify(intent),',
                '});',
              ],
            },
            solution: "ggf'a<C-r>u<Esc>",
          },
          {
            prompt: 'Change every "amt" to "amount".',
            setup: {
              text: ['function charge(amt: number) {', '  if (amt <= 0) throw new Error(`bad amt`);', '  return gateway.charge(amt);', '}'],
              cursor: { line: 0, col: 16 },
            },
            goal: {
              text: [
                'function charge(amount: number) {',
                '  if (amount <= 0) throw new Error(`bad amount`);',
                '  return gateway.charge(amount);',
                '}',
              ],
            },
            solution: 'yiw:%s/<C-r>0/amount/g<CR>',
          },
          {
            prompt: "Put 'theme', with its quotes, inside the empty get().",
            setup: {
              text: ['const settings = loadSettings();', 'const theme = settings.theme;', 'const saved = settings.get();', 'applyTheme(saved);'],
              cursor: { line: 1, col: 0 },
            },
            goal: {
              text: ['const settings = loadSettings();', 'const theme = settings.theme;', "const saved = settings.get('theme');", 'applyTheme(saved);'],
            },
            solution: "$byiwjf(a'<C-r>0'<Esc>",
          },
        ],
      },
    },
    {
      id: 'expression-register',
      title: 'Expression Register',
      chips: ['C-r', '='],
      keyCards: [
        { key: 'C-r', glyph: '⎘', label: 'insert a register' },
        { key: '=', glyph: '1+1', label: 'expression', sub: 'type it, then Enter' },
      ],
      intro: (
        <>
          <p>
            <Code>C-r =</Code> opens a prompt at the bottom of the screen. Type an expression, press Enter, and its
            result is inserted at the cursor: <Code>C-r =</Code> <Mono>24*60*60</Mono> Enter types <Mono>86400</Mono>.
          </p>
          <p>
            It's a calculator that writes straight into the buffer, and it knows Vim's string functions too.
          </p>
        </>
      ),
      practice: total => (
        <p>
          Let the expression register do the arithmetic. {total} rounds.
        </p>
      ),
      aside: {
        title: 'Integer maths',
        body: (
          <p>
            <Mono>7/2</Mono> is <Mono>3</Mono>: numbers without a decimal point are integers, and dividing them
            drops the remainder. <Mono>printf('%.2f', x)</Mono> formats a decimal result.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        base: { name: 'limits.ts' },
        rounds: [
          {
            prompt: 'Fill in one day in milliseconds: 24*60*60*1000.',
            setup: {
              text: ['export const MAX_RETRIES = 5;', 'export const ONE_DAY_MS = ;', 'export const PAGE_SIZE = 50;'],
              cursor: { line: 2, col: 0 },
            },
            goal: { text: ['export const MAX_RETRIES = 5;', 'export const ONE_DAY_MS = 86400000;', 'export const PAGE_SIZE = 50;'] },
            solution: 'kf;i<C-r>=24*60*60*1000<CR><Esc>',
          },
          {
            prompt: 'Fill in the Total row: the three costs added up.',
            setup: {
              name: 'invoice.md',
              text: ['| Item | Cost |', '|---|---|', '| Hosting | 129 |', '| Domain | 18 |', '| Email | 45 |', '| Total | |'],
              cursor: { line: 5, col: 0 },
            },
            goal: { text: ['| Item | Cost |', '|---|---|', '| Hosting | 129 |', '| Domain | 18 |', '| Email | 45 |', '| Total | 192 |'] },
            solution: '$i<C-r>=129+18+45<CR> <Esc>',
          },
          {
            prompt: 'Replace the 0 with 25 MB in bytes: 25*1024*1024.',
            setup: {
              text: ['export const upload = {', '  maxBytes: 0, // 25 MB', "  types: ['image/png', 'image/jpeg'],", '};'],
              cursor: { line: 3, col: 0 },
            },
            goal: { text: ['export const upload = {', '  maxBytes: 26214400, // 25 MB', "  types: ['image/png', 'image/jpeg'],", '};'] },
            solution: '2kf0cl<C-r>=25*1024*1024<CR><Esc>',
          },
          {
            prompt: "Add a line of 23 '=' under the heading. repeat('=', 23) builds it.",
            setup: {
              name: 'CHANGELOG.md',
              text: ['Release notes for 3.0.0', '', '- Drop Node 18 support.', '- New plugin API.'],
              cursor: { line: 3, col: 0 },
            },
            goal: { text: ['Release notes for 3.0.0', '=======================', '', '- Drop Node 18 support.', '- New plugin API.'] },
            solution: "ggo<C-r>=repeat('=', 23)<CR><Esc>",
          },
          {
            prompt: 'Replace the total 0 with 3 * 4.99, to two decimals (see the aside).',
            setup: {
              name: 'order.json',
              text: ['{', '  "sku": "MUG-01",', '  "qty": 3,', '  "price": 4.99,', '  "total": 0', '}'],
              cursor: { line: 2, col: 2 },
            },
            goal: { text: ['{', '  "sku": "MUG-01",', '  "qty": 3,', '  "price": 4.99,', '  "total": 14.97', '}'] },
            solution: "2j$cl<C-r>=printf('%.2f', 3 * 4.99)<CR><Esc>",
          },
        ],
      },
    },
  ],
};
