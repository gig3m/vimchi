import { Code, Mono } from '../../components/Code';
import type { Section } from '../types';

const auth = [
  "import { hash, verify } from './crypto';",
  "import { db } from './db';",
  '',
  'export async function login(email: string, pw: string) {',
  '  const user = await db.users.find({ email });',
  "  if (!user) throw new Error('unknown email');",
  '  const ok = await verify(pw, user.passwordHash);',
  "  if (!ok) throw new Error('wrong password');",
  '  return createSession(user.id);',
  '}',
  '',
  'export async function register(email: string, pw: string) {',
  '  const passwordHash = await hash(pw);',
  '  return db.users.insert({ email, passwordHash });',
  '}',
];

export const jumping: Section = {
  id: 'jumping',
  title: 'Jumping',
  band: 'plugins',
  lessons: [
    {
      id: 'flash-jump',
      title: 'Label Jumps',
      chips: ['s'],
      keyCards: [{ key: 's', glyph: '⚡', label: 'jump', sub: 's{chars}{label}' }],
      intro: (
        <>
          <p>
            flash.nvim turns <Code>s</Code> into a jump to anywhere on screen. Press <Code>s</Code> and type the first
            letters of where you want to go. Every match gets a label, a letter on a pink background; type the label
            and the cursor is there.
          </p>
          <p>
            Two letters are usually enough. The nearest matches get the easiest labels, and no label is ever a letter
            that could continue what you're typing, so you can keep typing until the label appears.
          </p>
        </>
      ),
      practice: total => (
        <p>
          Reach the <span className="hl-green">green box</span>: <Code>s</Code>, two letters of the target, then its
          label. {total} rounds.
        </p>
      ),
      aside: {
        title: 'leap and hop',
        body: (
          <p>
            leap.nvim (<Code>s</Code> plus two characters, then a label) and hop.nvim do the same job. flash replaces
            the built-in <Code>s</Code>; <Code>cl</Code> does what <Code>s</Code> did.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        showGoal: false,
        base: { name: 'auth.ts', text: auth, plugins: ['flash'] },
        rounds: [
          { setup: { cursor: { line: 0, col: 0 } }, goal: { cursor: { line: 8, col: 9 } }, solution: 'scrs' },
          { setup: { cursor: { line: 4, col: 2 } }, goal: { cursor: { line: 7, col: 11 } }, solution: 'sths' },
          { setup: { cursor: { line: 12, col: 2 } }, goal: { cursor: { line: 3, col: 22 } }, solution: 'sloa' },
          { setup: { cursor: { line: 8, col: 2 } }, goal: { cursor: { line: 13, col: 18 } }, solution: 'sinj' },
          { setup: { cursor: { line: 6, col: 2 } }, goal: { cursor: { line: 5, col: 23 } }, solution: 'sErs' },
          { setup: { cursor: { line: 13, col: 2 } }, goal: { cursor: { line: 1, col: 9 } }, solution: 'sdbd' },
        ],
      },
    },
    {
      id: 'flash-motions',
      title: 'Jumps as Motions',
      chips: ['d', 's'],
      keyCards: [
        { key: 'd', glyph: 'del', label: 'any operator' },
        { key: 's', glyph: '⚡', label: 'to the label' },
      ],
      intro: (
        <>
          <p>
            After an operator, <Code>s</Code> is a motion: <Code>d</Code>, <Code>s</Code>, a few letters and a label
            deletes from the cursor to that match. <Code>c</Code>, <Code>y</Code> and visual mode work the same way.
          </p>
          <p>
            Forward, the match's first character is included, as with <Code>f</Code>. Backward, the text from the
            match up to the cursor goes. Either way the target can be on another line.
          </p>
        </>
      ),
      practice: total => (
        <p>
          Use <Code>d</Code> or <Code>c</Code> with an <Code>s</Code> jump. {total} rounds.
        </p>
      ),
      aside: {
        title: 'Remote actions',
        body: (
          <p>
            flash also has <Code>r</Code> in operator-pending mode: <Code>yr</Code>, a jump, then a text object yanks
            something elsewhere on screen and brings the cursor back.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        base: { name: 'user.ts', plugins: ['flash'] },
        rounds: [
          {
            prompt: 'Delete the role field, backwards from email.',
            setup: {
              text: ['const user = {', '  id: 1,', "  name: 'Ada', role: 'admin', email: 'ada@example.com',", '};'],
              cursor: { line: 2, col: 30 },
            },
            goal: { text: ['const user = {', '  id: 1,', "  name: 'Ada', email: 'ada@example.com',", '};'] },
            solution: 'dsroa',
          },
          {
            prompt: 'Delete the filter step, backwards from .map.',
            setup: { text: ['const names = users', '  .filter(u => u.active)', '  .map(u => u.name);'], cursor: { line: 2, col: 2 } },
            goal: { text: ['const names = users', '  .map(u => u.name);'] },
            solution: 'ds.fa',
          },
          {
            prompt: 'Replace the ternary with plural(count, \'item\').',
            setup: { text: ['const label = count === 1', "  ? 'item'", "  : 'items';"], cursor: { line: 0, col: 14 } },
            goal: { text: "const label = plural(count, 'item');" },
            solution: "cs';aplural(count, 'item')<Esc>",
          },
          {
            prompt: 'Drop useEffect and useMemo.',
            setup: {
              name: 'App.tsx',
              text: ['import {', '  useState, useEffect, useMemo, useCallback,', "} from 'react';", '', 'export function App() {'],
              cursor: { line: 1, col: 32 },
            },
            goal: { text: ['import {', '  useState, useCallback,', "} from 'react';", '', 'export function App() {'] },
            solution: 'dsuss',
          },
        ],
      },
    },
    {
      id: 'flash-treesitter',
      title: 'Treesitter Select',
      chips: ['S'],
      keyCards: [{ key: 'S', glyph: '⚡{ }', label: 'select a node', sub: 'S{label}' }],
      intro: (
        <>
          <p>
            <Code>S</Code> labels the syntax nodes around the cursor: the word, the call it's in, the argument list,
            the statement, the block, the function. The same label sits at both ends of each node. Type one and that
            node is selected in visual mode.
          </p>
          <p>
            From there any visual command applies: <Code>d</Code>, <Code>c</Code>, <Code>y</Code>. Press{' '}
            <Code>V</Code> first to make the selection linewise when you're removing whole lines.
          </p>
        </>
      ),
      practice: total => (
        <p>
          Select the node with <Code>S</Code> and a label, then change or delete it. {total} rounds.
        </p>
      ),
      aside: {
        title: 'Incremental selection',
        body: (
          <p>
            nvim-treesitter's incremental selection grows a selection one node at a time; flash's labels skip the
            stepping. The labels start at the innermost node and go outward: <Mono>a</Mono>, <Mono>s</Mono>,{' '}
            <Mono>d</Mono>…
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        base: { name: 'app.ts', plugins: ['flash'] },
        rounds: [
          {
            prompt: 'Delete the argument of sum().',
            setup: {
              text: ['export function checkout(items: Item[]) {', '  const total = sum(items.map(price));', '  return charge(total);', '}'],
              cursor: { line: 1, col: 31 },
            },
            goal: { text: ['export function checkout(items: Item[]) {', '  const total = sum();', '  return charge(total);', '}'] },
            solution: 'Sdd',
          },
          {
            prompt: 'Pass reload as the callback.',
            setup: { text: ['function scheduleRefresh() {', '  setTimeout(() => refresh(true), 1000);', '}'], cursor: { line: 1, col: 19 } },
            goal: { text: ['function scheduleRefresh() {', '  setTimeout(reload, 1000);', '}'] },
            solution: 'Sdcreload<Esc>',
          },
          {
            prompt: 'Turn retries off: replace the object with false.',
            setup: { text: ['const config = {', '  retry: { count: 3, delay: 500 },', '  cache: true,', '};'], cursor: { line: 1, col: 11 } },
            goal: { text: ['const config = {', '  retry: false,', '  cache: true,', '};'] },
            solution: 'Sdcfalse<Esc>',
          },
          {
            prompt: 'Remove the whole if block.',
            setup: { text: ['function save() {', '  if (dirty) {', '    write();', '  }', '  close();', '}'], cursor: { line: 2, col: 4 } },
            goal: { text: ['function save() {', '  close();', '}'] },
            solution: 'SgVd',
          },
        ],
      },
    },
  ],
};
