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
  ],
};
