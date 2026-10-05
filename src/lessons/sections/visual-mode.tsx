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
          Select the text the goal no longer has, then press <Code>d</Code>. Where the edit repeats,{' '}
          <Code>.</Code> redoes it on as many characters from the cursor. {total} rounds.
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
            prompt: "Delete \"'debug', \" from both console.log lines.",
            setup: {
              text: [
                'async function load(user: User) {',
                "  console.log('debug', user.id);",
                "  console.log('debug', user.name);",
                '  return api.get(user.id);',
                '}',
              ],
              cursor: { line: 1, col: 14 },
            },
            goal: {
              text: [
                'async function load(user: User) {',
                '  console.log(user.id);',
                '  console.log(user.name);',
                '  return api.get(user.id);',
                '}',
              ],
            },
            solution: 'vf dj.',
          },
          {
            prompt: 'Delete " * 1000" after "5000".',
            setup: {
              text: [
                'export const config = {',
                '  retries: 3,',
                '  timeout: 5000 * 1000, // ms',
                '  verbose: false,',
                '};',
              ],
              cursor: { line: 2, col: 0 },
            },
            goal: {
              text: ['export const config = {', '  retries: 3,', '  timeout: 5000, // ms', '  verbose: false,', '};'],
            },
            solution: 'f*hvt,d',
          },
          {
            prompt: 'Remove both ".map(String)"s, dot included.',
            setup: {
              text: [
                'function tags(xs: unknown[]) {',
                '  const a = xs.map(String).join();',
                '  const b = xs.map(String).sort();',
                '  return [a, b];',
                '}',
              ],
              cursor: { line: 1, col: 15 },
            },
            goal: {
              text: [
                'function tags(xs: unknown[]) {',
                '  const a = xs.join();',
                '  const b = xs.sort();',
                '  return [a, b];',
                '}',
              ],
            },
            solution: 'vf)ohdj.',
          },
          {
            prompt: "Delete \" + ' ' + last\" after \"first\".",
            setup: {
              text: [
                'function welcome(first: string, last: string) {',
                "  return greet(first + ' ' + last, 'en');",
                '}',
              ],
              cursor: { line: 1, col: 21 },
            },
            goal: {
              text: [
                'function welcome(first: string, last: string) {',
                "  return greet(first, 'en');",
                '}',
              ],
            },
            solution: 'vt,ohd',
          },
          {
            prompt: 'Delete the middle sentence, "It takes a minute."',
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
            prompt: 'Delete both pairs of console.log lines.',
            setup: {
              text: [
                'app.get("/health", (req, res) => {',
                '  console.log(req.url);',
                '  console.log(req.headers);',
                '  res.send("ok");',
                '  console.log(res.statusCode);',
                '  console.log(Date.now());',
                '});',
              ],
              cursor: { line: 1, col: 2 },
            },
            goal: { text: ['app.get("/health", (req, res) => {', '  res.send("ok");', '});'] },
            solution: 'Vjdj.',
          },
          {
            prompt: 'Join "This note" and every line below it into one line.',
            setup: {
              name: 'notes.md',
              text: ['# Notes', '', 'This note', 'was wrapped', 'by hand, so', 'it reads', 'badly.'],
              cursor: { line: 2, col: 0 },
            },
            goal: { text: ['# Notes', '', 'This note was wrapped by hand, so it reads badly.'] },
            solution: 'VGJ',
          },
          {
            prompt: 'Delete from the "}" under the cursor up to "if (!res.ok) {".',
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
            prompt: 'Replace the two "legacy" lines with the yanked line.',
            setup: {
              text: ['app.use(auth);', 'app.get("/a", legacyA);', 'app.get("/b", legacyB);', 'app.listen(3000);'],
              registers: { '"': 'app.use("/api", router);\n' },
              cursor: { line: 1, col: 0 },
            },
            goal: { text: ['app.use(auth);', 'app.use("/api", router);', 'app.listen(3000);'] },
            solution: 'Vjp',
          },
          {
            prompt: 'Delete both blocks of three TODO lines.',
            setup: {
              name: 'release.md',
              text: [
                '# Release',
                'TODO: changelog',
                'TODO: screenshots',
                'TODO: tag',
                '- Faster startup',
                'TODO: docs',
                'TODO: blog',
                'TODO: tweet',
                '- Smaller bundle',
              ],
              cursor: { line: 1, col: 0 },
            },
            goal: { text: ['# Release', '- Faster startup', '- Smaller bundle'] },
            solution: 'Vjjdj.',
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
            prompt: 'You just selected the first two "old" entries. Delete them, then the other two.',
            setup: {
              text: [
                'local plugins = {',
                '  "old/one",',
                '  "old/two",',
                '  "folke/lazy.nvim",',
                '  "old/three",',
                '  "old/four",',
                '}',
              ],
              cursor: { line: 0, col: 0 },
              init: vim => vim.feedKeys('jVj<Esc>G'),
            },
            goal: { text: ['local plugins = {', '  "folke/lazy.nvim",', '}'] },
            solution: 'gvdj.',
          },
          {
            prompt: 'Yank the run() and done() lines, then reselect and delete them.',
            setup: {
              name: 'nested.ts',
              text: ['function setup() {', '  run();', '  done();', '  return ok;', '}'],
              cursor: { line: 1, col: 0 },
            },
            goal: { text: ['function setup() {', '  return ok;', '}'], registers: { '0': '  run();\n  done();\n' } },
            solution: 'Vjygvd',
          },
          {
            prompt: 'You selected "timeout" a moment ago. Change it to "delay".',
            setup: {
              name: 'client.ts',
              text: ['const client = createClient({', '  timeout: 3000,', '});'],
              cursor: { line: 1, col: 2 },
              init: vim => vim.feedKeys('ve<Esc>gg'),
            },
            goal: { text: ['const client = createClient({', '  delay: 3000,', '});'] },
            solution: 'gvcdelay<Esc>',
          },
          {
            prompt: 'You last selected the first hand-wrapped paragraph. Join it, then the second.',
            setup: {
              name: 'notes.md',
              text: ['This paragraph was', 'wrapped by hand and', 'reads badly.', '', 'So was this', 'one, three', 'lines long.'],
              cursor: { line: 0, col: 0 },
              init: vim => vim.feedKeys('Vjj<Esc>G'),
            },
            goal: {
              text: ['This paragraph was wrapped by hand and reads badly.', '', 'So was this one, three lines long.'],
            },
            solution: 'gvJjj.',
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
            prompt: 'Change "process.env.PORT || 3000" to "8080".',
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
            prompt: 'Delete "!user || " from the if line.',
            setup: {
              text: ['function greet(user?: User) {', '  if (!user || !user.active) return;', '  say(user.name);', '}'],
              cursor: { line: 1, col: 6 },
            },
            goal: { text: ['function greet(user?: User) {', '  if (!user.active) return;', '  say(user.name);', '}'] },
            solution: 'v2f d',
          },
          {
            prompt: 'Copy "order.id" into the gap before ")" on the buy line.',
            setup: {
              text: ['const id = order.id;', "track('view', order.id);", "track('buy', );", 'await flush();'],
              cursor: { line: 0, col: 11 },
            },
            goal: { text: ['const id = order.id;', "track('view', order.id);", "track('buy', order.id);", 'await flush();'] },
            solution: 'vt;yjjf)P',
          },
          {
            prompt: 'Replace the three lines inside the braces with "todo()".',
            setup: {
              text: ['function total(xs) {', '  let t = 0;', '  for (const x of xs) t += x;', '  return t;', '}'],
              cursor: { line: 1, col: 2 },
            },
            goal: { text: ['function total(xs) {', '  todo()', '}'] },
            solution: 'Vjjctodo()<Esc>',
          },
          {
            prompt: 'Change "yes" on the dark line to "no".',
            setup: {
              text: ['const flags = {', '  beta: "yes",', '  dark: "yes",', '  sync: "yes",', '};'],
              cursor: { line: 1, col: 9 },
            },
            goal: { text: ['const flags = {', '  beta: "yes",', '  dark: "no",', '  sync: "yes",', '};'] },
            solution: 'jvi"cno<Esc>',
          },
          {
            prompt: 'Copy the port and host lines to just above the last "};".',
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
            prompt: 'Delete the "// " from the front of all four lines.',
            setup: {
              text: ['// const a = 1;', '// const b = 2;', 'run(a, b);', '// const c = 3;', '// const d = 4;'],
              cursor: { line: 0, col: 0 },
            },
            goal: { text: ['const a = 1;', 'const b = 2;', 'run(a, b);', 'const c = 3;', 'const d = 4;'] },
            solution: '<C-v>jlld3j.',
          },
          {
            prompt: 'Change every "[ ]" to "[x]".',
            setup: {
              name: 'todo.md',
              text: ['## Today', '- [ ] write tests', '- [ ] update docs', '## Later', '- [ ] tag release', '- [ ] blog'],
              cursor: { line: 1, col: 3 },
            },
            goal: {
              text: ['## Today', '- [x] write tests', '- [x] update docs', '## Later', '- [x] tag release', '- [x] blog'],
            },
            solution: '<C-v>jrx3j.',
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
            prompt: 'Put "- " in front of Milk, Eggs, Soap and Tape.',
            setup: { text: ['## Groceries', 'Milk', 'Eggs', '', 'Soap', 'Tape'], cursor: { line: 1, col: 0 } },
            goal: { text: ['## Groceries', '- Milk', '- Eggs', '', '- Soap', '- Tape'] },
            solution: '<C-v>jI- <Esc>}j.',
          },
          {
            prompt: 'Put "local " in front of the width, height and wrap lines.',
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
            prompt: 'Add "-alt" after "sm", "md" and "lg".',
            setup: { name: 'buttons.css', text: ['.btn-sm {}', '.btn-md {}', '.btn-lg {}'], cursor: { line: 0, col: 6 } },
            goal: { text: ['.btn-sm-alt {}', '.btn-md-alt {}', '.btn-lg-alt {}'] },
            solution: '<C-v>jjA-alt<Esc>',
          },
          {
            prompt: 'Add ";" to the end of every line except "// then".',
            setup: {
              name: 'setup.ts',
              text: ['const app = express()', 'app.use(cors())', '// then', 'app.use(auth)', 'app.listen(3000)'],
              cursor: { line: 0, col: 0 },
            },
            goal: { text: ['const app = express();', 'app.use(cors());', '// then', 'app.use(auth);', 'app.listen(3000);'] },
            solution: '<C-v>j$A;<Esc>3j.',
          },
          {
            prompt: 'Add a comma after "apple" and after "pear".',
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
      chips: ['v', 'a(', 'i(', 'a{'],
      keyCards: [
        { key: 'v', glyph: '[ab]', label: 'start selecting' },
        { key: 'a(', glyph: '(…)', label: 'around parens' },
        { key: 'i(', glyph: '…', label: 'inside parens' },
        { key: 'a{', glyph: '{…}', label: 'around braces' },
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
            prompt: 'Change "(isAdmin(user) || isOwner(user))" on the if line to "staff".',
            setup: {
              text: [
                'function canSave(user: User) {',
                '  const staff = isAdmin(user) || isOwner(user);',
                '  if (isReady(user) && (isAdmin(user) || isOwner(user))) {',
                '    return true;',
                '  }',
                '  return false;',
                '}',
              ],
              cursor: { line: 2, col: 32 },
            },
            goal: {
              text: [
                'function canSave(user: User) {',
                '  const staff = isAdmin(user) || isOwner(user);',
                '  if (isReady(user) && staff) {',
                '    return true;',
                '  }',
                '  return false;',
                '}',
              ],
            },
            solution: 'va(a(cstaff<Esc>',
          },
          {
            prompt: 'Change "JSON.stringify(parse(body))" to "body".',
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
            prompt: 'Make "[[1, 2], [3, 4]]" read "[]".',
            setup: {
              text: ['const board = [[1, 2], [3, 4]];', 'const size = board.length;', 'render(board, size);'],
              cursor: { line: 0, col: 16 },
            },
            goal: { text: ['const board = [];', 'const size = board.length;', 'render(board, size);'] },
            solution: 'vi[i[d',
          },
          {
            prompt: 'Replace the whole outer "{ … }" with "{}".',
            setup: {
              text: [
                "import { start } from './server';",
                'const config = { server: { port: 8080 }, debug: true };',
                'start(config);',
              ],
              cursor: { line: 1, col: 27 },
            },
            goal: { text: ["import { start } from './server';", 'const config = {};', 'start(config);'] },
            solution: 'va{a{c{}<Esc>',
          },
        ],
      },
    },
  ],
};
