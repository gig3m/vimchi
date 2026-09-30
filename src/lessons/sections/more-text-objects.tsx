import { Code, Mono } from '../../components/Code';
import { PluginObjects } from '../../components/pluginDiagrams';
import type { Section } from '../types';

const users = [
  "import { db } from './db';",
  '',
  'export async function getUser(id: string) {',
  '  const row = await db.get(id);',
  '  return row && toUser(row);',
  '}',
  '',
  'function toUser(row: Row): User {',
  '  return { id: row.id, name: row.name };',
  '}',
  '',
  'export class UserCache {',
  '  private map = new Map<string, User>();',
  '',
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
            Both starters extend the <Code>i</Code> and <Code>a</Code> objects, with mini.ai and
            treesitter-textobjects. mini.ai adds a direction: put <Code>n</Code> (next) or{' '}
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
        title: 'From targets.vim',
        body: (
          <p>
            The <Code>n</Code> and <Code>l</Code> objects come from targets.vim, which also adds them to classic Vim.
            A count reaches further: <Code>2cin(</Code> skips one pair.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        base: { name: 'api.ts', plugins: ['mini-ai'] },
        rounds: [
          {
            prompt: 'Pass "render" to then() instead of "parse".',
            setup: { text: ['export function show(url: string) {', '  return fetch(url).then(parse);', '}'], cursor: { line: 1, col: 16 } },
            goal: { text: ['export function show(url: string) {', '  return fetch(url).then(render);', '}'] },
            solution: 'cin(render<Esc>',
          },
          {
            prompt: 'Both results are 0: fix each expected value from inside the call before it.',
            setup: {
              name: 'math.test.ts',
              text: ["import { add, mul } from './math';", '', "test('zero', () => {", '  expect(add(0, 0)).toBe(1);', '  expect(mul(0, 5)).toBe(1);', '});'],
              cursor: { line: 3, col: 13 },
            },
            goal: { text: ["import { add, mul } from './math';", '', "test('zero', () => {", '  expect(add(0, 0)).toBe(0);', '  expect(mul(0, 5)).toBe(0);', '});'] },
            solution: 'cin(0<Esc>j0f0.',
          },
          {
            prompt: 'Change "Hi" to "Hello".',
            setup: { text: ['function welcome(user: User) {', '  const text = format("Hi", user.name);', '  show(text);', '}'], cursor: { line: 1, col: 30 } },
            goal: { text: ['function welcome(user: User) {', '  const text = format("Hello", user.name);', '  show(text);', '}'] },
            solution: 'cil"Hello<Esc>',
          },
          {
            prompt: 'Index the column with k on both lines, from inside [i].',
            setup: {
              text: ['for (let i = 0; i < rows; i++) {', '  for (let k = 0; k < cols; k++) {', '    const cell = grid[i][j];', '    seen[i][j] = true;', '  }', '}'],
              cursor: { line: 2, col: 22 },
            },
            goal: { text: ['for (let i = 0; i < rows; i++) {', '  for (let k = 0; k < cols; k++) {', '    const cell = grid[i][k];', '    seen[i][k] = true;', '  }', '}'] },
            solution: 'cin[k<Esc>jFi.',
          },
          {
            prompt: 'Empty the first condition.',
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
            arguments. targets.vim and nvim-treesitter-textobjects offer the same object as <Code>ia</Code> or{' '}
            <Code>i,</Code>.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        base: { name: 'users.ts', plugins: ['mini-ai'] },
        rounds: [
          {
            prompt: 'Drop the email argument from both calls: daa, then . on the next line.',
            setup: {
              text: ['export async function signUp(form: Form) {', '  saveUser(name, email, role);', '  mailUser(name, email, role);', '}'],
              cursor: { line: 1, col: 18 },
            },
            goal: { text: ['export async function signUp(form: Form) {', '  saveUser(name, role);', '  mailUser(name, role);', '}'] },
            solution: 'daaj.',
          },
          {
            prompt: 'Drop the URL; keep the options.',
            setup: {
              text: ['async function post(url: string) {', "  const res = await fetch(url, { method: 'POST' });", '  return res.json();', '}'],
              cursor: { line: 2, col: 2 },
            },
            goal: { text: ['async function post(url: string) {', "  const res = await fetch({ method: 'POST' });", '  return res.json();', '}'] },
            solution: 'kfudaa',
          },
          {
            prompt: 'Compare against "sum" instead.',
            setup: {
              name: 'sum.test.ts',
              text: ["test('adds', () => {", '  const sum = add(1, 2);', '  assert.equal(a + b, 3);', '});'],
              cursor: { line: 2, col: 17 },
            },
            goal: { text: ["test('adds', () => {", '  const sum = add(1, 2);', '  assert.equal(sum, 3);', '});'] },
            solution: 'ciasum<Esc>',
          },
          {
            prompt: 'Remove the last argument from both calls.',
            setup: {
              text: ['export function warn(msg: string, extra?: unknown) {', "  log('warn', msg, extra);", "  send('warn', msg, extra);", '}'],
              cursor: { line: 1, col: 21 },
            },
            goal: { text: ['export function warn(msg: string, extra?: unknown) {', "  log('warn', msg);", "  send('warn', msg);", '}'] },
            solution: 'daajfx.',
          },
          {
            prompt: 'Map it in visual mode instead.',
            setup: {
              name: 'keymaps.lua',
              text: ["local format = require('conform').format", "vim.keymap.set('n', '<leader>f', format, {", "  desc = 'Format',", '})'],
              cursor: { line: 1, col: 16 },
            },
            goal: { text: ["local format = require('conform').format", "vim.keymap.set('v', '<leader>f', format, {", "  desc = 'Format',", '})'] },
            solution: "cia'v'<Esc>",
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
            LazyVim adds <Code>ii</Code> and <Code>ai</Code> to mini.ai; mini.indentscope and vim-indent-object provide
            the same objects on their own.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        base: { name: 'cache.py', plugins: ['mini-ai'] },
        rounds: [
          {
            prompt: 'Stub both method bodies with pass: cii, then . three lines down.',
            setup: {
              text: ['class Cache:', '    def reset(self):', '        self.cache.clear()', '        self.count = 0', '', '    def size(self):', '        return len(self.cache)'],
              cursor: { line: 3, col: 13 },
            },
            goal: { text: ['class Cache:', '    def reset(self):', '        pass', '', '    def size(self):', '        pass'] },
            solution: 'ciipass<Esc>3j.',
          },
          {
            prompt: 'Delete both debug branches.',
            setup: {
              text: ['def main():', '    if DEBUG:', '        dump(state)', '    run()', '    if DEBUG:', '        dump(result)', '    return result'],
              cursor: { line: 2, col: 8 },
            },
            goal: { text: ['def main():', '    run()', '    return result'] },
            solution: 'daijj.',
          },
          {
            prompt: 'Remove the Neovide block.',
            setup: {
              name: 'options.lua',
              text: ['vim.o.number = true', 'if vim.g.neovide then', "  vim.o.guifont = 'JetBrains Mono:h14'", '  vim.g.neovide_scale_factor = 1.0', 'end', 'vim.o.wrap = false'],
              cursor: { line: 3, col: 2 },
            },
            goal: { text: ['vim.o.number = true', 'vim.o.wrap = false'] },
            solution: 'dai',
          },
          {
            prompt: 'Replace the handler body with a bare raise.',
            setup: {
              name: 'load.py',
              text: ['try:', '    load()', 'except OSError:', "    log.warning('load failed')", '    retry()'],
              cursor: { line: 3, col: 8 },
            },
            goal: { text: ['try:', '    load()', 'except OSError:', '    raise'] },
            solution: 'ciiraise<Esc>',
          },
          {
            prompt: 'Drop the sub-steps under both items.',
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
            With treesitter the editor knows where functions and classes begin and end. <Code>if</Code> is a function's
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
            The keys are a convention, set in your config.
          </p>
        ),
      },
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
            prompt: 'Delete the debug() and dump() methods: daf, then . inside dump().',
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
            prompt: 'Delete the legacy class.',
            setup: {
              name: 'store.ts',
              text: ['class LegacyStore {', '  get(key: string) {', '    return localStorage.getItem(key);', '  }', '}', 'export const store = new Map<string, string>();'],
              cursor: { line: 2, col: 11 },
            },
            goal: { text: ['export const store = new Map<string, string>();'] },
            solution: 'dac',
          },
          {
            prompt: 'Replace the class body with one field: n = 0;',
            setup: {
              name: 'counter.ts',
              text: ['export class Counter {', '  inc() {', '    this.n++;', '  }', '}'],
              cursor: { line: 2, col: 4 },
            },
            goal: { text: ['export class Counter {', '  n = 0;', '}'] },
            solution: 'cicn = 0;<Esc>',
          },
          {
            prompt: 'Duplicate the add() method above itself.',
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
            prompt: 'Turn setup() into a stub whose body is just return.',
            setup: {
              name: 'init.lua',
              text: ['local M = {}', '', 'function M.setup(opts)', '  local o = opts or {}', "  M.opts = vim.tbl_deep_extend('force', defaults, o)", 'end', '', 'return M'],
              cursor: { line: 4, col: 30 },
            },
            goal: { text: ['local M = {}', '', 'function M.setup(opts)', '  return', 'end', '', 'return M'] },
            solution: 'cifreturn<Esc>',

          },
          {
            prompt: 'Delete the callback, from anywhere in it.',
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
      chips: [']m', '[m'],
      keyCards: [
        { key: ']m', glyph: '↓ƒ', label: 'next function' },
        { key: '[m', glyph: '↑ƒ', label: 'previous function' },
      ],
      intro: (
        <>
          <p>
            <Code>]m</Code> jumps to the start of the next function or method, <Code>[m</Code> to the start of the
            previous one. From inside a body, <Code>[m</Code> takes you to the top of the function you're in.
          </p>
          <p>
            They skip everything that isn't a function, so they're the quickest way down a file of methods. A count
            skips several: <Code>2]m</Code>.
          </p>
        </>
      ),
      practice: total => (
        <p>
          Reach the <span className="hl-green">green box</span> with <Code>]m</Code> or <Code>[m</Code>. {total} rounds.
        </p>
      ),
      aside: {
        title: 'Ends too',
        body: (
          <p>
            <Code>]M</Code> and <Code>[M</Code> go to function ends. Vim has <Code>]m</Code> built in, but it only
            understands Java-style classes; nvim-treesitter-textobjects makes it work in every language.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        showGoal: false,
        base: { name: 'users.ts', text: users, plugins: ['mini-ai'] },
        rounds: [
          { setup: { cursor: { line: 0, col: 0 } }, goal: { cursor: { line: 2, col: 0 } }, solution: ']m' },
          { setup: { cursor: { line: 3, col: 8 } }, goal: { cursor: { line: 7, col: 0 } }, solution: ']m' },
          { setup: { cursor: { line: 8, col: 20 } }, goal: { cursor: { line: 7, col: 0 } }, solution: '[m' },
          { setup: { cursor: { line: 12, col: 10 } }, goal: { cursor: { line: 14, col: 2 } }, solution: ']m' },
          { setup: { cursor: { line: 19, col: 6 } }, goal: { cursor: { line: 14, col: 2 } }, solution: '2[m' },
          { setup: { cursor: { line: 1, col: 0 } }, goal: { cursor: { line: 14, col: 2 } }, solution: '3]m' },
        ],
      },
    },
  ],
};
