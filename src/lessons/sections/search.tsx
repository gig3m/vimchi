import { Code, Mono } from '../../components/Code';
import { BeforeAfter, Motions } from '../../components/diagrams';
import type { Section, Setup } from '../types';

const retry: Setup = {
  name: 'retry.ts',
  text: [
    "import { sleep } from './time';",
    '',
    'export async function withRetry<T>(',
    '  fn: () => Promise<T>,',
    '  retries = 3,',
    '): Promise<T> {',
    '  let lastError: unknown;',
    '  for (let attempt = 0; attempt <= retries; attempt++) {',
    '    try {',
    '      return await fn();',
    '    } catch (err) {',
    '      lastError = err;',
    '      await sleep(2 ** attempt * 100);',
    '    }',
    '  }',
    '  throw lastError;',
    '}',
  ],
};

const options: Setup = {
  name: 'options.lua',
  text: [
    'local opt = vim.opt',
    '',
    'opt.number = true',
    'opt.relativenumber = true',
    'opt.tabstop = 2',
    'opt.shiftwidth = 2',
    '',
    "vim.keymap.set('n', '<leader>w', '<cmd>write<CR>')",
    "vim.keymap.set('n', '<leader>q', '<cmd>quit<CR>')",
  ],
};

export const search: Section = {
  id: 'search',
  title: 'Search',
  band: 'core',
  lessons: [
    {
      id: 'search-forward',
      title: 'Search Forward',
      chips: ['/', 'n', 'N'],
      keyCards: [
        { key: '/', glyph: '/→', label: 'search forward' },
        { key: 'n', glyph: '→', label: 'next match' },
        { key: 'N', glyph: '←', label: 'previous match' },
      ],
      intro: (
        <>
          <p>
            <Code>/</Code> opens a search prompt at the bottom. Type a pattern and press <Code>enter</Code>: the cursor jumps
            to the next match. <Code>n</Code> goes to the match after that, <Code>N</Code> back to the one before.
          </p>
          <p>
            Search is the fastest way to cross a file. Type just enough to be unique: <Code>/sleep(</Code> skips the import
            and lands on the call.
          </p>
          <Motions
            text="import { sleep } from './time'; await sleep(100);"
            cursor={0}
            keys={['/sleep<CR>', '/sleep(<CR>']}
            caption="Each pattern lands on the first match after the cursor."
          />
        </>
      ),
      practice: total => (
        <p>
          Reach the <span className="hl-green">green box</span> with a search, then <Code>n</Code> or <Code>N</Code> if
          you need to. {total} rounds.
        </p>
      ),
      aside: {
        title: 'Counts and wrapping',
        body: (
          <p>
            <Code>3n</Code> skips ahead three matches. At the end of the file the search wraps to the top and says so;{' '}
            <Code>:set nowrapscan</Code> makes it stop instead.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        showGoal: false,
        base: { ...retry, cursor: { line: 0, col: 0 } },
        rounds: [
          { goal: { cursor: { line: 10, col: 6 } }, solution: '/catch<CR>' },
          { setup: { cursor: { line: 6, col: 2 } }, goal: { cursor: { line: 12, col: 12 } }, solution: '/sleep(<CR>' },
          { setup: { cursor: { line: 9, col: 6 } }, goal: { cursor: { line: 15, col: 2 } }, solution: '/throw<CR>' },
          { goal: { cursor: { line: 15, col: 8 } }, solution: '/lastError<CR>2n' },
          {
            prompt: 'The last search was "retries".',
            setup: { search: 'retries', cursor: { line: 4, col: 2 } },
            goal: { cursor: { line: 7, col: 35 } },
            solution: 'n',
          },
          {
            prompt: 'The last search was "attempt".',
            setup: { search: 'attempt', cursor: { line: 12, col: 6 } },
            goal: { cursor: { line: 7, col: 44 } },
            solution: 'N',
          },
        ],
      },
    },
    {
      id: 'search-backward',
      title: 'Search Backward',
      chips: ['?'],
      keyCards: [{ key: '?', glyph: '←?', label: 'search backward' }],
      intro: (
        <>
          <p>
            <Code>?</Code> works like <Code>/</Code> but searches up the file, towards the top.
          </p>
          <p>
            After a <Code>?</Code> search, <Code>n</Code> keeps going backwards and <Code>N</Code> goes forwards.{' '}
            <Code>n</Code> always means "same direction as the last search".
          </p>
        </>
      ),
      practice: total => (
        <p>
          The cursor starts low in the file. Reach the <span className="hl-green">green box</span> above it with{' '}
          <Code>?</Code>. {total} rounds.
        </p>
      ),
      aside: {
        title: 'Search history',
        body: (
          <p>
            At the <Code>/</Code> or <Code>?</Code> prompt, <Code>C-p</Code> and <Code>C-n</Code> (or the arrow keys) step
            through earlier searches, so you rarely retype a long pattern.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        showGoal: false,
        base: { ...retry, cursor: { line: 15, col: 2 } },
        rounds: [
          { goal: { cursor: { line: 9, col: 19 } }, solution: '?fn<CR>' },
          { goal: { cursor: { line: 8, col: 4 } }, solution: '?try<CR>' },
          { setup: { cursor: { line: 12, col: 6 } }, goal: { cursor: { line: 7, col: 7 } }, solution: '?let<CR>' },
          { setup: { cursor: { line: 11, col: 6 } }, goal: { cursor: { line: 0, col: 0 } }, solution: '?import<CR>' },
          { goal: { cursor: { line: 9, col: 13 } }, solution: '?await<CR>n' },
          { setup: { cursor: { line: 7, col: 8 } }, goal: { cursor: { line: 5, col: 3 } }, solution: '?Promise<CR>' },
        ],
      },
    },
    {
      id: 'word-under-cursor',
      title: 'Word Under Cursor',
      chips: ['*', '#'],
      keyCards: [
        { key: '*', glyph: 'w→', label: 'next same word' },
        { key: '#', glyph: '←w', label: 'previous same word' },
      ],
      intro: (
        <>
          <p>
            <Code>*</Code> searches forward for the word under the cursor, <Code>#</Code> searches backward. No typing
            needed.
          </p>
          <p>
            They match whole words only: <Code>*</Code> on <Mono>err</Mono> skips <Mono>errs</Mono>. Afterwards{' '}
            <Code>n</Code> and <Code>N</Code> keep going with the same word.
          </p>
        </>
      ),
      practice: total => (
        <p>
          Put the cursor's word to work: reach the <span className="hl-green">green box</span> with <Code>*</Code> or{' '}
          <Code>#</Code>. {total} rounds.
        </p>
      ),
      aside: {
        title: 'Partial matches',
        body: (
          <>
            <p>
              <Code>g*</Code> and <Code>g#</Code> drop the whole-word rule, so <Code>g*</Code> on <Mono>err</Mono> stops
              inside <Mono>errs</Mono> too.
            </p>
            <Motions text="let err = errs[0] ?? err;" cursor={4} keys={['*', 'g*']} />
          </>
        ),
      },
      challenge: {
        kind: 'rounds',
        showGoal: false,
        base: retry,
        rounds: [
          { setup: { cursor: { line: 4, col: 2 } }, goal: { cursor: { line: 7, col: 35 } }, solution: '*' },
          { setup: { cursor: { line: 10, col: 13 } }, goal: { cursor: { line: 11, col: 18 } }, solution: '*' },
          { setup: { cursor: { line: 15, col: 8 } }, goal: { cursor: { line: 11, col: 6 } }, solution: '#' },
          { setup: { cursor: { line: 12, col: 12 } }, goal: { cursor: { line: 0, col: 9 } }, solution: '#' },
          { setup: { cursor: { line: 2, col: 32 } }, goal: { cursor: { line: 3, col: 20 } }, solution: '*' },
          { setup: { cursor: { line: 7, col: 11 } }, goal: { cursor: { line: 7, col: 44 } }, solution: '2*' },
        ],
      },
    },
    {
      id: 'search-as-motion',
      title: 'Search as a Motion',
      chips: ['d/', 'c/'],
      keyCards: [
        { key: 'd/', glyph: 'del→/', label: 'delete to match' },
        { key: 'c/', glyph: '✎→/', label: 'change to match' },
      ],
      intro: (
        <>
          <p>
            A search is a motion, so operators take it. <Code>d/return</Code> then <Code>enter</Code> deletes from the
            cursor up to the next <Mono>return</Mono>, across lines if needed. The match itself stays.
          </p>
          <p>
            Use it when the end of the edit is easier to name than to count: a keyword, a heading, the next place a word
            appears.
          </p>
        </>
      ),
      practice: total => (
        <p>
          Delete or change up to a search match to reach the goal. {total} rounds.
        </p>
      ),
      aside: {
        title: 'Include the match',
        body: (
          <p>
            Search motions stop before the match. Add an end offset to eat it too: <Code>d/foo/e</Code> deletes through
            the last letter of <Mono>foo</Mono>.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        base: { name: 'cart.ts' },
        rounds: [
          {
            prompt: 'Delete the debug lines, up to "return".',
            setup: {
              text: [
                'function total(items: Item[]) {',
                '  console.log(items);',
                '  debugger;',
                '  return items.reduce((sum, i) => sum + i.price, 0);',
                '}',
              ],
              cursor: { line: 1, col: 2 },
            },
            goal: { text: ['function total(items: Item[]) {', '  return items.reduce((sum, i) => sum + i.price, 0);', '}'] },
            solution: 'd/return<CR>',
          },
          {
            prompt: 'Drop the admin check, up to the next "user".',
            setup: {
              text: [
                'function canEdit(user: User) {',
                "  if (user.role === 'admin' || user.role === 'owner') {",
                '    return true;',
                '  }',
                '  return false;',
                '}',
              ],
              cursor: { line: 1, col: 6 },
            },
            goal: {
              text: [
                'function canEdit(user: User) {',
                "  if (user.role === 'owner') {",
                '    return true;',
                '  }',
                '  return false;',
                '}',
              ],
            },
            solution: 'd/user<CR>',
          },
          {
            prompt: 'Replace the concatenation with full_name.',
            setup: {
              name: 'users.sql',
              text: ['SELECT', '  id,', "  first_name || ' ' || last_name AS name", 'FROM users;'],
              cursor: { line: 0, col: 0 },
            },
            goal: { text: ['SELECT', '  id,', '  full_name AS name', 'FROM users;'] },
            solution: '/first<CR>c/ AS<CR>full_name<Esc>',
          },
          {
            prompt: 'Delete the fields before "version".',
            setup: {
              name: 'package.json',
              text: ['{', '  "name": "vimchi",', '  "private": true,', '  "type": "module",', '  "version": "0.1.0"', '}'],
              cursor: { line: 2, col: 2 },
            },
            goal: { text: ['{', '  "name": "vimchi",', '  "version": "0.1.0"', '}'] },
            solution: 'd/"version<CR>',
          },
          {
            prompt: 'Delete the outdated section, up to "## Usage".',
            setup: {
              name: 'README.md',
              text: ['# vimchi', '', '## Install (old)', '', 'Download the zip.', '', '## Usage', '', 'Run vimchi.'],
              cursor: { line: 2, col: 0 },
            },
            goal: { text: ['# vimchi', '', '## Usage', '', 'Run vimchi.'] },
            solution: 'd/## Usage<CR>',
          },
        ],
      },
    },
    {
      id: 'change-next-match',
      title: 'Change Next Match',
      chips: ['gn', 'cgn', '.'],
      keyCards: [
        { key: 'gn', glyph: '[/]', label: 'select next match' },
        { key: 'cgn', glyph: '✎/', label: 'change next match' },
        { key: '.', glyph: '↻', label: 'do it again' },
      ],
      intro: (
        <>
          <p>
            <Code>gn</Code> is a text object for the next search match. <Code>cgn</Code> changes it,{' '}
            <Code>dgn</Code> deletes it, <Code>gUgn</Code> uppercases it.
          </p>
          <p>
            The payoff is <Code>.</Code>: it repeats the change on the <em>next</em> match, no <Code>n</Code> needed.
            Search once, change once, then press <Code>.</Code> for every other occurrence.
          </p>
          <BeforeAfter
            lines={['const data = await load();', 'render(data);', 'save(data);']}
            cursor={[0, 6]}
            keys="*cgnrows<Esc>.."
          />
        </>
      ),
      practice: total => (
        <p>
          Change every match with one <Code>gn</Code> edit and some <Code>.</Code>s. {total} rounds.
        </p>
      ),
      aside: {
        title: 'A safer :s',
        body: (
          <p>
            Unlike <Code>:%s</Code>, you see each change as it happens and can stop early. To leave one match alone, move
            past it before pressing <Code>.</Code> again.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        base: { name: 'report.ts' },
        rounds: [
          {
            prompt: 'Rename every "data" to "rows".',
            setup: {
              text: ['const data = await load();', 'render(data);', 'cache.set(key, data);'],
              cursor: { line: 0, col: 6 },
            },
            goal: { text: ['const rows = await load();', 'render(rows);', 'cache.set(key, rows);'] },
            solution: '*cgnrows<Esc>..',
          },
          {
            prompt: 'The last search was "print". Make each one "log".',
            setup: {
              name: 'boot.lua',
              text: ["print('start')", "print('loading')", "print('done')"],
              search: 'print',
              cursor: { line: 0, col: 0 },
            },
            goal: { text: ["log('start')", "log('loading')", "log('done')"] },
            solution: 'cgnlog<Esc>..',
          },
          {
            prompt: 'Delete every " !important".',
            setup: {
              name: 'overrides.css',
              text: ['.btn { color: red !important; }', '.nav { margin: 0 !important; }', '.card { padding: 8px !important; }'],
              search: ' !important',
              cursor: { line: 0, col: 0 },
            },
            goal: { text: ['.btn { color: red; }', '.nav { margin: 0; }', '.card { padding: 8px; }'] },
            solution: 'dgn..',
          },
          {
            prompt: 'Uppercase every "todo".',
            setup: {
              name: 'plan.md',
              text: ['- todo: write tests', '- todo: update docs', '- done: tag release', '- todo: announce'],
              search: 'todo',
              cursor: { line: 0, col: 0 },
            },
            goal: { text: ['- TODO: write tests', '- TODO: update docs', '- done: tag release', '- TODO: announce'] },
            solution: 'gUgn..',
          },
          {
            prompt: 'Rename "cfg" to "config" everywhere.',
            setup: {
              text: ['const cfg = loadConfig();', 'if (cfg.debug) enableLogs(cfg);', 'export default cfg;'],
              cursor: { line: 0, col: 0 },
            },
            goal: { text: ['const config = loadConfig();', 'if (config.debug) enableLogs(config);', 'export default config;'] },
            solution: '/cfg<CR>cgnconfig<Esc>...',
          },
        ],
      },
    },
    {
      id: 'search-offsets',
      title: 'Search Offsets',
      chips: ['/e', '/+1'],
      keyCards: [
        { key: '/e', glyph: '→|', label: 'land on match end' },
        { key: '/+1', glyph: '↓', label: 'line below match' },
      ],
      intro: (
        <>
          <p>
            A search can say where to land. <Code>/tabstop/e</Code> puts the cursor on the last letter of the match.{' '}
            <Code>/e+1</Code> goes one character past it, which is handy for landing on a value after its name.
          </p>
          <p>
            A plain number moves by lines instead: <Code>/keymap/+1</Code> lands at the start of the line below the match,{' '}
            <Code>/tabstop/-1</Code> on the line above.
          </p>
          <Motions
            text="opt.shiftwidth = 2"
            cursor={0}
            keys={['/shift<CR>', '/shift/e<CR>', '/= /e+1<CR>']}
          />
        </>
      ),
      practice: total => (
        <p>
          Reach the <span className="hl-green">green box</span> with one search and an offset. {total} rounds.
        </p>
      ),
      aside: {
        title: 'Offsets stick',
        body: (
          <p>
            <Code>n</Code> reuses the offset along with the pattern. <Code>//e</Code> keeps the last pattern and gives it a
            new offset, and <Code>/s-1</Code> or <Code>/b+2</Code> count from the start of the match.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        showGoal: false,
        base: { ...options, cursor: { line: 0, col: 0 } },
        rounds: [
          { goal: { cursor: { line: 4, col: 10 } }, solution: '/tabstop/e<CR>' },
          { prompt: 'Land on the shiftwidth value.', goal: { cursor: { line: 5, col: 17 } }, solution: '/shiftwidth = /e+1<CR>' },
          { goal: { cursor: { line: 8, col: 0 } }, solution: '/keymap/+1<CR>' },
          { goal: { cursor: { line: 3, col: 0 } }, solution: '/tabstop/-1<CR>' },
          {
            prompt: 'The last search was "keymap". Land on its end.',
            setup: { search: 'keymap' },
            goal: { cursor: { line: 7, col: 9 } },
            solution: '//e<CR>',
          },
        ],
      },
    },
    {
      id: 'clear-highlights',
      title: 'Clear Highlights',
      chips: [':noh', 'C-l'],
      keyCards: [
        { key: ':noh', glyph: '⊘', label: 'hide highlights' },
        { key: 'C-l', glyph: '⟳', label: 'redraw and clear' },
      ],
      intro: (
        <>
          <p>
            Neovim highlights every match of the last search and leaves them lit. <Code>:noh</Code> (short for{' '}
            <Code>:nohlsearch</Code>) turns them off until the next search.
          </p>
          <p>
            <Code>C-l</Code> redraws the screen, and in Neovim it also runs <Code>:noh</Code>. The pattern is kept:{' '}
            <Code>n</Code> still works and brings the highlights back.
          </p>
        </>
      ),
      practice: total => (
        <p>
          Get to the box if there is one, then clear the highlights. {total} rounds.
        </p>
      ),
      aside: {
        title: 'In Vim',
        body: (
          <p>
            Classic Vim's <Code>C-l</Code> only redraws, and <Code>hlsearch</Code> is off by default. Many configs map{' '}
            <Code>esc</Code> to <Code>:noh</Code> instead.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        showGoal: false,
        base: { ...options, cursor: { line: 0, col: 0 } },
        rounds: [
          {
            prompt: 'Clear the "opt" highlights with :noh.',
            setup: { search: 'opt' },
            goal: { check: vim => !vim.hlActive },
            solution: ':noh<CR>',
          },
          {
            prompt: 'Clear the "vim" highlights with C-l.',
            setup: { search: 'vim' },
            goal: { check: vim => !vim.hlActive },
            solution: '<C-l>',
          },
          {
            prompt: 'Search your way to the box, then clear.',
            goal: { cursor: { line: 7, col: 22 }, check: vim => !vim.hlActive },
            solution: '/leader<CR><C-l>',
          },
          {
            prompt: 'Jump to the next "opt" with *, then clear.',
            setup: { cursor: { line: 0, col: 6 } },
            goal: { cursor: { line: 0, col: 16 }, check: vim => !vim.hlActive },
            solution: '*<C-l>',
          },
        ],
      },
    },
  ],
};
