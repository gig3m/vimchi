import { Code } from '../../components/Code';
import { BeforeAfter } from '../../components/diagrams';
import type { Section } from '../types';

export const basicOperators: Section = {
  id: 'basic-operators',
  title: 'Basic Operators',
  band: 'core',
  lessons: [
    {
      id: 'intro-operators',
      title: 'Intro to Operators',
      chips: ['d', 'c', 'y'],
      keyCards: [
        { key: 'd', glyph: 'del', glyphColor: 'var(--red)', label: 'delete' },
        { key: 'c', glyph: '✎', label: 'change' },
        { key: 'y', glyph: '⧉', label: 'yank (copy)' },
      ],
      intro: (
        <>
          <p>
            An operator is a verb waiting for a noun. <Code>d</Code> deletes, <Code>c</Code> changes, <Code>y</Code>{' '}
            copies, but none of them does anything until you say how far. Any motion you know finishes the sentence:{' '}
            <Code>dw</Code> deletes a word, <Code>d$</Code> deletes to the end of the line, <Code>c$</Code> changes it.
          </p>
          <BeforeAfter
            lines={['export default async function main() {']}
            cursor={7}
            keys="dw"
            caption={<><Code>d</Code> (delete) + <Code>w</Code> (to the next word)</>}
          />
          <BeforeAfter
            lines={['const port = 8080; // read from env']}
            cursor={18}
            keys="d$"
            caption={<>Same verb, new noun: <Code>d</Code> + <Code>$</Code> (to the end of the line)</>}
          />
          <p>
            This is why Vim pays off. Learn a new motion and it works with every operator; learn a new operator and it
            works with every motion. A handful of keys multiplies into hundreds of edits.
          </p>
        </>
      ),
      practice: total => (
        <p>
          Build each edit from an operator and a motion you already know. {total} rounds.
        </p>
      ),
      aside: {
        title: 'Doubling up',
        body: (
          <p>
            Typing an operator twice acts on the whole line: <Code>dd</Code> deletes it, <Code>cc</Code> changes it,{' '}
            <Code>yy</Code> copies it. The next lessons cover each one.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        base: { name: 'main.ts' },
        rounds: [
          {
            prompt: 'Delete "default " with dw.',
            setup: {
              text: [
                "import { serve } from './server';",
                '',
                'export default async function main() {',
                '  await serve(8080);',
                '}',
              ],
              cursor: { line: 0, col: 0 },
            },
            goal: {
              text: [
                "import { serve } from './server';",
                '',
                'export async function main() {',
                '  await serve(8080);',
                '}',
              ],
            },
            solution: 'jjwdw',
          },
          {
            prompt: 'Change "noremap" to "silent" with cw.',
            setup: {
              name: 'keymaps.lua',
              text: [
                'local map = vim.keymap.set',
                'local opts = { noremap = true }',
                "map('n', '<leader>w', '<cmd>w<CR>', opts)",
              ],
              cursor: { line: 2, col: 0 },
            },
            goal: {
              text: [
                'local map = vim.keymap.set',
                'local opts = { silent = true }',
                "map('n', '<leader>w', '<cmd>w<CR>', opts)",
              ],
            },
            solution: 'kfncwsilent<Esc>',
          },
          {
            prompt: 'Delete the comment with d$.',
            setup: {
              text: [
                "const host = 'localhost';",
                'const port = 8080; // read from env later',
                'const url = `http://${host}:${port}`;',
              ],
              cursor: { line: 0, col: 0 },
            },
            goal: {
              text: [
                "const host = 'localhost';",
                'const port = 8080;',
                'const url = `http://${host}:${port}`;',
              ],
            },
            solution: 'jf;ld$',
          },
          {
            prompt: 'Rewrite the rest of the line with c$.',
            setup: {
              text: [
                'function greet(name: string) {',
                "  const greeting = 'Hello, ' + name;",
                '  return greeting;',
                '}',
              ],
              cursor: { line: 0, col: 0 },
            },
            goal: {
              text: [
                'function greet(name: string) {',
                '  const greeting = `Hello, ${name}`;',
                '  return greeting;',
                '}',
              ],
            },
            solution: "jf'c$`Hello, ${name}`;<Esc>",
          },
          {
            prompt: 'Copy "await " with yw, then put it before getPosts with P.',
            setup: {
              text: [
                'async function load(id: string) {',
                '  const user = await getUser(id);',
                '  const posts = getPosts(id);',
                '  return { user, posts };',
                '}',
              ],
              cursor: { line: 0, col: 0 },
            },
            goal: {
              text: [
                'async function load(id: string) {',
                '  const user = await getUser(id);',
                '  const posts = await getPosts(id);',
                '  return { user, posts };',
                '}',
              ],
            },
            solution: 'jfaywjlP',
          },
        ],
      },
    },
    {
      id: 'delete-words',
      title: 'Delete Words',
      chips: ['d', 'w'],
      keyCards: [
        { key: 'd', glyph: 'del', glyphColor: 'var(--red)', label: 'delete' },
        { key: 'w', glyph: '→|', label: 'to next word' },
      ],
      intro: (
        <>
          <p>
            <Code>dw</Code> deletes from the cursor to the start of the next word, so the space after the word goes too
            and the line closes up neatly.
          </p>
          <p>
            A "word" is a run of letters, digits and underscores, or a run of punctuation. So <Code>dw</Code> on{' '}
            <Code>getUserById(id)</Code> with the cursor on <Code>B</Code> stops at the parenthesis.
          </p>
          <BeforeAfter lines={['const user = getUserById(id);']} cursor={20} keys="dw" />
        </>
      ),
      practice: total => (
        <p>
          Get to the word, then delete it with <Code>dw</Code>. {total} rounds.
        </p>
      ),
      aside: {
        title: 'Starting mid-word',
        body: (
          <p>
            <Code>dw</Code> deletes from the cursor, not from the start of the word. To delete the whole word from
            anywhere inside it, use <Code>daw</Code> from the Text Objects section.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        base: { name: 'user.ts' },
        rounds: [
          {
            prompt: 'Delete the second "await".',
            setup: {
              text: [
                'export async function loadUser(id: string) {',
                '  const user = await await getUser(id);',
                '  return user;',
                '}',
              ],
              cursor: { line: 1, col: 15 },
            },
            goal: {
              text: [
                'export async function loadUser(id: string) {',
                '  const user = await getUser(id);',
                '  return user;',
                '}',
              ],
            },
            solution: 'wdw',
          },
          {
            prompt: 'Delete "really".',
            setup: {
              name: 'README.md',
              text: ['# vimchi', '', 'This is a really short guide to Vim.', 'Each lesson teaches a few keys.'],
              cursor: { line: 0, col: 0 },
            },
            goal: { text: ['# vimchi', '', 'This is a short guide to Vim.', 'Each lesson teaches a few keys.'] },
            solution: 'jj3wdw',
          },
          {
            prompt: 'Delete the duplicated "local".',
            setup: {
              name: 'init.lua',
              text: ['local M = {}', '', 'local function local setup(opts)', '  M.opts = opts', 'end'],
              cursor: { line: 4, col: 0 },
            },
            goal: { text: ['local M = {}', '', 'local function setup(opts)', '  M.opts = opts', 'end'] },
            solution: 'kk2wdw',
          },
          {
            prompt: 'Trim "getUserById" to "getUser".',
            setup: {
              text: ['async function show(id: string) {', '  const user = getUserById(id);', '  render(user);', '}'],
              cursor: { line: 0, col: 0 },
            },
            goal: { text: ['async function show(id: string) {', '  const user = getUser(id);', '  render(user);', '}'] },
            solution: 'jfBdw',
          },
          {
            prompt: 'Delete the second "the".',
            setup: {
              name: 'TODO.md',
              text: ['## This week', '- [x] Fix the parser', '- [ ] Write the the tests', '- [ ] Tag a release'],
              cursor: { line: 0, col: 0 },
            },
            goal: { text: ['## This week', '- [x] Fix the parser', '- [ ] Write the tests', '- [ ] Tag a release'] },
            solution: 'jj4wdw',
          },
        ],
      },
    },
    {
      id: 'delete-to-char',
      title: 'Delete to Character',
      chips: ['dt', 'df'],
      keyCards: [
        { key: 'dt', glyph: '→|x', glyphColor: 'var(--red)', label: 'delete till x', sub: 'keeps x' },
        { key: 'df', glyph: '→x', glyphColor: 'var(--red)', label: 'delete through x', sub: 'takes x too' },
      ],
      intro: (
        <>
          <p>
            <Code>f</Code> and <Code>t</Code> are motions, so they work after an operator. <Code>dt)</Code> deletes up to
            the next <Code>)</Code> and keeps it. <Code>df,</Code> deletes through the next comma, comma included.
          </p>
          <BeforeAfter lines={['greet(name, { loud: true });']} cursor={10} keys="dt)" caption="dt) stops before the parenthesis." />
          <BeforeAfter lines={['user.profile.settings.theme']} cursor={5} keys="df." caption="df. takes the dot with it." />
          <p>
            Reach for these when the text you want gone doesn't line up with word boundaries: the rest of an argument
            list, a chunk of a dotted path, a suffix on a version string.
          </p>
        </>
      ),
      practice: total => (
        <p>
          Get to the line, then delete the extra text with <Code>dt</Code> or <Code>df</Code>. Pick the character that
          ends the deletion. {total} rounds.
        </p>
      ),
      aside: {
        title: 'Backwards too',
        body: (
          <p>
            <Code>dT(</Code> and <Code>dF(</Code> delete backwards to the previous <Code>(</Code>. Backward deletes never
            include the character under the cursor.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        base: { name: 'app.ts' },
        rounds: [
          {
            prompt: 'Remove the "state" label.',
            setup: {
              text: ['function render(user: User) {', '  console.log("state", user);', '  return view(user);', '}'],
              cursor: { line: 0, col: 0 },
            },
            goal: { text: ['function render(user: User) {', '  console.log(user);', '  return view(user);', '}'] },
            solution: 'jf"dtu',
          },
          {
            prompt: 'Drop the options argument.',
            setup: {
              text: ['const name = input.value;', 'greet(name, { loud: true });', 'showBanner();'],
              cursor: { line: 2, col: 0 },
            },
            goal: { text: ['const name = input.value;', 'greet(name);', 'showBanner();'] },
            solution: 'kf,dt)',
          },
          {
            prompt: 'Remove "profile." from the path.',
            setup: {
              text: [
                'function applyTheme(user: User) {',
                '  const theme = user.profile.settings.theme;',
                '  document.body.dataset.theme = theme;',
                '}',
              ],
              cursor: { line: 0, col: 0 },
            },
            goal: {
              text: [
                'function applyTheme(user: User) {',
                '  const theme = user.settings.theme;',
                '  document.body.dataset.theme = theme;',
                '}',
              ],
            },
            solution: 'jfpdf.',
          },
          {
            prompt: 'Drop the fallback port.',
            setup: {
              text: [
                "import { createServer } from 'node:http';",
                '',
                'const port = process.env.PORT ?? 3000;',
                'createServer(handler).listen(port);',
              ],
              cursor: { line: 3, col: 0 },
            },
            goal: {
              text: [
                "import { createServer } from 'node:http';",
                '',
                'const port = process.env.PORT;',
                'createServer(handler).listen(port);',
              ],
            },
            solution: 'kt?dt;',
          },
          {
            prompt: 'Strip the prerelease tag.',
            setup: {
              name: 'package.json',
              text: ['{', '  "name": "vimchi",', '  "version": "1.2.0-beta.3",', '  "private": true', '}'],
              cursor: { line: 0, col: 0 },
            },
            goal: { text: ['{', '  "name": "vimchi",', '  "version": "1.2.0",', '  "private": true', '}'] },
            solution: 'jjf-dt"',
          },
        ],
      },
    },
    {
      id: 'delete-lines',
      title: 'Delete Lines',
      chips: ['dd', 'D'],
      keyCards: [
        { key: 'dd', glyph: '⌫', glyphColor: 'var(--red)', label: 'delete line' },
        { key: 'D', glyph: '→|', glyphColor: 'var(--red)', label: 'delete to end' },
      ],
      intro: (
        <>
          <p>
            <Code>dd</Code> deletes the whole line, wherever the cursor is on it. <Code>D</Code> deletes from the cursor to
            the end of the line and keeps the rest; it's short for <Code>d$</Code>.
          </p>
          <p>
            Use <Code>dd</Code> to throw away a stray log or a dead import. Use <Code>D</Code> to cut off a trailing comment
            or the second half of a statement.
          </p>
          <BeforeAfter lines={['const retries = 3; // was 5', 'const backoff = 2;']} cursor={18} keys="D" />
        </>
      ),
      practice: total => (
        <p>
          Delete the line with <Code>dd</Code>, or the end of it with <Code>D</Code>. {total} rounds.
        </p>
      ),
      aside: {
        title: 'Deleted, not gone',
        body: (
          <p>
            Everything you delete goes into a register. After <Code>dd</Code>, press <Code>p</Code> to put the line back
            below the cursor. That's how you move lines around, as the Copy/Paste lesson shows.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        base: { name: 'cart.ts' },
        rounds: [
          {
            prompt: 'Delete the console.log line.',
            setup: {
              text: ['function addItem(cart, item) {', "  console.log('adding', item);", '  cart.items.push(item);', '}'],
              cursor: { line: 0, col: 0 },
            },
            goal: { text: ['function addItem(cart, item) {', '  cart.items.push(item);', '}'] },
            solution: 'jdd',
          },
          {
            prompt: 'Delete the trailing comment.',
            setup: {
              text: ['const timeout = 5000;', 'const retries = 3; // was 5 before the outage', 'const backoff = 2;'],
              cursor: { line: 2, col: 6 },
            },
            goal: { text: ['const timeout = 5000;', 'const retries = 3;', 'const backoff = 2;'] },
            solution: 'kf/hD',
          },
          {
            prompt: 'Remove the swapfile setting.',
            setup: {
              name: 'options.lua',
              text: ['vim.opt.number = true', 'vim.opt.swapfile = true', 'vim.opt.undofile = true', 'vim.opt.wrap = false'],
              cursor: { line: 3, col: 8 },
            },
            goal: { text: ['vim.opt.number = true', 'vim.opt.undofile = true', 'vim.opt.wrap = false'] },
            solution: 'kkdd',
          },
          {
            prompt: 'Cut the note off the end of the task.',
            setup: {
              name: 'TODO.md',
              text: ['## Sprint 12', '- [x] Ship v2 (blocked on review)', '- [ ] Update docs'],
              cursor: { line: 2, col: 0 },
            },
            goal: { text: ['## Sprint 12', '- [x] Ship v2', '- [ ] Update docs'] },
            solution: 'kf(hD',
          },
          {
            prompt: 'Delete the duplicate "lint" script.',
            setup: {
              name: 'package.json',
              text: ['"scripts": {', '  "lint": "eslint .",', '  "test": "vitest",', '  "lint": "eslint .",', '  "build": "vite build"', '}'],
              cursor: { line: 1, col: 2 },
            },
            goal: { text: ['"scripts": {', '  "lint": "eslint .",', '  "test": "vitest",', '  "build": "vite build"', '}'] },
            solution: 'jjdd',
          },
        ],
      },
    },
    {
      id: 'delete-multiple-lines',
      title: 'Delete Multiple Lines',
      chips: ['dj', 'dk'],
      keyCards: [
        { key: 'dj', glyph: '↓', glyphColor: 'var(--red)', label: 'this line + next' },
        { key: 'dk', glyph: '↑', glyphColor: 'var(--red)', label: 'this line + prev' },
      ],
      intro: (
        <>
          <p>
            <Code>j</Code> and <Code>k</Code> are linewise motions, so <Code>dj</Code> deletes the current line and the one
            below, and <Code>dk</Code> deletes the current line and the one above.
          </p>
          <p>
            Add a count to the motion for bigger blocks: <Code>d2j</Code> deletes three lines, this one and two more.
            There's no need to press <Code>dd</Code> again and again.
          </p>
          <BeforeAfter
            lines={['function load(id) {', '  if (!id) {', "    throw new Error('no id');", '  }', '  return db.get(id);', '}']}
            cursor={[1, 2]}
            keys="d2j"
          />
        </>
      ),
      practice: total => (
        <p>
          Delete each block in one go with <Code>dj</Code>, <Code>dk</Code> or a count. {total} rounds.
        </p>
      ),
      aside: {
        title: 'Count the lines, not the jumps',
        body: (
          <p>
            <Code>d2j</Code> and <Code>3dd</Code> both delete three lines. With <Code>relativenumber</Code> on, the number
            beside the last line you want is exactly the count for <Code>j</Code>.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        base: { name: 'server.ts' },
        rounds: [
          {
            prompt: 'Delete the two debug lines.',
            setup: {
              text: ['app.listen(port, () => {', "  console.log('port', port);", "  console.log('env', env);", "  log.info('ready');", '});'],
              cursor: { line: 0, col: 0 },
            },
            goal: { text: ['app.listen(port, () => {', "  log.info('ready');", '});'] },
            solution: 'jdj',
          },
          {
            prompt: 'Delete the commented-out pair.',
            setup: {
              name: 'keymaps.lua',
              text: [
                "vim.keymap.set('n', '<Esc>', '<cmd>nohlsearch<CR>')",
                "-- vim.keymap.set('n', 'Q', '<nop>')",
                "-- vim.keymap.set('n', 'q:', '<nop>')",
                "vim.keymap.set('n', '<leader>w', '<cmd>write<CR>')",
              ],
              cursor: { line: 2, col: 0 },
            },
            goal: {
              text: ["vim.keymap.set('n', '<Esc>', '<cmd>nohlsearch<CR>')", "vim.keymap.set('n', '<leader>w', '<cmd>write<CR>')"],
            },
            solution: 'dk',
          },
          {
            prompt: 'Delete the whole if block.',
            setup: {
              text: ['function load(id) {', '  if (!id) {', "    throw new Error('missing id');", '  }', '  return db.get(id);', '}'],
              cursor: { line: 3, col: 2 },
            },
            goal: { text: ['function load(id) {', '  return db.get(id);', '}'] },
            solution: 'd2k',
          },
          {
            prompt: 'Delete the draft section: heading, text and blank line.',
            setup: {
              name: 'CHANGELOG.md',
              text: ['## 2.1.0', '- Faster startup', '', '## Draft', 'Notes for next time.', '', '## 2.0.0', '- New engine'],
              cursor: { line: 3, col: 0 },
            },
            goal: { text: ['## 2.1.0', '- Faster startup', '', '## 2.0.0', '- New engine'] },
            solution: 'd2j',
          },
          {
            prompt: 'Delete the last two lines.',
            setup: {
              text: ['export const routes = [', "  { path: '/', page: Home },", "  { path: '/about', page: About },", '];', '// old routes below', '// export const legacy = [];'],
              cursor: { line: 4, col: 3 },
            },
            goal: { text: ['export const routes = [', "  { path: '/', page: Home },", "  { path: '/about', page: About },", '];'] },
            solution: 'dj',
          },
        ],
      },
    },
    {
      id: 'change-lines',
      title: 'Change Lines',
      chips: ['cc', 'C'],
      keyCards: [
        { key: 'cc', glyph: '✎', label: 'change line' },
        { key: 'C', glyph: '✎→|', label: 'change to end' },
      ],
      intro: (
        <>
          <p>
            <Code>cc</Code> clears the whole line and puts you in insert mode, keeping the indent. <Code>C</Code> clears
            from the cursor to the end of the line, like <Code>c$</Code>.
          </p>
          <p>
            They're <Code>dd</Code> and <Code>D</Code> with typing afterwards. Use <Code>cc</Code> when the line is wrong
            from the start, <Code>C</Code> when only the ending needs rewriting.
          </p>
          <BeforeAfter
            lines={['function total(items) {', "  console.log('here');", '}']}
            cursor={[1, 10]}
            keys="ccreturn sum;<Esc>"
            caption="cc keeps the indent."
          />
        </>
      ),
      practice: total => (
        <p>
          Rewrite the line, or its end, to match the goal. Press <Code>esc</Code> when done. {total} rounds.
        </p>
      ),
      aside: {
        title: 'S is cc',
        body: (
          <p>
            <Code>S</Code> from the Substitute lesson does exactly what <Code>cc</Code> does. Use whichever your fingers
            prefer.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        base: { name: 'config.ts' },
        rounds: [
          {
            prompt: 'Point the URL at the environment variable.',
            setup: {
              text: [
                "import { createClient } from './client';",
                '',
                "const url = 'http://localhost:3000';",
                'export const client = createClient(url);',
              ],
              cursor: { line: 0, col: 0 },
            },
            goal: {
              text: [
                "import { createClient } from './client';",
                '',
                'const url = process.env.API_URL;',
                'export const client = createClient(url);',
              ],
            },
            solution: "jjf'Cprocess.env.API_URL;<Esc>",
          },
          {
            prompt: 'Replace the debug line with a return.',
            setup: {
              text: ['function total(items) {', '  const sum = items.reduce((a, b) => a + b, 0);', "  console.log('here');", '}'],
              cursor: { line: 0, col: 0 },
            },
            goal: { text: ['function total(items) {', '  const sum = items.reduce((a, b) => a + b, 0);', '  return sum;', '}'] },
            solution: 'jjccreturn sum;<Esc>',
          },
          {
            prompt: 'Write the intro over the placeholder.',
            setup: { name: 'README.md', text: ['# vimchi', '', 'TODO: write an intro', '', '## Install'], cursor: { line: 4, col: 0 } },
            goal: { text: ['# vimchi', '', 'Learn Vim by doing.', '', '## Install'] },
            solution: 'kkccLearn Vim by doing.<Esc>',
          },
          {
            prompt: 'Map <leader>w to the write command.',
            setup: {
              name: 'keymaps.lua',
              text: [
                "vim.g.mapleader = ' '",
                "vim.keymap.set('n', '<leader>w', ':w<CR>')",
                "vim.keymap.set('n', '<leader>q', '<cmd>quit<CR>')",
              ],
              cursor: { line: 0, col: 0 },
            },
            goal: {
              text: [
                "vim.g.mapleader = ' '",
                "vim.keymap.set('n', '<leader>w', '<cmd>write<CR>')",
                "vim.keymap.set('n', '<leader>q', '<cmd>quit<CR>')",
              ],
            },
            solution: "jf:C<lt>cmd>write<lt>CR>')<Esc>",
          },
          {
            prompt: 'Change the condition.',
            setup: {
              text: [
                'function checkVoter(user: User) {',
                "  if (user.age > 17 && user.country === 'US') {",
                '    allow(user);',
                '  }',
                '}',
              ],
              cursor: { line: 0, col: 0 },
            },
            goal: { text: ['function checkVoter(user: User) {', '  if (canVote(user)) {', '    allow(user);', '  }', '}'] },
            solution: 'jfuCcanVote(user)) {<Esc>',
          },
        ],
      },
    },
    {
      id: 'copy-paste-lines',
      title: 'Copy/Paste Lines',
      chips: ['yy', 'p', 'P'],
      keyCards: [
        { key: 'yy', glyph: '⧉', label: 'yank line' },
        { key: 'p', glyph: '↓', label: 'put below' },
        { key: 'P', glyph: '↑', label: 'put above' },
      ],
      intro: (
        <>
          <p>
            <Code>yy</Code> yanks (copies) the current line. <Code>p</Code> puts it on a new line below the cursor,{' '}
            <Code>P</Code> above. <Code>y</Code> takes motions like any operator: <Code>yj</Code> yanks two lines.
          </p>
          <p>
            Delete and put work together too, since <Code>dd</Code> also fills the register. <Code>ddp</Code> swaps a
            line with the one below; <Code>ddkP</Code> moves it up.
          </p>
          <BeforeAfter lines={['1. Run the tests', '3. Push the tag', '2. Build the release']} cursor={[1, 0]} keys="ddp" />
        </>
      ),
      practice: total => (
        <p>
          Duplicate or move lines with yank, delete and put. No retyping. {total} rounds.
        </p>
      ),
      aside: {
        title: 'Lines stay lines',
        body: (
          <p>
            A yanked line always goes onto a line of its own, wherever the cursor is. Yank part of a line instead, like{' '}
            <Code>yw</Code>, and <Code>p</Code> puts it right after the cursor.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        base: { name: 'math.test.ts' },
        rounds: [
          {
            prompt: 'Duplicate the first test case.',
            setup: {
              text: ['const cases = [', '  [1, 2, 3],', '  [2, 2, 4],', '];'],
              cursor: { line: 3, col: 0 },
            },
            goal: { text: ['const cases = [', '  [1, 2, 3],', '  [1, 2, 3],', '  [2, 2, 4],', '];'] },
            solution: 'kkyyp',
          },
          {
            prompt: 'Swap the two steps.',
            setup: {
              name: 'deploy.md',
              text: ['## Release', '1. Run the tests', '3. Push the tag', '2. Build the release'],
              cursor: { line: 0, col: 0 },
            },
            goal: { text: ['## Release', '1. Run the tests', '2. Build the release', '3. Push the tag'] },
            solution: 'jjddp',
          },
          {
            prompt: 'Move the import to the top.',
            setup: {
              name: 'main.tsx',
              text: [
                "import { render } from 'react-dom';",
                "import './styles.css';",
                "import React from 'react';",
                '',
                "render(<App />, document.getElementById('root'));",
              ],
              cursor: { line: 2, col: 0 },
            },
            goal: {
              text: [
                "import React from 'react';",
                "import { render } from 'react-dom';",
                "import './styles.css';",
                '',
                "render(<App />, document.getElementById('root'));",
              ],
            },
            solution: 'ddggP',
          },
          {
            prompt: 'Copy the header row above the data.',
            setup: {
              name: 'scores.csv',
              text: ['name,score', 'ada,92', 'grace,88', 'linus,75'],
              cursor: { line: 3, col: 0 },
            },
            goal: { text: ['name,score', 'ada,92', 'grace,88', 'name,score', 'linus,75'] },
            solution: 'ggyyGP',
          },
          {
            prompt: 'Duplicate both keymap lines below.',
            setup: {
              name: 'keymaps.lua',
              text: ['local map = vim.keymap.set', "map('n', '<C-h>', '<C-w>h')", "map('n', '<C-l>', '<C-w>l')"],
              cursor: { line: 0, col: 0 },
            },
            goal: {
              text: [
                'local map = vim.keymap.set',
                "map('n', '<C-h>', '<C-w>h')",
                "map('n', '<C-l>', '<C-w>l')",
                "map('n', '<C-h>', '<C-w>h')",
                "map('n', '<C-l>', '<C-w>l')",
              ],
            },
            solution: 'jyjjp',
          },
        ],
      },
    },
    {
      id: 'yank-to-end',
      title: 'Yank to End',
      chips: ['Y'],
      keyCards: [{ key: 'Y', glyph: '⧉→|', label: 'yank to end' }],
      intro: (
        <>
          <p>
            <Code>Y</Code> yanks from the cursor to the end of the line, the same as <Code>y$</Code>. It pairs with{' '}
            <Code>D</Code> and <Code>C</Code>: all three act on the rest of the line.
          </p>
          <p>
            It's handy when two lines share an ending: yank the tail of one, then put it after the other with{' '}
            <Code>p</Code>.
          </p>
          <BeforeAfter lines={["const primary = '#1e66f5';", 'const accent = ']} cursor={16} keys="Yj$p" />
        </>
      ),
      practice: total => (
        <p>
          Yank the end of one line with <Code>Y</Code> and put it at the end of the next. {total} rounds.
        </p>
      ),
      aside: {
        title: 'Neovim vs Vim',
        body: (
          <p>
            In classic Vim, <Code>Y</Code> yanks the whole line like <Code>yy</Code>. Neovim changed it to <Code>y$</Code>{' '}
            for consistency. Add <Code>nnoremap Y y$</Code> to a vimrc to get the same.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        base: { name: 'theme.ts' },
        rounds: [
          {
            prompt: 'Give accent the same colour as primary.',
            setup: {
              text: ['// Catppuccin Latte', "const primary = '#1e66f5';", 'const accent = ', "const text = '#4c4f69';"],
              cursor: { line: 0, col: 0 },
            },
            goal: {
              text: ['// Catppuccin Latte', "const primary = '#1e66f5';", "const accent = '#1e66f5';", "const text = '#4c4f69';"],
            },
            solution: "jf'Yj$p",
          },
          {
            prompt: 'Map <C-p> to the same picker.',
            setup: {
              name: 'telescope.lua',
              text: [
                "local builtin = require('telescope.builtin')",
                "map('n', '<leader>ff', builtin.find_files)",
                "map('n', '<C-p>', ",
                "map('n', '<leader>fg', builtin.live_grep)",
              ],
              cursor: { line: 3, col: 0 },
            },
            goal: {
              text: [
                "local builtin = require('telescope.builtin')",
                "map('n', '<leader>ff', builtin.find_files)",
                "map('n', '<C-p>', builtin.find_files)",
                "map('n', '<leader>fg', builtin.live_grep)",
              ],
            },
            solution: 'kkfbYj$p',
          },
          {
            prompt: 'Load admin the same way as user.',
            setup: {
              name: 'users.ts',
              text: [
                'export async function loadPair(id: string) {',
                '  const user = await db.users.findOne({ id });',
                '  const admin = ',
                '  return { user, admin };',
                '}',
              ],
              cursor: { line: 0, col: 0 },
            },
            goal: {
              text: [
                'export async function loadPair(id: string) {',
                '  const user = await db.users.findOne({ id });',
                '  const admin = await db.users.findOne({ id });',
                '  return { user, admin };',
                '}',
              ],
            },
            solution: 'jfaYj$p',
          },
          {
            prompt: 'Give the second link the same URL.',
            setup: {
              name: 'links.md',
              text: ['Read the [docs] or the [manual].', '', '[docs]: https://neovim.io/doc/user/', '[manual]: '],
              cursor: { line: 0, col: 0 },
            },
            goal: {
              text: [
                'Read the [docs] or the [manual].',
                '',
                '[docs]: https://neovim.io/doc/user/',
                '[manual]: https://neovim.io/doc/user/',
              ],
            },
            solution: 'jjfhYj$p',
          },
        ],
      },
    },
    {
      id: 'join-lines',
      title: 'Join Lines',
      chips: ['J', 'gJ'],
      keyCards: [
        { key: 'J', glyph: '⤶', label: 'join with space' },
        { key: 'gJ', glyph: '⤶', label: 'join, no space' },
      ],
      intro: (
        <>
          <p>
            <Code>J</Code> pulls the next line up onto this one. It drops the next line's indent and puts a single space
            between them. <Code>gJ</Code> joins exactly as the text is: no space added, no indent removed.
          </p>
          <p>
            A count joins that many lines: <Code>3J</Code> folds a short three-line object into one. Use{' '}
            <Code>gJ</Code> for things that were never meant to have a space, like a string or URL that got split.
          </p>
          <BeforeAfter lines={['local opts =', '  { silent = true }']} cursor={0} keys="J" />
          <BeforeAfter lines={["const key = 'session_", "token';"]} cursor={0} keys="gJ" />
        </>
      ),
      practice: total => (
        <p>
          Join the lines to match the goal. Choose <Code>J</Code> or <Code>gJ</Code> by whether you want the space.{' '}
          {total} rounds.
        </p>
      ),
      aside: {
        title: 'Comments join cleanly',
        body: (
          <p>
            Neovim's default <Code>formatoptions</Code> includes <Code>j</Code>, so joining two <Code>//</Code> comment
            lines removes the second <Code>//</Code>. Classic Vim leaves it in.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        base: { name: 'notes.md' },
        rounds: [
          {
            prompt: 'Join the sentence back into one line.',
            setup: {
              text: ['# Modes', '', 'Vim is a modal editor.', 'Normal mode is home.'],
              cursor: { line: 0, col: 0 },
            },
            goal: { text: ['# Modes', '', 'Vim is a modal editor. Normal mode is home.'] },
            solution: 'jjJ',
          },
          {
            prompt: 'Put the table on one line.',
            setup: {
              name: 'keymaps.lua',
              text: [
                'local opts =',
                '  { noremap = true, silent = true }',
                "vim.keymap.set('n', '<leader>w', '<cmd>w<CR>', opts)",
              ],
              cursor: { line: 2, col: 0 },
            },
            goal: {
              text: ['local opts = { noremap = true, silent = true }', "vim.keymap.set('n', '<leader>w', '<cmd>w<CR>', opts)"],
            },
            solution: 'kkJ',
          },
          {
            prompt: 'Fold compilerOptions onto one line.',
            setup: {
              name: 'tsconfig.json',
              text: ['{', '  "extends": "./base.json",', '  "compilerOptions": {', '    "strict": true', '  }', '}'],
              cursor: { line: 0, col: 0 },
            },
            goal: { text: ['{', '  "extends": "./base.json",', '  "compilerOptions": { "strict": true }', '}'] },
            solution: 'jj3J',
          },
          {
            prompt: 'Repair the split URL.',
            setup: {
              text: ['## Further reading', '', 'Read [this](https://neovim.io/doc/', 'user/motion.html).'],
              cursor: { line: 0, col: 0 },
            },
            goal: { text: ['## Further reading', '', 'Read [this](https://neovim.io/doc/user/motion.html).'] },
            solution: 'jjgJ',
          },
          {
            prompt: 'Repair the split key.',
            setup: {
              name: 'cache.ts',
              text: ['export function cacheKey(id: string) {', "  const key = 'session_", "token';", '  return `${key}:${id}`;', '}'],
              cursor: { line: 0, col: 0 },
            },
            goal: { text: ['export function cacheKey(id: string) {', "  const key = 'session_token';", '  return `${key}:${id}`;', '}'] },
            solution: 'jgJ',
          },
        ],
      },
    },
    {
      id: 'repeat-last-change',
      title: 'Repeat Last Change',
      chips: ['.'],
      keyCards: [{ key: '.', glyph: '↻', label: 'repeat change' }],
      intro: (
        <>
          <p>
            <Code>.</Code> repeats your last change: the whole thing, including any text you typed in insert mode. After{' '}
            <Code>cwlet</Code>, a <Code>.</Code> on another word changes it to <Code>let</Code> too.
          </p>
          <p>
            It rewards making each change a single, repeatable action. Do it once properly, then move and press{' '}
            <Code>.</Code> for every other place it's needed.
          </p>
          <BeforeAfter
            lines={["const a = require('a')", "const b = require('b')", "const c = require('c')"]}
            cursor={0}
            keys="A;<Esc>j.j."
          />
        </>
      ),
      practice: total => (
        <p>
          Make the first edit, then repeat it with <Code>.</Code> instead of typing it again. {total} rounds.
        </p>
      ),
      aside: {
        title: 'Motions are not changes',
        body: (
          <p>
            <Code>.</Code> only repeats edits, never moves, so you're free to move between repeats. <Code>A;</Code> is
            one change; <Code>$a;</Code> is a motion plus a change, which is why <Code>A</Code> repeats better.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        base: { name: 'legacy.js' },
        rounds: [
          {
            prompt: 'Add the missing semicolons.',
            setup: { text: ["const a = require('a')", "const b = require('b')", "const c = require('c')"], cursor: { line: 0, col: 0 } },
            goal: { text: ["const a = require('a');", "const b = require('b');", "const c = require('c');"] },
            solution: 'A;<Esc>j.j.',
          },
          {
            prompt: 'Change each var to let.',
            setup: { text: ['var count = 0;', 'var total = 0;', 'var label = "";'], cursor: { line: 0, col: 0 } },
            goal: { text: ['let count = 0;', 'let total = 0;', 'let label = "";'] },
            solution: 'cwlet<Esc>j0.j0.',
          },
          {
            prompt: 'Delete every console.log line.',
            setup: {
              text: ['function save(doc) {', "  console.log('saving');", '  db.put(doc);', "  console.log('saved');", '}'],
              cursor: { line: 1, col: 2 },
            },
            goal: { text: ['function save(doc) {', '  db.put(doc);', '}'] },
            solution: 'ddj.',
          },
          {
            prompt: 'Drop the second argument from each call.',
            setup: {
              name: 'keymaps.lua',
              text: ["map('<leader>ff', 'n', find_files)", "map('<leader>fg', 'n', live_grep)", "map('<leader>fb', 'n', buffers)"],
              cursor: { line: 0, col: 0 },
            },
            goal: { text: ["map('<leader>ff', find_files)", "map('<leader>fg', live_grep)", "map('<leader>fb', buffers)"] },
            solution: 'f,ldf,j.j.',
          },
          {
            prompt: 'Uncheck all three tasks.',
            setup: { name: 'TODO.md', text: ['- [x] Write tests', '- [x] Fix the parser', '- [x] Tag a release'], cursor: { line: 2, col: 0 } },
            goal: { text: ['- [ ] Write tests', '- [ ] Fix the parser', '- [ ] Tag a release'] },
            solution: 'fxr k.k.',
          },
        ],
      },
    },
    {
      id: 'counts-operators',
      title: 'Counts & Operators',
      chips: ['3dw', 'd3w'],
      keyCards: [
        { key: '3dw', glyph: '×3', label: 'do dw 3 times' },
        { key: 'd3w', glyph: '→3', label: 'delete 3 words' },
      ],
      intro: (
        <>
          <p>
            A count can go before the operator or before the motion. <Code>3dw</Code> means "delete a word, three times";{' '}
            <Code>d3w</Code> means "delete three words". The result is the same.
          </p>
          <p>
            Counts work everywhere: <Code>3dd</Code> deletes three lines, <Code>c2w</Code> changes two words,{' '}
            <Code>2yy</Code> yanks two lines. One command beats three repeats.
          </p>
          <BeforeAfter lines={['Keep your commits very, very small.']} cursor={18} keys="d3w" />
        </>
      ),
      practice: total => (
        <p>
          Do each edit as one counted command. {total} rounds.
        </p>
      ),
      aside: {
        title: 'Counts multiply',
        body: (
          <p>
            With both, they multiply: <Code>2d3w</Code> deletes six words. Most people keep the count on the motion,
            because <Code>d3w</Code> reads like the sentence "delete three words".
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        base: { name: 'handler.ts' },
        rounds: [
          {
            prompt: 'Delete "default async ".',
            setup: {
              text: [
                "import type { Req, Res } from './types';",
                '',
                'export default async function handler(req, res) {',
                '  res.json(await load(req.query));',
                '}',
              ],
              cursor: { line: 3, col: 0 },
            },
            goal: {
              text: [
                "import type { Req, Res } from './types';",
                '',
                'export function handler(req, res) {',
                '  res.json(await load(req.query));',
                '}',
              ],
            },
            solution: 'kwd2w',
          },
          {
            prompt: 'Delete the whole retry block.',
            setup: {
              text: ['const res = await fetch(url);', 'if (!res.ok) {', '  await sleep(500);', '  return retry(url);', '}', 'return res.json();'],
              cursor: { line: 1, col: 0 },
            },
            goal: { text: ['const res = await fetch(url);', 'return res.json();'] },
            solution: '4dd',
          },
          {
            prompt: 'Change "config.server" to "env".',
            setup: {
              text: ["import config from './config';", '', 'const port = config.server.port;', 'app.listen(port);'],
              cursor: { line: 0, col: 0 },
            },
            goal: { text: ["import config from './config';", '', 'const port = env.port;', 'app.listen(port);'] },
            solution: 'jjfcc3wenv<Esc>',
          },
          {
            prompt: 'Delete "very, very ".',
            setup: {
              name: 'README.md',
              text: ['# Contributing', '', 'Keep your commits very, very small.', 'One idea per commit.'],
              cursor: { line: 0, col: 0 },
            },
            goal: { text: ['# Contributing', '', 'Keep your commits small.', 'One idea per commit.'] },
            solution: 'jjfvd3w',
          },
          {
            prompt: 'Duplicate both lines of the setting below.',
            setup: {
              name: 'options.lua',
              text: ['vim.opt.number = true', '-- Indent with two spaces', 'vim.opt.shiftwidth = 2'],
              cursor: { line: 0, col: 0 },
            },
            goal: {
              text: [
                'vim.opt.number = true',
                '-- Indent with two spaces',
                'vim.opt.shiftwidth = 2',
                '-- Indent with two spaces',
                'vim.opt.shiftwidth = 2',
              ],
            },
            solution: 'j2yyjp',
          },
        ],
      },
    },
    {
      id: 'boss-tidy-function',
      title: 'Boss: Tidy a Function',
      boss: true,
      chips: ['cw', 'dt', 'dd', '.'],
      keyCards: [
        { key: 'cw', glyph: '✎', label: 'change word' },
        { key: 'dt', glyph: '→|x', glyphColor: 'var(--red)', label: 'delete till' },
        { key: 'dd', glyph: '⌫', glyphColor: 'var(--red)', label: 'delete line' },
        { key: '.', glyph: '↻', label: 'repeat' },
      ],
      intro: (
        <>
          <p>
            A working function that nobody tidied: a vague name, a debug flag, leftover logs, a stale comment. Clean it up
            one edit at a time, using everything from this section.
          </p>
          <p>
            Each round picks up where the last one left off. Think in operator and motion before you touch a key; par
            is set by the shortest idiomatic edit.
          </p>
        </>
      ),
      practice: total => (
        <p>
          Five cleanups on the same function. Green marks show what to add, red what to remove. {total} rounds.
        </p>
      ),
      aside: {
        title: 'Plan, then type',
        body: (
          <p>
            Before each edit, ask where it ends: at a character (<Code>t</Code>, <Code>f</Code>), a word (
            <Code>w</Code>), the line end (<Code>D</Code>, <Code>C</Code>) or a whole line (<Code>dd</Code>). That
            answer is the motion.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        base: { name: 'order.ts' },
        rounds: [
          {
            prompt: 'Rename calc to orderTotal.',
            setup: {
              text: [
                'function calc(items, taxRate, debug) {',
                "  console.log('calc called');",
                '  let total = 0;',
                '  for (const item of items) {',
                '    total += item.price * item.qty;',
                '  }',
                '  if (debug) console.log(total);',
                '  return total * (1 + taxRate); // TODO: rounding?',
                '}',
              ],
              cursor: { line: 0, col: 0 },
            },
            goal: {
              text: [
                'function orderTotal(items, taxRate, debug) {',
                "  console.log('calc called');",
                '  let total = 0;',
                '  for (const item of items) {',
                '    total += item.price * item.qty;',
                '  }',
                '  if (debug) console.log(total);',
                '  return total * (1 + taxRate); // TODO: rounding?',
                '}',
              ],
            },
            solution: 'wcworderTotal<Esc>',
          },
          {
            prompt: 'Drop the debug parameter.',
            setup: {
              text: [
                'function orderTotal(items, taxRate, debug) {',
                "  console.log('calc called');",
                '  let total = 0;',
                '  for (const item of items) {',
                '    total += item.price * item.qty;',
                '  }',
                '  if (debug) console.log(total);',
                '  return total * (1 + taxRate); // TODO: rounding?',
                '}',
              ],
              cursor: { line: 2, col: 2 },
            },
            goal: {
              text: [
                'function orderTotal(items, taxRate) {',
                "  console.log('calc called');",
                '  let total = 0;',
                '  for (const item of items) {',
                '    total += item.price * item.qty;',
                '  }',
                '  if (debug) console.log(total);',
                '  return total * (1 + taxRate); // TODO: rounding?',
                '}',
              ],
            },
            solution: 'gg2f,dt)',
          },
          {
            prompt: 'Delete both debug lines.',
            setup: {
              text: [
                'function orderTotal(items, taxRate) {',
                "  console.log('calc called');",
                '  let total = 0;',
                '  for (const item of items) {',
                '    total += item.price * item.qty;',
                '  }',
                '  if (debug) console.log(total);',
                '  return total * (1 + taxRate); // TODO: rounding?',
                '}',
              ],
              cursor: { line: 0, col: 0 },
            },
            goal: {
              text: [
                'function orderTotal(items, taxRate) {',
                '  let total = 0;',
                '  for (const item of items) {',
                '    total += item.price * item.qty;',
                '  }',
                '  return total * (1 + taxRate); // TODO: rounding?',
                '}',
              ],
            },
            solution: 'jdd4j.',
          },
          {
            prompt: 'Replace the price maths with lineTotal(item).',
            setup: {
              text: [
                'function orderTotal(items, taxRate) {',
                '  let total = 0;',
                '  for (const item of items) {',
                '    total += item.price * item.qty;',
                '  }',
                '  return total * (1 + taxRate); // TODO: rounding?',
                '}',
              ],
              cursor: { line: 2, col: 2 },
            },
            goal: {
              text: [
                'function orderTotal(items, taxRate) {',
                '  let total = 0;',
                '  for (const item of items) {',
                '    total += lineTotal(item);',
                '  }',
                '  return total * (1 + taxRate); // TODO: rounding?',
                '}',
              ],
            },
            solution: 'jf=wct;lineTotal(item)<Esc>',
          },
          {
            prompt: 'Remove the stale comment.',
            setup: {
              text: [
                'function orderTotal(items, taxRate) {',
                '  let total = 0;',
                '  for (const item of items) {',
                '    total += lineTotal(item);',
                '  }',
                '  return total * (1 + taxRate); // TODO: rounding?',
                '}',
              ],
              cursor: { line: 2, col: 2 },
            },
            goal: {
              text: [
                'function orderTotal(items, taxRate) {',
                '  let total = 0;',
                '  for (const item of items) {',
                '    total += lineTotal(item);',
                '  }',
                '  return total * (1 + taxRate);',
                '}',
              ],
            },
            solution: '3jf;lD',
          },
        ],
      },
    },
  ],
};
