import { Code } from '../../components/Code';
import type { Vim } from '../../vim/editor';
import { STATUS_NAME, blameBufferName, commitBufferName } from '../../vim/plugins/fugitive';
import { type Commit, gitState } from '../../vim/plugins/git-model';
import type { Section, Setup } from '../types';

// A small Python weather CLI. HEAD is the committed project; each lesson
// changes the worktree (vim.fs) on top of it.
const file = (...lines: string[]) => lines.join('\n') + '\n';

const API_V1 = [
  'import requests',
  '',
  'BASE_URL = "https://api.weather.example/v1"',
  '',
  '',
  'def fetch_forecast(city, days=3):',
  '    url = f"{BASE_URL}/forecast"',
  '    params = {"q": city, "days": days}',
  '    resp = requests.get(url, params=params)',
  '    return resp.json()["forecast"]',
];
const API_V2 = [
  ...API_V1,
  '',
  '',
  'def fetch_current(city):',
  '    url = f"{BASE_URL}/current"',
  '    params = {"q": city}',
  '    resp = requests.get(url, params=params)',
  '    return resp.json()',
];
const API = [
  ...API_V2.slice(0, 9),
  '    resp.raise_for_status()',
  ...API_V2.slice(9, 16),
  '    resp.raise_for_status()',
  ...API_V2.slice(16),
];
/** api.py with two separate changes: a TIMEOUT constant and a timeout on fetch_current. */
const API_TIMEOUT = [
  ...API.slice(0, 3),
  'TIMEOUT = 5',
  ...API.slice(3, 16),
  '    resp = requests.get(url, params=params, timeout=TIMEOUT)',
  ...API.slice(17),
];

const UNITS = [
  'def c_to_f(celsius):',
  '    return celsius * 9 / 5 + 32',
  '',
  '',
  'def f_to_c(fahrenheit):',
  '    return (fahrenheit - 32) * 5 / 9',
];
const UNITS_ROUNDED = [
  'def c_to_f(celsius):',
  '    return round(celsius * 9 / 5 + 32, 1)',
  ...UNITS.slice(2, 5),
  '    return round((fahrenheit - 32) * 5 / 9, 1)',
];

const CLI = [
  'import sys',
  '',
  'from weather.api import fetch_forecast',
  'from weather.units import c_to_f',
  '',
  '',
  'def main():',
  '    city = sys.argv[1]',
  '    for day in fetch_forecast(city):',
  '        print(f"{day[\'date\']}: {c_to_f(day[\'temp\'])}°F")',
  '    sys.stdout.flush()',
  '',
  '',
  'if __name__ == "__main__":',
  '    main()',
];
/** cli.py moved to argparse: three hunks (top, main, a deleted line). */
const CLI_ARGPARSE = [
  '"""Print the forecast for a city."""',
  'import argparse',
  ...CLI.slice(1, 7),
  '    parser = argparse.ArgumentParser(prog="weather")',
  '    parser.add_argument("city")',
  '    parser.add_argument("--days", type=int, default=3)',
  '    args = parser.parse_args()',
  '    for day in fetch_forecast(args.city, args.days):',
  CLI[9],
  ...CLI.slice(11),
];

const README = file('# weather', '', 'A tiny forecast CLI.');
const README_USAGE = file('# weather', '', 'A tiny forecast CLI.', '', '    python -m weather.cli London');
const CACHE = file('import functools', '', '', 'cached = functools.lru_cache(maxsize=32)');

const HEAD: Record<string, string> = {
  'README.md': README,
  'weather/api.py': file(...API),
  'weather/cli.py': file(...CLI),
  'weather/units.py': file(...UNITS),
};

/** Worktree = HEAD plus changes; `staged` files are also in the index. */
function repo(changes: Record<string, string>, staged: Record<string, string> = {}): Setup {
  return {
    files: { ...HEAD, ...changes, ...staged },
    init: vim => {
      vim.pluginData.git = { head: { ...HEAD }, index: { ...HEAD, ...staged } };
    },
  };
}
/** The usual status: README staged, api.py and units.py changed, cache.py new. */
const STATUS_REPO = repo({ 'weather/api.py': file(...API_TIMEOUT), 'weather/units.py': file(...UNITS_ROUNDED), 'weather/cache.py': CACHE }, { 'README.md': README_USAGE });

