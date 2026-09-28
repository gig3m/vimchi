import { Code } from '../../components/Code';
import { BeforeAfter, Objects } from '../../components/diagrams';
import type { Section } from '../types';

export const visualMode: Section = {
  id: 'visual-mode',
  title: 'Visual Mode',
  band: 'core',
  lessons: [
    {
      id: 'visual-characters',
      title: 'Visual Characters',
      chips: ['v', 'o'],
      keyCards: [
        { key: 'v', glyph: '[ab]', label: 'select characters' },
        { key: 'o', glyph: '⇄', label: 'other end' },
      ],
      intro: (
        <>
          <p>
            <Code>v</Code> starts a selection at the cursor. Any motion now stretches it: <Code>e</Code>, <Code>f,</Code>,{' '}
            <Code>t;</Code>, <Code>j</Code>. Press <Code>d</Code> to delete what's selected, or <Code>esc</Code> to drop it.
          </p>
          <p>
            Only one end of the selection moves. <Code>o</Code> jumps the cursor to the other end, so you can grow the
            selection backwards when you started a little too far right.
          </p>
          <BeforeAfter
            lines={["const name = first + ' ' + last;"]}
            cursor={19}
            keys="vt;ohd"
            caption={
              <>
                <Code>vt;</Code> selects up to the semicolon, <Code>o</Code> swaps ends, <Code>h</Code> takes the
                space too.
              </>
            }
          />
        </>
      ),
      practice: total => (
        <p>
          Select the text the goal no longer has, then press <Code>d</Code>. {total} rounds.
        </p>
      ),
      aside: {
        title: 'See before you cut',
        body: (
          <p>
            Most visual edits have an operator form (<Code>vt;d</Code> is <Code>dt;</Code>). Reach for <Code>v</Code> when
            you want to see the span first, or when no single motion covers it.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        base: { name: 'app.ts' },
        rounds: [
          {
            prompt: 'Drop the "debug" label from the log call.',
            setup: {
              text: [
                'async function load(user: User) {',
                "  console.log('debug', user.id);",
                '  return api.get(user.id);',
                '}',
              ],
              cursor: { line: 1, col: 14 },
            },
            goal: {
              text: [
                'async function load(user: User) {',
                '  console.log(user.id);',
                '  return api.get(user.id);',
                '}',
              ],
            },
            solution: 'vf d',
          },
          {
            prompt: 'Delete the trailing comment on the timeout.',
            setup: {
              text: [
                'export const config = {',
                '  retries: 3,',
                '  timeout: 5000, // ms',
                '  verbose: false,',
                '};',
              ],
              cursor: { line: 0, col: 0 },
            },
            goal: {
              text: ['export const config = {', '  retries: 3,', '  timeout: 5000,', '  verbose: false,', '};'],
            },
            solution: 'jj$vT,d',
          },
          {
            prompt: 'Remove ".map(String)", dot included.',
            setup: {
              text: [
                'function tagList(items: unknown[]) {',
                "  const tags = items.filter(Boolean).map(String).join(', ');",
                '  return tags;',
                '}',
              ],
              cursor: { line: 1, col: 37 },
            },
            goal: {
              text: [
                'function tagList(items: unknown[]) {',
                "  const tags = items.filter(Boolean).join(', ');",
                '  return tags;',
                '}',
              ],
            },
            solution: 'vf)ohd',
          },
          {
            prompt: 'Keep only the first name.',
            setup: {
              text: [
                'function displayName(first: string, last: string) {',
                "  const name = first + ' ' + last;",
                '  return name.trim();',
                '}',
              ],
              cursor: { line: 1, col: 21 },
            },
            goal: {
              text: [
                'function displayName(first: string, last: string) {',
                '  const name = first;',
                '  return name.trim();',
                '}',
              ],
            },
            solution: 'vt;ohd',
          },
          {
            prompt: 'Cut the middle sentence.',
            setup: {
              name: 'README.md',
              text: [
                '# vimchi',
                '',
                'Install the CLI. It takes a minute. Then run vimchi init.',
                'The tutor opens in your browser.',
              ],
              cursor: { line: 2, col: 16 },
            },
            goal: {
              text: ['# vimchi', '', 'Install the CLI. Then run vimchi init.', 'The tutor opens in your browser.'],
            },
            solution: 'vf.d',
          },
        ],
      },
    },
    {
      id: 'visual-lines',
      title: 'Visual Lines',
      chips: ['V'],
      keyCards: [{ key: 'V', glyph: '[≡]', label: 'select lines' }],
      intro: (
        <>
          <p>
            <Code>V</Code> selects whole lines. Move with <Code>j</Code>, <Code>k</Code>, <Code>{'}'}</Code> or{' '}
            <Code>G</Code> and every line you touch is in, no matter where the cursor sits on it.
          </p>
          <p>
            Then act on the block: <Code>d</Code> deletes it, <Code>J</Code> joins it into one line, <Code>p</Code> replaces
            it with what you last yanked.
          </p>
        </>
      ),
      practice: total => (
        <p>
          Select the lines with <Code>V</Code>, then finish with one command. {total} rounds.
        </p>
      ),
      aside: {
        title: 'Count the lines for you',
        body: (
          <p>
            <Code>Vjjd</Code> and <Code>3dd</Code> do the same thing. The visual version saves you counting, and you see
            the damage before you commit to it.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        base: { name: 'server.ts' },
        rounds: [
          {
            prompt: 'Delete the three debug lines.',
            setup: {
              text: [
                'app.get("/health", (req, res) => {',
                '  console.log(req.url);',
                '  console.log(req.headers);',
                '  console.log(req.query);',
                '  res.send("ok");',
                '});',
              ],
              cursor: { line: 1, col: 2 },
            },
            goal: { text: ['app.get("/health", (req, res) => {', '  res.send("ok");', '});'] },
            solution: 'Vjjd',
          },
          {
            prompt: 'Join the import list onto one line.',
            setup: {
              text: ['import {', 'useEffect,', 'useState,', '} from "react";'],
              cursor: { line: 0, col: 0 },
            },
            goal: { text: 'import { useEffect, useState, } from "react";' },
            solution: 'VjjjJ',
          },
          {
            prompt: 'Delete the whole retry block, from the cursor up.',
            setup: {
              text: [
                'const res = await fetch(url);',
                'if (!res.ok) {',
                '  await sleep(500);',
                '  return retry(url);',
                '}',
                'return res.json();',
              ],
              cursor: { line: 4, col: 0 },
            },
            goal: { text: ['const res = await fetch(url);', 'return res.json();'] },
            solution: 'Vkkkd',
          },
          {
            prompt: 'Delete everything below the cursor line.',
            setup: {
              name: 'notes.md',
              text: ['# Release', '', '- Faster startup', '', '<!-- draft -->', 'TODO: changelog', 'TODO: screenshots'],
              cursor: { line: 4, col: 0 },
            },
            goal: { text: ['# Release', '', '- Faster startup', ''] },
            solution: 'VGd',
          },
          {
            prompt: 'Replace the two old routes with the yanked line.',
            setup: {
              text: ['app.use(auth);', 'app.get("/a", legacyA);', 'app.get("/b", legacyB);', 'app.listen(3000);'],
              registers: { '"': 'app.use("/api", router);\n' },
              cursor: { line: 1, col: 0 },
            },
            goal: { text: ['app.use(auth);', 'app.use("/api", router);', 'app.listen(3000);'] },
            solution: 'Vjp',
          },
        ],
      },
    },
    {
      id: 'reselect',
      title: 'Reselect',
      chips: ['gv'],
      keyCards: [{ key: 'gv', glyph: '↺[ ]', label: 'last selection' }],
      intro: (
        <>
          <p>
            <Code>gv</Code> brings back the last visual selection, same kind and same span, wherever the cursor is now.
          </p>
          <p>
            Most visual commands end the selection. <Code>gv</Code> is how you apply a second command to the same text:
            shift a block twice, or select, check, and then act.
          </p>
        </>
      ),
      practice: total => (
        <p>
          Each round names a selection you made a moment ago. Get it back with <Code>gv</Code> and finish the edit.{' '}
          {total} rounds.
        </p>
      ),
      aside: {
        title: 'Marks behind it',
        body: (
          <p>
            The selection is stored in the marks <Code>'&lt;</Code> and <Code>'&gt;</Code>. That's why pressing{' '}
            <Code>:</Code> in visual mode fills in <Code>:'&lt;,'&gt;</Code>, and why <Code>gv</Code> survives edits
            elsewhere.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        base: { name: 'list.lua' },
        rounds: [
          {
            prompt: 'You just selected the two "old" entries. Delete them.',
            setup: {
              text: ['local plugins = {', '  "old/one",', '  "old/two",', '  "folke/lazy.nvim",', '}'],
              cursor: { line: 0, col: 0 },
              init: vim => vim.feedKeys('jVj<Esc>G'),
            },
            goal: { text: ['local plugins = {', '  "folke/lazy.nvim",', '}'] },
            solution: 'gvd',
          },
          {
            prompt: 'Indent the two lines, then reselect and indent again.',
            setup: {
              name: 'nested.ts',
              text: ['if (a) {', '  if (b) {', 'run();', 'done();', '  }', '}'],
              cursor: { line: 2, col: 0 },
            },
            goal: { text: ['if (a) {', '  if (b) {', '    run();', '    done();', '  }', '}'] },
            solution: 'Vj>gv>',
          },
          {
            prompt: 'You selected "timeout" a moment ago. Change it to "timeoutMs".',
            setup: {
              name: 'client.ts',
              text: ['const client = createClient({', '  timeout: 3000,', '});'],
              cursor: { line: 1, col: 2 },
              init: vim => vim.feedKeys('ve<Esc>gg'),
            },
            goal: { text: ['const client = createClient({', '  timeoutMs: 3000,', '});'] },
            solution: 'gvctimeoutMs<Esc>',
          },
          {
            prompt: 'You last selected the hand-wrapped paragraph. Join it.',
            setup: {
              name: 'notes.md',
              text: ['This paragraph was', 'wrapped by hand and', 'reads badly.', '', '## Next'],
              cursor: { line: 0, col: 0 },
              init: vim => vim.feedKeys('Vjj<Esc>G'),
            },
            goal: { text: ['This paragraph was wrapped by hand and reads badly.', '', '## Next'] },
            solution: 'gvJ',
          },
        ],
      },
    },
    {
      id: 'visual-operators',
      title: 'Visual Operators',
      chips: ['d', 'c', 'y'],
      keyCards: [
        { key: 'd', glyph: 'del', label: 'delete selection' },
        { key: 'c', glyph: '✎', label: 'change selection' },
        { key: 'y', glyph: '⧉', label: 'yank selection' },
      ],
      intro: (
        <>
          <p>
            In visual mode an operator needs no motion: the selection is the motion. <Code>d</Code> deletes it,{' '}
            <Code>c</Code> deletes it and starts insert mode, <Code>y</Code> copies it.
          </p>
          <p>
            This works the same for characters and lines. Select with <Code>v</Code> or <Code>V</Code>, then choose what
            to do.
          </p>
        </>
      ),
      practice: total => (
        <p>
          Select, then use <Code>d</Code>, <Code>c</Code> or <Code>y</Code> to match the goal. {total} rounds.
        </p>
      ),
      aside: {
        title: 'Paste over a selection',
        body: (
          <p>
            <Code>p</Code> in visual mode replaces the selection with the register, and the replaced text goes into the
            register. Use <Code>P</Code> to keep the register as it was.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        base: { name: 'config.ts' },
        rounds: [
          {
            prompt: 'Replace the port expression with 8080.',
            setup: {
              text: [
                "import { createServer } from 'node:http';",
                '',
                'const port = process.env.PORT || 3000;',
                'createServer(handler).listen(port);',
              ],
              cursor: { line: 2, col: 0 },
            },
            goal: {
              text: [
                "import { createServer } from 'node:http';",
                '',
                'const port = 8080;',
                'createServer(handler).listen(port);',
              ],
            },
            solution: '3wvt;c8080<Esc>',
          },
          {
            prompt: 'Drop the first check.',
            setup: {
              text: ['function greet(user?: User) {', '  if (!user || !user.active) return;', '  say(user.name);', '}'],
              cursor: { line: 1, col: 6 },
            },
            goal: { text: ['function greet(user?: User) {', '  if (!user.active) return;', '  say(user.name);', '}'] },
            solution: 'v2f d',
          },
          {
            prompt: 'Copy "order.customer.id" into the empty argument.',
            setup: {
              text: ['const id = order.customer.id;', "analytics.track('checkout', );", 'sendReceipt(order);'],
              cursor: { line: 0, col: 11 },
            },
            goal: {
              text: [
                'const id = order.customer.id;',
                "analytics.track('checkout', order.customer.id);",
                'sendReceipt(order);',
              ],
            },
            solution: 'vt;yjf)P',
          },
          {
            prompt: 'Replace the loop with a single return.',
            setup: {
              text: ['let total = 0;', 'for (const x of xs) total += x;', 'return total;'],
              cursor: { line: 0, col: 0 },
            },
            goal: { text: 'return sum(xs);' },
            solution: 'Vjjcreturn sum(xs);<Esc>',
          },
          {
            prompt: 'Copy port and host into the test config.',
            setup: {
              text: ['export const dev = {', '  port: 3000,', "  host: 'localhost',", '};', '', 'export const test = {', '};'],
              cursor: { line: 1, col: 2 },
            },
            goal: {
              text: [
                'export const dev = {',
                '  port: 3000,',
                "  host: 'localhost',",
                '};',
                '',
                'export const test = {',
                '  port: 3000,',
                "  host: 'localhost',",
                '};',
              ],
            },
            solution: 'VjyGP',
          },
        ],
      },
    },
    {
      id: 'visual-block',
      title: 'Visual Block',
      chips: ['C-v'],
      keyCards: [{ key: 'C-v', glyph: '▦', label: 'select a block' }],
      intro: (
        <>
          <p>
            <Code>C-v</Code> selects a rectangle: the same columns on every line you move over. It's the tool for anything
            laid out in columns.
          </p>
          <p>
            Operators work on the rectangle only. <Code>d</Code> cuts a column out, <Code>c</Code> retypes it on every
            line, <Code>r</Code> overwrites every character in it.
          </p>
          <BeforeAfter
            lines={['id  size  qty', '1   L     3', '2   M     12']}
            cursor={[0, 4]}
            keys="<C-v>jj5ld"
            caption="A block six columns wide and three lines tall, cut in one go."
          />
        </>
      ),
      practice: total => (
        <p>
          Select a block with <Code>C-v</Code> and edit all the lines at once. {total} rounds.
        </p>
      ),
      aside: {
        title: 'Windows terminals',
        body: (
          <p>
            Some terminals take <Code>C-v</Code> for paste. <Code>C-q</Code> starts block mode too, in Vim and Neovim.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        base: { name: 'vars.ts' },
        rounds: [
          {
            prompt: 'Uncomment the three lines.',
            setup: {
              text: ['// const a = 1;', '// const b = 2;', '// const c = 3;'],
              cursor: { line: 0, col: 0 },
            },
            goal: { text: ['const a = 1;', 'const b = 2;', 'const c = 3;'] },
            solution: '<C-v>jjlld',
          },
          {
            prompt: 'Tick every box.',
            setup: {
              name: 'todo.md',
              text: ['- [ ] write tests', '- [ ] update docs', '- [ ] tag release'],
              cursor: { line: 0, col: 3 },
            },
            goal: { text: ['- [x] write tests', '- [x] update docs', '- [x] tag release'] },
            solution: '<C-v>jjrx',
          },
          {
            prompt: 'Change every "var" to "let".',
            setup: {
              text: ['var width = 80;', 'var height = 24;', 'var depth = 1;'],
              cursor: { line: 0, col: 0 },
            },
            goal: { text: ['let width = 80;', 'let height = 24;', 'let depth = 1;'] },
            solution: '<C-v>jjeclet<Esc>',
          },
          {
            prompt: 'Delete the qty column.',
            setup: {
              name: 'stock.txt',
              text: ['name     qty  price', 'apple    3    0.50', 'pear     12   0.75', 'plum     40   0.30'],
              cursor: { line: 0, col: 9 },
            },
            goal: { text: ['name     price', 'apple    0.50', 'pear     0.75', 'plum     0.30'] },
            solution: '<C-v>3j4ld',
          },
          {
            prompt: 'Rename the "old_" prefix to "new_" on the lower two lines.',
            setup: {
              name: 'keys.lua',
              text: ['local keep_a = 1', 'local old_b = 2', 'local old_c = 3'],
              cursor: { line: 1, col: 6 },
            },
            goal: { text: ['local keep_a = 1', 'local new_b = 2', 'local new_c = 3'] },
            solution: '<C-v>j3lcnew_<Esc>',
          },
        ],
      },
    },
    {
      id: 'block-insert-append',
      title: 'Block Insert & Append',
      chips: ['I', 'A', '$A'],
      keyCards: [
        { key: 'I', glyph: '|▦', label: 'insert before block' },
        { key: 'A', glyph: '▦|', label: 'append after block' },
        { key: '$A', glyph: '→|', label: 'append at line ends' },
      ],
      intro: (
        <>
          <p>
            With a block selected, <Code>I</Code> types before it and <Code>A</Code> types after it. You see the text on
            the first line only; it appears on the rest when you press <Code>esc</Code>.
          </p>
          <p>
            Lines are rarely the same length, so press <Code>$</Code> before <Code>A</Code>. The block then runs to the end
            of every line, and the text lands at each end.
          </p>
          <BeforeAfter
            lines={["name: 'vimchi'", 'port: 5317', 'debug: true']}
            cursor={0}
            keys="<C-v>jj$A,<Esc>"
            caption={
              <>
                With <Code>$</Code>, the comma lands at the end of each line, however long.
              </>
            }
          />
        </>
      ),
      practice: total => (
        <p>
          Select a block, type once with <Code>I</Code> or <Code>A</Code>, then <Code>esc</Code>. {total} rounds.
        </p>
      ),
      aside: {
        title: 'Commenting',
        body: (
          <p>
            <Code>C-v</Code> <Code>I//</Code> is the classic way to comment lines out. Neovim also has{' '}
            <Code>gc</Code>, which knows each filetype's comment syntax.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        base: { name: 'list.md' },
        rounds: [
          {
            prompt: 'Turn the lines into a bullet list.',
            setup: { text: ['## Groceries', '', 'Milk', 'Eggs', 'Bread'], cursor: { line: 0, col: 0 } },
            goal: { text: ['## Groceries', '', '- Milk', '- Eggs', '- Bread'] },
            solution: '2j<C-v>jjI- <Esc>',
          },
          {
            prompt: 'Make the three globals local.',
            setup: {
              name: 'init.lua',
              text: ['-- globals leak', 'width = 80', 'height = 24', 'wrap = false', 'return width'],
              cursor: { line: 3, col: 0 },
            },
            goal: {
              text: ['-- globals leak', 'local width = 80', 'local height = 24', 'local wrap = false', 'return width'],
            },
            solution: '<C-v>kkIlocal <Esc>',
          },
          {
            prompt: 'Add "-outline" after each size.',
            setup: { name: 'buttons.css', text: ['.btn-sm {}', '.btn-md {}', '.btn-lg {}'], cursor: { line: 0, col: 6 } },
            goal: { text: ['.btn-sm-outline {}', '.btn-md-outline {}', '.btn-lg-outline {}'] },
            solution: '<C-v>jjA-outline<Esc>',
          },
          {
            prompt: 'End every statement with a semicolon.',
            setup: {
              name: 'setup.ts',
              text: ["const app = express()", 'app.use(cors())', 'app.listen(3000)'],
              cursor: { line: 0, col: 0 },
            },
            goal: { text: ['const app = express();', 'app.use(cors());', 'app.listen(3000);'] },
            solution: '<C-v>jj$A;<Esc>',
          },
          {
            prompt: 'Add a comma after the first two items.',
            setup: {
              name: 'fruit.json',
              text: ['[', '  "apple"', '  "pear"', '  "plum"', ']'],
              cursor: { line: 1, col: 2 },
            },
            goal: { text: ['[', '  "apple",', '  "pear",', '  "plum"', ']'] },
            solution: '<C-v>j$A,<Esc>',
          },
        ],
      },
    },
    {
      id: 'growing-selections',
      title: 'Growing Selections',
      chips: ['v', 'a(', 'i('],
      keyCards: [
        { key: 'v', glyph: '[ab]', label: 'start selecting' },
        { key: 'a(', glyph: '(…)', label: 'around parens' },
        { key: 'i(', glyph: '…', label: 'inside parens' },
      ],
      intro: (
        <>
          <p>
            Text objects work in visual mode too. <Code>va(</Code> selects the nearest parentheses and what's inside. Press{' '}
            <Code>a(</Code> again and the selection grows to the next pair out.
          </p>
          <p>
            <Code>i(</Code> grows the same way, one level at a time, but stops inside the parentheses. Keep pressing until
            the highlight covers what you want, then act on it.
          </p>
          <Objects
            text="if (ok(a) && (isAdmin(u) || isOwner(u))) {"
            cursor={22}
            objects={['i(', 'a(', '2i(', '2a(', '3i(']}
            caption="Each press grows the selection one pair of parentheses further out."
          />
        </>
      ),
      practice: total => (
        <p>
          Grow the selection from the cursor until it covers the right span, then change or delete it. {total} rounds.
        </p>
      ),
      aside: {
        title: 'Counts do the same',
        body: (
          <p>
            <Code>v2i(</Code> equals <Code>vi(i(</Code>, and it works without visual mode: <Code>c2i(</Code> changes the
            second level out. Growing by hand is easier when you can't count the brackets at a glance.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        base: { name: 'main.ts' },
        rounds: [
          {
            prompt: 'Replace everything inside render(...) with "app".',
            setup: {
              text: ["import { createApp } from './app';", '', 'render(createApp(App, { store }));', 'hydrate();'],
              cursor: { line: 2, col: 24 },
            },
            goal: { text: ["import { createApp } from './app';", '', 'render(app);', 'hydrate();'] },
            solution: 'vi(i(capp<Esc>',
          },
          {
            prompt: 'Replace the whole "(isAdmin || isOwner)" group with canEdit(user).',
            setup: {
              text: [
                'function canSave(user: User) {',
                '  if (isReady(user) && (isAdmin(user) || isOwner(user))) {',
                '    return true;',
                '  }',
                '  return false;',
                '}',
              ],
              cursor: { line: 1, col: 32 },
            },
            goal: {
              text: [
                'function canSave(user: User) {',
                '  if (isReady(user) && canEdit(user)) {',
                '    return true;',
                '  }',
                '  return false;',
                '}',
              ],
            },
            solution: 'va(a(ccanEdit(user)<Esc>',
          },
          {
            prompt: 'Log "body" instead of the whole expression.',
            setup: {
              text: [
                "app.post('/echo', (req, res) => {",
                '  const body = req.body;',
                '  console.log(JSON.stringify(parse(body)));',
                '  res.sendStatus(204);',
                '});',
              ],
              cursor: { line: 2, col: 36 },
            },
            goal: {
              text: [
                "app.post('/echo', (req, res) => {",
                '  const body = req.body;',
                '  console.log(body);',
                '  res.sendStatus(204);',
                '});',
              ],
            },
            solution: 'vi(i(i(cbody<Esc>',
          },
          {
            prompt: 'Empty the grid, keeping the outer brackets.',
            setup: {
              text: ['const size = 2;', 'const grid = [[1, 2], [3, 4]];', 'export { size, grid };'],
              cursor: { line: 1, col: 23 },
            },
            goal: { text: ['const size = 2;', 'const grid = [];', 'export { size, grid };'] },
            solution: 'vi[i[d',
          },
          {
            prompt: 'Replace the whole config object with {}.',
            setup: {
              text: [
                "import { start } from './server';",
                '',
                'const config = { server: { port: 8080 }, debug: true };',
                'start(config);',
              ],
              cursor: { line: 2, col: 33 },
            },
            goal: { text: ["import { start } from './server';", '', 'const config = {};', 'start(config);'] },
            solution: 'va{a{c{}<Esc>',
          },
        ],
      },
    },
  ],
};
