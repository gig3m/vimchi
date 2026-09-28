import { Code } from '../../components/Code';
import type { Vim } from '../../vim/editor';
import type { Section } from '../types';

// src/utils.ts: four small functions.
const UTILS = [
  'export function slugify(title: string) {',                     // 0
  '  return title',                                               // 1
  '    .toLowerCase()',                                           // 2
  "    .replace(/[^a-z0-9]+/g, '-')",                             // 3
  "    .replace(/^-|-$/g, '');",                                  // 4
  '}',                                                            // 5
  '',                                                             // 6
  'export function truncate(text: string, max = 80) {',           // 7
  '  if (text.length <= max) return text;',                       // 8
  "  return text.slice(0, max - 1) + '…';",                       // 9
  '}',                                                            // 10
  '',                                                             // 11
  'export function debounce(fn: () => void, ms: number) {',       // 12
  '  let timer: ReturnType<typeof setTimeout>;',                  // 13
  '  return () => {',                                             // 14
  '    clearTimeout(timer);',                                     // 15
  '    timer = setTimeout(fn, ms);',                              // 16
  '  };',                                                         // 17
  '}',                                                            // 18
  '',                                                             // 19
  'export function groupBy<T>(xs: T[], key: (x: T) => string) {', // 20
  '  const out: Record<string, T[]> = {};',                       // 21
  '  for (const x of xs) {',                                      // 22
  '    (out[key(x)] ??= []).push(x);',                            // 23
  '  }',                                                          // 24
  '  return out;',                                                // 25
  '}',                                                            // 26
];

/** One fold per function. */
const FN_FOLDS: [number, number][] = [[0, 5], [7, 10], [12, 18], [20, 26]];
const fnFolds = (closed: boolean | boolean[], extra: { start: number; end: number; closed?: boolean }[] = []) => [
  ...FN_FOLDS.map(([start, end], i) => ({ start, end, closed: Array.isArray(closed) ? closed[i] : closed })),
  ...extra,
];

const hasFold = (start: number, end: number) => (vim: Vim) => vim.win.folds.some(f => f.start === start && f.end === end);
const foldAt = (vim: Vim, start: number) => vim.win.folds.find(f => f.start === start);
/** Closed state of the four function folds, e.g. "o c c c". */
const state = (vim: Vim) => FN_FOLDS.map(([s]) => (foldAt(vim, s)?.closed ? 'c' : 'o')).join(' ');

