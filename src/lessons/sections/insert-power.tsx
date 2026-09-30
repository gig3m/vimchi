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

const DOCS_FILES = {
  'README.md': '',
  'docs/architecture.md': '# Architecture\n',
  'docs/deploy.md': '# Deploying\n',
  'docs/setup.md': '# Setup\n',
  'assets/logo.svg': '<svg/>\n',
  'scripts/build.sh': '#!/usr/bin/env bash\n',
  'scripts/release.sh': '#!/usr/bin/env bash\n',
  'src/main.ts': '',
  'src/config.ts': '',
  'src/components/Button.tsx': '',
  'src/components/ButtonGroup.tsx': '',
  'tsconfig.json': '{}\n',
};

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
      id: 'insert-word-completion',
      title: 'Word Completion',
      chips: ['C-n', 'C-p'],
      keyCards: [
        { key: 'C-n', glyph: '↓…', label: 'next match', sub: 'searching forward' },
        { key: 'C-p', glyph: '↑…', label: 'previous match', sub: 'searching back' },
      ],
      intro: (
        <>
          <p>
            Type the start of a word and press <Code>C-p</Code>: Vim fills in the nearest matching word above the
            cursor. <Code>C-n</Code> searches forward instead. Press either again to step through the other matches.
          </p>
          <p>
            It needs no plugins or language server. Any word in your open buffers is fair game, so long names cost a
            few keys.
          </p>
        </>
      ),
      practice: total => (
        <p>
          Each round starts in insert mode. Type a few letters and complete the rest, then press <Code>esc</Code>. (In
          the browser, <Code>Alt-n</Code> stands in for <Code>C-n</Code>.) {total} rounds.
        </p>
      ),
      aside: {
        title: 'Accept or back out',
        body: (
          <p>
            While the menu is open, <Code>C-y</Code> accepts the match and <Code>C-e</Code> cancels it and restores what
            you typed. Any other key just keeps typing after the match.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        base: { name: 'metrics.ts' },
        rounds: [
          {
            prompt: 'Log customerLifetimeValue.',
            setup: {
              ...typing([
                'function report(totalSpend: number, months: number) {',
                '  const customerLifetimeValue = totalSpend / months;',
                '  console.log(‸);',
                '}',
              ]),
            },
            goal: {
              text: [
                'function report(totalSpend: number, months: number) {',
                '  const customerLifetimeValue = totalSpend / months;',
                '  console.log(customerLifetimeValue);',
                '}',
              ],
            },
            solution: 'cu<C-p><Esc>',
          },
          {
            prompt: 'Pass handleSubmit. The nearest match is handleReset, so step once more.',
            setup: {
              name: 'form.ts',
              ...typing([
                'function handleSubmit(event: SubmitEvent) {}',
                'function handleReset() {}',
                "form.addEventListener('submit', ‸);",
              ]),
            },
            goal: {
              text: [
                'function handleSubmit(event: SubmitEvent) {}',
                'function handleReset() {}',
                "form.addEventListener('submit', handleSubmit);",
              ],
            },
            solution: 'ha<C-p><C-p><Esc>',
          },
          {
            prompt: 'Call the function defined further down.',
            setup: {
              name: 'main.ts',
              ...typing(['export function main() {', '  ‸();', '}', '', 'function loadConfigFromEnvironment() {}']),
            },
            goal: {
              text: ['export function main() {', '  loadConfigFromEnvironment();', '}', '', 'function loadConfigFromEnvironment() {}'],
            },
            solution: 'lo<C-n><Esc>',
          },
          {
            prompt: 'Fill in augroup.',
            setup: {
              name: 'autocmds.lua',
              ...typing([
                "local augroup = vim.api.nvim_create_augroup('fmt', {",
                '  clear = true,',
                '})',
                "vim.api.nvim_create_autocmd('BufWritePre', {",
                '  group = ‸,',
                '  callback = format,',
                '})',
              ]),
            },
            goal: {
              text: [
                "local augroup = vim.api.nvim_create_augroup('fmt', {",
                '  clear = true,',
                '})',
                "vim.api.nvim_create_autocmd('BufWritePre', {",
                '  group = augroup,',
                '  callback = format,',
                '})',
              ],
            },
            solution: 'au<C-p><Esc>',
          },
          {
            prompt: 'Finish the sentence with internationalization.',
            setup: {
              name: 'roadmap.md',
              ...typing([
                'We need internationalization before the EU launch.',
                'Budget two sprints for ‸.',
                'Marketing starts once the copy is translated.',
              ]),
            },
            goal: {
              text: [
                'We need internationalization before the EU launch.',
                'Budget two sprints for internationalization.',
                'Marketing starts once the copy is translated.',
              ],
            },
            solution: 'int<C-p><Esc>',
          },
        ],
      },
    },
    {
      id: 'insert-line-completion',
      title: 'Line Completion',
      chips: ['C-x C-l'],
      keyCards: [{ key: 'C-x C-l', glyph: '↑≡', label: 'complete whole line' }],
      intro: (
        <>
          <p>
            <Code>C-x C-l</Code> completes the whole line. Vim looks upward for a line that starts with what you've
            typed (ignoring indent), then in your other open buffers, and fills in the rest.
          </p>
          <p>
            Code repeats itself: guard clauses, assertions, imports, plugin options. Type enough to pick the right line
            and let Vim write the rest.
          </p>
        </>
      ),
      practice: total => (
        <p>
          Open a new line, type the start of the line you need and complete it with <Code>C-x C-l</Code>. {total}{' '}
          rounds.
        </p>
      ),
      aside: {
        title: 'The C-x family',
        body: (
          <p>
            <Code>C-x</Code> starts a sub-mode with a completion for almost everything: <Code>C-x C-f</Code> file names,{' '}
            <Code>C-x C-n</Code> words from this buffer only, <Code>C-x C-o</Code> the language server in Neovim.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        base: { name: 'auth.test.ts' },
        rounds: [
          {
            prompt: 'Below the request, repeat the status assertion.',
            setup: {
              text: [
                "it('logs in', async () => {",
                "  const res = await request(app).post('/login').send(valid);",
                '  expect(res.status).toBe(200);',
                "  expect(res.body.token).toBeDefined();",
                '});',
                '',
                "it('logs out', async () => {",
                "  const res = await request(app).post('/logout');",
                '});',
              ],
              cursor: { line: 7, col: 2 },
            },
            goal: {
              text: [
                "it('logs in', async () => {",
                "  const res = await request(app).post('/login').send(valid);",
                '  expect(res.status).toBe(200);',
                "  expect(res.body.token).toBeDefined();",
                '});',
                '',
                "it('logs out', async () => {",
                "  const res = await request(app).post('/logout');",
                '  expect(res.status).toBe(200);',
                '});',
              ],
            },
            solution: 'oexpect(res.s<C-x><C-l><Esc>',
          },
          {
            prompt: 'Add the same guard to getOrders.',
            setup: {
              name: 'handlers.ts',
              text: [
                'export async function getProfile(req: Request) {',
                '  const user = await currentUser(req);',
                '  if (!user) throw new UnauthorizedError();',
                '  return user.profile;',
                '}',
                '',
                'export async function getOrders(req: Request) {',
                '  const user = await currentUser(req);',
                '  return db.orders.findMany({ where: { userId: user.id } });',
                '}',
              ],
              cursor: { line: 7, col: 2 },
            },
            goal: {
              text: [
                'export async function getProfile(req: Request) {',
                '  const user = await currentUser(req);',
                '  if (!user) throw new UnauthorizedError();',
                '  return user.profile;',
                '}',
                '',
                'export async function getOrders(req: Request) {',
                '  const user = await currentUser(req);',
                '  if (!user) throw new UnauthorizedError();',
                '  return db.orders.findMany({ where: { userId: user.id } });',
                '}',
              ],
            },
            solution: 'oif<C-x><C-l><Esc>',
          },
          {
            prompt: 'Harpoon needs plenary too. Add the dependencies line.',
            setup: {
              name: 'plugins.lua',
              text: [
                'return {',
                '  {',
                "    'nvim-telescope/telescope.nvim',",
                "    dependencies = { 'nvim-lua/plenary.nvim' },",
                '  },',
                '  {',
                "    'ThePrimeagen/harpoon',",
                "    branch = 'harpoon2',",
                '  },',
                '}',
              ],
              cursor: { line: 7, col: 4 },
            },
            goal: {
              text: [
                'return {',
                '  {',
                "    'nvim-telescope/telescope.nvim',",
                "    dependencies = { 'nvim-lua/plenary.nvim' },",
                '  },',
                '  {',
                "    'ThePrimeagen/harpoon',",
                "    branch = 'harpoon2',",
                "    dependencies = { 'nvim-lua/plenary.nvim' },",
                '  },',
                '}',
              ],
            },
            solution: 'od<C-x><C-l><Esc>',
          },
          {
            prompt: 'Import zod here the same way schema.ts does. It is open in another buffer.',
            setup: {
              files: {
                'src/schema.ts': "import { z } from 'zod';\n\nexport const User = z.object({ email: z.string().email() });\n",
                'src/routes.ts': "import { Router } from 'express';\n\nexport const signup = z.object({ email: z.string() });\n",
              },
              open: 'src/routes.ts',
              init: vim => {
                vim.edit('src/schema.ts');
                vim.edit('src/routes.ts');
              },
            },
            goal: {
              text: [
                "import { z } from 'zod';",
                "import { Router } from 'express';",
                '',
                'export const signup = z.object({ email: z.string() });',
              ],
            },
            solution: 'Oimport { z<C-x><C-l><Esc>',
          },
        ],
      },
    },
    {
      id: 'insert-file-completion',
      title: 'File Completion',
      chips: ['C-x C-f'],
      keyCards: [{ key: 'C-x C-f', glyph: '/…', label: 'complete file name' }],
      intro: (
        <>
          <p>
            <Code>C-x C-f</Code> completes the file name before the cursor from the files on disk. Completing a
            directory leaves a trailing <Code>/</Code>; press <Code>C-x C-f</Code> again to go one level deeper.
          </p>
          <p>Links in docs, paths in scripts and config: type a few letters and never misspell a path again.</p>
        </>
      ),
      practice: total => (
        <p>
          Each round starts in insert mode. Type the start of the path, complete it, then press <Code>esc</Code>. Use{' '}
          <Code>C-n</Code> to step to the next match if the first isn't right. {total} rounds.
        </p>
      ),
      aside: {
        title: 'Relative to where?',
        body: (
          <p>
            Paths complete from Vim's working directory (<Code>:pwd</Code>), not the current file's folder. In a
            TypeScript file, <Code>./</Code> imports are better left to the language server.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        base: { files: DOCS_FILES, name: 'README.md' },
        rounds: [
          {
            prompt: 'Link the setup guide.',
            setup: {
              ...typing(['# acme-web', '', 'See the [setup guide](‸) before you start.', 'Deploys: docs/deploy.md.']),
            },
            goal: {
              text: ['# acme-web', '', 'See the [setup guide](docs/setup.md) before you start.', 'Deploys: docs/deploy.md.'],
            },
            solution: 'docs/s<C-x><C-f><Esc>',
          },
          {
            prompt: 'Point the logo at assets/logo.svg: complete the folder, then the file.',
            setup: { ...typing(['# acme-web', '', '![Logo](‸)', '', 'A storefront built with Vite.']) },
            goal: { text: ['# acme-web', '', '![Logo](assets/logo.svg)', '', 'A storefront built with Vite.'] },
            solution: 'as<C-x><C-f><C-x><C-f><Esc>',
          },
          {
            prompt: 'Run the release script.',
            setup: {
              name: 'scripts/ci.sh',
              ...typing(['#!/usr/bin/env bash', 'set -euo pipefail', 'bash "‸"', 'echo "released"']),
            },
            goal: { text: ['#!/usr/bin/env bash', 'set -euo pipefail', 'bash "./scripts/release.sh"', 'echo "released"'] },
            solution: './scripts/r<C-x><C-f><Esc>',
          },
          {
            prompt: 'Include src/main.ts.',
            setup: { name: 'tsconfig.json', ...typing(['{', '  "files": ["‸"]', '}']) },
            goal: { text: ['{', '  "files": ["src/main.ts"]', '}'] },
            solution: 'src/m<C-x><C-f><Esc>',
          },
          {
            prompt: 'Link ButtonGroup.tsx. The first match is Button.tsx.',
            setup: {
              ...typing(['## Components', '', 'Plain buttons: `src/components/Button.tsx`.', 'Grouped buttons: `‸`.']),
            },
            goal: {
              text: [
                '## Components',
                '',
                'Plain buttons: `src/components/Button.tsx`.',
                'Grouped buttons: `src/components/ButtonGroup.tsx`.',
              ],
            },
            solution: 'src/components/B<C-x><C-f><C-n><Esc>',
          },
        ],
      },
    },
    {
      id: 'insert-digraphs',
      title: 'Digraphs',
      chips: ['C-k'],
      keyCards: [{ key: 'C-k', glyph: "e'→é", label: 'digraph', sub: 'two keys, one character' }],
      intro: (
        <>
          <p>
            <Code>C-k</Code> followed by two characters types a special character. The pairs are mnemonic:{' '}
            <Code>e'</Code> is é, <Code>-M</Code> an em dash, <Code>-&gt;</Code> an arrow, <Code>DG</Code> the degree
            sign.
          </p>
          <p>No hunting through a character map: accents, symbols and punctuation are two keys away.</p>
          <BeforeAfter
            lines={['Invite Zoe and Noel.']}
            cursor={7}
            keys="fes<C-k>e:<Esc>"
            caption="e: is e with two dots: C-k then e then : types ë."
          />
        </>
      ),
      practice: total => (
        <p>
          Put in the missing character with <Code>C-k</Code>. Useful pairs: <Code>e'</Code> é, <Code>DG</Code> °,{' '}
          <Code>-M</Code> —, <Code>-&gt;</Code> →, <Code>*X</Code> ×, <Code>Eu</Code> €. {total} rounds.
        </p>
      ),
      aside: {
        title: 'Finding a pair',
        body: (
          <p>
            <Code>:digraphs</Code> lists every pair. Digraphs work after <Code>r</Code> and <Code>f</Code> too:{' '}
            <Code>r C-k e'</Code> replaces a letter with é.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        base: { name: 'menu.md' },
        rounds: [
          {
            prompt: 'Café needs its accent.',
            setup: {
              text: ['## Drinks', '', '- Espresso, 2.50', '- Cafe au lait, 3.50', '- Chai latte, 3.80'],
              cursor: { line: 3, col: 0 },
            },
            goal: { text: ['## Drinks', '', '- Espresso, 2.50', '- Café au lait, 3.50', '- Chai latte, 3.80'] },
            solution: "fes<C-k>e'<Esc>",
          },
          {
            prompt: 'Add the degree sign before the C.',
            setup: {
              name: 'recipe.md',
              text: ['Preheat the oven.', 'Bake at 180C for 25 minutes.', 'Cool on a rack.'],
              cursor: { line: 0, col: 0 },
            },
            goal: { text: ['Preheat the oven.', 'Bake at 180°C for 25 minutes.', 'Cool on a rack.'] },
            solution: 'jfCi<C-k>DG<Esc>',
          },
          {
            prompt: 'Replace the double hyphen with an em dash.',
            setup: {
              name: 'post.md',
              text: ['# Why Vim', '', 'Vim is fast -- once your hands know it.', 'Until then, it is slow.'],
              cursor: { line: 3, col: 0 },
            },
            goal: { text: ['# Why Vim', '', 'Vim is fast — once your hands know it.', 'Until then, it is slow.'] },
            solution: 'kf-2s<C-k>-M<Esc>',
          },
          {
            prompt: 'Turn both "->" into arrows. The second is a ; and a . away.',
            setup: {
              name: 'faq.md',
              text: ['## Shortcuts', '', 'Open Settings -> Keyboard -> Shortcuts.', 'Then press Add.'],
              cursor: { line: 2, col: 0 },
            },
            goal: { text: ['## Shortcuts', '', 'Open Settings → Keyboard → Shortcuts.', 'Then press Add.'] },
            solution: 'f-2s<C-k>-><Esc>;.',
          },
          {
            prompt: 'Make the x a multiplication sign.',
            setup: {
              name: 'README.md',
              text: ['# Tiles', '', 'The board is a 3x4 grid.', 'Each tile holds one letter.'],
              cursor: { line: 0, col: 0 },
            },
            goal: { text: ['# Tiles', '', 'The board is a 3×4 grid.', 'Each tile holds one letter.'] },
            solution: 'jjfxs<C-k>*X<Esc>',
          },
          {
            prompt: 'Add the euro sign before the Pro price.',
            setup: {
              name: 'pricing.md',
              text: ['| Plan | Price |', '| --- | --- |', '| Pro | 12 / month |', '| Team | 30 / month |'],
              cursor: { line: 2, col: 0 },
            },
            goal: { text: ['| Plan | Price |', '| --- | --- |', '| Pro | €12 / month |', '| Team | 30 / month |'] },
            solution: 'f1i<C-k>Eu<Esc>',
          },
        ],
      },
    },
    {
      id: 'insert-literal',
      title: 'Literal Characters',
      chips: ['C-v'],
      keyCards: [
        { key: 'C-v', glyph: '⇥', label: 'insert literally' },
        { key: 'C-v u', glyph: 'u2026', label: 'by Unicode code' },
      ],
      intro: (
        <>
          <p>
            <Code>C-v</Code> inserts the next key as-is. <Code>C-v tab</Code> puts in a real tab even when{' '}
            <Code>expandtab</Code> turns tabs into spaces. <Code>C-v u</Code> plus four hex digits inserts any Unicode
            character: <Code>C-v u2026</Code> is an ellipsis.
          </p>
          <p>Makefiles and TSV files need real tabs. Code points cover what digraphs don't.</p>
          <BeforeAfter
            lines={['Status: done']}
            cursor={0}
            keys="fdi<C-v>u2713 <Esc>"
            caption="C-v u2713 types the character with that code: a check mark."
          />
        </>
      ),
      practice: total => (
        <p>
          <Code>expandtab</Code> is on, so <Code>tab</Code> types spaces. Insert real tabs and Unicode characters with{' '}
          <Code>C-v</Code>. {total} rounds.
        </p>
      ),
      aside: {
        title: 'Seeing tabs',
        body: (
          <p>
            <Code>:set list</Code> shows tabs as <Code>&gt;</Code> so you can tell them from spaces. On Windows, where{' '}
            <Code>C-v</Code> pastes, <Code>C-q</Code> does the same job.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        base: { name: 'scores.tsv', options: { expandtab: true } },
        rounds: [
          {
            prompt: 'Give lin a score of 88, separated by a real tab.',
            setup: { text: ['name\tscore', 'ada\t92', 'lin'], cursor: { line: 2, col: 0 } },
            goal: { text: ['name\tscore', 'ada\t92', 'lin\t88'] },
            solution: 'A<C-v><Tab>88<Esc>',
          },
          {
            prompt: 'Add the email column, separated by a tab.',
            setup: {
              name: 'users.tsv',
              text: ['id\tname\temail', '1\tAda', '2\tLin\tlin@example.com'],
              cursor: { line: 2, col: 0 },
            },
            goal: { text: ['id\tname\temail', '1\tAda\tada@example.com', '2\tLin\tlin@example.com'] },
            solution: 'kA<C-v><Tab>ada@example.com<Esc>',
          },
          {
            prompt: 'Swap the three dots for an ellipsis (u2026).',
            setup: {
              name: 'save.ts',
              text: ['export function saveLabel(busy: boolean) {', "  return busy ? 'Saving...' : 'Save';", '}'],
              cursor: { line: 0, col: 0 },
            },
            goal: { text: ['export function saveLabel(busy: boolean) {', "  return busy ? 'Saving…' : 'Save';", '}'] },
            solution: 'jf.3s<C-v>u2026<Esc>',
          },
          {
            prompt: 'Put a check mark (u2713) and a space before "Saved".',
            setup: {
              name: 'toast.ts',
              text: ['await api.save(doc);', "toast.success('Saved');", 'router.back();'],
              cursor: { line: 2, col: 0 },
            },
            goal: { text: ['await api.save(doc);', "toast.success('✓ Saved');", 'router.back();'] },
            solution: 'kfSi<C-v>u2713 <Esc>',
          },
          {
            prompt: 'Replace both ">" with arrows (u2192).',
            setup: {
              name: 'nav.ts',
              text: ['// Breadcrumb for the cookie page:', '// Settings > Privacy > Cookies', "export const path = '/settings/cookies';"],
              cursor: { line: 1, col: 0 },
            },
            goal: {
              text: ['// Breadcrumb for the cookie page:', '// Settings → Privacy → Cookies', "export const path = '/settings/cookies';"],
            },
            solution: 'f>s<C-v>u2192<Esc>;.',
          },
        ],
      },
    },
    {
      id: 'inspect-character',
      title: 'Inspecting a Character',
      chips: ['ga', 'g8'],
      keyCards: [
        { key: 'ga', glyph: 'é?', label: 'show code point' },
        { key: 'g8', glyph: 'c3a9', label: 'show UTF-8 bytes' },
      ],
      intro: (
        <>
          <p>
            <Code>ga</Code> prints the character under the cursor with its code in decimal, hex and octal, plus its
            digraph if it has one. <Code>g8</Code> prints the UTF-8 bytes.
          </p>
          <p>
            Reach for them when something looks right but isn't: a curly quote pasted into JSON, a non-breaking space
            in a shell command, a letter from the wrong alphabet.
          </p>
        </>
      ),
      practice: total => <p>{total} questions on reading what these two print.</p>,
      aside: {
        title: 'Find them all',
        body: (
          <p>
            <Code>/[^\x00-\x7F]</Code> searches for any non-ASCII character. Pair it with <Code>ga</Code> to see what
            each one is.
          </p>
        ),
      },
      challenge: {
        kind: 'quiz',
        questions: [
          {
            prompt: 'ga on é prints this. What is the last part for?',
            code: "<é> 233, Hex 00e9, Oct 351, Digr e'",
            options: [
              'The keys to type it with C-k',
              'The font it is drawn in',
              'Its position in the line',
              'The register it came from',
            ],
            answer: 0,
            explain: "Digr e' means C-k e' types this character.",
          },
          {
            prompt: 'A JSON file fails to parse. ga on one of the quotes prints this. What is it?',
            code: '<”> 8221, Hex 201d, Oct 20035',
            options: ['A plain double quote', 'A curly closing quote', 'An escaped quote', 'A backtick'],
            answer: 1,
            explain: 'A plain " is Hex 22. U+201D is a typographic quote, usually pasted from a document.',
          },
          {
            prompt: 'A shell command fails with "command not found". ga on the gap between words prints this.',
            code: '< > 160, Hex 00a0, Oct 240',
            options: ['A tab', 'A normal space', 'A non-breaking space', 'An empty line'],
            answer: 2,
            explain: 'A normal space is 32 (Hex 20). U+00A0 looks the same but the shell treats it as part of the word.',
          },
          {
            prompt: 'ga prints this. What character is under the cursor?',
            code: '<^I> 9, Hex 09, Oct 011',
            options: ['A tab', 'A capital I', 'A carriage return', 'A null byte'],
            answer: 0,
            explain: 'Control characters are shown in caret notation. ^I is character 9, the tab.',
          },
          {
            prompt: 'What does g8 print on é?',
            options: ['e9', 'c3 a9', '00e9', '233'],
            answer: 1,
            explain: 'g8 shows the bytes as stored in a UTF-8 file. é takes two: c3 a9.',
          },
          {
            prompt: 'Which character is not plain ASCII?',
            options: ['Hex 7e', 'Hex 20', 'Hex 0430', 'Hex 41'],
            answer: 2,
            explain: 'ASCII ends at 7f. U+0430 is the Cyrillic а, which looks exactly like a Latin a.',
          },
        ],
      },
    },
  ],
};
