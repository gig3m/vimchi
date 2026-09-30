import { Code } from '../../components/Code';
import type { Vim } from '../../vim/editor';
import type { Section } from '../types';

const file = (...lines: string[]) => lines.join('\n') + '\n';

// A small Express + Postgres notes API.
const PROJECT: Record<string, string> = {
  'README.md': file(
    '# notes-api',
    '',
    'A small JSON API for notes.',
    '',
    '- Entry point: src/index.ts',
    '- Routes live in src/routes/',
    '- Settings: src/config.ts',
  ),
  'src/index.ts': file(
    "import { createServer } from './server';",
    "import { config } from './config';",
    '',
    'const server = createServer();',
    '',
    'server.listen(config.port, () => {',
    '  console.log(`notes api on :${config.port}`);',
    '});',
  ),
  'src/server.ts': file(
    "import express from 'express';",
    "import { notes } from './routes/notes';",
    "import { users } from './routes/users';",
    '',
    'export function createServer() {',
    '  const app = express();',
    '  app.use(express.json());',
    "  app.use('/notes', notes);",
    "  app.use('/users', users);",
    '  return app;',
    '}',
  ),
  'src/config.ts': file(
    "const DEFAULT_DB = 'postgres://localhost/notes';",
    '',
    'export const config = {',
    '  port: Number(process.env.PORT ?? 3000),',
    '  dbUrl: process.env.DATABASE_URL ?? DEFAULT_DB,',
    '};',
  ),
  'src/db.ts': file(
    "import { Pool } from 'pg';",
    "import { config } from './config';",
    '',
    'export const db = new Pool({',
    '  connectionString: config.dbUrl,',
    '});',
  ),
  'src/routes/notes.ts': file(
    "import { Router } from 'express';",
    "import { db } from '../db';",
    '',
    'export const notes = Router();',
    '',
    "notes.get('/', async (_req, res) => {",
    '  const { rows } = await db.query(',
    "    'select * from notes order by created_at desc',",
    '  );',
    '  res.json(rows);',
    '});',
    '',
    "notes.post('/', async (req, res) => {",
    '  const { title, body } = req.body;',
    '  const { rows } = await db.query(',
    "    'insert into notes (title, body) ' +",
    "      'values ($1, $2) returning *',",
    '    [title, body],',
    '  );',
    '  res.status(201).json(rows[0]);',
    '});',
  ),
  'src/routes/users.ts': file(
    "import { Router } from 'express';",
    "import { db } from '../db';",
    '',
    'export const users = Router();',
    '',
    "users.get('/:id', async (req, res) => {",
    '  const { rows } = await db.query(',
    "    'select id, name from users where id = $1',",
    '    [req.params.id],',
    '  );',
    '  res.json(rows[0] ?? null);',
    '});',
  ),
  'test/notes.test.ts': file(
    "import { expect, it } from 'vitest';",
    "import { createServer } from '../src/server';",
    '',
    "it('creates an app', () => {",
    '  expect(createServer()).toBeDefined();',
    '});',
  ),
};

/** Open these files as buffers, in order, after the starting one. The last is current. */
const opened = (...names: string[]) => (vim: Vim) => {
  for (const n of names) vim.ex(`e ${n}`);
};

/** Buffers 1–5, as :ls numbers them. */
const FIVE = opened('src/server.ts', 'src/routes/notes.ts', 'src/db.ts', 'README.md');

const listed = (vim: Vim, name: string) => vim.buffers.some(b => b.listed && b.name === name);