export const folds: Section = {
  id: 'folds',
  title: 'Folds',
  band: 'deep',
  lessons: [
    {
      id: 'creating-folds',
      title: 'Creating Folds',
      chips: ['zf'],
      keyCards: [{ key: 'zf', glyph: '⊟', label: 'fold over motion', sub: 'zfap, zf%, zf2j' }],
      intro: (
        <>
          <p>
            <Code>zf</Code> is an operator that folds the lines a motion covers into one line. <Code>zfap</Code> folds a
            paragraph, <Code>zf%</Code> from an opening brace folds the whole block, and in visual mode <Code>zf</Code>{' '}
            folds the selection.
          </p>
          <p>
            A fold hides detail without deleting it, so you can see the shape of a long file and still have every line
            there.
          </p>
        </>
      ),
      practice: total => (
        <p>
          Fold the lines each round asks for. The new fold closes straight away. {total} rounds.
        </p>
      ),
      aside: {
        title: 'Manual folds',
        body: (
          <p>
            <Code>zf</Code> only works with <Code>foldmethod=manual</Code>, Neovim's default. Configs that fold by
            indent or with treesitter (<Code>foldmethod=expr</Code>) create folds for you, and <Code>zf</Code> reports
            E350.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        base: { name: 'src/utils.ts', text: UTILS, height: 16 },
        rounds: [
          {
            prompt: 'Fold slugify, from its brace to the closing one.',
            setup: { cursor: { line: 0, col: 0 } },
            goal: { check: hasFold(0, 5) },
            solution: '$zf%',
          },
          {
            prompt: 'Fold truncate and the blank line after it.',
            setup: { cursor: { line: 8, col: 2 } },
            goal: { check: hasFold(7, 11) },
            solution: 'zfap',
          },
          {
            prompt: 'Fold the inner arrow function (its braces).',
            setup: { cursor: { line: 15, col: 4 } },
            goal: { check: hasFold(14, 17) },
            solution: 'zfa{',
          },
          {
            prompt: 'Fold the for loop: this line and two more.',
            setup: { cursor: { line: 22, col: 2 } },
            goal: { check: hasFold(22, 24) },
            solution: 'zf2j',
          },
          {
            prompt: 'Select the two body lines of truncate and fold them.',
            setup: { cursor: { line: 8, col: 2 } },
            goal: { check: hasFold(8, 9) },
            solution: 'Vjzf',
          },
          {
            prompt: 'Fold from here to the end of the file.',
            setup: { cursor: { line: 20, col: 0 } },
            goal: { check: hasFold(20, 26) },
            solution: 'zfG',
          },
        ],
      },
    },
    {
      id: 'opening-closing-folds',
      title: 'Opening & Closing',
      chips: ['zo', 'zc', 'za'],
      keyCards: [
        { key: 'zo', glyph: '⊞', label: 'open fold' },
        { key: 'zc', glyph: '⊟', label: 'close fold' },
        { key: 'za', glyph: '⇅', label: 'toggle fold' },
      ],
      intro: (
        <>
          <p>
            With the cursor on a closed fold, <Code>zo</Code> opens it. Inside an open fold, <Code>zc</Code> closes it
            again. <Code>za</Code> toggles: it opens a closed fold and closes an open one.
          </p>
          <p>
            <Code>za</Code> is the one to keep in your fingers. You rarely need to think about which state a fold is in.
          </p>
        </>
      ),
      practice: total => (
        <p>
          Each function in utils.ts has a fold. Open or close the one each round asks for. {total} rounds.
        </p>
      ),
      aside: {
        title: 'Nested folds',
        body: (
          <p>
            <Code>zo</Code> and <Code>zc</Code> work one level at a time. <Code>zO</Code> and <Code>zC</Code> open or
            close every fold under the cursor, however deep.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        base: { name: 'src/utils.ts', text: UTILS, height: 16 },
        rounds: [
          {
            prompt: 'Open the slugify fold.',
            setup: { folds: fnFolds(true), cursor: { line: 0, col: 0 } },
            goal: { check: vim => state(vim) === 'o c c c' },
            solution: 'zo',
          },
          {
            prompt: "Close the fold you're in.",
            setup: { folds: fnFolds(false), cursor: { line: 15, col: 4 } },
            goal: { check: vim => state(vim) === 'o o c o' },
            solution: 'zc',
          },
          {
            prompt: 'Open groupBy, the last function.',
            setup: { folds: fnFolds(true), cursor: { line: 0, col: 0 } },
            goal: { check: vim => state(vim) === 'c c c o' },
            solution: 'Gzo',
          },
          {
            prompt: 'Toggle this fold closed.',
            setup: { folds: fnFolds(false), cursor: { line: 9, col: 2 } },
            goal: { check: vim => state(vim) === 'o c o o' },
            solution: 'za',
          },
          {
            prompt: 'Toggle this fold open.',
            setup: { folds: fnFolds([false, false, true, false]), cursor: { line: 12, col: 0 } },
            goal: { check: vim => state(vim) === 'o o o o' },
            solution: 'za',
          },
          {
            prompt: 'Close slugify, then open truncate below it.',
            setup: { folds: fnFolds([false, true, true, true]), cursor: { line: 3, col: 4 } },
            goal: { check: vim => state(vim) === 'c o c c' },
            solution: 'zcjjza',
          },
        ],
      },
    },
    {
      id: 'all-folds',
      title: 'All Folds',
      chips: ['zR', 'zM'],
      keyCards: [
        { key: 'zR', glyph: '⊞⊞', label: 'open all' },
        { key: 'zM', glyph: '⊟⊟', label: 'close all' },
      ],
      intro: (
        <>
          <p>
            <Code>zR</Code> opens every fold in the window and <Code>zM</Code> closes every one, nested folds
            included.
          </p>
          <p>
            <Code>zM</Code> turns a long file into an outline of its functions. Open the one you need, and{' '}
            <Code>zR</Code> when you want the full text back.
          </p>
        </>
      ),
      practice: total => (
        <p>
          utils.ts has a fold per function, plus one around the for loop in groupBy. {total} rounds.
        </p>
      ),
      aside: {
        title: 'Just enough',
        body: (
          <p>
            <Code>zv</Code> opens just enough folds to show the cursor line. <Code>zMzv</Code> collapses everything
            except where you are.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        base: { name: 'src/utils.ts', text: UTILS, height: 16 },
        rounds: [
          {
            prompt: 'Open every fold.',
            setup: { folds: fnFolds(true, [{ start: 22, end: 24 }]), cursor: { line: 7, col: 0 } },
            goal: { check: vim => vim.win.folds.every(f => !f.closed) },
            solution: 'zR',
          },
          {
            prompt: 'Close every fold.',
            setup: { folds: fnFolds(false, [{ start: 22, end: 24, closed: false }]), cursor: { line: 13, col: 2 } },
            goal: { check: vim => vim.win.folds.every(f => f.closed) },
            solution: 'zM',
          },
          {
            prompt: 'Some are open, some closed. Close them all.',
            setup: { folds: fnFolds([false, true, false, true], [{ start: 22, end: 24, closed: false }]), cursor: { line: 2, col: 4 } },
            goal: { check: vim => vim.win.folds.every(f => f.closed) },
            solution: 'zM',
          },
          {
            prompt: 'Close everything, then open just groupBy.',
            setup: { folds: fnFolds(false, [{ start: 22, end: 24, closed: false }]), cursor: { line: 21, col: 2 } },
            goal: { check: vim => state(vim) === 'c c c o' && foldAt(vim, 22)?.closed === true },
            solution: 'zMzo',
          },
          {
            prompt: 'Open everything, then close debounce again.',
            setup: { folds: fnFolds(true, [{ start: 22, end: 24 }]), cursor: { line: 12, col: 0 } },
            goal: { check: vim => state(vim) === 'o o c o' && foldAt(vim, 22)?.closed === false },
            solution: 'zRzc',
          },
        ],
      },
    },
    {
      id: 'moving-by-folds',
      title: 'Moving by Folds',
      chips: ['zj', 'zk'],
      keyCards: [
        { key: 'zj', glyph: '↓⊟', label: 'next fold start' },
        { key: 'zk', glyph: '↑⊟', label: 'previous fold end' },
      ],
      intro: (
        <>
          <p>
            <Code>zj</Code> moves down to the start of the next fold. <Code>zk</Code> moves up to the end of the
            previous one.
          </p>
          <p>
            With a fold per function they hop from function to function, open or closed. They are motions, so{' '}
            <Code>dzj</Code> deletes down to the next fold.
          </p>
        </>
      ),
      practice: total => (
        <p>
          Every function has an open fold. Reach the <span className="hl-green">green box</span> with <Code>zj</Code>{' '}
          and <Code>zk</Code>. {total} rounds.
        </p>
      ),
      aside: {
        title: 'Inside a fold',
        body: (
          <p>
            <Code>[z</Code> and <Code>]z</Code> move to the start and end of the fold the cursor is in, rather than to
            the next one.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        showGoal: false,
        base: { name: 'src/utils.ts', text: UTILS, height: 16, folds: fnFolds(false) },
        rounds: [
          { setup: { cursor: { line: 2, col: 4 } }, goal: { cursor: { line: 7, col: 0 } }, solution: 'zj' },
          { setup: { cursor: { line: 7, col: 0 } }, goal: { cursor: { line: 20, col: 0 } }, solution: 'zjzj' },
          { setup: { cursor: { line: 16, col: 4 } }, goal: { cursor: { line: 10, col: 0 } }, solution: 'zk' },
          { setup: { cursor: { line: 24, col: 2 } }, goal: { cursor: { line: 10, col: 0 } }, solution: 'zkzk' },
          { setup: { cursor: { line: 9, col: 2 } }, goal: { cursor: { line: 5, col: 0 } }, solution: 'zk' },
          { setup: { cursor: { line: 13, col: 2 } }, goal: { cursor: { line: 20, col: 0 } }, solution: 'zj' },
        ],
      },
    },
  ],
};
