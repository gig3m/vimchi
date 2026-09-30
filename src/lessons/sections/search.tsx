import { Code, Mono } from '../../components/Code';
import { BeforeAfter, Motions } from '../../components/diagrams';
import type { Section, Setup } from '../types';

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
            Search motions stop before the match. Add an end offset (Search Offsets, two lessons on) to take it too: <Code>d/foo/e</Code> deletes through
            the last letter of <Mono>foo</Mono>.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        base: { name: 'cart.ts' },
        rounds: [
          {
            prompt: 'Delete from "It takes" up to "Then", across the line break.',
            setup: {
              name: 'README.md',
              text: [
                '# vimchi',
                'Install the CLI. It takes a minute or two',
                'on a slow network. Then run vimchi init.',
                'The tutor opens in your browser.',
              ],
              cursor: { line: 1, col: 17 },
            },
            goal: { text: ['# vimchi', 'Install the CLI. Then run vimchi init.', 'The tutor opens in your browser.'] },
            solution: 'd/Then<CR>',
          },
          {
            prompt: 'Delete from the cursor up to the second "user" on the line.',
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
            prompt: 'Change the text before " AS" on both lines to "NULL".',
            setup: {
              name: 'users.sql',
              text: ['SELECT', "  first_name || ' ' || last_name AS name,", "  street || ' ' || city AS addr", 'FROM users;'],
              cursor: { line: 1, col: 2 },
            },
            goal: { text: ['SELECT', '  NULL AS name,', '  NULL AS addr', 'FROM users;'] },
            solution: 'c/ AS<CR>NULL<Esc>j^.',
          },
          {
            prompt: 'On all three lines, delete from ":" up to " =".',
            setup: {
              text: ['const a: Map<string, number> = new Map();', 'const b: Set<string> = new Set();', 'const c: string[] = [];'],
              cursor: { line: 0, col: 7 },
            },
            goal: { text: ['const a = new Map();', 'const b = new Set();', 'const c = [];'] },
            solution: 'd/ =<CR>j.j.',
          },
          {
            prompt: 'Delete from "## Install (old)" up to "## Usage".',
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
            <Code>gn</Code> is a text object for the next search match. <Code>cgn</Code> changes it and{' '}
            <Code>dgn</Code> deletes it.
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
            Unlike a substitute (<Code>:%s</Code>, in the Patterns band), you see each change as it happens and can stop early. To leave one match alone, move
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
            prompt: 'The last search was " !important". Delete every match.',
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
            prompt: 'The last search was "todo". Change each one to "TODO".',
            setup: {
              name: 'plan.md',
              text: ['- todo: write tests', '- todo: update docs', '- done: tag release', '- todo: announce'],
              search: 'todo',
              cursor: { line: 0, col: 0 },
            },
            goal: { text: ['- TODO: write tests', '- TODO: update docs', '- done: tag release', '- TODO: announce'] },
            solution: 'cgnTODO<Esc>..',
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
          { prompt: 'Land on the "2" after "shiftwidth =".', goal: { cursor: { line: 5, col: 17 } }, solution: '/shiftwidth = /e+1<CR>' },
          { goal: { cursor: { line: 8, col: 0 } }, solution: '/keymap/+1<CR>' },
          { goal: { cursor: { line: 3, col: 0 } }, solution: '/tabstop/-1<CR>' },
          {
            prompt: 'The last search was "relative". Land on its end.',
            setup: { search: 'relative' },
            goal: { cursor: { line: 3, col: 11 } },
            solution: '//e<CR>',
          },
          {
            prompt: 'Change every "opts" to "opt".',
            setup: {
              text: ['local opts = { noremap = true }', "map('n', 'j', 'gj', opts)", "map('n', 'k', 'gk', opts)"],
            },
            goal: { text: ['local opt = { noremap = true }', "map('n', 'j', 'gj', opt)", "map('n', 'k', 'gk', opt)"] },
            solution: '/opts/e<CR>xn.n.',
          },
          {
            prompt: 'Change "true", "false" and "2" to "nil".',
            setup: {
              text: ['local opt = vim.opt', 'opt.number = true', 'opt.wrap = false', 'opt.tabstop = 2'],
              cursor: { line: 1, col: 0 },
            },
            goal: { text: ['local opt = vim.opt', 'opt.number = nil', 'opt.wrap = nil', 'opt.tabstop = nil'] },
            solution: '/= /e+1<CR>cwnil<Esc>n.n.',
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
          {
            prompt: 'Turn both "true"s to "false", then clear the highlights with C-l.',
            goal: {
              text: (options.text as string[]).map(l => l.replace('true', 'false')),
              check: vim => !vim.hlActive,
            },
            solution: '/true<CR>cwfalse<Esc>n.<C-l>',
          },
          {
            prompt: "Change both 'n' to 'v', then clear with :noh.",
            goal: {
              text: (options.text as string[]).map(l => l.replace("'n'", "'v'")),
              check: vim => !vim.hlActive,
            },
            solution: "/'n/e<CR>rvn.:noh<CR>",
          },
        ],
      },
    },
  ],
};
