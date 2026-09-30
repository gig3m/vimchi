import { Code, Mono } from '../../components/Code';
import { Edits } from '../../components/pluginDiagrams';
import type { Section } from '../types';

export const surround: Section = {
  id: 'surround',
  title: 'Surround',
  band: 'code',
  lessons: [
    {
      id: 'add-surroundings',
      title: 'Add Surroundings',
      chips: ['sa'],
      keyCards: [{ key: 'sa', glyph: 'x→(x)', label: 'add a pair', sub: 'sa{motion}{char}' }],
      intro: (
        <>
          <p>
            mini.surround (kickstart ships it) adds <Code>sa</Code>, an operator that wraps text in a pair. Give
            it a motion or text object, then the character to wrap with: <Code>saiw"</Code> puts quotes around
            the word under the cursor, <Code>sa$)</Code> wraps everything to the end of the line in parentheses.
          </p>
          <p>
            Opening brackets add a space inside, closing brackets don't: <Code>saiw(</Code> gives{' '}
            <Mono>( word )</Mono>, <Code>saiw)</Code> gives <Mono>(word)</Mono>. Any other character is used on both
            sides.
          </p>
          <Edits
            plugins={['surround']}
            rows={[
              { keys: 'saiw"', text: 'mode = prod', cursor: 8 },
              { keys: 'saiw(', text: 'return total', cursor: 9 },
              { keys: 'saiw)', text: 'return total', cursor: 9 },
              { keys: 'sa$]', text: 'ports = 80, 443', cursor: 8 },
            ]}
          />
        </>
      ),
      practice: total => (
        <p>
          Wrap the text with <Code>sa</Code>, a motion and the character. {total} rounds.
        </p>
      ),
      aside: {
        title: 'Two starters, one plugin',
        body: (
          <p>
            kickstart enables mini.surround as it comes: <Code>sa</Code>, <Code>sr</Code>, <Code>sd</Code>. LazyVim's
            mini.surround extra maps the same actions to <Code>gsa</Code>, <Code>gsr</Code>, <Code>gsd</Code> so that{' '}
            <Code>s</Code> stays free for flash. The older lineage, tpope's vim-surround and nvim-surround, spells
            them <Code>ys</Code>, <Code>cs</Code>, <Code>ds</Code>. Shortcuts here: <Code>b</Code> is <Mono>)</Mono>,{' '}
            <Code>B</Code> is <Mono>{'}'}</Mono>, <Code>r</Code> is <Mono>]</Mono>.
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
            solution: 'saiw"',
          },
          {
            prompt: 'Put "width * height" in parentheses.',
            setup: {
              text: ['function area(width: number, height: number) {', '  const half = width * height / 2;', '  return Math.round(half);', '}'],
              cursor: { line: 1, col: 15 },
            },
            goal: { text: ['function area(width: number, height: number) {', '  const half = (width * height) / 2;', '  return Math.round(half);', '}'] },
            solution: 'sa3e)',
          },
          {
            prompt: 'Make the list of ports an array.',
            setup: { text: ["const host = 'localhost';", 'const ports = 3000, 3001, 3002;', 'server.listen(host, ports);'], cursor: { line: 1, col: 14 } },
            goal: { text: ["const host = 'localhost';", 'const ports = [3000, 3001, 3002];', 'server.listen(host, ports);'] },
            solution: 'sat;]',
          },
          {
            prompt: 'Wrap "silent = true" in a table, with spaces inside.',
            setup: {
              name: 'init.lua',
              text: ['local map = vim.keymap.set', "map('n', '<leader>w', ':w<CR>', silent = true)", "map('n', '<leader>q', ':q<CR>')"],
              cursor: { line: 1, col: 32 },
            },
            goal: { text: ['local map = vim.keymap.set', "map('n', '<leader>w', ':w<CR>', { silent = true })", "map('n', '<leader>q', ':q<CR>')"] },
            solution: 'sat){',
          },
          {
            prompt: 'Mark "npm install" as code.',
            setup: {
              name: 'README.md',
              text: ['## Setup', '', 'Run npm install before the first build.', 'Then copy .env.example to .env.'],
              cursor: { line: 2, col: 0 },
            },
            goal: { text: ['## Setup', '', 'Run `npm install` before the first build.', 'Then copy .env.example to .env.'] },
            solution: 'wsa2e`',
          },
        ],
      },
    },
    {
      id: 'change-surroundings',
      title: 'Change Surroundings',
      chips: ['sr'],
      keyCards: [{ key: 'sr', glyph: "'→\"", label: 'replace a pair', sub: 'sr{old}{new}' }],
      intro: (
        <>
          <p>
            <Code>sr</Code> swaps one pair for another. Name the pair around the cursor, then the new one:{' '}
            <Code>sr'"</Code> turns <Mono>'text'</Mono> into <Mono>"text"</Mono>.
          </p>
          <p>
            The cursor only has to be inside the pair. If it isn't inside one, nvim-surround uses the next pair on the
            line. The same spacing rule applies: <Code>sr)(</Code> adds spaces inside, <Code>sr()</Code> removes them.
          </p>
          <Edits
            plugins={['surround']}
            rows={[
              { keys: `sr'"`, text: "from 'express'", cursor: 8 },
              { keys: 'sr)]', text: 'point = (x, y)', cursor: 9 },
              { keys: 'sr)(', text: 'if (ready)', cursor: 5 },
            ]}
          />
        </>
      ),
      practice: total => (
        <p>
          Change each pair with <Code>sr</Code>. {total} rounds.
        </p>
      ),
      aside: {
        title: 'Any quote',
        body: (
          <p>
            <Code>q</Code> stands for whichever quote is closest, so <Code>srq"</Code> works on single quotes and
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
            solution: `sr'"`,
          },
          {
            prompt: 'Make the URL a template string.',
            setup: {
              text: ['async function load(id: string) {', '  const url = "/api/users/${id}";', '  return fetch(url);', '}'],
              cursor: { line: 1, col: 16 },
            },
            goal: { text: ['async function load(id: string) {', '  const url = `/api/users/${id}`;', '  return fetch(url);', '}'] },
            solution: 'sr"`',
          },
          {
            prompt: 'Turn the tuple into an array.',
            setup: { text: ['const x = 4, y = 2;', 'const point = (x, y);', 'draw(...point);'], cursor: { line: 1, col: 15 } },
            goal: { text: ['const x = 4, y = 2;', 'const point = [x, y];', 'draw(...point);'] },
            solution: 'sr)]',
          },
          {
            prompt: 'Drop the spaces inside the parentheses.',
            setup: { text: ['function start() {', '  if ( ready ) run();', '  else queue.push(run);', '}'], cursor: { line: 1, col: 9 } },
            goal: { text: ['function start() {', '  if (ready) run();', '  else queue.push(run);', '}'] },
            solution: 'sr()',
          },
          {
            prompt: 'Swap the brackets for braces, spaced.',
            setup: {
              name: 'treesitter.lua',
              text: ["require('nvim-treesitter.configs').setup({", "  ensure_installed = [ 'lua', 'rust' ],", '  highlight = { enable = true },', '})'],
              cursor: { line: 1, col: 25 },
            },
            goal: { text: ["require('nvim-treesitter.configs').setup({", "  ensure_installed = { 'lua', 'rust' },", '  highlight = { enable = true },', '})'] },
            solution: 'sr[{',
          },
        ],
      },
    },
    {
      id: 'delete-surroundings',
      title: 'Delete Surroundings',
      chips: ['sd'],
      keyCards: [{ key: 'sd', glyph: '(x)→x', label: 'delete a pair', sub: 'sd{char}' }],
      intro: (
        <>
          <p>
            <Code>sd</Code> removes the pair around the cursor and keeps what's inside: <Code>sd"</Code> strips the
            quotes, <Code>sd)</Code> the parentheses.
          </p>
          <p>
            <Code>sd(</Code> also removes the spaces just inside the brackets, so <Mono>( a )</Mono> becomes{' '}
            <Mono>a</Mono>. <Code>sdt</Code> deletes the nearest HTML tag pair and <Code>sdf</Code> unwraps a function
            call.
          </p>
          <Edits
            plugins={['surround']}
            rows={[
              { keys: 'sd"', text: 'port = "8080"', cursor: 9 },
              { keys: 'sd(', text: 'return ( a + b )', cursor: 11 },
              { keys: 'sdt', text: '<b>Note:</b> hi', cursor: 4 },
              { keys: 'sdf', text: 'id = String(n)', cursor: 12 },
            ]}
          />
        </>
      ),
      practice: total => (
        <p>
          Remove the pair with <Code>sd</Code>. {total} rounds.
        </p>
      ),
      aside: {
        title: 'Nested pairs',
        body: (
          <p>
            <Code>sd</Code> works on the innermost pair of that kind around the cursor. In{' '}
            <Mono>log((total))</Mono> with the cursor on <Mono>total</Mono>, <Code>sd)</Code> removes the inner
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
            solution: 'sd)',
          },
          {
            prompt: 'Make the port a number.',
            setup: {
              text: ["import { createServer } from 'node:http';", '', 'const port = "8080";', 'createServer(handler).listen(port);'],
              cursor: { line: 2, col: 15 },
            },
            goal: { text: ["import { createServer } from 'node:http';", '', 'const port = 8080;', 'createServer(handler).listen(port);'] },
            solution: 'sd"',
          },
          {
            prompt: 'Unwrap the expression, spaces too.',
            setup: { text: ['function add(a: number, b: number) {', '  return ( a + b );', '}'], cursor: { line: 1, col: 11 } },
            goal: { text: ['function add(a: number, b: number) {', '  return a + b;', '}'] },
            solution: 'sd(',
          },
          {
            prompt: 'Drop the emphasis.',
            setup: {
              name: 'NOTES.md',
              text: ['## CI', '', 'This step is _really_ slow on CI.', 'Caching the install speeds it up.'],
              cursor: { line: 2, col: 16 },
            },
            goal: { text: ['## CI', '', 'This step is really slow on CI.', 'Caching the install speeds it up.'] },
            solution: 'sd_',
          },
          {
            prompt: 'Remove the <strong> tag.',
            setup: {
              name: 'Hint.tsx',
              text: ['export function Hint() {', '  return (', '    <p><strong>Note:</strong> the cache is per user.</p>', '  );', '}'],
              cursor: { line: 2, col: 16 },
            },
            goal: { text: ['export function Hint() {', '  return (', '    <p>Note: the cache is per user.</p>', '  );', '}'] },
            solution: 'sdt',
          },
          {
            prompt: 'Unwrap the call to String().',
            setup: { text: ['function key(user: User) {', '  const id = String(user.id);', '  return `user:${id}`;', '}'], cursor: { line: 1, col: 20 } },
            goal: { text: ['function key(user: User) {', '  const id = user.id;', '  return `user:${id}`;', '}'] },
            solution: 'sdf',
          },
        ],
      },
    },
    {
      id: 'find-surroundings',
      title: 'Find a Surrounding',
      chips: ['sf', 'sF'],
      keyCards: [
        { key: 'sf', glyph: '→)', label: 'jump to the closing side', sub: 'sf{char}' },
        { key: 'sF', glyph: '(←', label: 'jump to the opening side', sub: 'sF{char}' },
      ],
      intro: (
        <>
          <p>
            <Code>sf</Code> and <Code>sF</Code> move the cursor to the pair itself: <Code>sf)</Code> jumps to the
            closing parenthesis around the cursor, <Code>sF)</Code> to the opening one. They use the same search as{' '}
            <Code>sd</Code> and <Code>sr</Code>, so when the cursor is not inside a pair they find the next one on the
            line.
          </p>
          <p>
            That makes them a way to move by structure: <Code>sf"</Code> lands on the end of a string,{' '}
            <Code>sFt</Code> on the opening tag, from anywhere inside.
          </p>
        </>
      ),
      practice: total => (
        <p>
          Jump to the side of the pair the prompt names. {total} rounds.
        </p>
      ),
      aside: {
        title: 'The whole family',
        body: (
          <p>
            mini.surround also has <Code>sh</Code>, which highlights a pair for a moment, and <Code>sn</Code>, which
            sets how many lines it searches. LazyVim's extra prefixes them all with <Code>g</Code>.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        base: { name: 'checkout.ts', plugins: ['surround'] },
        rounds: [
          {
            prompt: 'Jump to the closing parenthesis of the call.',
            setup: {
              text: ['const total = round(sum(subtotal,', '  shipping, handling, duty,', '  fees + tips) * rate);', 'send(total);'],
              cursor: { line: 1, col: 24 },
            },
            goal: { cursor: { line: 2, col: 13 } },
            solution: 'sf)',
          },
          {
            prompt: 'Jump to the opening parenthesis of the inner call.',
            setup: {
              text: ['const total = sum(prices, taxFor(region,', '  zone, rate, discount,', '  tier), fees);'],
              cursor: { line: 1, col: 8 },
            },
            goal: { cursor: { line: 0, col: 32 } },
            solution: 'sF)',
          },
          {
            prompt: 'Jump to the closing tag of the paragraph.',
            setup: {
              name: 'note.html',
              text: ['<p class="note">Thanks for your order.', '  It ships today, and the tracking', '  link follows.</p> <a href="/track">Track</a>', '<hr>'],
              cursor: { line: 0, col: 26 },
            },
            goal: { cursor: { line: 2, col: 15 } },
            solution: 'sft',
          },
          {
            prompt: 'Jump to the opening brace of the object.',
            setup: {
              text: ["const opts = { name: 'api',", "  retries: 3, backoff: 'exp',", '  timeout: 500,', '};', 'export default opts;'],
              cursor: { line: 1, col: 24 },
            },
            goal: { cursor: { line: 0, col: 13 } },
            solution: 'sF{',
          },
          {
            prompt: 'Jump to the closing bracket.',
            setup: {
              text: ['const ports = new Set([80, 443,', '  8080, 9000]); // http and https', 'listen(ports);'],
              cursor: { line: 0, col: 27 },
            },
            goal: { cursor: { line: 1, col: 12 } },
            solution: 'sf]',
          },
        ],
      },
    },
    {
      id: 'surround-a-selection',
      title: 'Surround a Selection',
      chips: ['v', 'sa'],
      keyCards: [
        { key: 'v', glyph: '▮▮', label: 'select' },
        { key: 'sa', glyph: '(▮▮)', label: 'wrap selection', sub: 'sa{char}' },
      ],
      intro: (
        <>
          <p>
            In visual mode, <Code>sa</Code> followed by a character wraps the selection. Use it when the text is easier
            to select than to describe with one motion.
          </p>
          <p>
            A linewise selection (<Code>V</Code>) is wrapped as characters: the pair lands at the start of the first
            line and the end of the last. For a pair on lines of its own, select and wrap, then break the lines.
          </p>
          <Edits
            plugins={['surround']}
            name="diagram.json"
            rows={[
              { keys: 'veesa]', label: 'vee sa]', text: 'Read the docs now', cursor: 5 },
              { keys: 'Vjsa}', label: 'Vj sa}', text: ['"semi": false,', '"tabs": true'], cursor: [0, 0] },
            ]}
          />
        </>
      ),
      practice: total => (
        <p>
          Select the text, then press <Code>sa</Code> and the character. {total} rounds.
        </p>
      ),
      aside: {
        title: 'Why sa and not S',
        body: (
          <p>
            nvim-surround uses <Code>S</Code> here, but in a LazyVim setup <Code>S</Code> is flash's treesitter
            jump. mini.surround keeps its own prefix in every mode, so the key you press in normal mode is the key
            you press on a selection.
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
            solution: 'v3esa)',
          },
          {
            prompt: 'An array of string or null: wrap the union.',
            setup: { text: ['type Row = { id: number };', 'let names: string | null[];', 'let rows: Row[] = [];'], cursor: { line: 1, col: 11 } },
            goal: { text: ['type Row = { id: number };', 'let names: (string | null)[];', 'let rows: Row[] = [];'] },
            solution: 'vt[sa)',
          },
          {
            prompt: 'Turn "migration guide" into link text.',
            setup: { name: 'README.md', text: ['# Upgrading', '', 'Read the migration guide first.', 'Then bump the version.'], cursor: { line: 2, col: 9 } },
            goal: { text: ['# Upgrading', '', 'Read the [migration guide] first.', 'Then bump the version.'] },
            solution: 'veesa]',
          },
          {
            prompt: 'Wrap all three settings in braces.',
            setup: { name: '.prettierrc.json', text: ['"semi": false,', '"singleQuote": true,', '"printWidth": 60'], cursor: { line: 0, col: 0 } },
            goal: { text: ['{"semi": false,', '"singleQuote": true,', '"printWidth": 60}'] },
            solution: 'VGsa}',
          },
          {
            prompt: 'Quote the whole path.',
            setup: { name: 'deploy.sh', text: ['#!/bin/sh', 'npm run build', 'cp dist/app.js $HOME/My Apps/', 'echo done'], cursor: { line: 2, col: 15 } },
            goal: { text: ['#!/bin/sh', 'npm run build', 'cp dist/app.js "$HOME/My Apps/"', 'echo done'] },
            solution: 'vg_sa"',
          },
        ],
      },
    },
    {
      id: 'surround-with-tags',
      title: 'Surround with Tags',
      chips: ['srtt', 'sat'],
      keyCards: [
        { key: 'srtt', glyph: '<b>→<i>', label: 'tag → tag', sub: 'type the name, then Enter' },
        { key: 'sa…t', glyph: 'x→<b>x', label: 'add a tag' },
      ],
      intro: (
        <>
          <p>
            <Code>t</Code> means an HTML or JSX tag. <Code>sr</Code> takes the old pair and then the new one, so a
            tag swap is <Code>srtt</Code>: replace a tag with a tag. It asks for the new name: type it and press{' '}
            <Code>Enter</Code>. The whole opening tag is replaced, attributes included, so type them again if you want
            them kept.
          </p>
          <p>
            To add a tag, use <Code>t</Code> as the character after <Code>sa</Code>, in normal or visual mode. You can type attributes too: <Mono>a href="/"</Mono>.
          </p>
          <Edits
            plugins={['surround']}
            name="diagram.tsx"
            rows={[
              { keys: 'srtth3<CR>', label: 'srtt‹h3›⏎', text: '<h2>Settings</h2>', cursor: 6 },
              { keys: 'saiwtem<CR>', label: 'saiwt‹em›⏎', text: 'never expire', cursor: 2 },
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
        title: 'Attributes',
        body: (
          <p>
            <Code>sat</Code> and <Code>srtt</Code> both accept attributes in the name: <Mono>a href="/"</Mono> gives{' '}
            <Mono>{'<a href="/">…</a>'}</Mono>. nvim-surround differs here: its <Code>cst</Code> keeps the old
            attributes and you type the tag itself, <Code>{'cst<em>'}</Code>.
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
            solution: 'srttstrong<CR>',
          },
          {
            prompt: 'Make the card a <section> with the same className.',
            setup: { text: ['<div className="card">', '  <h2>{title}</h2>', '</div>'], cursor: { line: 1, col: 6 } },
            goal: { text: ['<section className="card">', '  <h2>{title}</h2>', '</section>'] },
            solution: 'jsrttsection className="card"<CR>',
          },
          {
            prompt: 'Demote the heading to <h3>.',
            setup: { text: ['<section>', '  <h2>Settings</h2>', '  <Toggle label="Dark mode" />', '</section>'], cursor: { line: 1, col: 8 } },
            goal: { text: ['<section>', '  <h3>Settings</h3>', '  <Toggle label="Dark mode" />', '</section>'] },
            solution: 'srtth3<CR>',
          },
          {
            prompt: 'Make the item a list entry.',
            setup: { text: ['<ul>', '  <li>Eggs</li>', '  Buy milk', '</ul>'], cursor: { line: 0, col: 0 } },
            goal: { text: ['<ul>', '  <li>Eggs</li>', '  <li>Buy milk</li>', '</ul>'] },
            solution: '2j^sa$tli<CR>',
          },
          {
            prompt: 'Emphasise "never".',
            setup: { text: ['<Card title="Tokens">', '  <p>Tokens never expire.</p>', '</Card>'], cursor: { line: 1, col: 13 } },
            goal: { text: ['<Card title="Tokens">', '  <p>Tokens <em>never</em> expire.</p>', '</Card>'] },
            solution: 'saiwtem<CR>',
          },
          {
            prompt: 'Replace the whole <span> with a link to /docs.',
            setup: { text: ['<footer>', '  <span class="muted">Read the docs</span>', '</footer>'], cursor: { line: 1, col: 24 } },
            goal: { text: ['<footer>', '  <a href="/docs">Read the docs</a>', '</footer>'] },
            solution: 'srtta href="/docs"<CR>',
          },
        ],
      },
    },
  ],
};