const withStatus = (s: Setup): Setup => ({
  ...s,
  init: vim => {
    s.init?.(vim);
    vim.ex('Git');
  },
});

const index = (vim: Vim, path: string) => gitState(vim).index[path];
const staged = (path: string) => (vim: Vim) => index(vim, path) === vim.fs.read(path);
const unstaged = (path: string) => (vim: Vim) => index(vim, path) === HEAD[path];
const lastCommit = (vim: Vim): Commit | undefined => gitState(vim).log[gitState(vim).log.length - 1];
const windows = (n: number) => (vim: Vim) => vim.tab.windows().length === n;

// Blame history for api.py.
const LOG: Commit[] = [
  { hash: '3f9c2a1', author: 'Ada Lovelace', date: '2026-02-03', message: 'Add forecast client', files: { 'weather/api.py': file(...API_V1), 'README.md': README } },
  { hash: '8b41d07', author: 'Grace Hopper', date: '2026-03-14', message: 'Fetch current conditions', files: { 'weather/api.py': file(...API_V2) } },
  { hash: 'c72e5f9', author: 'Katherine Johnson', date: '2026-05-20', message: 'Raise on HTTP errors', files: { 'weather/api.py': file(...API) } },
];
const BLAME_REPO: Setup = {
  files: HEAD,
  open: 'weather/api.py',
  init: vim => {
    vim.pluginData.git = { head: { ...HEAD }, log: LOG.map(c => ({ ...c })) };
  },
};
const line = (text: string) => API.indexOf(text);

