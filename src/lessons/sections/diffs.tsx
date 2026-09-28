import { Code } from '../../components/Code';
import type { Vim } from '../../vim/editor';
import type { Section } from '../types';

const file = (...lines: string[]) => lines.join('\n') + '\n';

const PROD = [
  '{',
  '  "port": 8080,',
  '  "logLevel": "warn",',
  '  "database": {',
  '    "host": "db.internal",',
  '    "pool": 20',
  '  },',
  '  "features": {',
  '    "newCheckout": true,',
  '    "betaSearch": false',
  '  },',
  '  "cacheTtl": 300',
  '}',
];
const STAGING = [
  '{',
  '  "port": 8080,',
  '  "logLevel": "debug",',
  '  "database": {',
  '    "host": "db.staging.internal",',
  '    "pool": 5',
  '  },',
  '  "features": {',
  '    "newCheckout": true,',
  '    "betaSearch": true',
  '  },',
  '  "cacheTtl": 300,',
  '  "seedData": true',
  '}',
];
const CONFIG = { 'config/production.json': file(...PROD), 'config/staging.json': file(...STAGING) };

const inDiff = (vim: Vim) => vim.tab.windows().filter(w => w.opts.diff).length;
const windows = (n: number) => (vim: Vim) => vim.tab.windows().length === n;
/** production.json on the right, staging.json on the left, both in diff mode. */
const sideBySide = (focus: 'production' | 'staging') => (vim: Vim) => {
  vim.ex('vert diffsplit config/staging.json');
  if (focus === 'production') vim.focusWindow(vim.tab.windows()[1]);
};
const staging = (vim: Vim) => vim.findBuffer('config/staging.json')!.lines;
const same = (a: string[], b: string[]) => a.join('\n') === b.join('\n');

const PRICING = [
  "export const CURRENCY = 'GBP';",
  '',
  '<<<<<<< HEAD',
  'export const TAX_RATE = 0.2;',
  '=======',
  'export const TAX_RATE = 0.21;',
  '>>>>>>> feature/eu-tax',
  '',
  'export function withTax(cents: number): number {',
  '<<<<<<< HEAD',
  '  return Math.round(cents * (1 + TAX_RATE));',
  '=======',
  '  return Math.ceil(cents * (1 + TAX_RATE));',
  '>>>>>>> feature/eu-tax',
  '}',
];
const resolved = (first: 2 | 3, second: 2 | 3 | null) => [
  ...PRICING.slice(0, 2),
  PRICING[first === 2 ? 3 : 5],
  ...PRICING.slice(7, 9),
  ...(second ? [PRICING[second === 2 ? 10 : 12]] : PRICING.slice(9, 14)),
  '}',
];
const CONFLICT = { 'src/pricing.ts': file(...PRICING) };

