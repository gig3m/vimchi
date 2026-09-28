import { Code, Mono } from '../../components/Code';
import { Edits } from '../../components/pluginDiagrams';
import type { Section } from '../types';

export const surround: Section = {
  id: 'surround',
  title: 'Surround',
  band: 'plugins',
  lessons: [
    {
      id: 'add-surroundings',
      title: 'Add Surroundings',
      chips: ['ys'],
      keyCards: [{ key: 'ys', glyph: 'x→(x)', label: 'add a pair', sub: 'ys{motion}{char}' }],
      intro: (
        <>
          <p>
            nvim-surround adds <Code>ys</Code>, an operator that wraps text in a pair. Give it a motion or text object,
            then the character to wrap with: <Code>ysiw"</Code> puts quotes around the word under the cursor,{' '}
            <Code>ys$)</Code> wraps everything to the end of the line in parentheses.
          </p>
          <p>
            Opening brackets add a space inside, closing brackets don't: <Code>ysiw(</Code> gives{' '}
            <Mono>( word )</Mono>, <Code>ysiw)</Code> gives <Mono>(word)</Mono>. Any other character is used on both
            sides.
          </p>
          <Edits
            plugins={['surround']}
            rows={[
              { keys: 'ysiw"', text: 'mode = prod', cursor: 8 },
              { keys: 'ysiw(', text: 'return total', cursor: 9 },
              { keys: 'ysiw)', text: 'return total', cursor: 9 },
              { keys: 'ys$]', text: 'ports = 80, 443', cursor: 8 },
            ]}
          />
        </>
      ),
      practice: total => (
        <p>
          Wrap the text with <Code>ys</Code>, a motion and the character. {total} rounds.
        </p>
      ),
      aside: {
        title: 'Other surround plugins',
        body: (
          <p>
            nvim-surround copies the keys of tpope's vim-surround, so <Code>ys</Code>, <Code>cs</Code> and{' '}
            <Code>ds</Code> work in both. mini.surround uses <Code>sa</Code>, <Code>sr</Code> and <Code>sd</Code>{' '}
            instead. Shortcuts: <Code>b</Code> is <Mono>)</Mono>, <Code>B</Code> is <Mono>{'}'}</Mono>,{' '}
            <Code>r</Code> is <Mono>]</Mono>.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        base: { name: 'config.ts', plugins: ['surround'] },
        rounds: [
          {
            prompt: 'Quote "production".',
            setup: { text: ['export const config = {', '  mode: production,', '  port: 8080,', '};'], cursor: { line: 1, col: 10 } },
            goal: { text: ['export const config = {', '  mode: "production",', '  port: 8080,', '};'] },
            solution: 'ysiw"',
          },
          {
            prompt: 'Put "width * height" in parentheses.',
            setup: {
              text: ['function area(width: number, height: number) {', '  const half = width * height / 2;', '  return Math.round(half);', '}'],
              cursor: { line: 1, col: 15 },
            },
            goal: { text: ['function area(width: number, height: number) {', '  const half = (width * height) / 2;', '  return Math.round(half);', '}'] },
            solution: 'ys3e)',
          },
          {
            prompt: 'Make the list of ports an array.',
            setup: { text: ["const host = 'localhost';", 'const ports = 3000, 3001, 3002;', 'server.listen(host, ports);'], cursor: { line: 1, col: 14 } },
            goal: { text: ["const host = 'localhost';", 'const ports = [3000, 3001, 3002];', 'server.listen(host, ports);'] },
            solution: 'yst;]',
          },
          {
            prompt: 'Wrap "silent = true" in a table, with spaces inside.',
            setup: {
              name: 'init.lua',
              text: ['local map = vim.keymap.set', "map('n', '<leader>w', ':w<CR>', silent = true)", "map('n', '<leader>q', ':q<CR>')"],
              cursor: { line: 1, col: 32 },
            },
            goal: { text: ['local map = vim.keymap.set', "map('n', '<leader>w', ':w<CR>', { silent = true })", "map('n', '<leader>q', ':q<CR>')"] },
            solution: 'yst){',
          },
          {
            prompt: 'Mark "npm install" as code.',
            setup: {
              name: 'README.md',
              text: ['## Setup', '', 'Run npm install before the first build.', 'Then copy .env.example to .env.'],
              cursor: { line: 2, col: 0 },
            },
            goal: { text: ['## Setup', '', 'Run `npm install` before the first build.', 'Then copy .env.example to .env.'] },
            solution: 'wys2e`',
          },
        ],
      },
    },
    {
      id: 'change-surroundings',
      title: 'Change Surroundings',
      chips: ['cs'],
      keyCards: [{ key: 'cs', glyph: "'→\"", label: 'change a pair', sub: 'cs{old}{new}' }],
      intro: (
        <>
          <p>
            <Code>cs</Code> swaps one pair for another. Name the pair around the cursor, then the new one:{' '}
            <Code>cs'"</Code> turns <Mono>'text'</Mono> into <Mono>"text"</Mono>.
          </p>
          <p>
            The cursor only has to be inside the pair. If it isn't inside one, nvim-surround uses the next pair on the
            line. The same spacing rule applies: <Code>cs)(</Code> adds spaces inside, <Code>cs()</Code> removes them.
          </p>
          <Edits
            plugins={['surround']}
            rows={[
              { keys: `cs'"`, text: "from 'express'", cursor: 8 },
              { keys: 'cs)]', text: 'point = (x, y)', cursor: 9 },
              { keys: 'cs)(', text: 'if (ready)', cursor: 5 },
            ]}
          />
        </>
      ),
      practice: total => (
        <p>
          Change each pair with <Code>cs</Code>. {total} rounds.
        </p>
      ),
      aside: {
        title: 'Any quote',
        body: (
          <p>
            <Code>q</Code> stands for whichever quote is closest, so <Code>csq"</Code> works on single quotes and
            backticks alike.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        base: { name: 'app.ts', plugins: ['surround'] },
        rounds: [
          {
            prompt: 'Switch "express" to double quotes.',
            setup: {
              text: ["import express from 'express';", "import cors from 'cors';", '', 'const app = express();'],
              cursor: { line: 0, col: 22 },
            },
            goal: { text: ['import express from "express";', "import cors from 'cors';", '', 'const app = express();'] },
            solution: `cs'"`,
          },
          {
            prompt: 'Make the URL a template string.',
            setup: {
              text: ['async function load(id: string) {', '  const url = "/api/users/${id}";', '  return fetch(url);', '}'],
              cursor: { line: 1, col: 16 },
            },
            goal: { text: ['async function load(id: string) {', '  const url = `/api/users/${id}`;', '  return fetch(url);', '}'] },
            solution: 'cs"`',
          },
          {
            prompt: 'Turn the tuple into an array.',
            setup: { text: ['const x = 4, y = 2;', 'const point = (x, y);', 'draw(...point);'], cursor: { line: 1, col: 15 } },
            goal: { text: ['const x = 4, y = 2;', 'const point = [x, y];', 'draw(...point);'] },
            solution: 'cs)]',
          },
          {
            prompt: 'Drop the spaces inside the parentheses.',
            setup: { text: ['function start() {', '  if ( ready ) run();', '  else queue.push(run);', '}'], cursor: { line: 1, col: 9 } },
            goal: { text: ['function start() {', '  if (ready) run();', '  else queue.push(run);', '}'] },
            solution: 'cs()',
          },
          {
            prompt: 'Swap the brackets for braces, spaced.',
            setup: {
              name: 'treesitter.lua',
              text: ["require('nvim-treesitter.configs').setup({", "  ensure_installed = [ 'lua', 'rust' ],", '  highlight = { enable = true },', '})'],
              cursor: { line: 1, col: 25 },
            },
            goal: { text: ["require('nvim-treesitter.configs').setup({", "  ensure_installed = { 'lua', 'rust' },", '  highlight = { enable = true },', '})'] },
            solution: 'cs[{',
          },
        ],
      },
    },
    {
      id: 'delete-surroundings',
      title: 'Delete Surroundings',
      chips: ['ds'],
      keyCards: [{ key: 'ds', glyph: '(x)→x', label: 'delete a pair', sub: 'ds{char}' }],
      intro: (
        <>
          <p>
            <Code>ds</Code> removes the pair around the cursor and keeps what's inside: <Code>ds"</Code> strips the
            quotes, <Code>ds)</Code> the parentheses.
          </p>
          <p>
            <Code>ds(</Code> also removes the spaces just inside the brackets, so <Mono>( a )</Mono> becomes{' '}
            <Mono>a</Mono>. <Code>dst</Code> deletes the nearest HTML tag pair and <Code>dsf</Code> unwraps a function
            call.
          </p>
          <Edits
            plugins={['surround']}
            rows={[
              { keys: 'ds"', text: 'port = "8080"', cursor: 9 },
              { keys: 'ds(', text: 'return ( a + b )', cursor: 11 },
              { keys: 'dst', text: '<b>Note:</b> hi', cursor: 4 },
              { keys: 'dsf', text: 'id = String(n)', cursor: 12 },
            ]}
          />
        </>
      ),
      practice: total => (
        <p>
          Remove the pair with <Code>ds</Code>. {total} rounds.
        </p>
      ),
      aside: {
        title: 'Nested pairs',
        body: (
          <p>
            <Code>ds</Code> works on the innermost pair of that kind around the cursor. In{' '}
            <Mono>log((total))</Mono> with the cursor on <Mono>total</Mono>, <Code>ds)</Code> removes the inner
            parentheses and leaves the call alone.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        base: { name: 'server.ts', plugins: ['surround'] },
        rounds: [
          {
            prompt: 'Remove the extra parentheses.',
            setup: { text: ['const total = items.reduce(sum, 0);', 'console.log((total));', 'process.exit(0);'], cursor: { line: 1, col: 14 } },
            goal: { text: ['const total = items.reduce(sum, 0);', 'console.log(total);', 'process.exit(0);'] },
            solution: 'ds)',
          },
          {
            prompt: 'Make the port a number.',
            setup: {
              text: ["import { createServer } from 'node:http';", '', 'const port = "8080";', 'createServer(handler).listen(port);'],
              cursor: { line: 2, col: 15 },
            },
            goal: { text: ["import { createServer } from 'node:http';", '', 'const port = 8080;', 'createServer(handler).listen(port);'] },
            solution: 'ds"',
          },
          {
            prompt: 'Unwrap the expression, spaces too.',
            setup: { text: ['function add(a: number, b: number) {', '  return ( a + b );', '}'], cursor: { line: 1, col: 11 } },
            goal: { text: ['function add(a: number, b: number) {', '  return a + b;', '}'] },
            solution: 'ds(',
          },
          {
            prompt: 'Drop the emphasis.',
            setup: {
              name: 'NOTES.md',
              text: ['## CI', '', 'This step is _really_ slow on CI.', 'Caching the install speeds it up.'],
              cursor: { line: 2, col: 16 },
            },
            goal: { text: ['## CI', '', 'This step is really slow on CI.', 'Caching the install speeds it up.'] },
            solution: 'ds_',
          },
          {
            prompt: 'Remove the <strong> tag.',
            setup: {
              name: 'Hint.tsx',
              text: ['export function Hint() {', '  return (', '    <p><strong>Note:</strong> the cache is per user.</p>', '  );', '}'],
              cursor: { line: 2, col: 16 },
            },
            goal: { text: ['export function Hint() {', '  return (', '    <p>Note: the cache is per user.</p>', '  );', '}'] },
            solution: 'dst',
          },
          {
            prompt: 'Unwrap the call to String().',
            setup: { text: ['function key(user: User) {', '  const id = String(user.id);', '  return `user:${id}`;', '}'], cursor: { line: 1, col: 20 } },
            goal: { text: ['function key(user: User) {', '  const id = user.id;', '  return `user:${id}`;', '}'] },
            solution: 'dsf',
          },
        ],
      },
    },
    {
      id: 'surround-a-line',
      title: 'Surround a Line',
      chips: ['yss'],
      keyCards: [{ key: 'yss', glyph: '(——)', label: 'wrap the line', sub: 'yss{char}' }],
      intro: (
        <>
          <p>
            Like <Code>dd</Code> and <Code>yy</Code>, doubling the operator acts on the whole line:{' '}
            <Code>yss)</Code> wraps the current line in parentheses.
          </p>
          <p>
            Leading indentation and trailing spaces stay outside the pair, so <Code>yss</Code> is safe on indented
            code. The cursor can be anywhere on the line.
          </p>
        </>
      ),
      practice: total => (
        <p>
          Wrap each line with <Code>yss</Code>. {total} rounds.
        </p>
      ),
      aside: {
        title: 'On their own lines',
        body: (
          <p>
            <Code>ySS</Code> puts the pair on separate lines and indents the text between them.{' '}
            <Code>yS</Code> does the same with a motion.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        base: { name: 'CHANGELOG.md', plugins: ['surround'] },
        rounds: [
          {
            prompt: 'Italicise the whole line with underscores.',
            setup: { text: ['## 3.0.0', '', 'This release drops support for Node 16.', 'Upgrade to Node 20 first.'], cursor: { line: 2, col: 13 } },
            goal: { text: ['## 3.0.0', '', '_This release drops support for Node 16._', 'Upgrade to Node 20 first.'] },
            solution: 'yss_',
          },
          {
            prompt: 'Mark the command as code.',
            setup: { text: ['Then run:', '', 'npm run migrate', '', 'and restart the server.'], cursor: { line: 2, col: 4 } },
            goal: { text: ['Then run:', '', '`npm run migrate`', '', 'and restart the server.'] },
            solution: 'yss`',
          },
          {
            prompt: 'Make the override an object.',
            setup: {
              name: '.prettierrc.json',
              text: ['{', '  "overrides": [', '    "files": "*.md", "options": {}', '  ]', '}'],
              cursor: { line: 2, col: 10 },
            },
            goal: { text: ['{', '  "overrides": [', '    { "files": "*.md", "options": {} }', '  ]', '}'] },
            solution: 'yss{',
          },
          {
            prompt: 'Wrap the plugin in a spec table.',
            setup: { name: 'plugins.lua', text: ['return {', "  'folke/flash.nvim'", '}'], cursor: { line: 0, col: 0 } },
            goal: { text: ['return {', "  { 'folke/flash.nvim' }", '}'] },
            solution: 'jyss{',
          },
          {
            prompt: 'Bold the warning: ** means yss* twice.',
            setup: { text: ['## 2.0.0', '', 'Breaking: config moved to init.lua.'], cursor: { line: 2, col: 0 } },
            goal: { text: ['## 2.0.0', '', '**Breaking: config moved to init.lua.**'] },
            solution: 'yss*.',
          },
        ],
      },
    },
    {
      id: 'surround-a-selection',
      title: 'Surround a Selection',
      chips: ['v', 'S'],
      keyCards: [
        { key: 'v', glyph: '▮▮', label: 'select' },
        { key: 'S', glyph: '(▮▮)', label: 'wrap selection', sub: 'S{char}' },
      ],
      intro: (
        <>
          <p>
            In visual mode, <Code>S</Code> followed by a character wraps the selection. Use it when the text is easier
            to select than to describe with one motion.
          </p>
          <p>
            With a linewise selection (<Code>V</Code>), the pair goes on lines of its own above and below, and the
            lines between are indented.
          </p>
          <Edits
            plugins={['surround']}
            name="diagram.json"
            rows={[
              { keys: 'veeS]', label: 'vee S]', text: 'Read the docs now', cursor: 5 },
              { keys: 'VjS}', label: 'Vj S}', text: ['"semi": false,', '"tabs": true'], cursor: [0, 0] },
            ]}
          />
        </>
      ),
      practice: total => (
        <p>
          Select the text, then press <Code>S</Code> and the character. {total} rounds.
        </p>
      ),
      aside: {
        title: 'S in normal mode',
        body: (
          <p>
            Only visual <Code>S</Code> changes. In normal mode <Code>S</Code> still clears the line and starts insert
            mode, like <Code>cc</Code>.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        base: { name: 'types.ts', plugins: ['surround'] },
        rounds: [
          {
            prompt: 'Group the sum before dividing.',
            setup: { text: ['function bisect(lo: number, hi: number) {', '  const mid = lo + hi / 2;', '  return Math.floor(mid);', '}'], cursor: { line: 1, col: 14 } },
            goal: { text: ['function bisect(lo: number, hi: number) {', '  const mid = (lo + hi) / 2;', '  return Math.floor(mid);', '}'] },
            solution: 'v3eS)',
          },
          {
            prompt: 'An array of string or null: wrap the union.',
            setup: { text: ['type Row = { id: number };', 'let names: string | null[];', 'let rows: Row[] = [];'], cursor: { line: 1, col: 11 } },
            goal: { text: ['type Row = { id: number };', 'let names: (string | null)[];', 'let rows: Row[] = [];'] },
            solution: 'vt[S)',
          },
          {
            prompt: 'Turn "migration guide" into link text.',
            setup: { name: 'README.md', text: ['# Upgrading', '', 'Read the migration guide first.', 'Then bump the version.'], cursor: { line: 2, col: 9 } },
            goal: { text: ['# Upgrading', '', 'Read the [migration guide] first.', 'Then bump the version.'] },
            solution: 'veeS]',
          },
          {
            prompt: 'Wrap all three settings in an object.',
            setup: { name: '.prettierrc.json', text: ['"semi": false,', '"singleQuote": true,', '"printWidth": 60'], cursor: { line: 0, col: 0 } },
            goal: { text: ['{', '  "semi": false,', '  "singleQuote": true,', '  "printWidth": 60', '}'] },
            solution: 'VGS}',
          },
          {
            prompt: 'Quote the whole path.',
            setup: { name: 'deploy.sh', text: ['#!/bin/sh', 'npm run build', 'cp dist/app.js $HOME/My Apps/', 'echo done'], cursor: { line: 2, col: 15 } },
            goal: { text: ['#!/bin/sh', 'npm run build', 'cp dist/app.js "$HOME/My Apps/"', 'echo done'] },
            solution: 'vg_S"',
          },
        ],
      },
    },
    {
      id: 'surround-with-tags',
      title: 'Surround with Tags',
      chips: ['cst', 'yst'],
      keyCards: [
        { key: 'cst', glyph: '<b>→<i>', label: 'change a tag', sub: 'type the name, then Enter' },
        { key: 'ys…t', glyph: 'x→<b>x', label: 'add a tag' },
      ],
      intro: (
        <>
          <p>
            <Code>t</Code> means an HTML or JSX tag. <Code>cst</Code> asks for a new tag name: type it and press{' '}
            <Code>Enter</Code>. The attributes stay, so <Mono>{'<div class="card">'}</Mono> can become{' '}
            <Mono>{'<section class="card">'}</Mono>.
          </p>
          <p>
            To add a tag, use <Code>t</Code> as the character after <Code>ys</Code>, <Code>yss</Code> or visual{' '}
            <Code>S</Code>. You can type attributes too: <Mono>a href="/"</Mono>.
          </p>
          <Edits
            plugins={['surround']}
            name="diagram.tsx"
            rows={[
              { keys: 'csth3<CR>', label: 'cst‹h3›⏎', text: '<h2>Settings</h2>', cursor: 6 },
              { keys: 'ysiwtem<CR>', label: 'ysiwt‹em›⏎', text: 'never expire', cursor: 2 },
            ]}
          />
        </>
      ),
      practice: total => (
        <p>
          Change or add tags. Finish each name with <Code>Enter</Code>. {total} rounds.
        </p>
      ),
      aside: {
        title: 't and T',
        body: (
          <p>
            <Code>csT</Code> replaces the whole opening tag, attributes included. In vim-surround you type the tag
            itself instead: <Code>{'cst<em>'}</Code>, which nvim-surround also accepts.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        base: { name: 'Card.tsx', plugins: ['surround'] },
        rounds: [
          {
            prompt: 'Use <strong> instead of <b>.',
            setup: { text: ['<div className="alert">', '  <b>Warning:</b> this cannot be undone.', '</div>'], cursor: { line: 1, col: 6 } },
            goal: { text: ['<div className="alert">', '  <strong>Warning:</strong> this cannot be undone.', '</div>'] },
            solution: 'cststrong<CR>',
          },
          {
            prompt: 'Make the card a <section>, keeping its class.',
            setup: { text: ['<div className="card">', '  <h2>{title}</h2>', '</div>'], cursor: { line: 1, col: 6 } },
            goal: { text: ['<section className="card">', '  <h2>{title}</h2>', '</section>'] },
            solution: 'jcstsection<CR>',
          },
          {
            prompt: 'Demote the heading to <h3>.',
            setup: { text: ['<section>', '  <h2>Settings</h2>', '  <Toggle label="Dark mode" />', '</section>'], cursor: { line: 1, col: 8 } },
            goal: { text: ['<section>', '  <h3>Settings</h3>', '  <Toggle label="Dark mode" />', '</section>'] },
            solution: 'csth3<CR>',
          },
          {
            prompt: 'Make the item a list entry.',
            setup: { text: ['<ul>', '  <li>Eggs</li>', '  Buy milk', '</ul>'], cursor: { line: 0, col: 0 } },
            goal: { text: ['<ul>', '  <li>Eggs</li>', '  <li>Buy milk</li>', '</ul>'] },
            solution: '2jysstli<CR>',
          },
          {
            prompt: 'Emphasise "never".',
            setup: { text: ['<Card title="Tokens">', '  <p>Tokens never expire.</p>', '</Card>'], cursor: { line: 1, col: 13 } },
            goal: { text: ['<Card title="Tokens">', '  <p>Tokens <em>never</em> expire.</p>', '</Card>'] },
            solution: 'ysiwtem<CR>',
          },
          {
            prompt: 'Replace the whole <span> with a link to /docs.',
            setup: { text: ['<footer>', '  <span class="muted">Read the docs</span>', '</footer>'], cursor: { line: 1, col: 24 } },
            goal: { text: ['<footer>', '  <a href="/docs">Read the docs</a>', '</footer>'] },
            solution: 'csTa href="/docs"<CR>',
          },
        ],
      },
    },
  ],
};