export const git: Section = {
  id: 'git',
  title: 'Git',
  band: 'code',
  lessons: [
    {
      id: 'fugitive-status',
      title: 'Git Status',
      chips: [':Git', 'gu', 'gs', 'gq'],
      keyCards: [
        { key: ':Git', glyph: '±', label: 'status window', sub: 'fugitive' },
        { key: 'gu', glyph: '↓', label: 'to Unstaged', sub: 'gs: Staged, gU: Untracked' },
        { key: 'CR', glyph: '⏎', label: 'open the file' },
        { key: 'gq', glyph: '✕', label: 'close status' },
      ],
      intro: (
        <>
          <p>
            <Code>:Git</Code> with no arguments opens fugitive's status window: the branch, then your changes grouped
            as Untracked, Unstaged and Staged. <Code>gu</Code>, <Code>gs</Code> and <Code>gU</Code> jump to the first
            file in each section; a count picks a later one.
          </p>
          <p>
            <Code>CR</Code> opens the file under the cursor and <Code>gq</Code> closes the window. It is a buffer, so{' '}
            <Code>j</Code>, <Code>k</Code> and <Code>/</Code> work as usual.
          </p>
        </>
      ),
      practice: total => <p>Open the status window and get around it. {total} rounds.</p>,
      aside: {
        title: 'Short forms',
        body: (
          <p>
            <Code>:G</Code> is the same command. Neogit and lazygit (in a terminal float) are the popular alternatives
            to fugitive's status window.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        base: { ...STATUS_REPO, open: 'weather/api.py', plugins: ['fugitive'], height: 20 },
        rounds: [
          {
            prompt: 'Open the status window.',
            goal: { buffer: STATUS_NAME },
            solution: ':Git<CR>',
          },
          {
            prompt: 'Open the second unstaged file.',
            setup: { open: 'README.md' },
            goal: { buffer: 'weather/units.py' },
            solution: ':Git<CR>2gu<CR>',
          },
          {
            prompt: 'Open the staged file.',
            goal: { buffer: 'README.md' },
            solution: ':Git<CR>gs<CR>',
          },
          {
            prompt: 'Open the untracked file.',
            goal: { buffer: 'weather/cache.py' },
            solution: ':Git<CR><CR>',
          },
          {
            prompt: 'Close the status window.',
            setup: withStatus(STATUS_REPO),
            goal: { check: vim => windows(1)(vim) && vim.buf.name === 'weather/api.py' },
            solution: 'gq',
          },
        ],
      },
    },
    {
      id: 'fugitive-stage',
      title: 'Stage & Unstage',
      chips: ['s', 'u', '-'],
      keyCards: [
        { key: 's', glyph: '+', label: 'stage', sub: 'file, section or selection' },
        { key: 'u', glyph: '−', label: 'unstage' },
        { key: '-', glyph: '±', label: 'toggle' },
      ],
      intro: (
        <>
          <p>
            In the status window, <Code>s</Code> stages the file under the cursor and <Code>u</Code> unstages it.{' '}
            <Code>-</Code> does whichever makes sense: stage from Unstaged or Untracked, unstage from Staged.
          </p>
          <p>
            On a section heading they act on the whole section, and in visual mode on every selected file. The list
            redraws straight away, so the cursor is already on the next file.
          </p>
        </>
      ),
      practice: total => <p>Get the index into the shape the prompt describes. {total} rounds.</p>,
      aside: {
        title: 'From the file itself',
        body: (
          <p>
            <Code>:Gwrite</Code> writes the current file and stages it in one go, like <Code>:w</Code> followed by{' '}
            <Code>git add %</Code>.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        base: { ...withStatus(STATUS_REPO), open: 'weather/api.py', plugins: ['fugitive'], height: 20 },
        rounds: [
          {
            prompt: 'Stage api.py.',
            goal: { check: staged('weather/api.py') },
            solution: 'gus',
          },
          {
            prompt: 'Unstage the README.',
            goal: { check: unstaged('README.md') },
            solution: 'gsu',
          },
          {
            prompt: 'Stage the new cache.py (the cursor is on it).',
            goal: { check: staged('weather/cache.py') },
            solution: 's',
          },
          {
            prompt: 'Stage everything under Unstaged at once.',
            goal: { check: vim => staged('weather/api.py')(vim) && staged('weather/units.py')(vim) && !staged('weather/cache.py')(vim) },
            solution: 'guks',
          },
          {
            prompt: 'Select api.py and units.py and toggle them with -.',
            goal: { check: vim => staged('weather/api.py')(vim) && staged('weather/units.py')(vim) },
            solution: 'guVj-',
          },
        ],
      },
    },
    {
      id: 'fugitive-inline-diff',
      title: 'Inline Diff',
      chips: ['=', ')', 's'],
      keyCards: [
        { key: '=', glyph: '±', label: 'toggle inline diff' },
        { key: ')', glyph: '↓', label: 'next file or hunk', sub: '( previous' },
        { key: 's', glyph: '+', label: 'stage the hunk' },
      ],
      intro: (
        <>
          <p>
            <Code>=</Code> on a file in the status window unfolds its diff right there; <Code>=</Code> again folds it.{' '}
            <Code>)</Code> and <Code>(</Code> step through files and hunks.
          </p>
          <p>
            With the cursor inside a hunk, <Code>s</Code> and <Code>u</Code> stage or unstage just that hunk. That is
            how you split one messy file into two tidy commits.
          </p>
        </>
      ),
      practice: total => <p>Stage and unstage single hunks from the inline diff. {total} rounds.</p>,
      aside: {
        title: 'Side by side',
        body: (
          <p>
            <Code>dv</Code> opens the file in a vertical diff against the index instead. diffview.nvim shows every
            changed file this way at once.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        base: { ...withStatus(STATUS_REPO), open: 'weather/api.py', plugins: ['fugitive'], height: 26 },
        rounds: [
          {
            prompt: 'Show the diff for api.py.',
            goal: { check: vim => vim.buf.lines.some(l => l.startsWith('@@')) },
            solution: 'gu=',
          },
          {
            prompt: 'Stage only the first hunk of api.py (the TIMEOUT constant).',
            goal: { check: vim => index(vim, 'weather/api.py').includes('TIMEOUT = 5') && !index(vim, 'weather/api.py').includes('timeout=') },
            solution: 'gu=)s',
          },
          {
            prompt: 'Stage only the second hunk of api.py.',
            goal: { check: vim => !index(vim, 'weather/api.py').includes('TIMEOUT = 5') && index(vim, 'weather/api.py').includes('timeout=') },
            solution: 'gu=))s',
          },
          {
            prompt: 'Both api.py hunks are staged. Unstage the second one.',
            setup: withStatus(repo({ 'weather/api.py': file(...API_TIMEOUT) }, { 'weather/api.py': file(...API_TIMEOUT) })),
            goal: { check: vim => index(vim, 'weather/api.py').includes('TIMEOUT = 5') && !index(vim, 'weather/api.py').includes('timeout=') },
            solution: 'gs=))u',
          },
        ],
      },
    },
    {
      id: 'fugitive-commit',
      title: 'Committing',
      chips: ['cc', 'ce', 'ca'],
      keyCards: [
        { key: 'cc', glyph: '✓', label: 'commit', sub: 'write the message, :wq' },
        { key: 'ce', glyph: '+', label: 'amend, same message' },
        { key: 'ca', glyph: '✎', label: 'amend and edit' },
      ],
      intro: (
        <>
          <p>
            <Code>cc</Code> in the status window opens a commit message buffer listing what is staged. Type the
            message on the first line and <Code>:wq</Code>: the commit is made and the status window updates.
          </p>
          <p>
            <Code>ce</Code> adds the staged changes to the last commit without touching its message.{' '}
            <Code>ca</Code> does the same but opens the message for editing first.
          </p>
        </>
      ),
      practice: total => <p>Commit what the prompt describes. {total} rounds.</p>,
      aside: {
        title: 'Changing your mind',
        body: (
          <p>
            Lines starting with <Code>#</Code> are dropped, and an empty message aborts the commit, so{' '}
            <Code>:q!</Code>, or deleting the message and <Code>:wq</Code>, backs out.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        base: { ...withStatus(STATUS_REPO), open: 'weather/api.py', plugins: ['fugitive'], height: 20 },
        rounds: [
          {
            prompt: 'Commit the staged README as "Document usage".',
            goal: { check: vim => lastCommit(vim)?.message === 'Document usage' && gitState(vim).head['README.md'] === README_USAGE },
            solution: 'cciDocument usage<Esc>:wq<CR>',
          },
          {
            prompt: 'Nothing is staged. Stage api.py and commit it as "Add request timeout".',
            setup: withStatus(repo({ 'weather/api.py': file(...API_TIMEOUT), 'weather/units.py': file(...UNITS_ROUNDED) })),
            goal: { check: vim => lastCommit(vim)?.message === 'Add request timeout' && Object.keys(lastCommit(vim)!.files!).join() === 'weather/api.py' },
            solution: 'guscciAdd request timeout<Esc>:wq<CR>',
          },
          {
            prompt: 'Add units.py to the last commit, keeping its message.',
            setup: withStatus({
              files: { ...HEAD, 'weather/units.py': file(...UNITS_ROUNDED) },
              init: vim => {
                vim.pluginData.git = { head: { ...HEAD }, log: [{ hash: '5d0e8b2', author: 'You', date: '2026-09-26', message: 'Round temperatures', files: {} }] };
              },
            }),
            goal: { check: vim => gitState(vim).log.length === 1 && lastCommit(vim)?.message === 'Round temperatures' && gitState(vim).head['weather/units.py'] === file(...UNITS_ROUNDED) },
            solution: 'gusce',
          },
          {
            prompt: 'Fix the typo in the last commit message: "requst".',
            setup: withStatus({
              files: { ...HEAD, 'weather/cache.py': CACHE },
              init: vim => {
                vim.pluginData.git = { head: { ...HEAD }, log: [{ hash: '9a1f4c3', author: 'You', date: '2026-09-26', message: 'Add requst timeout', files: {} }] };
              },
            }),
            goal: { check: vim => gitState(vim).log.length === 1 && lastCommit(vim)?.message === 'Add request timeout' },
            solution: 'cafuae<Esc>:wq<CR>',
          },
        ],
      },
    },
    {
      id: 'gitsigns-hunks',
      title: 'Walking Hunks',
      chips: [']c', '[c'],
      keyCards: [
        { key: ']c', glyph: '↓', label: 'next hunk', sub: 'gitsigns' },
        { key: '[c', glyph: '↑', label: 'previous hunk' },
      ],
      intro: (
        <>
          <p>
            gitsigns marks every changed line in the sign column: a <span className="hl-green">green</span> bar for
            added lines, an <span className="hl-orange">orange</span> one for changed lines, and a{' '}
            <span className="hl-red">red</span> <Code>_</Code> under the spot where lines were deleted.
          </p>
          <p>
            <Code>]c</Code> jumps to the start of the next hunk and <Code>[c</Code> to the previous one. Both take a
            count and wrap around the file.
          </p>
        </>
      ),
      practice: total => (
        <p>
          Reach the <span className="hl-green">green box</span> at the start of each hunk. {total} rounds.
        </p>
      ),
      aside: {
        title: 'Same keys as diff mode',
        body: (
          <p>
            <Code>]c</Code> is diff mode's "next change". gitsigns' README maps it to fall back to the built-in when the
            window is in diff mode, so one habit covers both.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        showGoal: false,
        base: { ...repo({ 'weather/cli.py': file(...CLI_ARGPARSE) }), open: 'weather/cli.py', plugins: ['gitsigns'] },
        rounds: [
          { setup: { cursor: { line: 3, col: 0 } }, goal: { cursor: { line: 8, col: 0 } }, solution: ']c' },
          { setup: { cursor: { line: 3, col: 0 } }, goal: { cursor: { line: 13, col: 0 } }, solution: '2]c' },
          { setup: { cursor: { line: 17, col: 4 } }, goal: { cursor: { line: 13, col: 0 } }, solution: '[c' },
          { setup: { cursor: { line: 13, col: 8 } }, goal: { cursor: { line: 0, col: 0 } }, solution: ']c' },
          { setup: { cursor: { line: 10, col: 4 } }, goal: { cursor: { line: 0, col: 0 } }, solution: '[c[c' },
        ],
      },
    },
    {
      id: 'gitsigns-stage-hunk',
      title: 'Stage a Hunk',
      chips: ['␣hs', '␣hr'],
      keyCards: [
        { key: '␣hs', glyph: '+', label: 'stage hunk', sub: 'gitsigns' },
        { key: '␣hr', glyph: '↺', label: 'reset hunk', sub: 'undo with u' },
      ],
      intro: (
        <>
          <p>
            <Code>Space hs</Code> stages the hunk under the cursor without leaving the file; its sign disappears.{' '}
            <Code>Space hr</Code> resets the hunk, putting back what the index has.
          </p>
          <p>
            Pair them with <Code>]c</Code>: walk the hunks, stage the ones that belong in this commit and reset the
            debugging you forgot about. A reset is an ordinary change, so <Code>u</Code> brings it back.
          </p>
        </>
      ),
      practice: total => <p>Stage or reset the hunks the prompt names. {total} rounds.</p>,
      aside: {
        title: 'Look before you stage',
        body: (
          <p>
            <Code>Space hp</Code> previews the hunk in a float. The keys come from gitsigns' README; in visual mode{' '}
            <Code>Space hs</Code> stages just the selected lines' hunks.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        base: { ...repo({ 'weather/cli.py': file(...CLI_ARGPARSE) }), open: 'weather/cli.py', plugins: ['gitsigns'] },
        rounds: [
          {
            prompt: 'Stage the argparse setup in main() (the cursor is in that hunk).',
            setup: { cursor: { line: 9, col: 4 } },
            goal: { check: vim => index(vim, 'weather/cli.py').includes('parser.parse_args()') && index(vim, 'weather/cli.py').includes('import sys') },
            solution: '<Space>hs',
          },
          {
            prompt: 'Stage the first hunk of the file.',
            setup: { cursor: { line: 4, col: 0 } },
            goal: { check: vim => index(vim, 'weather/cli.py').includes('import argparse') && !index(vim, 'weather/cli.py').includes('parser.parse_args()') },
            solution: '[c<Space>hs',
          },
          {
            prompt: 'Put back the deleted sys.stdout.flush() line.',
            setup: { cursor: { line: 0, col: 0 } },
            goal: { check: vim => vim.buf.lines.includes('    sys.stdout.flush()') },
            solution: '2]c<Space>hr',
          },
          {
            prompt: 'Reset the debug print you left in api.py.',
            setup: {
              ...repo({ 'weather/api.py': file(...API.slice(0, 9), '    print("DEBUG", resp.status_code)', ...API.slice(9)) }),
              open: 'weather/api.py',
              cursor: { line: 0, col: 0 },
            },
            goal: { text: API },
            solution: ']c<Space>hr',
          },
          {
            prompt: 'Stage the second hunk, then reset the third.',
            setup: { cursor: { line: 0, col: 0 } },
            goal: { check: vim => index(vim, 'weather/cli.py').includes('parser.parse_args()') && vim.buf.lines.includes('    sys.stdout.flush()') },
            solution: ']c<Space>hs]c<Space>hr',
          },
        ],
      },
    },
    {
      id: 'fugitive-blame',
      title: 'Blame',
      chips: [':Git blame', 'CR', 'gq'],
      keyCards: [
        { key: ':Git blame', glyph: '?', label: 'who wrote each line' },
        { key: 'CR', glyph: '⏎', label: 'open the commit' },
        { key: 'gq', glyph: '✕', label: 'close blame' },
      ],
      intro: (
        <>
          <p>
            <Code>:Git blame</Code> opens a window to the left of the file with the commit, author and date of every
            line. It moves with the file, so the line under the cursor is always the one you are asking about.
          </p>
          <p>
            <Code>CR</Code> on a line closes the blame and opens that commit: its message and the diff that introduced
            the line. <Code>gq</Code> closes the blame window.
          </p>
        </>
      ),
      practice: total => <p>Find out who changed what, and why. {total} rounds.</p>,
      aside: {
        title: 'Just one line',
        body: (
          <p>
            gitsigns' <Code>Space hb</Code> (<Code>:Gitsigns blame_line</Code>) shows the commit for the current line in
            a float, without the extra window.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        base: { ...BLAME_REPO, plugins: ['fugitive'] },
        rounds: [
          {
            prompt: 'Open blame for api.py.',
            goal: { buffer: blameBufferName('weather/api.py') },
            solution: ':Git blame<CR>',
          },
          {
            prompt: 'Who added fetch_current? Open that commit (the cursor is on it).',
            setup: { cursor: { line: line('def fetch_current(city):'), col: 4 } },
            goal: { buffer: commitBufferName('8b41d07') },
            solution: ':Git blame<CR><CR>',
          },
          {
            prompt: 'Open the commit behind line 10.',
            goal: { buffer: commitBufferName('c72e5f9') },
            solution: ':Git blame<CR>10G<CR>',
          },
          {
            prompt: 'Open the commit that wrote the first line of the file.',
            setup: { cursor: { line: 7, col: 0 } },
            goal: { buffer: commitBufferName('3f9c2a1') },
            solution: ':Git blame<CR>gg<CR>',
          },
          {
            prompt: 'Close the blame window.',
            setup: { init: vim => { BLAME_REPO.init!(vim); vim.ex('Git blame'); } },
            goal: { check: vim => windows(1)(vim) && vim.buf.name === 'weather/api.py' },
            solution: 'gq',
          },
        ],
      },
    },
  ],
};
