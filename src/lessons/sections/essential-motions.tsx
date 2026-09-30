import { Code, Mono } from '../../components/Code';
import { BeforeAfter, Motions, Words } from '../../components/diagrams';
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

export const essentialMotions: Section = {
  id: 'essential-motions',
  title: 'Motions Worth Knowing',
  band: 'core',
  lessons: [
    {
      id: 'words-big',
      title: 'Moving by WORDs',
      chips: ['W', 'E', 'B'],
      keyCards: [
        { key: 'W', glyph: '→|', label: 'next WORD start' },
        { key: 'E', glyph: '|→', label: 'WORD end' },
        { key: 'B', glyph: '|←', label: 'previous WORD start' },
      ],
      intro: (
        <>
          <p>
            A WORD is any run of non-blank characters. <Code>W</Code>, <Code>E</Code> and <Code>B</Code> work like{' '}
            <Code>w</Code>, <Code>e</Code> and <Code>b</Code>, but only stop at spaces.
          </p>
          <p>
            In code full of dots, slashes and brackets, a small word ends every few characters.{' '}
            <Mono>u.roles?.includes('admin')</Mono> is eight words but one WORD.
          </p>
          <Words text="u.roles?.includes('admin') ?? false" caption="words" />
          <Words text="u.roles?.includes('admin') ?? false" big caption="WORDs" />
        </>
      ),
      practice: total => (
        <p>
          Reach each <span className="hl-green">green box</span> with <Code>W</Code>, <Code>E</Code> or <Code>B</Code>.
          Counts work: <Code>3W</Code>. {total} rounds.
        </p>
      ),
      aside: {
        title: 'Which one to use',
        body: (
          <p>
            Count the spaces, not the punctuation. When the target is a WORD or two away, <Code>W</Code> is the fewest
            keys; when it's in the middle of a WORD, finish with <Code>w</Code> or <Code>f</Code>.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        showGoal: false,
        base: {
          name: 'api.ts',
          text: [
            'const url = `${API_BASE}/v2/users/${id}?include=teams`;',
            'export const isAdmin = (u: User) =>',
            "  u.roles?.includes('admin') ?? false;",
            'const res = await fetch(url, { headers: authHeaders() });',
            'const { data: user } = await res.json();',
          ],
        },
        rounds: [
          { setup: { cursor: { line: 0, col: 12 } }, goal: { cursor: { line: 0, col: 54 } }, solution: 'E' },
          { setup: { cursor: { line: 0, col: 54 } }, goal: { cursor: { line: 0, col: 12 } }, solution: 'B' },
          { setup: { cursor: { line: 1, col: 33 } }, goal: { cursor: { line: 2, col: 2 } }, solution: 'W' },
          { setup: { cursor: { line: 2, col: 37 } }, goal: { cursor: { line: 1, col: 33 } }, solution: '4B' },
          { setup: { cursor: { line: 3, col: 18 } }, goal: { cursor: { line: 3, col: 54 } }, solution: '4W' },
          { setup: { cursor: { line: 4, col: 0 } }, goal: { cursor: { line: 4, col: 12 } }, solution: '3E' },
        ],
      },
    },
    {
      id: 'word-ends-backward',
      title: 'Word Ends Backward',
      chips: ['ge', 'gE'],
      keyCards: [
        { key: 'ge', glyph: '←|', label: 'previous word end' },
        { key: 'gE', glyph: '←|', label: 'previous WORD end' },
      ],
      intro: (
        <>
          <p>
            <Code>ge</Code> moves back to the end of the previous word. <Code>gE</Code> does the same for WORDs. They are{' '}
            <Code>e</Code> and <Code>E</Code> in reverse.
          </p>
          <p>
            Use them to land on the last character of something behind you: a closing quote, the end of a name, a
            trailing comma.
          </p>
          <Motions text="local builtin = require('telescope.builtin')" cursor={35} keys={['ge', '2ge', 'gE']} />
        </>
      ),
      practice: total => (
        <p>
          Reach each <span className="hl-green">green box</span> with <Code>ge</Code> or <Code>gE</Code>. {total} rounds.
        </p>
      ),
      aside: {
        title: 'Why not b?',
        body: (
          <p>
            <Code>b</Code> lands on the start of a word; you'd still need <Code>e</Code> to reach its end. <Code>ge</Code>{' '}
            gets there in one motion, and <Code>dge</Code> deletes back to it.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        showGoal: false,
        base: {
          name: 'telescope.lua',
          text: [
            "local builtin = require('telescope.builtin')",
            "vim.keymap.set('n', '<leader>ff', builtin.find_files,",
            "  { desc = 'Find files' })",
            "vim.keymap.set('n', '<leader>fg', builtin.live_grep,",
            "  { desc = 'Live grep' })",
          ],
        },
        rounds: [
          { setup: { cursor: { line: 0, col: 20 } }, goal: { cursor: { line: 0, col: 14 } }, solution: 'ge' },
          { setup: { cursor: { line: 0, col: 43 } }, goal: { cursor: { line: 0, col: 12 } }, solution: '2gE' },
          { setup: { cursor: { line: 2, col: 25 } }, goal: { cursor: { line: 2, col: 22 } }, solution: 'gE' },
          { setup: { cursor: { line: 1, col: 2 } }, goal: { cursor: { line: 0, col: 41 } }, solution: '2ge' },
          { setup: { cursor: { line: 4, col: 1 } }, goal: { cursor: { line: 3, col: 32 } }, solution: '2gE' },
          { setup: { cursor: { line: 3, col: 0 } }, goal: { cursor: { line: 2, col: 25 } }, solution: 'ge' },
        ],
      },
    },
    {
      id: 'first-char',
      title: 'First Character',
      chips: ['^', '_'],
      keyCards: [
        { key: '^', glyph: '|→x', label: 'first non-blank' },
        { key: '_', glyph: '↓x', label: 'first non-blank', sub: 'count goes down' },
      ],
      intro: (
        <>
          <p>
            <Code>^</Code> jumps to the first non-blank character of the line, past the indentation. That's usually where
            you want to be, not column 0.
          </p>
          <Motions text="        response.raise_for_status()" cursor={20} keys={['0', '^']} />
          <p>
            <Code>_</Code> does the same, but takes a count as lines: <Code>3_</Code> goes to the first non-blank two
            lines down.
          </p>
        </>
      ),
      practice: total => (
        <p>
          Reach the <span className="hl-green">green box</span> at the start of the code on a line. Some are on
          other lines: <Code>j</Code> then <Code>^</Code> works, and a count on <Code>_</Code> is shorter. {total} rounds.
        </p>
      ),
      aside: {
        title: 'Plus and minus',
        body: (
          <p>
            <Code>+</Code> and <Code>Enter</Code> go to the first non-blank of the next line, <Code>-</Code> to the one
            above. <Code>_</Code> exists mostly for operators: <Code>d_</Code> deletes the whole line, like{' '}
            <Code>dd</Code>.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        showGoal: false,
        base: {
          name: 'retry.py',
          text: [
            'def fetch_with_retry(url, attempts=3):',
            '    for attempt in range(attempts):',
            '        try:',
            '            response = session.get(url, timeout=5)',
            '            response.raise_for_status()',
            '            return response.json()',
            '        except RequestException as err:',
            '            log.warning("attempt %d: %s", attempt, err)',
            '            time.sleep(2 ** attempt)',
            '    raise FetchError(url)',
          ],
        },
        rounds: [
          { setup: { cursor: { line: 3, col: 30 } }, goal: { cursor: { line: 3, col: 12 } }, solution: '^' },
          { setup: { cursor: { line: 7, col: 0 } }, goal: { cursor: { line: 7, col: 12 } }, solution: '^' },
          { setup: { cursor: { line: 2, col: 11 } }, goal: { cursor: { line: 5, col: 12 } }, solution: '4_' },
          { setup: { cursor: { line: 6, col: 36 } }, goal: { cursor: { line: 6, col: 8 } }, solution: '^' },
          { setup: { cursor: { line: 0, col: 20 } }, goal: { cursor: { line: 1, col: 4 } }, solution: '2_' },
          { setup: { cursor: { line: 3, col: 0 } }, goal: { cursor: { line: 8, col: 12 } }, solution: '6_' },
        ],
      },
    },
    {
      id: 'find-backward',
      title: 'Find Backward',
      chips: ['F', 'T'],
      keyCards: [
        { key: 'F', glyph: 'x←', label: 'back onto x' },
        { key: 'T', glyph: 'x|←', label: 'back till x' },
      ],
      intro: (
        <>
          <p>
            <Code>F</Code> and <Code>T</Code> are <Code>f</Code> and <Code>t</Code> going left. <Code>F</Code> lands on
            the previous occurrence of a character; <Code>T</Code> stops just after it. Like <Code>f</Code>, they only
            search the current line.
          </p>
          <Motions text="formatLine(item, locale, { tax: true });" cursor={39} keys={['F(', 'T(', '2F,']} />
          <p>
            You often finish typing at the end of a line and need to fix something earlier in it. Look back for a rare
            character and jump.
          </p>
        </>
      ),
      practice: total => (
        <p>
          The cursor starts late in a line. Reach each <span className="hl-green">green box</span> with <Code>F</Code>{' '}
          or <Code>T</Code>, moving to its line first when it's on another one. {total} rounds.
        </p>
      ),
      aside: {
        title: 'Counts',
        body: (
          <p>
            <Code>2F,</Code> jumps back to the second comma. Past two or three, repeating the jump is easier than counting,
            which is the next lesson.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        showGoal: false,
        base: {
          name: 'invoice.ts',
          text: [
            "const item = { sku: 'A-100', qty: 2, price: 19.99 };",
            'const line = formatLine(item, locale, { tax: true });',
            'invoice.lines.push(line);',
            'invoice.total += item.price * item.qty;',
          ],
        },
        rounds: [
          { setup: { cursor: { line: 1, col: 52 } }, goal: { cursor: { line: 1, col: 23 } }, solution: 'F(' },
          { setup: { cursor: { line: 1, col: 40 } }, goal: { cursor: { line: 1, col: 24 } }, solution: 'T(' },
          { setup: { cursor: { line: 0, col: 51 } }, goal: { cursor: { line: 0, col: 26 } }, solution: "F'" },
          { setup: { cursor: { line: 3, col: 16 } }, goal: { cursor: { line: 2, col: 8 } }, solution: 'kFl' },
          { setup: { cursor: { line: 0, col: 26 } }, goal: { cursor: { line: 0, col: 21 } }, solution: "T'" },
          { setup: { cursor: { line: 1, col: 52 } }, goal: { cursor: { line: 1, col: 28 } }, solution: '2F,' },
          { setup: { cursor: { line: 2, col: 24 } }, goal: { cursor: { line: 3, col: 21 } }, solution: 'jF.' },
        ],
      },
    },
    {
      id: 'repeat-find',
      title: 'Repeat Find',
      chips: [';', ','],
      keyCards: [
        { key: ';', glyph: '→→', label: 'repeat find' },
        { key: ',', glyph: '←←', label: 'repeat, reversed' },
      ],
      intro: (
        <>
          <p>
            <Code>;</Code> repeats the last <Code>f</Code>, <Code>t</Code>, <Code>F</Code> or <Code>T</Code>.{' '}
            <Code>,</Code> repeats it in the opposite direction.
          </p>
          <p>
            You don't need to count commas before you jump. Press <Code>f,</Code>, then tap <Code>;</Code> until you're
            there. Overshoot, and <Code>,</Code> steps back. Neither leaves the line: past the last comma,{' '}
            <Code>;</Code> just stays put.
          </p>
          <BeforeAfter
            lines={['42,Ada Lovelace,ada@example.com,admin,true']}
            cursor={0}
            keys="f,;;;,"
            caption={<><Code>f,</Code> then three <Code>;</Code> overshoots to the fourth comma; <Code>,</Code> steps back to the third.</>}
          />
        </>
      ),
      practice: total => (
        <p>
          Some rounds start mid-jump: the prompt says which find you just typed. Continue it with <Code>;</Code> and{' '}
          <Code>,</Code>. {total} rounds.
        </p>
      ),
      aside: {
        title: 'Repeating a till',
        body: (
          <p>
            After <Code>t,</Code> the cursor sits just before a comma, and a plain repeat would find that same comma.
            Vim and Neovim skip it, so <Code>;</Code> moves on to the next one.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        showGoal: false,
        base: {
          name: 'users.csv',
          text: [
            'id,name,email,role,active,created_at',
            '42,Ada Lovelace,ada@example.com,admin,true,2024-03-01',
            '43,Grace Hopper,grace@example.com,editor,false,2024-05-17',
            '44,Alan Turing,alan@example.com,viewer,true,2024-06-02',
          ],
        },
        rounds: [
          { setup: { cursor: { line: 1, col: 0 } }, goal: { cursor: { line: 1, col: 31 } }, solution: 'f,;;' },
          {
            prompt: 'You just typed f, — continue to the fourth comma.',
            setup: { cursor: { line: 0, col: 0 }, init: vim => vim.feedKeys('f,') },
            goal: { cursor: { line: 0, col: 18 } },
            solution: ';;;',
          },
          {
            prompt: 'One ; too many. Step back a comma.',
            setup: { cursor: { line: 2, col: 0 }, init: vim => vim.feedKeys('f,;;;') },
            goal: { cursor: { line: 2, col: 33 } },
            solution: ',',
          },
          {
            prompt: 'You just typed F- — keep going left.',
            setup: { cursor: { line: 1, col: 52 }, init: vim => vim.feedKeys('F-') },
            goal: { cursor: { line: 1, col: 47 } },
            solution: ';',
          },
          { setup: { cursor: { line: 1, col: 0 } }, goal: { cursor: { line: 3, col: 42 } }, solution: 'jjt,;;;;' },
          {
            prompt: 'You typed F,;;; and went two commas too far. Go back.',
            setup: { cursor: { line: 0, col: 36 }, init: vim => vim.feedKeys('F,;;;') },
            goal: { cursor: { line: 0, col: 18 } },
            solution: ',,',
          },
        ],
      },
    },
    {
      id: 'top-bottom',
      title: 'Top & Bottom',
      chips: ['gg', 'G'],
      keyCards: [
        { key: 'gg', glyph: '⤒', label: 'first line' },
        { key: 'G', glyph: '⤓', label: 'last line' },
      ],
      intro: (
        <>
          <p>
            <Code>gg</Code> jumps to the first line of the file and <Code>G</Code> to the last. Neovim keeps your
            column when it can (Vim's <Code>startofline</Code> is off), so from column 5 you land on column 5 of the
            new line; add <Code>0</Code> or <Code>^</Code> when you want the start of it.
          </p>
          <p>
            With a count they go to that line: <Code>42G</Code> and <Code>42gg</Code> both jump to line 42. Error messages
            and stack traces give you line numbers; this is how you use them.
          </p>
        </>
      ),
      practice: total => (
        <p>
          Jump to the line each round names. {total} rounds.
        </p>
      ),
      aside: {
        title: 'Getting back',
        body: (
          <p>
            <Code>gg</Code> and <Code>G</Code> are jumps. Press <Code>C-o</Code> to return to where you were before, or{' '}
            <Code>``</Code> to toggle between the last two spots.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        showGoal: false,
        base: {
          name: 'server.go',
          height: 12,
          text: [
            'package main',
            '',
            'import (',
            '\t"encoding/json"',
            '\t"log"',
            '\t"net/http"',
            '\t"os"',
            ')',
            '',
            'type Health struct {',
            '\tStatus  string `json:"status"`',
            '\tVersion string `json:"version"`',
            '}',
            '',
            'func healthHandler(w http.ResponseWriter, r *http.Request) {',
            '\tw.Header().Set("Content-Type", "application/json")',
            '\tjson.NewEncoder(w).Encode(Health{',
            '\t\tStatus:  "ok",',
            '\t\tVersion: version,',
            '\t})',
            '}',
            '',
            'var version = "dev"',
            '',
            'func main() {',
            '\tport := os.Getenv("PORT")',
            '\tif port == "" {',
            '\t\tport = "8080"',
            '\t}',
            '\thttp.HandleFunc("/healthz", healthHandler)',
            '\tlog.Printf("listening on :%s", port)',
            '\tlog.Fatal(http.ListenAndServe(":"+port, nil))',
            '}',
          ],
        },
        rounds: [
          { prompt: 'Go to the last line.', setup: { cursor: { line: 3, col: 0 } }, goal: { cursor: { line: 32, col: 0 } }, solution: 'G' },
          { prompt: 'Go to the first line.', setup: { cursor: { line: 31, col: 0 } }, goal: { cursor: { line: 0, col: 0 } }, solution: 'gg' },
          { prompt: 'Go to line 25.', setup: { cursor: { line: 0, col: 0 } }, goal: { cursor: { line: 24, col: 0 } }, solution: '25G' },
          { prompt: 'Go to line 15.', setup: { cursor: { line: 32, col: 0 } }, goal: { cursor: { line: 14, col: 0 } }, solution: '15G' },
          { prompt: 'Go to line 30 (your column is kept).', setup: { cursor: { line: 10, col: 1 } }, goal: { cursor: { line: 29, col: 1 } }, solution: '30gg' },
          { prompt: 'Go to line 10 (your column is kept).', setup: { cursor: { line: 27, col: 2 } }, goal: { cursor: { line: 9, col: 2 } }, solution: '10G' },
        ],
      },
    },
    {
      id: 'paragraphs',
      title: 'Paragraphs',
      chips: ['{', '}'],
      keyCards: [
        { key: '{', glyph: '¶↑', label: 'previous blank line' },
        { key: '}', glyph: '¶↓', label: 'next blank line' },
      ],
      intro: (
        <>
          <p>
            <Code>{'}'}</Code> jumps forward to the next blank line; <Code>{'{'}</Code> jumps back to the previous one. Vim
            calls the text between blank lines a paragraph.
          </p>
          <p>
            Code has paragraphs too: functions, import blocks, groups of settings. These motions skip a whole block at a
            time.
          </p>
        </>
      ),
      practice: total => (
        <p>
          Reach each <span className="hl-green">green box</span> with <Code>{'{'}</Code> and <Code>{'}'}</Code>. A count
          skips several blocks. {total} rounds.
        </p>
      ),
      aside: {
        title: 'Only truly empty lines',
        body: (
          <p>
            A line containing just spaces doesn't count as blank for <Code>{'{'}</Code> and <Code>{'}'}</Code>. If a jump
            sails past a gap, that line probably has trailing whitespace.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        showGoal: false,
        base: {
          name: 'options.lua',
          height: 20,
          text: [
            '-- Editor options',
            'local opt = vim.opt',
            '',
            'opt.number = true',
            'opt.relativenumber = true',
            'opt.signcolumn = "yes"',
            '',
            'opt.expandtab = true',
            'opt.shiftwidth = 2',
            'opt.tabstop = 2',
            'opt.smartindent = true',
            '',
            'opt.ignorecase = true',
            'opt.smartcase = true',
            'opt.hlsearch = true',
            '',
            'opt.splitright = true',
            'opt.splitbelow = true',
            'opt.scrolloff = 8',
          ],
        },
        rounds: [
          { setup: { cursor: { line: 0, col: 3 } }, goal: { cursor: { line: 2, col: 0 } }, solution: '}' },
          { setup: { cursor: { line: 3, col: 0 } }, goal: { cursor: { line: 11, col: 0 } }, solution: '2}' },
          { setup: { cursor: { line: 13, col: 4 } }, goal: { cursor: { line: 11, col: 0 } }, solution: '{' },
          { setup: { cursor: { line: 17, col: 0 } }, goal: { cursor: { line: 6, col: 0 } }, solution: '3{' },
          { setup: { cursor: { line: 8, col: 4 } }, goal: { cursor: { line: 15, col: 0 } }, solution: '2}' },
          { setup: { cursor: { line: 16, col: 0 } }, goal: { cursor: { line: 18, col: 16 } }, solution: '}' },
        ],
      },
    },
    {
      id: 'matching-pairs',
      title: 'Matching Pairs',
      chips: ['%'],
      keyCards: [{ key: '%', glyph: '(↔)', label: 'jump to match' }],
      intro: (
        <>
          <p>
            On a bracket, <Code>%</Code> jumps to its partner: <Mono>(</Mono> to <Mono>)</Mono>, <Mono>[</Mono> to{' '}
            <Mono>]</Mono>, <Mono>{'{'}</Mono> to <Mono>{'}'}</Mono>, and back.
          </p>
          <p>
            Not on a bracket? <Code>%</Code> finds the next one on the line first, then jumps to its match. From the start
            of an <Code>if</Code> line it lands on the closing parenthesis of the condition.
          </p>
          <Motions text="if (hit && (Date.now() - hit.at) < ttl) return;" cursor={0} keys={['%']} />
        </>
      ),
      practice: total => (
        <p>
          Reach each <span className="hl-green">green box</span>. Every one is a bracket's partner. {total} rounds.
        </p>
      ),
      aside: {
        title: 'Beyond brackets',
        body: (
          <p>
            Neovim ships the matchit plugin, and it is on by default: <Code>%</Code> also jumps between HTML tags and
            between <Code>if</Code>, <Code>else</Code> and <Code>end</Code> in Lua and shell. In classic Vim, run{' '}
            <Code>:packadd matchit</Code> first.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        showGoal: false,
        base: {
          name: 'cache.ts',
          text: [
            'type Entry<T> = { value: T; at: number };',
            '',
            'export function memoize<T>(',
            '  fn: (key: string) => T,',
            '  ttl = 60_000,',
            ') {',
            '  const cache = new Map<string, Entry<T>>();',
            '  return (key: string): T => {',
            '    const hit = cache.get(key);',
            '    if (hit && (Date.now() - hit.at) < ttl) {',
            '      return hit.value;',
            '    }',
            '    const value = fn(key);',
            '    cache.set(key, { value, at: Date.now() });',
            '    return value;',
            '  };',
            '}',
          ],
        },
        rounds: [
          { setup: { cursor: { line: 5, col: 2 } }, goal: { cursor: { line: 16, col: 0 } }, solution: '%' },
          { setup: { cursor: { line: 9, col: 4 } }, goal: { cursor: { line: 9, col: 42 } }, solution: '%' },
          { setup: { cursor: { line: 15, col: 2 } }, goal: { cursor: { line: 7, col: 29 } }, solution: '%' },
          { setup: { cursor: { line: 7, col: 2 } }, goal: { cursor: { line: 15, col: 2 } }, solution: '$%' },
          { setup: { cursor: { line: 2, col: 26 } }, goal: { cursor: { line: 5, col: 0 } }, solution: '%' },
          { setup: { cursor: { line: 9, col: 8 } }, goal: { cursor: { line: 9, col: 35 } }, solution: '%' },
        ],
      },
    },
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
      reps: { mutations: ['wrong-word-run'], count: [10, 15], sections: ['essential-motions'] },
      challenge: {
        kind: 'rounds',
        showGoal: false,
        base: { ...retry, cursor: { line: 0, col: 0 } },
        rounds: [
          { goal: { cursor: { line: 6, col: 10 } }, solution: '/Err<CR>' },
          { setup: { cursor: { line: 6, col: 2 } }, goal: { cursor: { line: 12, col: 12 } }, solution: '/sleep(<CR>' },
          { setup: { cursor: { line: 9, col: 6 } }, goal: { cursor: { line: 4, col: 4 } }, solution: '/tri<CR>' },
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
          { goal: { cursor: { line: 10, col: 6 } }, solution: '/cat<CR>' },
          { goal: { cursor: { line: 7, col: 24 } }, solution: '/attempt<CR>n' },
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
          { goal: { cursor: { line: 2, col: 22 } }, solution: '?wi<CR>' },
          { goal: { cursor: { line: 12, col: 12 } }, solution: '?sl<CR>' },
          { setup: { cursor: { line: 12, col: 6 } }, goal: { cursor: { line: 6, col: 17 } }, solution: '?un<CR>' },
          { setup: { cursor: { line: 11, col: 6 } }, goal: { cursor: { line: 0, col: 0 } }, solution: '?import<CR>' },
          { goal: { cursor: { line: 9, col: 13 } }, solution: '?await<CR>n' },
          { setup: { cursor: { line: 7, col: 8 } }, goal: { cursor: { line: 5, col: 3 } }, solution: '?Promise<CR>' },
          { goal: { cursor: { line: 3, col: 12 } }, solution: '?Promise<CR>n' },
          { goal: { cursor: { line: 0, col: 9 } }, solution: '?sleep<CR>n' },
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
      reps: { mutations: ['wrong-word-run'], count: [10, 15], sections: ['essential-motions'] },
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
          { setup: { cursor: { line: 12, col: 12 } }, goal: { cursor: { line: 0, col: 9 } }, solution: '*' },
          { setup: { cursor: { line: 7, col: 35 } }, goal: { cursor: { line: 4, col: 2 } }, solution: '#' },
        ],
      },
    },
  ],
};
