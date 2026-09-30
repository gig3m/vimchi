import { Code } from '../../components/Code';
import type { Vim } from '../../vim/editor';
import { gitState } from '../../vim/plugins/git-model';
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
/** The usual status: README staged, api.py and units.py changed, cache.py new (the lazygit lesson). */
export const STATUS_REPO = repo({ 'weather/api.py': file(...API_TIMEOUT), 'weather/units.py': file(...UNITS_ROUNDED), 'weather/cache.py': CACHE }, { 'README.md': README_USAGE });

const index = (vim: Vim, path: string) => gitState(vim).index[path];


export const git: Section = {
  id: 'git',
  title: 'Git',
  band: 'code',
  lessons: [
    {
      id: 'gitsigns-hunks',
      title: 'Walking Hunks',
      chips: [']h', '[h'],
      keyCards: [
        { key: ']h', glyph: '↓', label: 'next hunk', sub: 'LazyVim; kickstart: ]c' },
        { key: '[h', glyph: '↑', label: 'previous hunk', sub: 'kickstart: [c' },
      ],
      intro: (
        <>
          <p>
            gitsigns marks every changed line in the sign column: a <span className="hl-green">green</span> bar for
            added lines, an <span className="hl-orange">orange</span> one for changed lines, and a{' '}
            <span className="hl-red">red</span> <Code>_</Code> under the spot where lines were deleted.
          </p>
          <p>
            <Code>]h</Code> jumps to the start of the next hunk and <Code>[h</Code> to the previous one. Both take a
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
        title: "kickstart's keys",
        body: (
          <p>
            kickstart maps the same jumps to <Code>]c</Code> / <Code>[c</Code> (gitsigns' README keys, shared with diff
            mode) and staging to <Code>Space hs</Code> / <Code>Space hr</Code>; both sets work here.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        showGoal: false,
        // 12 rows keep the hunk at line 8 off M (the middle row of a full-height window).
        base: { ...repo({ 'weather/cli.py': file(...CLI_ARGPARSE) }), open: 'weather/cli.py', plugins: ['gitsigns'], height: 12 },
        rounds: [
          { setup: { cursor: { line: 3, col: 0 } }, goal: { cursor: { line: 8, col: 0 } }, solution: ']h' },
          { setup: { cursor: { line: 3, col: 0 } }, goal: { cursor: { line: 13, col: 0 } }, solution: '2]h' },
          { setup: { cursor: { line: 17, col: 4 } }, goal: { cursor: { line: 13, col: 0 } }, solution: '[h' },
          { setup: { cursor: { line: 13, col: 8 } }, goal: { cursor: { line: 0, col: 0 } }, solution: ']h' },
          { setup: { cursor: { line: 17, col: 4 } }, goal: { cursor: { line: 8, col: 0 } }, solution: '2[h' },
        ],
      },
    },
    {
      id: 'gitsigns-stage-hunk',
      title: 'Stage a Hunk',
      chips: ['␣ghs', '␣ghr'],
      keyCards: [
        { key: '␣ghs', glyph: '+', label: 'stage hunk', sub: 'LazyVim; kickstart: ␣hs' },
        { key: '␣ghr', glyph: '↺', label: 'reset hunk', sub: 'undo with u' },
      ],
      intro: (
        <>
          <p>
            <Code>Space ghs</Code> (LazyVim's <Code>Space gh</Code> is the git-hunk prefix) stages the hunk under the cursor without leaving the file; its sign disappears.{' '}
            <Code>Space ghr</Code> resets the hunk, putting back what the index has.
          </p>
          <p>
            Pair them with <Code>]h</Code>: walk the hunks, stage the ones that belong in this commit and reset the
            debugging you forgot about. A reset is an ordinary change, so <Code>u</Code> brings it back.
          </p>
        </>
      ),
      practice: total => <p>Stage or reset the hunks the prompt names. {total} rounds.</p>,
      aside: {
        title: 'Look before you stage',
        body: (
          <p>
            <Code>Space hp</Code> previews the hunk in a float. kickstart keeps gitsigns' README keys, <Code>Space hs</Code> and{' '}
            <Code>Space hr</Code>; in visual mode either stages just the selected lines' hunks.
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
            solution: '<Space>ghs',
          },
          {
            prompt: 'Stage the first hunk of the file.',
            setup: { cursor: { line: 4, col: 0 } },
            goal: { check: vim => index(vim, 'weather/cli.py').includes('import argparse') && !index(vim, 'weather/cli.py').includes('parser.parse_args()') },
            solution: '[h<Space>ghs',
          },
          {
            prompt: 'Put back the deleted sys.stdout.flush() line.',
            setup: { cursor: { line: 0, col: 0 } },
            goal: { check: vim => vim.buf.lines.includes('    sys.stdout.flush()') },
            solution: '2]h<Space>ghr',
          },
          {
            prompt: 'Reset the debug print you left in api.py.',
            setup: {
              ...repo({ 'weather/api.py': file(...API.slice(0, 9), '    print("DEBUG", resp.status_code)', ...API.slice(9)) }),
              open: 'weather/api.py',
              cursor: { line: 0, col: 0 },
            },
            goal: { text: API },
            solution: ']h<Space>ghr',
          },
          {
            prompt: 'Stage the second hunk, then reset the third.',
            setup: { cursor: { line: 0, col: 0 } },
            goal: { check: vim => index(vim, 'weather/cli.py').includes('parser.parse_args()') && vim.buf.lines.includes('    sys.stdout.flush()') },
            solution: ']h<Space>ghs]h<Space>ghr',
          },
        ],
      },
    },
    {
      id: 'git-lazygit',
      title: 'Lazygit',
      chips: ['␣gg', 'q'],
      keyCards: [
        { key: '␣gg', glyph: '⎇', label: 'open lazygit', sub: 'LazyVim' },
        { key: 'q', glyph: '✕', label: 'close it' },
      ],
      intro: (
        <>
          <p>
            Staging one hunk at a time is gitsigns' job. For everything else — the full status, commits, branches,
            logs — the starters hand you <Code>lazygit</Code> in a floating terminal: <Code>Space gg</Code> opens it
            over the editor, <Code>q</Code> brings the editor back.
          </p>
          <p>
            Inside, lazygit has its own keys (<Code>?</Code> lists them). The habit to build is the round trip: open,
            do the git thing, close, keep editing.
          </p>
        </>
      ),
      practice: total => <p>Open lazygit, read what is changed, and close it again. {total} rounds.</p>,
      aside: {
        title: 'kickstart',
        body: (
          <p>
            kickstart does not ship lazygit; <Code>:!git status</Code> or a second terminal fills the gap until you add
            it. To see how a config wires in the plugins from this band, read kickstart.nvim's single{' '}
            <Code>init.lua</Code>: it is written to be read top to bottom.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        base: { ...STATUS_REPO, open: 'weather/api.py', plugins: ['gitsigns', 'lazygit'] },
        rounds: [
          {
            prompt: 'Open lazygit.',
            goal: { mode: 'any', check: vim => vim.floats.some(f => f.id === 'lazygit') },
            solution: '<Space>gg',
          },
          {
            prompt: 'Open it, read the status, and close it again.',
            goal: { check: vim => !vim.floats.some(f => f.id === 'lazygit') && (vim.pluginData.lazygit as { closed: number } | undefined)?.closed === 1 },
            solution: '<Space>ggq',
          },
          {
            prompt: 'Once more: open and close in one go.',
            goal: { check: vim => (vim.pluginData.lazygit as { closed: number } | undefined)?.closed === 1 },
            solution: '<Space>ggq',
          },
        ],
      },
    },
  ],
};
