import { Code, Mono } from '../../components/Code';
import { PluginObjects } from '../../components/pluginDiagrams';
import type { Vim } from '../../vim/editor';
import type { Section } from '../types';

const users = [
  "import { db } from './db';",
  '',
  'export async function getUser(id: string) {',
  '  const row = await db.get(id);',
  '  return row && toUser(row);',
  '}',
  '',
  '// Maps a database row to the public shape',
  'function toUser(row: Row): User {',
  '  const name = row.name.trim();',
  '  return { id: row.id, name };',
  '}',
  '',
  'export class UserCache {',
  '  private map = new Map<string, User>();',
  '',
  '  // Cached lookup, no database hit',
  '  get(id: string) {',
  '    return this.map.get(id);',
  '  }',
  '',
  '  set(user: User) {',
  '    this.map.set(user.id, user);',
  '  }',
  '}',
];

export const moreTextObjects: Section = {
  id: 'more-text-objects',
  title: 'More Text Objects',
  band: 'code',
  lessons: [
    {
      id: 'next-last-objects',
      title: 'Next & Last Objects',
      chips: ['in(', 'il"'],
      keyCards: [
        { key: 'in(', glyph: '→( )', label: 'next object', sub: 'also an( in" in[ …' },
        { key: 'il"', glyph: '" "←', label: 'last object', sub: 'also al" il( il[ …' },
      ],
      intro: (
        <>
          <p>
            Both starters extend the <Code>i</Code> and <Code>a</Code> objects with the mini.ai plugin. It adds a
            direction: put <Code>n</Code> (next) or{' '}
            <Code>l</Code> (last) in the middle and the object is found ahead of or behind the cursor:{' '}
            <Code>cin(</Code> changes inside the next parentheses, <Code>dil"</Code> empties the previous string.
          </p>
          <p>
            Plain <Code>ci(</Code> also looks ahead when the cursor isn't inside any parentheses. <Code>in(</Code>{' '}
            is for when you are inside one pair and want the one after it.
          </p>
          <PluginObjects plugins={['mini-ai']} text="load(a).then(b).catch(c)" cursor={13} objects={['i(', 'in(', 'il(']} />
        </>
      ),
      practice: total => (
        <p>
          Change or delete the object before or after the cursor, with <Code>n</Code> or <Code>l</Code>. {total} rounds.
        </p>
      ),
      aside: {
        title: "kickstart's keys",
        body: (
          <p>
            These are LazyVim's keys. kickstart moves "next" to <Code>ii</Code> and <Code>aa</Code>
            (<Code>cii(</Code>), because Neovim 0.12 uses <Code>in</Code> and <Code>an</Code> for its own treesitter
            selection. A count reaches further: <Code>2cin(</Code> skips one pair.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        base: { name: 'api.ts', plugins: ['mini-ai'] },
        rounds: [
          {
            prompt: 'Change "parse" to "render".',
            setup: { text: ['export function show(url: string) {', '  return fetch(url).then(parse);', '}'], cursor: { line: 1, col: 16 } },
            goal: { text: ['export function show(url: string) {', '  return fetch(url).then(render);', '}'] },
            solution: 'cin(render<Esc>',
          },
          {
            prompt: 'Change both toBe(1) to toBe(0).',
            setup: {
              name: 'math.test.ts',
              text: ["import { add, mul } from './math';", '', "test('zero', () => {", '  expect(add(0, 0)).toBe(1);', '  expect(mul(0, 5)).toBe(1);', '});'],
              cursor: { line: 3, col: 13 },
            },
            goal: { text: ["import { add, mul } from './math';", '', "test('zero', () => {", '  expect(add(0, 0)).toBe(0);', '  expect(mul(0, 5)).toBe(0);', '});'] },
            solution: 'cin(0<Esc>jF0.',
          },
          {
            prompt: 'Change "Hi" to "Hello".',
            setup: { text: ['function welcome(user: User) {', '  const text = format("Hi", user.name);', '  show(text);', '}'], cursor: { line: 1, col: 30 } },
            goal: { text: ['function welcome(user: User) {', '  const text = format("Hello", user.name);', '  show(text);', '}'] },
            solution: 'cil"Hello<Esc>',
          },
          {
            prompt: 'Change [j] to [k] on both lines.',
            setup: {
              text: ['for (let i = 0; i < rows; i++) {', '  for (let k = 0; k < cols; k++) {', '    const cell = grid[i][j];', '    seen[i][j] = true;', '  }', '}'],
              cursor: { line: 2, col: 22 },
            },
            goal: { text: ['for (let i = 0; i < rows; i++) {', '  for (let k = 0; k < cols; k++) {', '    const cell = grid[i][k];', '    seen[i][k] = true;', '  }', '}'] },
            solution: 'cin[k<Esc>jFi.',
          },
          {
            prompt: 'Empty the parentheses around "cached".',
            setup: { text: ['async function get(key: string) {', '  if (cached) return load(key);', '  return fetchFresh(key);', '}'], cursor: { line: 1, col: 27 } },
            goal: { text: ['async function get(key: string) {', '  if () return load(key);', '  return fetchFresh(key);', '}'] },
            solution: 'dil(',
          },
        ],
      },
    },
    {
      id: 'argument-objects',
      title: 'Arguments',
      chips: ['ia', 'aa'],
      keyCards: [
        { key: 'ia', glyph: '(▮, )', label: 'inner argument' },
        { key: 'aa', glyph: '(▮▮ )', label: 'argument + comma' },
      ],
      intro: (
        <>
          <p>
            <Code>ia</Code> is one argument of a call, parameter list, array or object: everything between the commas,
            however many words it has. <Code>cia</Code> replaces <Mono>a + b</Mono> as easily as <Mono>x</Mono>.
          </p>
          <p>
            <Code>aa</Code> takes the comma and space with it, so <Code>daa</Code> removes an argument and leaves a
            clean list, whether it was the first, a middle or the last one.
          </p>
          <PluginObjects plugins={['mini-ai']} text="createUser(name, email, role)" cursor={19} objects={['ia', 'aa']} />
        </>
      ),
      practice: total => (
        <p>
          Change or delete one argument. {total} rounds.
        </p>
      ),
      aside: {
        title: 'Nested calls',
        body: (
          <p>
            Commas inside nested brackets and strings don't count, so <Mono>{"f(g(1, 2), 'a, b')"}</Mono> has two
            arguments. In kickstart <Code>aa</Code> starts a "next" object instead, so there <Code>daa</Code> waits
            for another key; <Code>ia</Code> works in both.
          </p>
        ),
      },
      reps: { mutations: ['stray-arg', 'wrong-arg'], count: [10, 15], sections: ['more-text-objects'] },
      challenge: {
        kind: 'rounds',
        base: { name: 'users.ts', plugins: ['mini-ai'] },
        rounds: [
          {
            prompt: 'Delete the email argument on both lines.',
            setup: {
              text: ['export async function signUp(form: Form) {', '  saveUser(name, email, role);', '  mailUser(name, email, role);', '}'],
              cursor: { line: 1, col: 18 },
            },
            goal: { text: ['export async function signUp(form: Form) {', '  saveUser(name, role);', '  mailUser(name, role);', '}'] },
            solution: 'daaj.',
          },
          {
            prompt: 'Delete the url argument inside fetch( ).',
            setup: {
              text: ['async function post(url: string) {', "  const res = await fetch(url, { method: 'POST' });", '  return res.json();', '}'],
              cursor: { line: 2, col: 2 },
            },
            goal: { text: ['async function post(url: string) {', "  const res = await fetch({ method: 'POST' });", '  return res.json();', '}'] },
            solution: 'kfudaa',
          },
          {
            prompt: 'Replace "a + b" with "sum".',
            setup: {
              name: 'sum.test.ts',
              text: ["test('adds', () => {", '  const sum = add(1, 2);', '  assert.equal(a + b, 3);', '});'],
              cursor: { line: 2, col: 17 },
            },
            goal: { text: ["test('adds', () => {", '  const sum = add(1, 2);', '  assert.equal(sum, 3);', '});'] },
            solution: 'ciasum<Esc>',
          },
          {
            prompt: 'Delete extra from the log and send lines.',
            setup: {
              text: ['export function warn(msg: string, extra?: unknown) {', "  log('warn', msg, extra);", "  send('warn', msg, extra);", '}'],
              cursor: { line: 1, col: 21 },
            },
            goal: { text: ['export function warn(msg: string, extra?: unknown) {', "  log('warn', msg);", "  send('warn', msg);", '}'] },
            solution: 'daajfx.',
          },
          {
            prompt: 'Replace "60 * 1000" with 0.',
            setup: {
              name: 'tick.lua',
              text: ['local function check()', "  vim.notify('tick')", 'end', 'vim.defer_fn(check, 60 * 1000)'],
              cursor: { line: 3, col: 23 },
            },
            goal: { text: ['local function check()', "  vim.notify('tick')", 'end', 'vim.defer_fn(check, 0)'] },
            solution: 'cia0<Esc>',
          },
        ],
      },
    },
    {
      id: 'indent-objects',
      title: 'Indent Objects',
      chips: ['ii', 'ai'],
      keyCards: [
        { key: 'ii', glyph: '⇥▮', label: 'inner indent', sub: 'lines at this level' },
        { key: 'ai', glyph: '⇤⇥▮', label: 'around indent', sub: 'plus header and end' },
      ],
      intro: (
        <>
          <p>
            <Code>ii</Code> selects the block of lines indented at least as deep as the cursor line: a function body,
            an <Mono>if</Mono> branch, a nested list. <Code>ai</Code> adds the line above it and, when there is one,
            the closing line below (<Mono>{'}'}</Mono> or <Mono>end</Mono>).
          </p>
          <p>
            It needs no brackets, so it works the same in Python, YAML, Lua and Markdown lists.
          </p>
          <PluginObjects
            plugins={['mini-ai']}
            name="diagram.py"
            text={['def main():', '    if DEBUG:', '        print(state)', '        dump(state)', '    run()']}
            cursor={[2, 8]}
            objects={['ii', 'ai']}
          />
        </>
      ),
      practice: total => (
        <p>
          Change or delete a whole indented block. {total} rounds.
        </p>
      ),
      aside: {
        title: 'Where it comes from',
        body: (
          <p>
            LazyVim gets <Code>ii</Code> and <Code>ai</Code> from snacks.nvim's scope module; mini.indentscope and
            vim-indent-object provide the same objects. kickstart has none: its <Code>ii</Code> means "inside
            next".
          </p>
        ),
      },
      reps: { mutations: ['scope-over-indented', 'stray-scope'], count: [10, 15], sections: ['more-text-objects'] },
      challenge: {
        kind: 'rounds',
        base: { name: 'cache.py', plugins: ['mini-ai'] },
        rounds: [
          {
            prompt: 'Replace the lines under each def with pass.',
            setup: {
              text: ['class Cache:', '    def reset(self):', '        self.cache.clear()', '        self.count = 0', '', '    def size(self):', '        return len(self.cache)'],
              cursor: { line: 3, col: 13 },
            },
            goal: { text: ['class Cache:', '    def reset(self):', '        pass', '', '    def size(self):', '        pass'] },
            solution: 'ciipass<Esc>3j.',
          },
          {
            prompt: 'Delete both "if DEBUG:" blocks.',
            setup: {
              text: ['def main():', '    if DEBUG:', '        dump(state)', '    run()', '    if DEBUG:', '        dump(result)', '    return result'],
              cursor: { line: 2, col: 8 },
            },
            goal: { text: ['def main():', '    run()', '    return result'] },
            solution: 'daijj.',
          },
          {
            prompt: 'Delete the whole if block, from "if" to "end".',
            setup: {
              name: 'options.lua',
              text: ['vim.o.number = true', 'if vim.g.neovide then', "  vim.o.guifont = 'JetBrains Mono:h14'", '  vim.g.neovide_scale_factor = 1.0', 'end', 'vim.o.wrap = false'],
              cursor: { line: 3, col: 2 },
            },
            goal: { text: ['vim.o.number = true', 'vim.o.wrap = false'] },
            solution: 'dai',
          },
          {
            prompt: 'Replace the two lines under "except OSError:" with raise.',
            setup: {
              name: 'load.py',
              text: ['try:', '    load()', 'except OSError:', "    log.warning('load failed')", '    retry()'],
              cursor: { line: 3, col: 8 },
            },
            goal: { text: ['try:', '    load()', 'except OSError:', '    raise'] },
            solution: 'ciiraise<Esc>',
          },
          {
            prompt: 'Delete the indented lines under "- Setup" and "- Usage".',
            setup: {
              name: 'README.md',
              text: ['- Setup', '  - Install Node 22', '  - Run npm ci', '- Usage', '  - npm start', '  - npm test'],
              cursor: { line: 1, col: 6 },
            },
            goal: { text: ['- Setup', '- Usage'] },
            solution: 'diij.',
          },
        ],
      },
    },
    {
      id: 'function-class-objects',
      title: 'Functions & Classes',
      chips: ['if', 'af', 'ic', 'ac'],
      keyCards: [
        { key: 'if', glyph: '{▮}', label: 'function body' },
        { key: 'af', glyph: 'fn▮', label: 'whole function' },
        { key: 'ic', glyph: '{▮}', label: 'class body' },
        { key: 'ac', glyph: 'cls▮', label: 'whole class' },
      ],
      intro: (
        <>
          <p>
            Treesitter, the parser behind Neovim's syntax colours, knows where functions and classes begin and end.
            With it, <Code>if</Code> is a function's
            body, <Code>af</Code> the whole function; <Code>ic</Code> and <Code>ac</Code> do the same for classes.
          </p>
          <p>
            The cursor can be anywhere inside, even deep in a nested block. <Code>cif</Code> rewrites a body in one
            go; <Code>daf</Code> removes a method without counting lines.
          </p>
          <PluginObjects
            plugins={['mini-ai']}
            text={['function total(items: Item[]) {', '  const sum = items.reduce(add, 0);', '  return sum * TAX;', '}']}
            cursor={[2, 9]}
            objects={['if', 'af']}
          />
        </>
      ),
      practice: total => (
        <p>
          Change, delete, indent or copy a function or class from anywhere inside it. {total} rounds.
        </p>
      ),
      aside: {
        title: 'Not built in',
        body: (
          <p>
            These come from nvim-treesitter-textobjects or from mini.ai with a treesitter spec (LazyVim's default).
            In kickstart, mini.ai's own <Code>f</Code> is a function call and there is no <Code>c</Code>.
          </p>
        ),
      },
      reps: { mutations: ['fn-body-dedented', 'extra-function'], count: [10, 15], sections: ['more-text-objects'] },
      challenge: {
        kind: 'rounds',
        base: { name: 'cart.ts', plugins: ['mini-ai'] },
        rounds: [
          {
            prompt: 'Indent the whole body one more level.',
            setup: {
              text: ['function total(xs: number[]) {', '  let sum = 0;', '  for (const x of xs) sum += x;', '  return sum;', '}'],
              cursor: { line: 2, col: 4 },
            },
            goal: { text: ['function total(xs: number[]) {', '    let sum = 0;', '    for (const x of xs) sum += x;', '    return sum;', '}'] },
            solution: '>if',
          },
          {
            prompt: 'Delete the debug() and dump() blocks.',
            setup: {
              text: [
                'class Cart {',
                '  debug() {',
                '    console.log(this.items);',
                '  }',
                '  add(item: Item) {',
                '    this.items.push(item);',
                '  }',
                '  dump() {',
                '    console.log(this);',
                '  }',
                '}',
              ],
              cursor: { line: 2, col: 16 },
            },
            goal: { text: ['class Cart {', '  add(item: Item) {', '    this.items.push(item);', '  }', '}'] },
            solution: 'daf4j.',
          },
          {
            prompt: 'Delete the LegacyStore class.',
            setup: {
              name: 'store.ts',
              text: ['class LegacyStore {', '  get(key: string) {', '    return localStorage.getItem(key);', '  }', '}', 'export const store = new Map<string, string>();'],
              cursor: { line: 2, col: 11 },
            },
            goal: { text: ['export const store = new Map<string, string>();'] },
            solution: 'dac',
          },
          {
            prompt: 'Replace everything inside the class with: n = 0;',
            setup: {
              name: 'counter.ts',
              text: ['export class Counter {', '  inc() {', '    this.n++;', '  }', '}'],
              cursor: { line: 2, col: 4 },
            },
            goal: { text: ['export class Counter {', '  n = 0;', '}'] },
            solution: 'cicn = 0;<Esc>',
          },
          {
            prompt: 'Make a second copy of add() and its body.',
            setup: {
              text: ['class Cart {', '  add(item: Item) {', '    this.items.push(item);', '  }', '}'],
              cursor: { line: 2, col: 6 },
            },
            goal: {
              text: ['class Cart {', '  add(item: Item) {', '    this.items.push(item);', '  }', '  add(item: Item) {', '    this.items.push(item);', '  }', '}'],
            },
            solution: 'yafP',
          },
          {
            prompt: 'Copy the body of onOpen() over the body of onSave().',
            setup: {
              name: 'hooks.ts',
              text: ['function onOpen(doc: Doc) {', '  lint(doc);', '}', 'function onSave(doc: Doc) {', '  const text = doc.getText();', '  lint(parse(text));', '}'],
              cursor: { line: 1, col: 4 },
            },
            goal: { text: ['function onOpen(doc: Doc) {', '  lint(doc);', '}', 'function onSave(doc: Doc) {', '  lint(doc);', '}'] },
            solution: 'yif3jcif<C-r>0<Esc>',
          },
          {
            prompt: 'Delete the function inside forEach( ), leaving items.forEach();',
            setup: {
              text: ['const total = sum(prices);', 'items.forEach(function (item) {', '  if (item.qty > 1) {', '    warn(item);', '  }', '});'],
              cursor: { line: 3, col: 6 },
            },
            goal: { text: ['const total = sum(prices);', 'items.forEach();'] },
            solution: 'daf',
          },
        ],
      },
    },
    {
      id: 'function-motions',
      title: 'Function Motions',
      chips: [']f', '[f'],
      keyCards: [
        { key: ']f', glyph: '↓ƒ', label: 'next function' },
        { key: '[f', glyph: '↑ƒ', label: 'previous function' },
      ],
      intro: (
        <>
          <p>
            <Code>]f</Code> jumps to the start of the next function or method, <Code>[f</Code> to the start of the
            previous one. From inside a body, <Code>[f</Code> takes you to the top of the function you're in.
          </p>
          <p>
            They skip everything that isn't a function, so they're the quickest way down a file of methods. A count
            skips several: <Code>2]f</Code>.
          </p>
        </>
      ),
      practice: total => (
        <p>
          Reach the <span className="hl-green">green box</span> with <Code>]f</Code> or <Code>[f</Code>. {total} rounds.
        </p>
      ),
      aside: {
        title: 'Ends, and kickstart',
        body: (
          <p>
            <Code>]F</Code> and <Code>[F</Code> go to function ends. These are LazyVim's treesitter-textobjects moves.
            kickstart ships nvim-treesitter without them, so there you have only Vim's <Code>]m</Code>, which
            understands Java-style classes and nothing else, until you add the plugin yourself.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        showGoal: false,
        base: { name: 'users.ts', text: users, plugins: ['mini-ai'] },
        rounds: [
          { setup: { cursor: { line: 0, col: 0 } }, goal: { cursor: { line: 2, col: 0 } }, solution: ']f' },
          { setup: { cursor: { line: 3, col: 8 } }, goal: { cursor: { line: 8, col: 0 } }, solution: ']f' },
          { setup: { cursor: { line: 10, col: 20 } }, goal: { cursor: { line: 8, col: 0 } }, solution: '[f' },
          { setup: { cursor: { line: 14, col: 10 } }, goal: { cursor: { line: 17, col: 2 } }, solution: ']f' },
          { setup: { cursor: { line: 22, col: 13 } }, goal: { cursor: { line: 17, col: 2 } }, solution: '2[f' },
          { setup: { cursor: { line: 1, col: 0 } }, goal: { cursor: { line: 17, col: 2 } }, solution: '3]f' },
        ],
      },
    },
    {
      id: 'toggle-folds',
      title: 'Folds',
      chips: ['za', 'zR', 'zM'],
      keyCards: [
        { key: 'za', glyph: '▸▾', label: 'toggle this fold' },
        { key: 'zR', glyph: '▾▾', label: 'open all folds' },
        { key: 'zM', glyph: '▸▸', label: 'close all folds' },
      ],
      intro: (
        <>
          <p>
            A closed fold hides a block behind one row: <Mono>+-- 4 lines: function retryDelay…</Mono>. <Code>za</Code>{' '}
            toggles the fold under the cursor, opening it if it is closed and closing it if it is open.{' '}
            <Code>zR</Code> opens every fold in the window and <Code>zM</Code> closes them all.
          </p>
          <p>
            <Code>zM</Code> turns a long file into its outline. <Code>j</Code> and <Code>k</Code> step over a closed
            fold as one line, so move to the function you want and <Code>za</Code> it open. An operator takes a closed
            fold whole: <Code>dd</Code> on one deletes every line in it.
          </p>
        </>
      ),
      practice: total => <p>Open, close or edit through the folds as the prompt asks. {total} rounds.</p>,
      aside: {
        title: 'Where folds come from',
        body: (
          <p>
            LazyVim folds by treesitter, so every function and block is a fold; stock Neovim and kickstart start with
            none, and <Code>zf</Code> makes one by hand. <Code>zo</Code> and <Code>zc</Code> open or close just one
            fold, and <Code>zj</Code> / <Code>zk</Code> move to the next or previous fold.
          </p>
        ),
      },
      challenge: (() => {
        const orders = [
          "import { db } from './db';",
          '',
          'export async function listOrders(userId: string) {',
          '  const rows = await db.orders.find({ userId });',
          '  return rows.map(toOrder);',
          '}',
          '',
          'export async function cancelOrder(id: string) {',
          '  const order = await db.orders.get(id);',
          "  if (order.status === 'shipped') {",
          "    throw new Error('already shipped');",
          '  }',
          "  await db.orders.update(id, { status: 'cancelled' });",
          '}',
          '',
          'function retryDelay(attempt: number) {',
          '  const base = 250;',
          '  return base * 2 ** attempt;',
          '}',
        ];
        const folds = (closed: boolean) => [
          { start: 2, end: 5, closed },
          { start: 7, end: 13, closed },
          { start: 9, end: 11, closed },
          { start: 15, end: 18, closed },
        ];
        /** Is the fold that starts on the line containing `needle` closed? */
        const closedAt = (vim: Vim, needle: string) => {
          const line = vim.lines.findIndex(l => l.includes(needle));
          const f = vim.win.folds.find(x => x.start === line);
          return !!f && f.closed && vim.closedFoldAt(line) !== null;
        };
        const allClosed = (vim: Vim) => vim.win.folds.every(f => f.closed);
        const allOpen = (vim: Vim) => vim.win.folds.every(f => !f.closed);
        const edit = (from: string, to: string) => orders.map(l => l.replace(from, to));
        return {
          kind: 'rounds',
          base: { name: 'orders.ts', text: orders, folds: folds(true) },
          rounds: [
            {
              prompt: 'Open the retryDelay fold and change 250 to 500.',
              setup: { cursor: { line: 0, col: 0 } },
              goal: { text: edit('base = 250', 'base = 500') },
              solution: 'Gzakkf2cw500<Esc>',
            },
            {
              prompt: 'Close every fold, so the file reads as an outline.',
              setup: { folds: folds(false), cursor: { line: 12, col: 2 } },
              goal: { check: allClosed },
              solution: 'zM',
            },
            {
              prompt: 'Open every fold.',
              setup: { cursor: { line: 7, col: 0 } },
              goal: { check: allOpen },
              solution: 'zR',
            },
            {
              prompt: 'Open the cancelOrder fold and the fold inside it, then delete "already ".',
              setup: { cursor: { line: 7, col: 0 } },
              goal: { text: edit("Error('already shipped')", "Error('shipped')") },
              solution: 'zajjzajfadw',
            },
            {
              prompt: 'Close every fold, then open only listOrders and delete its return line.',
              setup: { folds: folds(false), cursor: { line: 12, col: 2 } },
              goal: {
                text: orders.filter(l => !l.includes('return rows')),
                check: vim => closedAt(vim, 'cancelOrder') && closedAt(vim, 'retryDelay') && !closedAt(vim, 'listOrders'),
              },
              solution: 'zMgg2jza2jdd',
            },
            {
              prompt: 'Close the retryDelay fold.',
              setup: { folds: folds(false), cursor: { line: 17, col: 2 } },
              goal: { check: vim => closedAt(vim, 'retryDelay') && !closedAt(vim, 'cancelOrder') },
              solution: 'za',
            },
            {
              prompt: 'Without opening a fold, copy the whole listOrders function to the end of the file.',
              setup: { cursor: { line: 0, col: 0 } },
              goal: { text: [...orders, ...orders.slice(2, 6)] },
              solution: '2jyyGp',
            },
          ],
        };
      })(),
    },
  ],
};