export const diffs: Section = {
  id: 'diffs',
  title: 'Diffs & Merges',
  band: 'plugins',
  lessons: [
    {
      id: 'diff-mode',
      title: 'Diff Mode',
      chips: [':diffsplit', ']c', '[c'],
      keyCards: [
        { key: ':diffsplit', glyph: '▯▯', label: 'diff with a file' },
        { key: ']c', glyph: '↓', label: 'next change' },
        { key: '[c', glyph: '↑', label: 'previous change' },
      ],
      intro: (
        <>
          <p>
            <Code>:diffsplit file</Code> opens another file in a split and compares the two. Changed lines are
            highlighted, the changed part of each line brighter, and dashed filler lines stand in for lines only the
            other side has. <Code>:vert diffsplit</Code> puts them side by side.
          </p>
          <p>
            <Code>]c</Code> and <Code>[c</Code> jump to the next and previous change. For two files that are already
            open, <Code>:windo diffthis</Code> starts diff mode in both, and <Code>:diffoff!</Code> ends it.
          </p>
        </>
      ),
      practice: total => <p>Compare the production and staging configs. {total} rounds.</p>,
      aside: {
        title: 'Always vertical',
        body: (
          <p>
            <Code>set diffopt+=vertical</Code> makes plain <Code>:diffsplit</Code> split side by side. From a shell,{' '}
            <Code>nvim -d a b</Code> opens two files in diff mode.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        base: { files: CONFIG, open: 'config/production.json', plugins: ['diff'], height: 16 },
        rounds: [
          {
            prompt: 'Diff production.json against config/staging.json, side by side.',
            goal: { check: vim => inDiff(vim) === 2 && vim.tab.root.type === 'row' },
            solution: ':vert diffsplit config/staging.json<CR>',
          },
          {
            prompt: 'Jump to the first change.',
            setup: { init: sideBySide('production') },
            goal: { cursor: { line: 2, col: 0 } },
            solution: ']c',
          },
          {
            prompt: 'Jump to the third change.',
            setup: { init: sideBySide('production') },
            goal: { cursor: { line: 9, col: 0 } },
            solution: '3]c',
          },
          {
            prompt: 'Jump back to the change before the cursor.',
            setup: { init: vim => { sideBySide('staging')(vim); vim.setCursor({ line: 7, col: 4 }); } },
            goal: { cursor: { line: 4, col: 0 } },
            solution: '[c',
          },
          {
            prompt: 'Both configs are open side by side. Turn on diff mode in both windows.',
            setup: { init: vim => vim.ex('vsplit config/staging.json') },
            goal: { check: vim => inDiff(vim) === 2 },
            solution: ':windo diffthis<CR>',
          },
          {
            prompt: 'Turn diff mode off in every window.',
            setup: { init: sideBySide('production') },
            goal: { check: vim => inDiff(vim) === 0 },
            solution: ':diffoff!<CR>',
          },
        ],
      },
    },
    {
      id: 'diff-obtain-put',
      title: 'Obtain & Put',
      chips: ['do', 'dp'],
      keyCards: [
        { key: 'do', glyph: '←', label: 'obtain the change', sub: 'diff obtain' },
        { key: 'dp', glyph: '→', label: 'put the change', sub: 'diff put' },
      ],
      intro: (
        <>
          <p>
            In diff mode, <Code>do</Code> (diff obtain) replaces the change under the cursor with the other window's
            version. <Code>dp</Code> (diff put) does the opposite: it copies this window's version over there.
          </p>
          <p>
            Walk the changes with <Code>]c</Code> and decide each one with <Code>do</Code> or <Code>dp</Code>. Both are
            normal edits, so <Code>u</Code> undoes them.
          </p>
        </>
      ),
      practice: total => <p>Move settings between the two configs. {total} rounds.</p>,
      aside: {
        title: 'Ranges',
        body: (
          <p>
            <Code>:diffget</Code> and <Code>:diffput</Code> are the ex versions and take a range, such as{' '}
            <Code>:%diffget</Code> for every change at once. With three buffers in diff mode, name the one you mean:{' '}
            <Code>:diffget staging</Code>.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        base: { files: CONFIG, open: 'config/production.json', plugins: ['diff'], height: 16, init: sideBySide('production') },
        rounds: [
          {
            prompt: "Take staging's logLevel into production.",
            goal: { text: [...PROD.slice(0, 2), STAGING[2], ...PROD.slice(3)] },
            solution: ']cdo',
          },
          {
            prompt: "Put production's database settings into staging.",
            goal: { check: vim => same(staging(vim), [...STAGING.slice(0, 4), ...PROD.slice(4, 6), ...STAGING.slice(6)]) },
            solution: '2]cdp',
          },
          {
            prompt: 'Turn betaSearch on in production, like staging.',
            goal: { text: [...PROD.slice(0, 9), STAGING[9], ...PROD.slice(10)] },
            solution: '3]cdo',
          },
          {
            prompt: 'Bring the seedData setting over from staging.',
            goal: { text: [...PROD.slice(0, 11), ...STAGING.slice(11)] },
            solution: 'G[cdo',
          },
          {
            prompt: "From the staging window, pull in production's database settings.",
            setup: { init: sideBySide('staging') },
            goal: { text: [...STAGING.slice(0, 4), ...PROD.slice(4, 6), ...STAGING.slice(6)] },
            solution: '2]cdo',
          },
        ],
      },
    },
    {
      id: 'diff-merge-conflicts',
      title: 'Merge Conflicts',
      chips: [':diffget //2', '//3', ']c'],
      keyCards: [
        { key: ':diffget //2', glyph: '←', label: 'take ours', sub: 'HEAD' },
        { key: ':diffget //3', glyph: '→', label: 'take theirs', sub: 'the merged branch' },
        { key: ']c', glyph: '↓', label: 'next conflict' },
      ],
      intro: (
        <>
          <p>
            A merge conflict leaves both versions in the file between <Code>{'<<<<<<<'}</Code>,{' '}
            <Code>=======</Code> and <Code>{'>>>>>>>'}</Code>. With the cursor in a conflict,{' '}
            <Code>:diffget //2</Code> keeps ours (the top half, your branch) and <Code>:diffget //3</Code> keeps
            theirs, markers and all gone.
          </p>
          <p>
            The names come from fugitive's <Code>:Gvdiffsplit!</Code>, which shows ours on the left (<Code>//2</Code>
            ), the file in the middle and theirs on the right (<Code>//3</Code>). <Code>]c</Code> jumps to the next
            conflict.
          </p>
        </>
      ),
      practice: total => <p>Resolve the conflicts the way the prompt says. {total} rounds.</p>,
      aside: {
        title: 'Shorter still',
        body: (
          <p>
            In the three-way view fugitive maps <Code>d2o</Code> and <Code>d3o</Code> to the same thing. diffview.nvim
            and git-conflict.nvim (<Code>co</Code>/<Code>ct</Code>) are the popular alternatives.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        base: { files: CONFLICT, open: 'src/pricing.ts', plugins: ['diff', 'fugitive'] },
        rounds: [
          {
            prompt: 'Keep our TAX_RATE (HEAD).',
            setup: { cursor: { line: 3, col: 0 } },
            goal: { text: resolved(2, null) },
            solution: ':diffget //2<CR>',
          },
          {
            prompt: 'Jump to the first conflict and take theirs.',
            setup: { cursor: { line: 0, col: 0 } },
            goal: { text: resolved(3, null) },
            solution: ']c:diffget //3<CR>',
          },
          {
            prompt: 'Take theirs in the second conflict.',
            setup: { cursor: { line: 0, col: 0 } },
            goal: { text: [...PRICING.slice(0, 9), PRICING[12], '}'] },
            solution: '2]c:diffget //3<CR>',
          },
          {
            prompt: 'Resolve both: ours for TAX_RATE, theirs for withTax.',
            setup: { cursor: { line: 0, col: 0 } },
            goal: { text: resolved(2, 3) },
            solution: ']c:diffget //2<CR>]c:diffget //3<CR>',
          },
          {
            prompt: 'Open the three-way diff.',
            goal: { check: windows(3) },
            solution: ':Gvdiffsplit!<CR>',
          },
          {
            prompt: 'In the three-way view, take theirs for TAX_RATE.',
            setup: { cursor: { line: 3, col: 0 }, init: vim => vim.ex('Gvdiffsplit!') },
            goal: { text: resolved(3, null) },
            solution: ':diffget //3<CR>',
          },
        ],
      },
    },
  ],
};
