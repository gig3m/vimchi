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
      chips: ['gsa'],
      keyCards: [{ key: 'gsa', glyph: 'x→(x)', label: 'add a pair', sub: 'gsa{motion}{char}' }],
      intro: (
        <>
          <p>
            mini.surround adds <Code>gsa</Code> (LazyVim's key), an operator that wraps text in a pair. Give
            it a motion or text object, then the character to wrap with: <Code>gsaiw"</Code> puts quotes around
            the word under the cursor, <Code>gsa$)</Code> wraps everything to the end of the line in parentheses.
          </p>
          <p>
            Opening brackets add a space inside, closing brackets don't: <Code>gsaiw(</Code> gives{' '}
            <Mono>( word )</Mono>, <Code>gsaiw)</Code> gives <Mono>(word)</Mono>. Any other character is used on both
            sides.
          </p>
          <Edits
            plugins={['surround']}
            rows={[
              { keys: 'gsaiw"', text: 'mode = prod', cursor: 8 },
              { keys: 'gsaiw(', text: 'return total', cursor: 9 },
              { keys: 'gsaiw)', text: 'return total', cursor: 9 },
              { keys: 'gsa$]', text: 'ports = 80, 443', cursor: 8 },
            ]}
          />
        </>
      ),
      practice: total => (
        <p>
          Wrap the text with <Code>gsa</Code>, a motion and the character. {total} rounds.
        </p>
      ),
      aside: {
        title: 'Two starters, one plugin',
        body: (
          <p>
            LazyVim's mini.surround extra maps <Code>gsa</Code>, <Code>gsd</Code>, <Code>gsr</Code>,{' '}
            <Code>gsf</Code> so that <Code>s</Code> stays free for flash, which is on in every lesson here.
            kickstart enables mini.surround as it comes, so there you drop the <Code>g</Code>: <Code>sa</Code>,{' '}
            <Code>sd</Code>, <Code>sr</Code>, <Code>sf</Code>. The older lineage, tpope's vim-surround and
            nvim-surround, spells them <Code>ys</Code>, <Code>cs</Code>, <Code>ds</Code>. Shortcuts here:{' '}
            <Code>b</Code> is <Mono>)</Mono>, <Code>B</Code> is <Mono>{'}'}</Mono>, <Code>r</Code> is <Mono>]</Mono>.
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
            solution: 'gsaiw"',
          },
          {
            prompt: 'Put "width * height" in parentheses.',
            setup: {
              text: ['function area(width: number, height: number) {', '  const half = width * height / 2;', '  return Math.round(half);', '}'],
              cursor: { line: 1, col: 15 },
            },
            goal: { text: ['function area(width: number, height: number) {', '  const half = (width * height) / 2;', '  return Math.round(half);', '}'] },
            solution: 'gsa3e)',
          },
          {
            prompt: 'Make the list of ports an array.',
            setup: { text: ["const host = 'localhost';", 'const ports = 3000, 3001, 3002;', 'server.listen(host, ports);'], cursor: { line: 1, col: 14 } },
            goal: { text: ["const host = 'localhost';", 'const ports = [3000, 3001, 3002];', 'server.listen(host, ports);'] },
            solution: 'gsat;]',
          },
          {
            prompt: 'Wrap "silent = true" in a table, with spaces inside.',
            setup: {
              name: 'init.lua',
              text: ['local map = vim.keymap.set', "map('n', '<leader>w', ':w<CR>', silent = true)", "map('n', '<leader>q', ':q<CR>')"],
              cursor: { line: 1, col: 32 },
            },
            goal: { text: ['local map = vim.keymap.set', "map('n', '<leader>w', ':w<CR>', { silent = true })", "map('n', '<leader>q', ':q<CR>')"] },
            solution: 'gsat){',
          },
          {
            prompt: 'Mark "npm install" as code.',
            setup: {
              name: 'README.md',
              text: ['## Setup', '', 'Run npm install before the first build.', 'Then copy .env.example to .env.'],
              cursor: { line: 2, col: 0 },
            },
            goal: { text: ['## Setup', '', 'Run `npm install` before the first build.', 'Then copy .env.example to .env.'] },
            solution: 'wgsa2e`',
          },
        ],
      },
    },
    {
      id: 'change-surroundings',
      title: 'Change Surroundings',
      chips: ['gsr'],
      keyCards: [{ key: 'gsr', glyph: "'→\"", label: 'replace a pair', sub: 'gsr{old}{new}' }],
      intro: (
        <>
          <p>
            <Code>gsr</Code> swaps one pair for another. Name the pair around the cursor, then the new one:{' '}
            <Code>gsr'"</Code> turns <Mono>'text'</Mono> into <Mono>"text"</Mono>.
          </p>
          <p>
            The cursor only has to be inside the pair. If it isn't inside one, nvim-surround uses the next pair on the
            line. The same spacing rule applies: <Code>gsr)(</Code> adds spaces inside, <Code>gsr()</Code> removes them.
          </p>
          <Edits
            plugins={['surround']}
            rows={[
              { keys: `gsr'"`, text: "from 'express'", cursor: 8 },
              { keys: 'gsr)]', text: 'point = (x, y)', cursor: 9 },
              { keys: 'gsr)(', text: 'if (ready)', cursor: 5 },
            ]}
          />
        </>
      ),
      practice: total => (
        <p>
          Change each pair with <Code>gsr</Code>. {total} rounds.
        </p>
      ),
      aside: {
        title: 'Any quote',
        body: (
          <p>
            <Code>q</Code> stands for whichever quote is closest, so <Code>gsrq"</Code> works on single quotes and
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
            solution: `gsr'"`,
          },
          {
            prompt: 'Make the URL a template string.',
            setup: {
              text: ['async function load(id: string) {', '  const url = "/api/users/${id}";', '  return fetch(url);', '}'],
              cursor: { line: 1, col: 16 },
            },
            goal: { text: ['async function load(id: string) {', '  const url = `/api/users/${id}`;', '  return fetch(url);', '}'] },
            solution: 'gsr"`',
          },
          {
            prompt: 'Turn the tuple into an array.',
            setup: { text: ['const x = 4, y = 2;', 'const point = (x, y);', 'draw(...point);'], cursor: { line: 1, col: 15 } },
            goal: { text: ['const x = 4, y = 2;', 'const point = [x, y];', 'draw(...point);'] },
            solution: 'gsr)]',
          },
          {
            prompt: 'Drop the spaces inside the parentheses.',
            setup: { text: ['function start() {', '  if ( ready ) run();', '  else queue.push(run);', '}'], cursor: { line: 1, col: 9 } },
            goal: { text: ['function start() {', '  if (ready) run();', '  else queue.push(run);', '}'] },
            solution: 'gsr()',
          },
          {
            prompt: 'Swap the brackets for braces, spaced.',
            setup: {
              name: 'treesitter.lua',
              text: ["require('nvim-treesitter.configs').setup({", "  ensure_installed = [ 'lua', 'rust' ],", '  highlight = { enable = true },', '})'],
              cursor: { line: 1, col: 25 },
            },
            goal: { text: ["require('nvim-treesitter.configs').setup({", "  ensure_installed = { 'lua', 'rust' },", '  highlight = { enable = true },', '})'] },
            solution: 'gsr[{',
          },
        ],
      },
    },
    {
      id: 'delete-surroundings',
      title: 'Delete Surroundings',
      chips: ['gsd'],
      keyCards: [{ key: 'gsd', glyph: '(x)→x', label: 'delete a pair', sub: 'gsd{char}' }],
      intro: (
        <>
          <p>
            <Code>gsd</Code> removes the pair around the cursor and keeps what's inside: <Code>gsd"</Code> strips the
            quotes, <Code>gsd)</Code> the parentheses.
          </p>
          <p>
            <Code>gsd(</Code> also removes the spaces just inside the brackets, so <Mono>( a )</Mono> becomes{' '}
            <Mono>a</Mono>. <Code>gsdt</Code> deletes the nearest HTML tag pair and <Code>gsdf</Code> unwraps a function
            call.
          </p>
          <Edits
            plugins={['surround']}
            rows={[
              { keys: 'gsd"', text: 'port = "8080"', cursor: 9 },
              { keys: 'gsd(', text: 'return ( a + b )', cursor: 11 },
              { keys: 'gsdt', text: '<b>Note:</b> hi', cursor: 4 },
              { keys: 'gsdf', text: 'id = String(n)', cursor: 12 },
            ]}
          />
        </>
      ),
      practice: total => (
        <p>
          Remove the pair with <Code>gsd</Code>. {total} rounds.
        </p>
      ),
      aside: {
        title: 'Nested pairs',
        body: (
          <p>
            <Code>gsd</Code> works on the innermost pair of that kind around the cursor. In{' '}
            <Mono>log((total))</Mono> with the cursor on <Mono>total</Mono>, <Code>gsd)</Code> removes the inner
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
            solution: 'gsd)',
          },
          {
            prompt: 'Make the port a number.',
            setup: {
              text: ["import { createServer } from 'node:http';", '', 'const port = "8080";', 'createServer(handler).listen(port);'],
              cursor: { line: 2, col: 15 },
            },
            goal: { text: ["import { createServer } from 'node:http';", '', 'const port = 8080;', 'createServer(handler).listen(port);'] },
            solution: 'gsd"',
          },
          {
            prompt: 'Unwrap the expression, spaces too.',
            setup: { text: ['function add(a: number, b: number) {', '  return ( a + b );', '}'], cursor: { line: 1, col: 11 } },
            goal: { text: ['function add(a: number, b: number) {', '  return a + b;', '}'] },
            solution: 'gsd(',
          },
          {
            prompt: 'Drop the emphasis.',
            setup: {
              name: 'NOTES.md',
              text: ['## CI', '', 'This step is _really_ slow on CI.', 'Caching the install speeds it up.'],
              cursor: { line: 2, col: 16 },
            },
            goal: { text: ['## CI', '', 'This step is really slow on CI.', 'Caching the install speeds it up.'] },
            solution: 'gsd_',
          },
          {
            prompt: 'Remove the <strong> tag.',
            setup: {
              name: 'Hint.tsx',
              text: ['export function Hint() {', '  return (', '    <p><strong>Note:</strong> the cache is per user.</p>', '  );', '}'],
              cursor: { line: 2, col: 16 },
            },
            goal: { text: ['export function Hint() {', '  return (', '    <p>Note: the cache is per user.</p>', '  );', '}'] },
            solution: 'gsdt',
          },
          {
            prompt: 'Unwrap the call to String().',
            setup: { text: ['function key(user: User) {', '  const id = String(user.id);', '  return `user:${id}`;', '}'], cursor: { line: 1, col: 20 } },
            goal: { text: ['function key(user: User) {', '  const id = user.id;', '  return `user:${id}`;', '}'] },
            solution: 'gsdf',
          },
        ],
      },
    },
    {
      id: 'find-surroundings',
      title: 'Find a Surrounding',
      chips: ['gsf', 'gsF'],
      keyCards: [
        { key: 'gsf', glyph: '→)', label: 'jump to the closing side', sub: 'gsf{char}' },
        { key: 'gsF', glyph: '(←', label: 'jump to the opening side', sub: 'gsF{char}' },
      ],
      intro: (
        <>
          <p>
            <Code>gsf</Code> and <Code>gsF</Code> move the cursor to the pair itself: <Code>gsf)</Code> jumps to the
            closing parenthesis around the cursor, <Code>gsF)</Code> to the opening one. They use the same search as{' '}
            <Code>gsd</Code> and <Code>gsr</Code>, so when the cursor is not inside a pair they find the next one on the
            line.
          </p>
          <p>
            That makes them a way to move by structure: <Code>gsf"</Code> lands on the end of a string,{' '}
            <Code>gsFt</Code> on the opening tag, from anywhere inside.
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
            mini.surround also has <Code>gsh</Code>, which highlights a pair for a moment, and <Code>gsn</Code>, which
            sets how many lines it searches. On kickstart the whole family drops the <Code>g</Code>:{' '}
            <Code>sf</Code>, <Code>sF</Code>, <Code>sh</Code>, <Code>sn</Code>.
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
            solution: 'gsf)',
          },
          {
            prompt: 'Jump to the opening parenthesis of the inner call.',
            setup: {
              text: ['const total = sum(prices, taxFor(region,', '  zone, rate, discount,', '  tier), fees);'],
              cursor: { line: 1, col: 8 },
            },
            goal: { cursor: { line: 0, col: 32 } },
            solution: 'gsF)',
          },
          {
            prompt: 'Jump to the closing tag of the paragraph.',
            setup: {
              name: 'note.html',
              text: ['<p class="note">Thanks for your order.', '  It ships today, and the tracking', '  link follows.</p> <a href="/track">Track</a>', '<hr>'],
              cursor: { line: 0, col: 26 },
            },
            goal: { cursor: { line: 2, col: 15 } },
            solution: 'gsft',
          },
          {
            prompt: 'Jump to the opening brace of the object.',
            setup: {
              text: ["const opts = { name: 'api',", "  retries: 3, backoff: 'exp',", '  timeout: 500,', '};', 'export default opts;'],
              cursor: { line: 1, col: 24 },
            },
            goal: { cursor: { line: 0, col: 13 } },
            solution: 'gsF{',
          },
          {
            prompt: 'Jump to the closing bracket.',
            setup: {
              text: ['const ports = new Set([80, 443,', '  8080, 9000]); // http and https', 'listen(ports);'],
              cursor: { line: 0, col: 27 },
            },
            goal: { cursor: { line: 1, col: 12 } },
            solution: 'gsf]',
          },
        ],
      },
    },
    {
      id: 'surround-a-selection',
      title: 'Surround a Selection',
      chips: ['v', 'gsa'],
      keyCards: [
        { key: 'v', glyph: '▮▮', label: 'select' },
        { key: 'gsa', glyph: '(▮▮)', label: 'wrap selection', sub: 'gsa{char}' },
      ],
      intro: (
        <>
          <p>
            In visual mode, <Code>gsa</Code> followed by a character wraps the selection. Use it when the text is easier
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
              { keys: 'veegsa]', label: 'vee gsa]', text: 'Read the docs now', cursor: 5 },
              { keys: 'Vjgsa}', label: 'Vj gsa}', text: ['"semi": false,', '"tabs": true'], cursor: [0, 0] },
            ]}
          />
        </>
      ),
      practice: total => (
        <p>
          Select the text, then press <Code>gsa</Code> and the character. {total} rounds.
        </p>
      ),
      aside: {
        title: 'Why gsa and not S',
        body: (
          <p>
            nvim-surround uses <Code>S</Code> here, but in a LazyVim setup, and in every lesson here,{' '}
            <Code>S</Code> is flash's treesitter select. mini.surround keeps its own prefix in every mode, so the key
            you press in normal mode is the key you press on a selection.
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
            solution: 'v3egsa)',
          },
          {
            prompt: 'An array of string or null: wrap the union.',
            setup: { text: ['type Row = { id: number };', 'let names: string | null[];', 'let rows: Row[] = [];'], cursor: { line: 1, col: 11 } },
            goal: { text: ['type Row = { id: number };', 'let names: (string | null)[];', 'let rows: Row[] = [];'] },
            solution: 'vt[gsa)',
          },
          {
            prompt: 'Turn "migration guide" into link text.',
            setup: { name: 'README.md', text: ['# Upgrading', '', 'Read the migration guide first.', 'Then bump the version.'], cursor: { line: 2, col: 9 } },
            goal: { text: ['# Upgrading', '', 'Read the [migration guide] first.', 'Then bump the version.'] },
            solution: 'veegsa]',
          },
          {
            prompt: 'Wrap all three settings in braces.',
            setup: { name: '.prettierrc.json', text: ['"semi": false,', '"singleQuote": true,', '"printWidth": 60'], cursor: { line: 0, col: 0 } },
            goal: { text: ['{"semi": false,', '"singleQuote": true,', '"printWidth": 60}'] },
            solution: 'VGgsa}',
          },
          {
            prompt: 'Quote the whole path.',
            setup: { name: 'deploy.sh', text: ['#!/bin/sh', 'npm run build', 'cp dist/app.js $HOME/My Apps/', 'echo done'], cursor: { line: 2, col: 15 } },
            goal: { text: ['#!/bin/sh', 'npm run build', 'cp dist/app.js "$HOME/My Apps/"', 'echo done'] },
            solution: 'vg_gsa"',
          },
        ],
      },
    },
    {
      id: 'surround-with-tags',
      title: 'Surround with Tags',
      chips: ['gsrtt', 'gsaiwt'],
      keyCards: [
        { key: 'gsrtt', glyph: '<b>→<i>', label: 'tag → tag', sub: 'type the name, then Enter' },
        { key: 'gsa…t', glyph: 'x→<b>x', label: 'add a tag' },
      ],
      intro: (
        <>
          <p>
            <Code>t</Code> means an HTML or JSX tag. <Code>gsr</Code> takes the old pair and then the new one, so a
            tag swap is <Code>gsrtt</Code>: replace a tag with a tag. It asks for the new name: type it and press{' '}
            <Code>Enter</Code>. The whole opening tag is replaced, attributes included, so type them again if you want
            them kept.
          </p>
          <p>
            To add a tag, use <Code>t</Code> as the character after <Code>gsa</Code>, in normal or visual mode. You can type attributes too: <Mono>a href="/"</Mono>.
          </p>
          <Edits
            plugins={['surround']}
            name="diagram.tsx"
            rows={[
              { keys: 'gsrtth3<CR>', label: 'gsrtt‹h3›⏎', text: '<h2>Settings</h2>', cursor: 6 },
              { keys: 'gsaiwtem<CR>', label: 'gsaiwt‹em›⏎', text: 'never expire', cursor: 2 },
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
            <Code>gsa…t</Code> and <Code>gsrtt</Code> both accept attributes in the name: <Mono>a href="/"</Mono> gives{' '}
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
            solution: 'gsrttstrong<CR>',
          },
          {
            prompt: 'Make the card a <section> with the same className.',
            setup: { text: ['<div className="card">', '  <h2>{title}</h2>', '</div>'], cursor: { line: 1, col: 6 } },
            goal: { text: ['<section className="card">', '  <h2>{title}</h2>', '</section>'] },
            solution: 'jgsrttsection className="card"<CR>',
          },
          {
            prompt: 'Demote the heading to <h3>.',
            setup: { text: ['<section>', '  <h2>Settings</h2>', '  <Toggle label="Dark mode" />', '</section>'], cursor: { line: 1, col: 8 } },
            goal: { text: ['<section>', '  <h3>Settings</h3>', '  <Toggle label="Dark mode" />', '</section>'] },
            solution: 'gsrtth3<CR>',
          },
          {
            prompt: 'Make the item a list entry.',
            setup: { text: ['<ul>', '  <li>Eggs</li>', '  Buy milk', '</ul>'], cursor: { line: 0, col: 0 } },
            goal: { text: ['<ul>', '  <li>Eggs</li>', '  <li>Buy milk</li>', '</ul>'] },
            solution: '2j^gsa$tli<CR>',
          },
          {
            prompt: 'Emphasise "never".',
            setup: { text: ['<Card title="Tokens">', '  <p>Tokens never expire.</p>', '</Card>'], cursor: { line: 1, col: 13 } },
            goal: { text: ['<Card title="Tokens">', '  <p>Tokens <em>never</em> expire.</p>', '</Card>'] },
            solution: 'gsaiwtem<CR>',
          },
          {
            prompt: 'Replace the whole <span> with a link to /docs.',
            setup: { text: ['<footer>', '  <span class="muted">Read the docs</span>', '</footer>'], cursor: { line: 1, col: 24 } },
            goal: { text: ['<footer>', '  <a href="/docs">Read the docs</a>', '</footer>'] },
            solution: 'gsrtta href="/docs"<CR>',
          },
        ],
      },
    },
  ],
};
