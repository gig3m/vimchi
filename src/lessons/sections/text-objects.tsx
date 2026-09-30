import { Code } from '../../components/Code';
import { BeforeAfter, Objects } from '../../components/diagrams';
import type { Section } from '../types';

export const textObjects: Section = {
  id: 'text-objects',
  title: 'Text Objects',
  band: 'core',
  lessons: [
    {
      id: 'intro-text-objects',
      title: 'Intro to Text Objects',
      chips: ['iw', 'aw', 'i"', 'i('],
      keyCards: [
        { key: 'i', glyph: '[x]', label: 'inner', sub: 'just the thing' },
        { key: 'a', glyph: '[ x ]', label: 'around', sub: 'plus space or pair' },
      ],
      intro: (
        <>
          <p>
            A motion says where to go; a text object says what to act on. After an operator, <Code>i</Code> means inner
            and <Code>a</Code> means around, then one more key names the object: <Code>w</Code> for a word,{' '}
            <Code>"</Code> for a quoted string, <Code>(</Code> for parentheses.
          </p>
          <p>
            The cursor can be anywhere inside the object. <Code>diw</Code> deletes the word under the cursor whether
            you're on its first letter or its last, so you stop steering to the start of things.
          </p>
          <BeforeAfter
            lines={['const itemCount = cart.items.length;']}
            cursor={10}
            keys="ciwcount<Esc>"
            caption={<><Code>c</Code> (change) + <Code>iw</Code> (inner word), from mid-word</>}
          />
          <BeforeAfter
            lines={['cart.clear(true, "reset");']}
            cursor={14}
            keys="di("
            caption={<><Code>d</Code> (delete) + <Code>i(</Code> (inside parentheses)</>}
          />
        </>
      ),
      practice: total => (
        <p>
          Put an operator in front of a text object: <Code>diw</Code>, <Code>ciw</Code>, <Code>daw</Code>,{' '}
          <Code>ci"</Code>. Get into the object, anywhere in it, then act. {total} rounds.
        </p>
      ),
      aside: {
        title: 'Say it out loud',
        body: (
          <p>
            Read commands as sentences: <Code>ciw</Code> is "change inner word", <Code>da(</Code> is "delete around
            parentheses". If you can say it, you can type it.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        base: { name: 'cart.ts' },
        rounds: [
          {
            prompt: 'Rename "itemCount" to "count" with ciw.',
            setup: {
              text: [
                'export function isEmpty(cart: Cart) {',
                '  const itemCount = cart.items.length;',
                '  return count === 0;',
                '}',
              ],
              cursor: { line: 0, col: 0 },
            },
            goal: {
              text: [
                'export function isEmpty(cart: Cart) {',
                '  const count = cart.items.length;',
                '  return count === 0;',
                '}',
              ],
            },
            solution: 'jfCciwcount<Esc>',
          },
          {
            prompt: 'Delete both "very"s and their spaces: daw, then . on the next line.',
            setup: {
              name: 'README.md',
              text: [
                '# vimchi',
                '',
                'This is a very short guide.',
                'It covers the very keys you use.',
              ],
              cursor: { line: 0, col: 0 },
            },
            goal: {
              text: [
                '# vimchi',
                '',
                'This is a short guide.',
                'It covers the keys you use.',
              ],
            },
            solution: 'jjfvdawjfv.',
          },
          {
            prompt: 'Change the string to "dark" with ci".',
            setup: {
              text: [
                'const theme = "light";',
                'applyTheme(theme);',
                'savePrefs({ theme });',
              ],
              cursor: { line: 0, col: 17 },
            },
            goal: {
              text: [
                'const theme = "dark";',
                'applyTheme(theme);',
                'savePrefs({ theme });',
              ],
            },
            solution: 'ci"dark<Esc>',
          },
          {
            prompt: 'Empty both argument lists: di(, then . on the next line.',
            setup: {
              text: [
                'export function reset(cart: Cart) {',
                '  cart.clear(true, "reset");',
                '  cache.clear(true);',
                '}',
              ],
              cursor: { line: 0, col: 0 },
            },
            goal: {
              text: [
                'export function reset(cart: Cart) {',
                '  cart.clear();',
                '  cache.clear();',
                '}',
              ],
            },
            solution: 'jf(di(j.',
          },
          {
            prompt: 'Poll every second instead of every five.',
            setup: {
              text: [
                "const poll = () => fetch('/api/status');",
                'setInterval(poll, 5000);',
                "window.addEventListener('focus', poll);",
              ],
              cursor: { line: 0, col: 0 },
            },
            goal: {
              text: [
                "const poll = () => fetch('/api/status');",
                'setInterval(poll, 1000);',
                "window.addEventListener('focus', poll);",
              ],
            },
            solution: 'jf5ciw1000<Esc>',
          },
        ],
      },
    },
    {
      id: 'word-objects',
      title: 'Word Objects',
      chips: ['iw', 'aw'],
      keyCards: [
        { key: 'iw', glyph: '[w]', label: 'inner word' },
        { key: 'aw', glyph: '[w ]', label: 'a word', sub: 'with its space' },
      ],
      intro: (
        <>
          <p>
            <Code>iw</Code> is the word under the cursor. <Code>aw</Code> is the word plus the space after it, or the
            space before it when the word ends the line.
          </p>
          <p>
            Change with <Code>ciw</Code>, since you want the gap kept for the new word. Delete with <Code>daw</Code>,
            since you want the gap gone too.
          </p>
          <Objects text="tests are really easy to review" cursor={12} objects={['iw', 'aw']} />
        </>
      ),
      practice: total => (
        <p>
          Land anywhere in the word, then <Code>ciw</Code> to rename or <Code>daw</Code> to remove. {total} rounds.
        </p>
      ),
      aside: {
        title: 'Better than dw',
        body: (
          <p>
            <Code>daw</Code> repeats well with <Code>.</Code> because it doesn't care where in the word you are.{' '}
            <Code>dw</Code> only works from the first letter.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        base: { name: 'orders.ts' },
        rounds: [
          {
            prompt: 'Rename "orderList" to "orders".',
            setup: {
              text: [
                'const orders = await loadOrders();',
                'for (const order of orderList) {',
                '  ship(order);',
                '}',
              ],
              cursor: { line: 0, col: 0 },
            },
            goal: {
              text: [
                'const orders = await loadOrders();',
                'for (const order of orders) {',
                '  ship(order);',
                '}',
              ],
            },
            solution: 'jfLciworders<Esc>',
          },
          {
            prompt: 'Delete "really" from both lines.',
            setup: {
              name: 'CONTRIBUTING.md',
              text: [
                '## Pull requests',
                '',
                'Small pull requests are really easy to review.',
                'Keep each one really small.',
              ],
              cursor: { line: 0, col: 0 },
            },
            goal: {
              text: [
                '## Pull requests',
                '',
                'Small pull requests are easy to review.',
                'Keep each one small.',
              ],
            },
            solution: 'jjfydawj0fy.',
          },
          {
            prompt: 'Delete "again" at the end of the line.',
            setup: {
              name: 'CONTRIBUTING.md',
              text: [
                '## Before you push',
                '',
                'Run the tests before you push again',
                'and check the linter output.',
              ],
              cursor: { line: 3, col: 10 },
            },
            goal: {
              text: [
                '## Before you push',
                '',
                'Run the tests before you push',
                'and check the linter output.',
              ],
            },
            solution: 'k$daw',
          },
          {
            prompt: 'Raise the timeout to 10000.',
            setup: {
              name: 'config.json',
              text: [
                '{',
                '  "retries": 3,',
                '  "timeout": 3000,',
                '  "verbose": false',
                '}',
              ],
              cursor: { line: 0, col: 0 },
            },
            goal: {
              text: [
                '{',
                '  "retries": 3,',
                '  "timeout": 10000,',
                '  "verbose": false',
                '}',
              ],
            },
            solution: 'jjf3ciw10000<Esc>',
          },
          {
            prompt: 'Turn both "false" flags to "true".',
            setup: {
              name: 'options.lua',
              text: [
                'vim.opt.smartcase = true',
                'vim.opt.ignorecase = false',
                'vim.opt.hlsearch = false',
              ],
              cursor: { line: 1, col: 23 },
            },
            goal: {
              text: [
                'vim.opt.smartcase = true',
                'vim.opt.ignorecase = true',
                'vim.opt.hlsearch = true',
              ],
            },
            solution: 'ciwtrue<Esc>j.',
          },
          {
            prompt: 'Delete the stray "async".',
            setup: {
              text: [
                "import { db } from './db';",
                '',
                'export async function async loadOrders() {',
                '  return db.orders.all();',
                '}',
              ],
              cursor: { line: 3, col: 0 },
            },
            goal: {
              text: [
                "import { db } from './db';",
                '',
                'export async function loadOrders() {',
                '  return db.orders.all();',
                '}',
              ],
            },
            solution: 'k3wdaw',
          },
        ],
      },
    },
    {
      id: 'word-objects-big',
      title: 'WORD Objects',
      chips: ['iW', 'aW'],
      keyCards: [
        { key: 'iW', glyph: '[W]', label: 'inner WORD' },
        { key: 'aW', glyph: '[W ]', label: 'a WORD', sub: 'with its space' },
      ],
      intro: (
        <>
          <p>
            A WORD is everything between spaces, punctuation included. <Code>ciW</Code> on <Code>user.profile.name</Code>{' '}
            takes the whole path; <Code>ciw</Code> would take one piece.
          </p>
          <p>
            Reach for the capital version with paths, URLs, flags like <Code>--no-verify</Code>, and chained property
            access: anything a space separates but punctuation doesn't.
          </p>
          <Objects text="const port = config.server.port || 3000;" cursor={22} objects={['iw', 'iW', 'aW']} />
        </>
      ),
      practice: total => (
        <p>
          Change or delete the whole space-separated chunk with <Code>ciW</Code> or <Code>daW</Code>. {total} rounds.
        </p>
      ),
      aside: {
        title: 'Watch the edges',
        body: (
          <p>
            A WORD grabs punctuation on both ends too. In <Code>f(a.b)</Code>, <Code>ciW</Code> takes the whole call, so
            use <Code>ci(</Code> for what's inside brackets.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        base: { name: 'server.ts' },
        rounds: [
          {
            prompt: 'Replace the config path with PORT.',
            setup: {
              text: [
                "import config from './config';",
                '',
                'const port = config.server.port || 3000;',
                'app.listen(port);',
              ],
              cursor: { line: 3, col: 0 },
            },
            goal: {
              text: [
                "import config from './config';",
                '',
                'const port = PORT || 3000;',
                'app.listen(port);',
              ],
            },
            solution: 'k3wciWPORT<Esc>',
          },
          {
            prompt: 'Remove --no-verify from both commands.',
            setup: {
              name: 'release.sh',
              text: [
                '#!/usr/bin/env bash',
                'npm run build',
                'git commit --no-verify -m "release"',
                'git push --no-verify --follow-tags',
              ],
              cursor: { line: 0, col: 0 },
            },
            goal: {
              text: [
                '#!/usr/bin/env bash',
                'npm run build',
                'git commit -m "release"',
                'git push --follow-tags',
              ],
            },
            solution: 'jjf-daWj.',
          },
          {
            prompt: 'Both links are dead: replace each one with TBD.',
            setup: {
              name: 'README.md',
              text: [
                '# vimchi',
                '',
                'Docs: https://old.example.com/docs',
                'Wiki: https://old.example.com/wiki',
              ],
              cursor: { line: 0, col: 0 },
            },
            goal: {
              text: [
                '# vimchi',
                '',
                'Docs: TBD',
                'Wiki: TBD',
              ],
            },
            solution: 'jjWciWTBD<Esc>j.',
          },
          {
            prompt: 'Replace the whole optional chain with user.',
            setup: {
              text: [
                'function displayName(data: Payload) {',
                "  const name = data?.user?.profile?.name ?? 'anon';",
                '  return name.trim();',
                '}',
              ],
              cursor: { line: 1, col: 22 },
            },
            goal: {
              text: [
                'function displayName(data: Payload) {',
                "  const name = user ?? 'anon';",
                '  return name.trim();',
                '}',
              ],
            },
            solution: 'ciWuser<Esc>',

          },
          {
            prompt: 'Delete the bold "really".',
            setup: {
              name: 'guide.md',
              text: [
                '## Setup',
                '',
                'This step is **really** required.',
                'Skip it and nothing loads.',
              ],
              cursor: { line: 0, col: 0 },
            },
            goal: {
              text: [
                '## Setup',
                '',
                'This step is required.',
                'Skip it and nothing loads.',
              ],
            },
            solution: 'jjf*daW',
          },
        ],
      },
    },
    {
      id: 'text-objects-quotes',
      title: 'Quotes',
      chips: ['i"', "i'", 'i`'],
      keyCards: [
        { key: 'i"', glyph: '"x"', label: 'inside "…"' },
        { key: "i'", glyph: "'x'", label: "inside '…'" },
        { key: 'i`', glyph: '`x`', label: 'inside `…`' },
      ],
      intro: (
        <>
          <p>
            <Code>i"</Code>, <Code>i'</Code> and <Code>i`</Code> select the text inside a pair of quotes on the current
            line. <Code>ci"</Code> is the fastest way to replace a string.
          </p>
          <Objects text={'const msg = "hello world";'} cursor={16} objects={['i"', 'a"']} />
          <p>
            The <Code>a</Code> versions take the quotes too, plus any trailing whitespace. The cursor can be inside the
            string or on either of its quote marks. Quotes never span lines, so these objects only look at the cursor's
            line: when the string is further down, move to its line first.
          </p>
        </>
      ),
      practice: total => (
        <p>
          Change or empty each string without touching its quotes. Some are on other lines, so get there first.{' '}
          {total} rounds.
        </p>
      ),
      aside: {
        title: 'Escapes are skipped',
        body: (
          <p>
            A backslash-escaped quote doesn't end the string, so <Code>ci"</Code> inside <Code>"say \"hi\""</Code> takes
            the whole thing.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        base: { name: 'package.json' },
        rounds: [
          {
            prompt: 'Name the package "app" and point main at "src".',
            setup: {
              text: [
                '{',
                '  "name": "vim-tutor-draft",',
                '  "main": "dist/index.js",',
                '  "private": true',
                '}',
              ],
              cursor: { line: 0, col: 0 },
            },
            goal: {
              text: [
                '{',
                '  "name": "app",',
                '  "main": "src",',
                '  "private": true',
                '}',
              ],
            },
            solution: 'jfvci"app<Esc>jci"src<Esc>',
          },
          {
            prompt: 'Switch the theme to nord.',
            setup: {
              name: 'lualine.lua',
              text: [
                "require('lualine').setup({",
                "  options = { theme = 'gruvbox' },",
                "  sections = { lualine_c = { 'filename' } },",
                '})',
              ],
              cursor: { line: 3, col: 0 },
            },
            goal: {
              text: [
                "require('lualine').setup({",
                "  options = { theme = 'nord' },",
                "  sections = { lualine_c = { 'filename' } },",
                '})',
              ],
            },
            solution: "kkfgci'nord<Esc>",
          },
          {
            prompt: 'Bump the API version to v2.',
            setup: {
              name: 'api.ts',
              text: [
                'export async function listUsers() {',
                '  const ver = `v1`;',
                '  return fetch(`/api/${ver}/users`);',
                '}',
              ],
              cursor: { line: 1, col: 15 },
            },
            goal: {
              text: [
                'export async function listUsers() {',
                '  const ver = `v2`;',
                '  return fetch(`/api/${ver}/users`);',
                '}',
              ],
            },
            solution: 'ci`v2<Esc>',
          },
          {
            prompt: 'Clear both hard-coded secrets: di", then . on the next line.',
            setup: {
              name: 'env.ts',
              text: [
                'export const env = {',
                '  apiUrl: "https://api.example.com",',
                '  token: "sk-live-4f9a2c",',
                '  secret: "hunter2",',
                '};',
              ],
              cursor: { line: 0, col: 0 },
            },
            goal: {
              text: [
                'export const env = {',
                '  apiUrl: "https://api.example.com",',
                '  token: "",',
                '  secret: "",',
                '};',
              ],
            },
            solution: 'jjf"di"j.',
          },
          {
            prompt: 'Change the scheme from the opening quote.',
            setup: {
              name: 'init.lua',
              text: [
                'vim.opt.termguicolors = true',
                "vim.cmd.colorscheme 'catppuccin'",
                "vim.opt.background = 'dark'",
              ],
              cursor: { line: 1, col: 20 },
            },
            goal: {
              text: [
                'vim.opt.termguicolors = true',
                "vim.cmd.colorscheme 'desert'",
                "vim.opt.background = 'dark'",
              ],
            },
            solution: "ci'desert<Esc>",
          },
        ],
      },
    },
    {
      id: 'text-objects-parens',
      title: 'Parentheses',
      chips: ['i(', 'a(', 'ib'],
      keyCards: [
        { key: 'i(', glyph: '(x)', label: 'inside parens' },
        { key: 'a(', glyph: '[(x)]', label: 'parens and all' },
        { key: 'ib', glyph: '(x)', label: 'same as i(', sub: 'b for block' },
      ],
      intro: (
        <>
          <p>
            <Code>i(</Code> selects everything between the nearest enclosing parentheses. <Code>a(</Code> includes the
            parentheses themselves. <Code>ib</Code> and <Code>ab</Code> are the same objects, easier to type.
          </p>
          <p>
            The cursor can be deep inside: in <Code>fetch(url, {'{ retries: 3 }'})</Code>, <Code>di(</Code> from{' '}
            <Code>retries</Code> still empties the call. <Code>)</Code> works as well as <Code>(</Code>.
          </p>
          <Objects text="Math.max(0, Math.min(x, 10))" cursor={21} objects={['i(', 'a(', '2i(']} />
        </>
      ),
      practice: total => (
        <p>
          Change or delete the contents of the parentheses. Anywhere inside them will do. {total} rounds.
        </p>
      ),
      aside: {
        title: 'Counts climb outward',
        body: (
          <p>
            <Code>d2i(</Code> skips the innermost pair and works on the one around it. Handy in nested calls like{' '}
            <Code>max(0, min(x, 10))</Code>.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        base: { name: 'greet.ts' },
        rounds: [
          {
            prompt: 'Pass the whole user to both calls: ci(, then . on the next line.',
            setup: {
              text: [
                'const user = await loadUser(id);',
                'greet(user.firstName, user.lastName);',
                'track(user.id, user.email);',
              ],
              cursor: { line: 0, col: 0 },
            },
            goal: {
              text: [
                'const user = await loadUser(id);',
                'greet(user);',
                'track(user);',
              ],
            },
            solution: 'jfFci(user<Esc>j.',
          },
          {
            prompt: 'Drop the parentheses in both arrow functions.',
            setup: {
              text: [
                'const double = (n) => n * 2;',
                'const triple = (n) => n * 3;',
                'export { double, triple };',
              ],
              cursor: { line: 2, col: 0 },
            },
            goal: {
              text: [
                'const double = n => n * 2;',
                'const triple = n => n * 3;',
                'export { double, triple };',
              ],
            },
            solution: 'kkf(ca(n<Esc>j.',
          },
          {
            prompt: 'Empty the call from inside the options.',
            setup: {
              name: 'fetch.ts',
              text: [
                'export async function load(url: string) {',
                '  const res = await fetchWithRetry(url, { retries: 3 });',
                '  return res.json();',
                '}',
              ],
              cursor: { line: 1, col: 44 },
            },
            goal: {
              text: [
                'export async function load(url: string) {',
                '  const res = await fetchWithRetry();',
                '  return res.json();',
                '}',
              ],
            },
            solution: 'dib',
          },
          {
            prompt: 'Simplify to Math.max(v, 0).',
            setup: {
              name: 'clamp.ts',
              text: [
                'export function clamp(v: number) {',
                '  return Math.max(0, Math.min(v, 99));',
                '}',
              ],
              cursor: { line: 1, col: 19 },
            },
            goal: {
              text: [
                'export function clamp(v: number) {',
                '  return Math.max(v, 0);',
                '}',
              ],
            },
            solution: 'ci(v, 0<Esc>',
          },
          {
            prompt: 'Print the msg variable.',
            setup: {
              name: 'main.go',
              text: [
                'func main() {',
                '\tmsg := "Hello, " + os.Args[1]',
                '\tfmt.Println("Hello,", name)',
                '}',
              ],
              cursor: { line: 0, col: 0 },
            },
            goal: {
              text: [
                'func main() {',
                '\tmsg := "Hello, " + os.Args[1]',
                '\tfmt.Println(msg)',
                '}',
              ],
            },
            solution: 'jjf,cibmsg<Esc>',
          },
        ],
      },
    },
    {
      id: 'text-objects-brackets',
      title: 'Brackets & Braces',
      chips: ['i[', 'i{', 'iB'],
      keyCards: [
        { key: 'i[', glyph: '[x]', label: 'inside [ ]' },
        { key: 'i{', glyph: '{x}', label: 'inside { }' },
        { key: 'iB', glyph: '{x}', label: 'same as i{', sub: 'B for Block' },
      ],
      intro: (
        <>
          <p>
            Square brackets and braces work like parentheses: <Code>i[</Code> is inside an array, <Code>i{'{'}</Code>{' '}
            inside an object or block. <Code>iB</Code> is another name for <Code>i{'{'}</Code>.
          </p>
          <p>
            On a block that spans lines, <Code>di{'{'}</Code> deletes the lines inside and leaves the braces on their
            own lines, ready for a new body.
          </p>
          <Objects text="const opts = { tags: ['a', 'b'] };" cursor={23} objects={['i[', 'i{', 'a{']} />
        </>
      ),
      practice: total => (
        <p>
          Change or empty what's inside the nearest brackets or braces. {total} rounds.
        </p>
      ),
      aside: {
        title: 'Angle brackets too',
        body: (
          <p>
            <Code>i{'<'}</Code> works on angle brackets, which is handy for TypeScript generics like{' '}
            <Code>Promise{'<User[]>'}</Code>.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        base: { name: 'data.ts' },
        rounds: [
          {
            prompt: 'Empty both arrays: di[, then . on the next line.',
            setup: {
              text: [
                'const primes = [2, 3, 5, 7, 11];',
                'const evens = [2, 4, 6];',
                'console.log(primes, evens);',
              ],
              cursor: { line: 2, col: 0 },
            },
            goal: {
              text: [
                'const primes = [];',
                'const evens = [];',
                'console.log(primes, evens);',
              ],
            },
            solution: 'kkf5di[j.',
          },
          {
            prompt: 'Empty the options on the first two calls.',
            setup: {
              text: [
                'const a = load({ cache: true });',
                'const b = load({ cache: false });',
                'const c = load({});',
              ],
              cursor: { line: 0, col: 0 },
            },
            goal: {
              text: [
                'const a = load({});',
                'const b = load({});',
                'const c = load({});',
              ],
            },
            solution: 'f{di{j.',

          },
          {
            prompt: 'Clear the function body.',
            setup: {
              name: 'counter.ts',
              text: [
                'function reset() {',
                '  count = 0;',
                '  total = 0;',
                '  history.length = 0;',
                '}',
              ],
              cursor: { line: 0, col: 0 },
            },
            goal: {
              text: [
                'function reset() {',
                '}',
              ],
            },
            solution: 'jdiB',
          },
          {
            prompt: 'Publish only dist.',
            setup: {
              name: 'package.json',
              text: [
                '{',
                '  "name": "vimchi",',
                '  "files": ["dist", "src", "test"],',
                '  "type": "module"',
                '}',
              ],
              cursor: { line: 0, col: 0 },
            },
            goal: {
              text: [
                '{',
                '  "name": "vimchi",',
                '  "files": ["dist"],',
                '  "type": "module"',
                '}',
              ],
            },
            solution: 'jjf[ci["dist"<Esc>',
          },
          {
            prompt: 'Empty the plugin options.',
            setup: {
              name: 'plugins.lua',
              text: [
                'return {',
                "  { 'folke/which-key.nvim', opts = { preset = 'modern' } },",
                "  { 'stevearc/oil.nvim', opts = {} },",
                '}',
              ],
              cursor: { line: 1, col: 40 },
            },
            goal: {
              text: [
                'return {',
                "  { 'folke/which-key.nvim', opts = {} },",
                "  { 'stevearc/oil.nvim', opts = {} },",
                '}',
              ],
            },
            solution: 'di{',
          },
        ],
      },
    },
    {
      id: 'text-objects-tags',
      title: 'Tags',
      chips: ['it', 'at'],
      keyCards: [
        { key: 'it', glyph: '>x<', label: 'inside tag' },
        { key: 'at', glyph: '<>x</>', label: 'whole element' },
      ],
      intro: (
        <>
          <p>
            In HTML, XML and JSX, <Code>it</Code> is the content between an opening and closing tag. <Code>at</Code> is
            the whole element, tags included.
          </p>
          <p>
            It picks the innermost element around the cursor, so <Code>cit</Code> on a link's text changes the link text,
            and on plain paragraph text changes the whole paragraph.
          </p>
          <Objects text={'<p>Read the <a href="/g">guide</a> now.</p>'} cursor={27} objects={['it', 'at', '2it']} />
        </>
      ),
      practice: total => (
        <p>
          Change the text inside a tag with <Code>cit</Code>, or remove an element with <Code>dat</Code>. {total} rounds.
        </p>
      ),
      aside: {
        title: 'On the tag itself',
        body: (
          <p>
            With the cursor on the tag name, <Code>cit</Code> still works on that element. The same goes for the closing
            tag.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        base: { name: 'index.html' },
        rounds: [
          {
            prompt: 'Change the heading to "Home".',
            setup: {
              text: [
                '<main>',
                '  <h1>Welcome back</h1>',
                '  <p>Here is your week.</p>',
                '</main>',
              ],
              cursor: { line: 0, col: 0 },
            },
            goal: {
              text: [
                '<main>',
                '  <h1>Home</h1>',
                '  <p>Here is your week.</p>',
                '</main>',
              ],
            },
            solution: 'jfWcitHome<Esc>',
          },
          {
            prompt: 'Label the button "Save".',
            setup: {
              name: 'Form.tsx',
              text: [
                '<form onSubmit={save}>',
                '  <Input name="email" />',
                '  <Button variant="primary">Submit form</Button>',
                '</form>',
              ],
              cursor: { line: 2, col: 32 },
            },
            goal: {
              text: [
                '<form onSubmit={save}>',
                '  <Input name="email" />',
                '  <Button variant="primary">Save</Button>',
                '</form>',
              ],
            },
            solution: 'citSave<Esc>',
          },
          {
            prompt: 'Remove both icon spans: dat, then . on the next line.',
            setup: {
              text: [
                '<nav>',
                '  <button><span class="icon">+</span>Add</button>',
                '  <button><span class="icon">-</span>Remove</button>',
                '</nav>',
              ],
              cursor: { line: 3, col: 0 },
            },
            goal: {
              text: [
                '<nav>',
                '  <button>Add</button>',
                '  <button>Remove</button>',
                '</nav>',
              ],
            },
            solution: 'kkf+datj.',
          },
          {
            prompt: 'Replace the whole paragraph text with "Soon."',
            setup: {
              text: [
                '<section>',
                '  <h2>Getting started</h2>',
                '  <p>Read the <a href="/guide">guide</a> first.</p>',
                '</section>',
              ],
              cursor: { line: 2, col: 7 },
            },
            goal: {
              text: [
                '<section>',
                '  <h2>Getting started</h2>',
                '  <p>Soon.</p>',
                '</section>',
              ],
            },
            solution: 'citSoon.<Esc>',
          },
          {
            prompt: 'Change the page title.',
            setup: {
              text: [
                '<head>',
                '  <meta charset="utf-8">',
                '  <title>Untitled</title>',
                '</head>',
              ],
              cursor: { line: 0, col: 0 },
            },
            goal: {
              text: [
                '<head>',
                '  <meta charset="utf-8">',
                '  <title>vimchi</title>',
                '</head>',
              ],
            },
            solution: 'jjwcitvimchi<Esc>',
          },
          {
            prompt: 'Mark both list items TBD.',
            setup: {
              text: [
                '<ul>',
                '  <li>Draft one</li>',
                '  <li>Draft two</li>',
                '</ul>',
              ],
              cursor: { line: 0, col: 0 },
            },
            goal: {
              text: [
                '<ul>',
                '  <li>TBD</li>',
                '  <li>TBD</li>',
                '</ul>',
              ],
            },
            solution: 'jfDcitTBD<Esc>j.',
          },
        ],
      },
    },
    {
      id: 'sentences-paragraphs',
      title: 'Sentences & Paragraphs',
      chips: ['is', 'as', 'ip', 'ap'],
      keyCards: [
        { key: 'is', glyph: '[.]', label: 'inner sentence' },
        { key: 'as', glyph: '[. ]', label: 'a sentence', sub: 'with its space' },
        { key: 'ip', glyph: '[¶]', label: 'inner paragraph' },
        { key: 'ap', glyph: '[¶ ]', label: 'a paragraph', sub: 'with blank line' },
      ],
      intro: (
        <>
          <p>
            A sentence ends at <Code>.</Code>, <Code>!</Code> or <Code>?</Code> followed by a space or line end. A
            paragraph is a run of lines between blank lines. <Code>is</Code> and <Code>ip</Code> take just the text;{' '}
            <Code>as</Code> and <Code>ap</Code> take the trailing space or blank line too.
          </p>
          <p>
            Paragraphs aren't only for prose. In code, a blank-line-separated block is a paragraph, so{' '}
            <Code>dap</Code> deletes a whole function and <Code>yap</Code> copies one.
          </p>
          <Objects text="Vim is modal. It has modes. Normal is home." cursor={17} objects={['is', 'as']} />
        </>
      ),
      practice: total => (
        <p>
          Delete, change or copy whole sentences and paragraphs. {total} rounds.
        </p>
      ),
      aside: {
        title: 'Format a paragraph',
        body: (
          <p>
            <Code>gqap</Code> rewraps a paragraph to <Code>textwidth</Code>, or 79 columns when that's unset. It's the
            quickest way to tidy a long Markdown paragraph or a block comment.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        base: { name: 'notes.md' },
        rounds: [
          {
            prompt: 'Delete "It has a lot." from both lines.',
            setup: {
              text: [
                '# Modes',
                '',
                'Vim is modal. It has a lot. Normal mode is home.',
                'Insert types. It has a lot. Visual selects.',
              ],
              cursor: { line: 2, col: 18 },
            },
            goal: {
              text: [
                '# Modes',
                '',
                'Vim is modal. Normal mode is home.',
                'Insert types. Visual selects.',
              ],
            },
            solution: 'dasj.',
          },
          {
            prompt: 'Rewrite the second sentence as "Ship."',
            setup: {
              text: [
                '## Habits',
                '',
                'Save often. Or else. Commit when tests pass.',
                'Push before you log off.',
              ],
              cursor: { line: 0, col: 0 },
            },
            goal: {
              text: [
                '## Habits',
                '',
                'Save often. Ship. Commit when tests pass.',
                'Push before you log off.',
              ],
            },
            solution: 'jjfOcisShip.<Esc>',
          },
          {
            prompt: 'Delete both draft paragraphs.',
            setup: {
              text: [
                '# Release notes',
                '',
                'Draft: fill this in',
                'before shipping.',
                '',
                'Startup is twice as fast.',
                '',
                'Draft: and this.',
                '',
                'Less memory used.',
              ],
              cursor: { line: 3, col: 2 },
            },
            goal: {
              text: [
                '# Release notes',
                '',
                'Startup is twice as fast.',
                '',
                'Less memory used.',
              ],
            },
            solution: 'dapjj.',
          },
          {
            prompt: 'Delete the unused helper.',
            setup: {
              name: 'utils.ts',
              text: [
                'export function clamp(n: number, lo: number, hi: number) {',
                '  return Math.min(hi, Math.max(lo, n));',
                '}',
                '',
                'function unused() {',
                "  return 'old';",
                '}',
                '',
                'export const noop = () => {};',
              ],
              cursor: { line: 5, col: 4 },
            },
            goal: {
              text: [
                'export function clamp(n: number, lo: number, hi: number) {',
                '  return Math.min(hi, Math.max(lo, n));',
                '}',
                '',
                'export const noop = () => {};',
              ],
            },
            solution: 'dap',
          },
          {
            prompt: 'Duplicate the keymap block above itself.',
            setup: {
              name: 'keymaps.lua',
              text: [
                "map('n', '<C-d>', '<C-d>zz')",
                "map('n', '<C-u>', '<C-u>zz')",
                '',
                "map('n', 'n', 'nzz')",
              ],
              cursor: { line: 1, col: 0 },
            },
            goal: {
              text: [
                "map('n', '<C-d>', '<C-d>zz')",
                "map('n', '<C-u>', '<C-u>zz')",
                '',
                "map('n', '<C-d>', '<C-d>zz')",
                "map('n', '<C-u>', '<C-u>zz')",
                '',
                "map('n', 'n', 'nzz')",
              ],
            },
            solution: 'yapP',
          },
        ],
      },
    },
    {
      id: 'reaching-objects',
      title: 'Reaching Objects',
      chips: ['ci"', "ci'", 'ci('],
      keyCards: [
        { key: 'ci"', glyph: '→"x"', label: 'next string', sub: 'from before it' },
        { key: "ci'", glyph: "→'x'", label: 'same for quotes' },
        { key: 'ci(', glyph: '→(x)', label: 'next brackets', sub: 'any line below' },
      ],
      intro: (
        <>
          <p>
            Text objects don't need you inside them. If the cursor is before a string on the line, <Code>ci"</Code>{' '}
            jumps forward to the next one and changes it. Outside any brackets, <Code>ci(</Code>, <Code>ci[</Code> and{' '}
            <Code>ci{'{'}</Code> reach the next pair the same way.
          </p>
          <p>
            So from the start of a line, <Code>ci'</Code> edits its first string in three keys. Reaching only happens
            from outside: stand between two strings and the quotes either side of the cursor win, so you'd change the
            gap.
          </p>
          <Objects text="local theme = 'gruvbox'" cursor={0} objects={["i'", "a'"]} />
        </>
      ),
      practice: total => (
        <p>
          Change or empty each string or bracket. Strings only reach along the cursor's line, so move to that line
          first; brackets reach down to later lines. {total} rounds.
        </p>
      ),
      aside: {
        title: 'Neovim vs Vim',
        body: (
          <p>
            Quotes only reach along the current line; brackets keep searching on later lines. Older Vims don't reach
            for brackets at all, which is why plugins like targets.vim exist.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        base: { name: 'init.lua' },
        rounds: [
          {
            prompt: 'Switch the colorscheme.',
            setup: {
              text: [
                "local theme = 'gruvbox'",
                'vim.cmd.colorscheme(theme)',
                "vim.opt.background = 'dark'",
              ],
              cursor: { line: 0, col: 0 },
            },
            goal: {
              text: [
                "local theme = 'nord'",
                'vim.cmd.colorscheme(theme)',
                "vim.opt.background = 'dark'",
              ],
            },
            solution: "ci'nord<Esc>",
          },
          {
            prompt: 'Make comma the leader key.',
            setup: {
              text: [
                '-- Leader keys',
                "vim.g.mapleader = ' '",
                'vim.opt.timeoutlen = 300',
              ],
              cursor: { line: 0, col: 0 },
            },
            goal: {
              text: [
                '-- Leader keys',
                "vim.g.mapleader = ','",
                'vim.opt.timeoutlen = 300',
              ],
            },
            solution: "jci',<Esc>",
          },
          {
            prompt: 'Log just the sum: ${sum}.',
            setup: {
              name: 'cart.ts',
              text: [
                'const n = cart.items.length;',
                'const sum = total(cart.items);',
                'console.log(`count: ${n}`);',
              ],
              cursor: { line: 0, col: 0 },
            },
            goal: {
              text: [
                'const n = cart.items.length;',
                'const sum = total(cart.items);',
                'console.log(`${sum}`);',
              ],
            },
            solution: 'jjci`${sum}<Esc>',
          },
          {
            prompt: 'Simplify the condition to ok.',
            setup: {
              name: 'guard.ts',
              text: [
                'function guard(user: User, next: () => void) {',
                "  if (user.role === 'admin') {",
                '    next();',
                '  }',
                '}',
              ],
              cursor: { line: 1, col: 0 },
            },
            goal: {
              text: [
                'function guard(user: User, next: () => void) {',
                '  if (ok) {',
                '    next();',
                '  }',
                '}',
              ],
            },
            solution: 'ci(ok<Esc>',
          },
          {
            prompt: 'Empty both tables, reaching each from the start of its line.',
            setup: {
              text: [
                'local opts = { debug = true }',
                'local keys = { silent = true }',
                "require('oil').setup(opts)",
              ],
              cursor: { line: 0, col: 0 },
            },
            goal: {
              text: [
                'local opts = {}',
                'local keys = {}',
                "require('oil').setup(opts)",
              ],
            },
            solution: 'di{j0.',
          },
          {
            prompt: 'Replace the "wip" commit message with "fix".',
            setup: {
              name: 'release.sh',
              text: [
                '#!/usr/bin/env bash',
                'git add -A',
                'git commit -am "wip"',
                'git push',
              ],
              cursor: { line: 0, col: 0 },
            },
            goal: {
              text: [
                '#!/usr/bin/env bash',
                'git add -A',
                'git commit -am "fix"',
                'git push',
              ],
            },
            solution: 'jjci"fix<Esc>',
          },
          {
            prompt: 'Empty all three test names, reaching each from the start of its line.',
            setup: {
              name: 'cart.test.ts',
              text: [
                "describe('cart', () => {",
                "  it('TODO: one', () => {});",
                "  it('TODO: two', () => {});",
                "  it('TODO: three', () => {});",
                '});',
              ],
              cursor: { line: 1, col: 0 },
            },
            goal: {
              text: [
                "describe('cart', () => {",
                "  it('', () => {});",
                "  it('', () => {});",
                "  it('', () => {});",
                '});',
              ],
            },
            solution: "di'j0.j0.",

          },
        ],
      },
    },
  ],
};
