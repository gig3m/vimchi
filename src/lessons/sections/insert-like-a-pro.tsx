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
      typing: true,
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
            prompt: 'Return the result and end the statement.',
            setup: {
              text: ['function visibleRows(items: Item[]) {', '  items.filter(isVisible).map(toRow)', '}'],
              cursor: { line: 1, col: 12 },
            },
            goal: {
              text: ['function visibleRows(items: Item[]) {', '  return items.filter(isVisible).map(toRow);', '}'],
            },
            solution: 'Ireturn <Esc>A;<Esc>',
          },
          {
            prompt: 'Comment out both options.',
            setup: {
              name: 'init.lua',
              text: ['vim.opt.number = true', 'vim.opt.wrap = false', 'vim.opt.mouse = "a"', 'vim.opt.tabstop = 2'],
              cursor: { line: 1, col: 9 },
            },
            goal: { text: ['vim.opt.number = true', '-- vim.opt.wrap = false', '-- vim.opt.mouse = "a"', 'vim.opt.tabstop = 2'] },
            solution: 'I-- <Esc>jI-- <Esc>',
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
          Add the missing lines from the goal, most of them blank. Pick the neighbouring line, then <Code>o</Code>{' '}
          or <Code>O</Code>. {total} rounds.
        </p>
      ),
      aside: {
        title: 'Blank lines',
        body: (
          <p>
            <Code>o</Code> then <Code>esc</Code> adds an empty line below. The next lesson adds blank lines without
            leaving normal mode at all.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        base: { name: 'user.ts' },
        rounds: [
          {
            prompt: 'Put a blank line between the two functions.',
            setup: {
              name: 'nums.ts',
              text: ['function one() {', '  return 1;', '}', 'function two() {', '  return 2;', '}'],
              cursor: { line: 1, col: 4 },
            },
            goal: { text: ['function one() {', '  return 1;', '}', '', 'function two() {', '  return 2;', '}'] },
            solution: 'jo<Esc>',
          },
          {
            prompt: 'Give the heading a blank line above and below.',
            setup: {
              name: 'README.md',
              text: ['# vimchi', 'A browser Vim tutor.', '## Usage', 'Run npm run dev.'],
              cursor: { line: 2, col: 4 },
            },
            goal: { text: ['# vimchi', 'A browser Vim tutor.', '', '## Usage', '', 'Run npm run dev.'] },
            solution: 'O<Esc>jo<Esc>',
          },
          {
            prompt: 'Close the table with "}" above the return.',
            setup: {
              name: 'mod.lua',
              text: ['local M = {', '  x = 1,', '  y = 2,', 'return M'],
              cursor: { line: 1, col: 3 },
            },
            goal: { text: ['local M = {', '  x = 1,', '  y = 2,', '}', 'return M'] },
            solution: 'jjO}<Esc>',
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
            prompt: 'Add "id: 1," below the name (it keeps the indent).',
            setup: {
              text: ['const user = {', "  name: 'Ada',", "  role: 'admin',", '};'],
              cursor: { line: 1, col: 5 },
            },
            goal: { text: ['const user = {', "  name: 'Ada',", '  id: 1,', "  role: 'admin',", '};'] },
            solution: 'oid: 1,<Esc>',
          },
          {
            prompt: 'Put a blank line after each of the first two functions.',
            setup: {
              name: 'noop.ts',
              text: ['function a() {}', 'function b() {}', 'function c() {}'],
              cursor: { line: 0, col: 9 },
            },
            goal: { text: ['function a() {}', '', 'function b() {}', '', 'function c() {}'] },
            solution: 'o<Esc>jo<Esc>',
          },
        ],
      },
    },
    {
      id: 'blank-lines',
      title: 'Blank Lines',
      chips: ['[␣', ']␣'],
      keyCards: [
        { key: '[␣', glyph: '⏎↑', label: 'blank line above' },
        { key: ']␣', glyph: '⏎↓', label: 'blank line below' },
      ],
      intro: (
        <>
          <p>
            <Code>[&lt;Space&gt;</Code> adds a blank line above the cursor and <Code>]&lt;Space&gt;</Code> one below. A
            count adds that many.
          </p>
          <p>
            Unlike <Code>o</Code> and <Code>O</Code>, you stay in normal mode and the cursor stays on its line, so you
            can space out code without stopping what you're doing.
          </p>
          <BeforeAfter
            lines={['}', 'export function lerp() {']}
            cursor={[0, 0]}
            keys="]<Space>"
            caption="A blank line below; the cursor stays on the brace."
          />
          <BeforeAfter
            lines={['import os', 'def main():', '    pass']}
            cursor={[1, 4]}
            keys="2[<Space>"
            caption="With a count: two blank lines above."
          />
        </>
      ),
      practice: total => <p>Add the blank lines the goal shows. {total} rounds.</p>,
      aside: {
        title: 'Borrowed from unimpaired',
        body: (
          <p>
            These came from Tim Pope's vim-unimpaired, along with the <Code>[</Code> and <Code>]</Code> pairs you
            will meet later for buffers and quickfix. Neovim 0.11 built them in; in classic Vim you still need the
            plugin.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        base: { name: 'utils.ts' },
        rounds: [
          {
            prompt: 'Separate the two functions.',
            setup: {
              text: ['export function clamp(n: number, lo: number, hi: number) {', '  return Math.min(hi, Math.max(lo, n));', '}', 'export function lerp(a: number, b: number, t: number) {', '  return a + (b - a) * t;', '}'],
              cursor: { line: 2, col: 0 },
            },
            goal: {
              text: ['export function clamp(n: number, lo: number, hi: number) {', '  return Math.min(hi, Math.max(lo, n));', '}', '', 'export function lerp(a: number, b: number, t: number) {', '  return a + (b - a) * t;', '}'],
            },
            solution: '] ',
          },
          {
            prompt: 'Give the heading room above it.',
            setup: {
              name: 'README.md',
              text: ['Run `npm install` first.', '## Usage', '', 'Start the server with `npm run dev`.'],
              cursor: { line: 1, col: 3 },
            },
            goal: { text: ['Run `npm install` first.', '', '## Usage', '', 'Start the server with `npm run dev`.'] },
            solution: '[ ',
          },
          {
            prompt: 'PEP 8 wants two blank lines before a top-level def.',
            setup: {
              name: 'shapes.py',
              text: ['def area(r):', '    return 3.14159 * r * r', 'def circumference(r):', '    return 2 * 3.14159 * r'],
              cursor: { line: 2, col: 0 },
            },
            goal: { text: ['def area(r):', '    return 3.14159 * r * r', '', '', 'def circumference(r):', '    return 2 * 3.14159 * r'] },
            solution: '2[ ',
          },
          {
            prompt: 'Put a blank line on both sides of the rule.',
            setup: {
              name: 'CHANGELOG.md',
              text: ['- Fixed the login redirect.', '---', '## 1.4.0'],
              cursor: { line: 1, col: 0 },
            },
            goal: { text: ['- Fixed the login redirect.', '', '---', '', '## 1.4.0'] },
            solution: '[ ] ',
          },
          {
            prompt: 'Split the keymaps from the options.',
            setup: {
              name: 'init.lua',
              text: ['vim.opt.number = true', 'vim.opt.relativenumber = true', "vim.keymap.set('n', '<Esc>', '<cmd>nohlsearch<CR>')", "vim.keymap.set('n', '<leader>w', '<cmd>write<CR>')"],
              cursor: { line: 1, col: 8 },
            },
            goal: {
              text: ['vim.opt.number = true', 'vim.opt.relativenumber = true', '', "vim.keymap.set('n', '<Esc>', '<cmd>nohlsearch<CR>')", "vim.keymap.set('n', '<leader>w', '<cmd>write<CR>')"],
            },
            solution: '] ',
          },
        ],
      },
    },
    {
      id: 'substitute',
      title: 'Substitute Characters',
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
        title: 'S and cc',
        body: (
          <>
          <p>
            <Code>S</Code> and <Code>cc</Code> do the same thing. You'll meet <Code>cc</Code> again in Change Lines,
            alongside <Code>C</Code>.
          </p>
          <p>
            Both starters later rebind these keys: LazyVim gives <Code>s</Code> and <Code>S</Code> to flash.nvim
            (label jumps), kickstart gives <Code>s</Code> to mini.surround. <Code>cl</Code> and <Code>cc</Code> are the
            spellings that survive, so they are worth knowing too.
          </p>
          </>
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
            prompt: 'Number the list: 1., 2., 3.',
            setup: { name: 'TODO.md', text: ['* Write', '* Test', '* Ship'], cursor: { line: 0, col: 0 } },
            goal: { text: ['1. Write', '2. Test', '3. Ship'] },
            solution: 's1.<Esc>j0s2.<Esc>j0s3.<Esc>',
          },
          {
            prompt: 'Change "14px" to "1rem".',
            setup: {
              name: 'theme.ts',
              text: ['export const body = {', "  fontFamily: 'Inter, sans-serif',", "  fontSize: '14px',", '  lineHeight: 1.5,', '};'],
              cursor: { line: 1, col: 13 },
            },
            goal: {
              text: ['export const body = {', "  fontFamily: 'Inter, sans-serif',", "  fontSize: '1rem',", '  lineHeight: 1.5,', '};'],
            },
            solution: 'j4s1rem<Esc>',
          },
          {
            prompt: 'The stray print should be the "end" of the if.',
            setup: {
              name: 'check.lua',
              text: ['if ok then', '  run()', "print('x')", 'return ok'],
              cursor: { line: 0, col: 3 },
            },
            goal: { text: ['if ok then', '  run()', 'end', 'return ok'] },
            solution: 'jjSend<Esc>',
          },
          {
            prompt: 'Rewrite the TODO step as "2. Tag".',
            setup: {
              name: 'deploy.md',
              text: ['1. Build the image.', '2. TODO', '3. Restart the service.'],
              cursor: { line: 1, col: 4 },
            },
            goal: { text: ['1. Build the image.', '2. Tag', '3. Restart the service.'] },
            solution: 'S2. Tag<Esc>',
          },
        ],
      },
    },
    {
      id: 'replace-mode',
      title: 'Replace Mode',
      typing: true,
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
            prompt: 'Set the expiry to 06/2027.',
            setup: { text: ['{', '  "card": "visa",', '  "expires": "12/2025"', '}'], cursor: { line: 2, col: 2 } },
            goal: { text: ['{', '  "card": "visa",', '  "expires": "06/2027"', '}'] },
            solution: 'f1R06/2027<Esc>',
          },
          {
            prompt: 'Mark the task DONE.',
            setup: {
              name: 'notes.ts',
              text: ['// TODO', 'export const retries = 3;', 'export const timeoutMs = 5_000;'],
              cursor: { line: 0, col: 3 },
            },
            goal: { text: ['// DONE', 'export const retries = 3;', 'export const timeoutMs = 5_000;'] },
            solution: 'RDONE<Esc>',
          },
          {
            prompt: 'Bump both packages to 2.0.',
            setup: {
              name: 'versions.json',
              text: ['{', '  "engine": "1.4",', '  "cli": "1.7"', '}'],
              cursor: { line: 0, col: 0 },
            },
            goal: { text: ['{', '  "engine": "2.0",', '  "cli": "2.0"', '}'] },
            solution: 'jf1R2.0<Esc>j0f1R2.0<Esc>',
          },
        ],
      },
    },
  ],
};
