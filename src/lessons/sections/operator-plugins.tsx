import { Code, Mono } from '../../components/Code';
import { Edits } from '../../components/pluginDiagrams';
import type { Section } from '../types';

export const operatorPlugins: Section = {
  id: 'operator-plugins',
  title: 'Operator Plugins',
  band: 'plugins',
  lessons: [
    {
      id: 'exchange',
      title: 'Exchange',
      chips: ['cx', 'cxx'],
      keyCards: [
        { key: 'cx', glyph: 'a⇄b', label: 'exchange', sub: 'cx{motion}, twice' },
        { key: 'cxx', glyph: '═⇄═', label: 'exchange lines' },
      ],
      intro: (
        <>
          <p>
            vim-exchange swaps two pieces of text. <Code>cx</Code> plus a motion marks the first one (it turns{' '}
            <span className="hl-orange">orange</span>); the same on a second piece swaps them. <Code>cxx</Code> marks
            a whole line.
          </p>
          <p>
            The second <Code>cx</Code> can be a <Code>.</Code>: <Code>cxiw</Code>, move, <Code>.</Code> swaps two words.
            No registers get overwritten along the way.
          </p>
          <Edits
            plugins={['exchange']}
            rows={[
              { keys: 'cxiwfw.', label: 'cxiw fw .', text: '[height, width]', cursor: 3 },
              { keys: 'cxxj.', label: 'cxx j .', text: ['b = 2', 'a = 1'], cursor: [0, 0] },
            ]}
          />
        </>
      ),
      practice: total => (
        <p>
          Swap the two pieces with <Code>cx</Code> or <Code>cxx</Code>. {total} rounds.
        </p>
      ),
      aside: {
        title: 'Changed your mind?',
        body: (
          <p>
            <Code>cxc</Code> clears the marked text. In visual mode it's <Code>X</Code>. mini.operators has the same
            operator as <Code>gx</Code>.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        base: { name: 'layout.ts', plugins: ['exchange'] },
        rounds: [
          {
            prompt: 'Swap width and height.',
            setup: { text: ['function resize(size: Size) {', '  const [height, width] = size;', '  return { width, height };', '}'], cursor: { line: 1, col: 11 } },
            goal: { text: ['function resize(size: Size) {', '  const [width, height] = size;', '  return { width, height };', '}'] },
            solution: 'cxiwfw.',
          },
          {
            prompt: 'The arguments are the wrong way round.',
            setup: {
              name: 'sum.test.ts',
              text: ["test('parse', () => {", '  const expected = 1;', "  const actual = parse('1');", '  assert.equal(expected, actual);', '});'],
              cursor: { line: 3, col: 15 },
            },
            goal: { text: ["test('parse', () => {", '  const expected = 1;', "  const actual = parse('1');", '  assert.equal(actual, expected);', '});'] },
            solution: 'cxiwfa.',
          },
          {
            prompt: 'Sort by price, low to high.',
            setup: {
              text: ['export function cheapest(items: Item[]) {', '  items.sort((a, b) => b.price - a.price);', '  return items[0];', '}'],
              cursor: { line: 1, col: 23 },
            },
            goal: { text: ['export function cheapest(items: Item[]) {', '  items.sort((a, b) => a.price - b.price);', '  return items[0];', '}'] },
            solution: 'cxiwfa.',
          },
          {
            prompt: 'Put the imports in order.',
            setup: {
              text: ["import { render } from './render';", "import { parse } from './parse';", "import { stringify } from './stringify';"],
              cursor: { line: 0, col: 0 },
            },
            goal: { text: ["import { parse } from './parse';", "import { render } from './render';", "import { stringify } from './stringify';"] },
            solution: 'cxxj.',
          },
          {
            prompt: 'Swap the first and last lines.',
            setup: {
              name: 'init.lua',
              text: ["require('plugins.telescope')", "require('plugins.lsp')", "require('plugins.cmp')"],
              cursor: { line: 0, col: 0 },
            },
            goal: { text: ["require('plugins.cmp')", "require('plugins.lsp')", "require('plugins.telescope')"] },
            solution: 'cxx2j.',
          },
        ],
      },
    },
    {
      id: 'replace-with-register',
      title: 'Replace with Register',
      chips: ['gr', 'grr'],
      keyCards: [
        { key: 'gr', glyph: '▮←"', label: 'replace with reg', sub: 'gr{motion}' },
        { key: 'grr', glyph: '═←"', label: 'replace line' },
      ],
      intro: (
        <>
          <p>
            <Code>gr</Code> replaces text with a register: <Code>griw</Code> swaps the word for what you last yanked,{' '}
            <Code>grr</Code> the whole line. Put <Code>"a</Code> in front to use another register.
          </p>
          <p>
            The old text is thrown away instead of landing in the register, so you can yank once and{' '}
            <Code>gr</Code> as many times as you like. Visual <Code>p</Code> can't do that twice.
          </p>
        </>
      ),
      practice: total => (
        <p>
          Yank, then replace with <Code>gr</Code>. Where a register is already filled, <Code>gr</Code> right away.{' '}
          {total} rounds.
        </p>
      ),
      aside: {
        title: 'Neovim 0.11 uses gr',
        body: (
          <p>
            Neovim 0.11 maps <Code>grn</Code>, <Code>grr</Code>, <Code>gra</Code> and <Code>gri</Code> to LSP actions.
            This plugin takes <Code>gr</Code> over, and so does mini.operators' replace operator. Remap one or the
            other.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        base: { name: 'user.ts', plugins: ['replace-with-register'] },
        rounds: [
          {
            prompt: 'Pass userId instead of id.',
            setup: {
              text: ['export async function show(params: Params) {', '  const userId = params.id;', '  const user = await getUser(id);', '  render(user);', '}'],
              cursor: { line: 1, col: 8 },
            },
            goal: { text: ['export async function show(params: Params) {', '  const userId = params.id;', '  const user = await getUser(userId);', '  render(user);', '}'] },
            solution: 'yiwjf(lgriw',
          },
          {
            prompt: 'Replace both 3s with the yanked name.',
            setup: {
              text: ['function check(retries: number, attempts: number) {', '  if (retries > 3 || attempts > 3) stop();', '  next();', '}'],
              cursor: { line: 1, col: 0 },
              registers: { '0': 'maxRetries' },
            },
            goal: { text: ['function check(retries: number, attempts: number) {', '  if (retries > maxRetries || attempts > maxRetries) stop();', '  next();', '}'] },
            solution: 'f3griw;.',
          },
          {
            prompt: 'Point the second import at lodash-es too.',
            setup: {
              text: ["import debounce from 'lodash-es/debounce';", "import throttle from 'lodash/throttle';", '', 'export const onScroll = throttle(update, 100);'],
              cursor: { line: 1, col: 22 },
            },
            goal: { text: ["import debounce from 'lodash-es/debounce';", "import throttle from 'lodash-es/throttle';", '', 'export const onScroll = throttle(update, 100);'] },
            solution: 'kyt/jgrt/',
          },
          {
            prompt: 'Replace the last line with the first.',
            setup: {
              name: '.env',
              text: ['API_URL=https://api.example.com', 'TIMEOUT=30', 'API_URL=http://localhost:3000'],
              cursor: { line: 0, col: 0 },
            },
            goal: { text: ['API_URL=https://api.example.com', 'TIMEOUT=30', 'API_URL=https://api.example.com'] },
            solution: 'yyGgrr',
          },
          {
            prompt: 'Use register a for the argument.',
            setup: {
              text: ['export async function list(db: Db) {', '  const rows = await db.query(sql);', '  return rows.map(toUser);', '}'],
              cursor: { line: 1, col: 30 },
              registers: { a: 'preparedSql' },
            },
            goal: { text: ['export async function list(db: Db) {', '  const rows = await db.query(preparedSql);', '  return rows.map(toUser);', '}'] },
            solution: '"agriw',
          },
        ],
      },
    },
    {
      id: 'case-coercion',
      title: 'Case Coercion (abolish)',
      chips: ['crs', 'crc', 'cr-'],
      keyCards: [
        { key: 'crs', glyph: 'a_b', label: 'snake_case' },
        { key: 'crc', glyph: 'aB', label: 'camelCase' },
        { key: 'cr-', glyph: 'a-b', label: 'dash-case' },
        { key: 'cru', glyph: 'A_B', label: 'UPPER_CASE' },
      ],
      intro: (
        <>
          <p>
            vim-abolish's <Code>cr</Code> ("coerce") rewrites the word under the cursor in another case:{' '}
            <Code>crs</Code> gives <Mono>snake_case</Mono>, <Code>crc</Code> <Mono>camelCase</Mono>, <Code>crm</Code>{' '}
            <Mono>MixedCase</Mono>, <Code>cru</Code> <Mono>UPPER_CASE</Mono> and <Code>cr-</Code>{' '}
            <Mono>dash-case</Mono>.
          </p>
          <p>
            It works from anywhere in the word and repeats with <Code>.</Code>, which helps when an API response uses
            one convention and your code another.
          </p>
          <Edits
            plugins={['abolish']}
            rows={[
              { keys: 'crc', text: 'user_name', cursor: 2 },
              { keys: 'crm', text: 'user_name', cursor: 2 },
              { keys: 'crs', text: 'userName', cursor: 2 },
              { keys: 'cru', text: 'userName', cursor: 2 },
              { keys: 'cr-', text: 'userName', cursor: 2 },
            ]}
          />
        </>
      ),
      practice: total => (
        <p>
          Convert the identifier with <Code>cr</Code> and a letter. {total} rounds.
        </p>
      ),
      aside: {
        title: 'One way only',
        body: (
          <p>
            <Code>cr-</Code> and <Code>cr.</Code> can't be undone with another <Code>cr</Code>: a dash splits the word,
            so the next <Code>cr</Code> only sees half of it. Use <Code>u</Code>.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        base: { name: 'user.ts', plugins: ['abolish'] },
        rounds: [
          {
            prompt: 'Make user_name camelCase, both times.',
            setup: { text: ['// the account we log in as', "const user_name = 'ada';", "login(user_name, 'secret');"], cursor: { line: 1, col: 9 } },
            goal: { text: ['// the account we log in as', "const userName = 'ada';", "login(userName, 'secret');"] },
            solution: 'crcj.',
          },
          {
            prompt: 'The server expects snake_case keys.',
            setup: { name: 'payload.json', text: ['{', '  "maxRetries": 3,', '  "timeout": 30', '}'], cursor: { line: 1, col: 5 } },
            goal: { text: ['{', '  "max_retries": 3,', '  "timeout": 30', '}'] },
            solution: 'crs',
          },
          {
            prompt: 'CSS classes use dash-case.',
            setup: {
              text: ["const el = document.createElement('nav');", "el.classList.add('navBar');", 'document.body.append(el);'],
              cursor: { line: 1, col: 20 },
            },
            goal: { text: ["const el = document.createElement('nav');", "el.classList.add('nav-bar');", 'document.body.append(el);'] },
            solution: 'cr-',
          },
          {
            prompt: 'It is a constant: UPPER_CASE.',
            setup: { text: ['export const RETRIES = 3;', 'export const defaultTimeout = 5000;', "export const BASE_URL = '/api';"], cursor: { line: 1, col: 20 } },
            goal: { text: ['export const RETRIES = 3;', 'export const DEFAULT_TIMEOUT = 5000;', "export const BASE_URL = '/api';"] },
            solution: 'cru',
          },
          {
            prompt: 'Python names are snake_case: fix both.',
            setup: {
              name: 'api.py',
              text: ['from client import fetchUser, saveUser', '', '', 'def sync(user_id):', '    save_user(fetch_user(user_id))'],
              cursor: { line: 0, col: 19 },
            },
            goal: { text: ['from client import fetch_user, save_user', '', '', 'def sync(user_id):', '    save_user(fetch_user(user_id))'] },
            solution: 'crsW.',
          },
        ],
      },
    },
    {
      id: 'smart-substitute',
      title: 'Smart Substitute (abolish)',
      chips: [':S'],
      keyCards: [{ key: ':S', glyph: 'aA→bB', label: 'substitute variants', sub: ':S/pat{a,b}/rep{x,y}/g' }],
      intro: (
        <>
          <p>
            <Code>:S</Code> (<Code>:Subvert</Code>) is <Code>:s</Code> that keeps case. <Code>:%S/user/account/g</Code>{' '}
            turns <Mono>user</Mono>, <Mono>User</Mono> and <Mono>USER</Mono> into <Mono>account</Mono>,{' '}
            <Mono>Account</Mono> and <Mono>ACCOUNT</Mono> in one pass.
          </p>
          <p>
            Braces list variants that pair up by position: <Code>:S/child{'{,ren}'}/item{'{,s}'}/g</Code> maps{' '}
            <Mono>child</Mono> to <Mono>item</Mono> and <Mono>children</Mono> to <Mono>items</Mono>.
          </p>
        </>
      ),
      practice: total => (
        <p>
          Rename with one <Code>:S</Code> command. {total} rounds.
        </p>
      ),
      aside: {
        title: 'Swapping words',
        body: (
          <p>
            Because every match is replaced in one go, <Code>:S/{'{min,max}'}/{'{max,min}'}/g</Code> swaps the two
            words without a temporary name. Add <Code>w</Code> to the flags to match whole words only.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        base: { name: 'store.ts', plugins: ['abolish'] },
        rounds: [
          {
            prompt: 'Rename user to account, every case.',
            setup: {
              text: ["const USER_KEY = 'user';", 'export class UserStore {', '  user: User | null = null;', '}'],
              cursor: { line: 0, col: 0 },
            },
            goal: { text: ["const ACCOUNT_KEY = 'account';", 'export class AccountStore {', '  account: Account | null = null;', '}'] },
            solution: ':%S/user/account/g<CR>',
          },
          {
            prompt: 'Rename child/children to item/items.',
            setup: {
              name: 'tree.ts',
              text: ['const children = node.children;', 'for (const child of children) visit(child);', 'return children.length;'],
              cursor: { line: 0, col: 0 },
            },
            goal: { text: ['const items = node.items;', 'for (const item of items) visit(item);', 'return items.length;'] },
            solution: ':%S/child{,ren}/item{,s}/g<CR>',
          },
          {
            prompt: 'min and max are the wrong way round.',
            setup: {
              name: 'range.ts',
              text: ['export function bounds(a: number, b: number) {', '  const lo = Math.max(a, b), hi = Math.min(a, b);', '  return [lo, hi];', '}'],
              cursor: { line: 1, col: 2 },
            },
            goal: { text: ['export function bounds(a: number, b: number) {', '  const lo = Math.min(a, b), hi = Math.max(a, b);', '  return [lo, hi];', '}'] },
            solution: ':S/{min,max}/{max,min}/g<CR>',
          },
          {
            prompt: 'We rent buildings now, not facilities.',
            setup: {
              name: 'NOTES.md',
              text: ['## Facilities', '', 'Each facility has a manager. FACILITY codes are unique.'],
              cursor: { line: 0, col: 0 },
            },
            goal: { text: ['## Buildings', '', 'Each building has a manager. BUILDING codes are unique.'] },
            solution: ':%S/facilit{y,ies}/building{,s}/g<CR>',
          },
        ],
      },
    },
  ],
};