export const buffersFiles: Section = {
  id: 'buffers-files',
  title: 'Buffers & Files',
  band: 'project',
  lessons: [
    {
      id: 'opening-files',
      title: 'Opening Files',
      chips: [':e'],
      keyCards: [
        { key: ':e', glyph: '→f', label: 'edit a file', sub: ':e path' },
        { key: ':e!', glyph: '↺', label: 'reload from disk' },
      ],
      intro: (
        <>
          <p>
            <Code>:e src/db.ts</Code> opens a file in the current window. Paths are relative to the directory Neovim
            started in, and a name that doesn't exist yet starts a new, empty buffer that reaches the disk on{' '}
            <Code>:w</Code>.
          </p>
          <p>
            Each file you open becomes a buffer and stays loaded after you move on. <Code>:e!</Code> with no name
            throws away your changes and reloads the current file from disk.
          </p>
        </>
      ),
      practice: total => (
        <p>
          The notes API is open. Open each file with <Code>:e</Code> and press <Code>Enter</Code>. {total} rounds.
        </p>
      ),
      aside: {
        title: 'Leaving unsaved buffers',
        body: (
          <p>
            Neovim turns on <Code>hidden</Code> by default, so <Code>:e</Code> lets you leave a file with unsaved
            changes and they wait in the buffer. Classic Vim refuses with E37 unless you <Code>:set hidden</Code>.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        base: { files: PROJECT, open: 'src/index.ts', height: 14 },
        rounds: [
          {
            prompt: 'Open src/db.ts.',
            goal: { buffer: 'src/db.ts' },
            solution: ':e src/db.ts<CR>',
          },
          {
            prompt: 'Open the README.',
            setup: { open: 'src/config.ts' },
            goal: { buffer: 'README.md' },
            solution: ':e README.md<CR>',
          },
          {
            prompt: 'Open src/routes/users.ts.',
            setup: { open: 'src/routes/notes.ts' },
            goal: { buffer: 'src/routes/users.ts' },
            solution: ':e src/routes/users.ts<CR>',
          },
          {
            prompt: 'Start a new file, src/routes/tags.ts, and write it to disk.',
            setup: { open: 'src/server.ts' },
            goal: { buffer: 'src/routes/tags.ts', check: vim => vim.fs.read('src/routes/tags.ts') != null },
            solution: ':e src/routes/tags.ts<CR>:w<CR>',
          },
          {
            prompt: 'You deleted the wrong lines. Reload the file from disk.',
            // Four separate deletes, then a yank: neither one `P` nor one `u` brings the lines back.
            setup: { open: 'src/routes/notes.ts', cursor: { line: 5, col: 0 }, init: vim => vim.feedKeys('ddddddddggyy') },
            goal: { text: PROJECT['src/routes/notes.ts'].slice(0, -1) },
            solution: ':e!<CR>',
          },
        ],
      },
    },
    {
      id: 'buffer-list',
      title: 'Buffer List',
      chips: [':ls', ':b'],
      keyCards: [
        { key: ':ls', glyph: '☰', label: 'list buffers' },
        { key: ':b', glyph: '→', label: 'switch buffer', sub: ':b name or :b 3' },
      ],
      intro: (
        <>
          <p>
            <Code>:ls</Code> lists the open buffers with their numbers. <Code>%a</Code> marks the one in this window
            and <Code>#</Code> the one you were in before.
          </p>
          <p>
            <Code>:b</Code> switches to a buffer by number (<Code>:b3</Code>) or by any unique part of its name (
            <Code>:b db</Code>). You rarely need the full path.
          </p>
        </>
      ),
      practice: total => (
        <p>
          Five buffers are open: index.ts, server.ts, notes.ts, db.ts and the README. Switch to the one each round
          asks for. {total} rounds.
        </p>
      ),
      aside: {
        title: 'Tab completes',
        body: (
          <p>
            <Code>:b</Code> completes buffer names with <Code>Tab</Code>, matching anywhere in the path, so{' '}
            <Code>:b not</Code> then <Code>Tab</Code> finds src/routes/notes.ts.
           With a picker, <Code>Space fb</Code> (LazyVim <Code>Space ,</Code>) lists the same buffers with fuzzy search.</p>
        ),
      },
      challenge: {
        kind: 'rounds',
        base: { files: PROJECT, open: 'src/index.ts', height: 14, init: FIVE },
        rounds: [
          {
            prompt: 'Switch to db.ts by name.',
            goal: { buffer: 'src/db.ts' },
            solution: ':b db<CR>',
          },
          {
            prompt: 'List the buffers, then switch to server.ts by its number.',
            goal: { buffer: 'src/server.ts' },
            solution: ':ls<CR>:b2<CR>',
          },
          {
            prompt: 'Switch to the notes routes.',
            goal: { buffer: 'src/routes/notes.ts' },
            solution: ':b notes<CR>',
          },
          {
            prompt: 'Switch to buffer 1.',
            goal: { buffer: 'src/index.ts' },
            solution: ':b1<CR>',
          },
          {
            prompt: 'Back to the README.',
            setup: { init: vim => { FIVE(vim); vim.ex('b1'); } },
            goal: { buffer: 'README.md' },
            solution: ':b READ<CR>',
          },
        ],
      },
    },
    {
      id: 'cycling-buffers',
      title: 'Cycling Buffers',
      chips: ['[b', ']b'],
      keyCards: [
        { key: '[b', glyph: '←', label: 'previous buffer' },
        { key: ']b', glyph: '→', label: 'next buffer' },
      ],
      intro: (
        <>
          <p>
            <Code>]b</Code> moves to the next buffer in the list and <Code>[b</Code> to the previous one. Both wrap
            around at the ends.
          </p>
          <p>
            They are quickest when you have a handful of related files open. A count skips ahead: <Code>2]b</Code>{' '}
            moves two buffers on.
          </p>
        </>
      ),
      practice: total => (
        <p>
          Buffers 1–5 are index.ts, server.ts, notes.ts, db.ts and the README. Cycle to the one each round asks for.{' '}
          {total} rounds.
        </p>
      ),
      aside: {
        title: 'New in Neovim 0.11',
        body: (
          <p>
            <Code>[b</Code> <Code>]b</Code> (and <Code>[B</Code> <Code>]B</Code> for first and last) are built-in maps
            since Neovim 0.11, borrowed from vim-unimpaired. LazyVim also binds <Code>S-h</Code> / <Code>S-l</Code> to
            the same moves, with bufferline showing the buffers as tabs. In classic Vim use <Code>:bnext</Code> and{' '}
            <Code>:bprevious</Code>.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        base: { files: PROJECT, open: 'src/index.ts', height: 14 },
        rounds: [
          {
            prompt: 'Go to the next buffer.',
            setup: { init: vim => { FIVE(vim); vim.ex('b2'); } },
            goal: { buffer: 'src/routes/notes.ts' },
            solution: ']b',
          },
          {
            prompt: 'Go to the previous buffer.',
            setup: { init: vim => { FIVE(vim); vim.ex('b4'); } },
            goal: { buffer: 'src/routes/notes.ts' },
            solution: '[b',
          },
          {
            prompt: 'From index.ts, go back one. It wraps.',
            setup: { init: vim => { FIVE(vim); vim.ex('b1'); } },
            goal: { buffer: 'README.md' },
            solution: '[b',
          },
          {
            prompt: 'Skip ahead two buffers.',
            setup: { init: vim => { FIVE(vim); vim.ex('b1'); } },
            goal: { buffer: 'src/routes/notes.ts' },
            solution: '2]b',
          },
          {
            prompt: 'Forward one, past the end.',
            setup: { init: FIVE },
            goal: { buffer: 'src/index.ts' },
            solution: ']b',
          },
        ],
      },
    },
    {
      id: 'alternate-file',
      title: 'Alternate File',
      chips: ['C-^'],
      keyCards: [{ key: 'C-^', glyph: '⇄', label: 'alternate file', sub: 'Ctrl-6' }],
      intro: (
        <>
          <p>
            <Code>C-^</Code> (Ctrl-6 on most keyboards) jumps back to the file you were in before this one, the
            alternate file marked <Code>#</Code> in <Code>:ls</Code>. Press it again to come back.
          </p>
          <p>
            It is the fastest way to flip between two files, like a route and the module it imports. With a count,{' '}
            <Code>3 C-^</Code> edits buffer 3.
          </p>
        </>
      ),
      practice: total => (
        <p>
          Flip back to the file the round asks for. In the browser, press <Code>Ctrl-Shift-6</Code>: plain Ctrl-6
          switches browser tabs. {total} rounds.
        </p>
      ),
      aside: {
        title: 'The ex spelling',
        body: (
          <p>
            <Code>#</Code> means the alternate file on the command line too: <Code>:e #</Code> does what{' '}
            <Code>C-^</Code> does, and <Code>:vs #</Code> opens it in a split.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        base: { files: PROJECT, open: 'src/index.ts', height: 14 },
        rounds: [
          {
            prompt: 'You just opened server.ts. Go back to index.ts.',
            setup: { init: opened('src/server.ts') },
            goal: { buffer: 'src/index.ts' },
            solution: '<C-^>',
          },
          {
            prompt: 'Open src/config.ts, then flip back here.',
            setup: { open: 'src/db.ts' },
            goal: { buffer: 'src/db.ts', check: vim => vim.win.alt?.name === 'src/config.ts' },
            solution: ':e src/config.ts<CR><C-^>',
          },
          {
            prompt: 'Open the imported src/db.ts, then flip back.',
            setup: { open: 'src/routes/notes.ts', cursor: { line: 1, col: 20 } },
            goal: { buffer: 'src/routes/notes.ts', check: vim => vim.win.alt?.name === 'src/db.ts' },
            solution: ':e src/db.ts<CR><C-^>',
          },
          {
            prompt: 'Edit buffer 4 (db.ts) with a count.',
            setup: { init: FIVE },
            goal: { buffer: 'src/db.ts' },
            solution: '4<C-^>',
          },
        ],
      },
    },
    {
      id: 'closing-buffers',
      title: 'Closing Buffers',
      chips: [':bd'],
      keyCards: [
        { key: ':bd', glyph: '✕', label: 'delete buffer', sub: ':bd name, :bd 2 3' },
        { key: ':bd!', glyph: '✕!', label: 'discard changes' },
      ],
      intro: (
        <>
          <p>
            <Code>:bd</Code> removes the current buffer from the list and shows another one in its place. Give it names
            or numbers to close other buffers without leaving this one: <Code>:bd db</Code>, <Code>:bd 2 3</Code>.
          </p>
          <p>
            A buffer with unsaved changes won't go quietly. <Code>:bd!</Code> drops it and its changes.
          </p>
        </>
      ),
      practice: total => (
        <p>
          Buffers 1–5 are index.ts, server.ts, notes.ts, db.ts and the README. Close the ones each round names.{' '}
          {total} rounds.
        </p>
      ),
      aside: {
        title: ':q is not :bd',
        body: (
          <p>
            <Code>:q</Code> closes a window but the buffer stays in <Code>:ls</Code>. <Code>:bd</Code> takes it out of
            the list, which keeps <Code>]b</Code> and <Code>:b</Code> completion short.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        base: { files: PROJECT, open: 'src/index.ts', height: 14, init: FIVE },
        rounds: [
          {
            prompt: "You're done with the README. Close it.",
            goal: { check: vim => !listed(vim, 'README.md') && listed(vim, 'src/db.ts') },
            solution: ':bd<CR>',
          },
          {
            prompt: 'Close db.ts but stay in the README.',
            goal: { buffer: 'README.md', check: vim => !listed(vim, 'src/db.ts') },
            solution: ':bd db<CR>',
          },
          {
            prompt: 'Close buffers 2 and 3 in one command.',
            goal: {
              buffer: 'README.md',
              check: vim => !listed(vim, 'src/server.ts') && !listed(vim, 'src/routes/notes.ts') && listed(vim, 'src/db.ts'),
            },
            solution: ':bd 2 3<CR>',
          },
          {
            prompt: "notes.ts has edits you don't want. Close it anyway.",
            setup: {
              init: vim => {
                FIVE(vim);
                vim.ex('b notes');
                vim.feedKeys('Gdd');
                vim.ex('b READ');
              },
            },
            goal: { buffer: 'README.md', check: vim => !listed(vim, 'src/routes/notes.ts') },
            solution: ':bd! notes<CR>',
          },
        ],
      },
    },
    {
      id: 'go-to-file',
      title: 'Go to File',
      chips: ['gf'],
      keyCards: [{ key: 'gf', glyph: '↳f', label: 'open file under cursor' }],
      intro: (
        <>
          <p>
            <Code>gf</Code> opens the file whose name is under the cursor, or the next one after it on the line. Relative
            paths like <Code>'../db'</Code> resolve from the current file.
          </p>
          <p>
            Imports without an extension work too: the TypeScript filetype tells Vim to try <Code>.ts</Code>,{' '}
            <Code>.tsx</Code> and friends.
          </p>
        </>
      ),
      practice: total => (
        <p>
          Put the cursor on or before the path and press <Code>gf</Code>. {total} rounds.
        </p>
      ),
      aside: {
        title: 'Getting back',
        body: (
          <p>
            <Code>gf</Code> adds a jump, so <Code>C-o</Code> takes you back to the exact spot. <Code>C-^</Code>{' '}
            works too, but only remembers one file.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        base: { files: PROJECT, open: 'src/index.ts', height: 14 },
        rounds: [
          {
            prompt: 'Open the server module.',
            goal: { buffer: 'src/server.ts' },
            solution: "f'gf",
          },
          {
            prompt: 'Open the notes routes.',
            setup: { open: 'src/server.ts', cursor: { line: 1, col: 0 } },
            goal: { buffer: 'src/routes/notes.ts' },
            solution: 'f.gf',
          },
          {
            prompt: 'Open the settings file the README mentions.',
            setup: { open: 'README.md', cursor: { line: 6, col: 0 } },
            goal: { buffer: 'src/config.ts' },
            solution: '$gf',
          },
          {
            prompt: 'Open the db module this route imports.',
            setup: { open: 'src/routes/users.ts', cursor: { line: 1, col: 0 } },
            goal: { buffer: 'src/db.ts' },
            solution: "f'gf",
          },
          {
            prompt: 'Follow the import from the test to the server.',
            setup: { open: 'test/notes.test.ts', cursor: { line: 0, col: 0 } },
            goal: { buffer: 'src/server.ts' },
            solution: "jf'gf",
          },
        ],
      },
    },
    {
      id: 'finding-files',
      title: 'Finding Files',
      chips: [':find'],
      keyCards: [{ key: ':find', glyph: '?f', label: 'find by name', sub: ':find users.ts' }],
      intro: (
        <>
          <p>
            <Code>:find users.ts</Code> searches the directories in <Code>'path'</Code> and opens the first match, so
            you can open a file by name without knowing where it lives.
          </p>
          <p>
            Press <Code>Tab</Code> after part of a name to complete it. The completion shows the full path, which helps
            when two files share a name.
          </p>
        </>
      ),
      practice: total => (
        <p>
          Open each file with <Code>:find</Code> and just its file name. {total} rounds.
        </p>
      ),
      aside: {
        title: "Set 'path' first",
        body: (
          <p>
            Neovim's default <Code>path</Code> only covers the current file's directory and the working directory. Add{' '}
            <Code>vim.opt.path:append('**')</Code> to your config so <Code>:find</Code> searches every subdirectory, as
            it does here.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        base: { files: PROJECT, open: 'src/index.ts', height: 14 },
        rounds: [
          {
            prompt: 'Open users.ts.',
            goal: { buffer: 'src/routes/users.ts' },
            solution: ':find users.ts<CR>',
          },
          {
            prompt: 'Open config.ts.',
            setup: { open: 'src/routes/notes.ts' },
            goal: { buffer: 'src/config.ts' },
            solution: ':find config.ts<CR>',
          },
          {
            prompt: 'Open the notes test.',
            goal: { buffer: 'test/notes.test.ts' },
            solution: ':find notes.test.ts<CR>',
          },
          {
            prompt: 'Open server.ts, completing the name with Tab.',
            setup: { open: 'README.md' },
            goal: { buffer: 'src/server.ts' },
            solution: ':find se<Tab><CR>',
          },
          {
            prompt: 'Open notes.ts, the routes file.',
            setup: { open: 'src/db.ts' },
            goal: { buffer: 'src/routes/notes.ts' },
            solution: ':find notes.ts<CR>',
          },
        ],
      },
    },
  ],
};
