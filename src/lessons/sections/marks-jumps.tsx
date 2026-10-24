import { Code } from '../../components/Code';
import { BeforeAfter } from '../../components/diagrams';
import { yanked } from '../runtime';
import type { Vim } from '../../vim/editor';
import type { Section } from '../types';

/** Replay some keys as history the learner didn't type (jumps, edits). */
const history = (keys: string) => (vim: Vim) => {
  vim.feedKeys(keys);
  vim.typedKeys = 0;
};

/** Mark `m` is on `line` (and at `col`, when given). */
const markOn = (m: string, line: number, col?: number) => (vim: Vim) => {
  const at = vim.buf.marks.get(m);
  return !!at && at.line === line && (col == null || at.col === col);
};

/** Mark `m` is on `line` (and `col`) and the cursor jumped back to it from another line: setting
 * the mark where the cursor already is doesn't count as the jump. */
const backTo = (m: string, line: number, col?: number) => (vim: Vim) => {
  const from = vim.buf.marks.get("'");
  return markOn(m, line, col)(vim) && !!from && from.line !== line;
};

const onLine = (line: number) => (vim: Vim) => vim.cursor.line === line;

/** Load other files and set uppercase marks in them, then return to the opened file. */
const fileMarks = (marks: Record<string, [file: string, line: number, col: number]>) => (vim: Vim) => {
  const home = vim.buf;
  const at = { ...vim.cursor };
  for (const [m, [file, line, col]] of Object.entries(marks)) {
    const buf = vim.findBuffer(file) ?? vim.edit(file);
    vim.globalMarks.set(m, { buf, pos: { line, col } });
  }
  vim.edit(home.name);
  vim.setCursor(at);
};

const SERVER = [
  "import express from 'express';",
  "import { db } from './db';",
  '',
  'const app = express();',
  'app.use(express.json());',
  '',
  "app.get('/health', (_req, res) => res.send('ok'));",
  '',
  "app.get('/users/:id', async (req, res) => {",
  '  const user = await db.users.find(req.params.id);',
  '  if (!user) return res.status(404).end();',
  '  res.json(user);',
  '});',
  '',
  'app.listen(Number(process.env.PORT ?? 3000));',
];

const PROJECT = {
  'src/app.ts': [
    "import { createRouter } from './routes';",
    "import { loadConfig } from './config';",
    '',
    'export async function main() {',
    '  const config = await loadConfig();',
    '  const router = createRouter(config);',
    '  router.listen(config.port);',
    '}',
  ].join('\n'),
  'src/routes.ts': [
    "import type { Config } from './config';",
    '',
    'export function createRouter(config: Config) {',
    '  const router = new Router();',
    "  router.get('/health', health);",
    "  router.post('/orders', createOrder);",
    '  return router;',
    '}',
  ].join('\n'),
  'src/config.ts': [
    'export type Config = { port: number; dbUrl: string };',
    '',
    'export async function loadConfig(): Promise<Config> {',
    '  return {',
    '    port: Number(process.env.PORT ?? 8080),',
    "    dbUrl: process.env.DATABASE_URL ?? '',",
    '  };',
    '}',
  ].join('\n'),
};

/** SHOP with some lines replaced (null drops the line). */
const shop = (edits: Record<number, string[] | null>) => SHOP.flatMap((l, i) => (i in edits ? (edits[i] ?? []) : [l]));

const GETJSON = (rest: string) => [
  "import { HttpError } from './errors';",
  '',
  'export async function getJson(url: string) {',
  '  const res = await fetch(url);',
  `  if (!res.ok)${rest}`,
  '  return res.json();',
  '}',
];
const CLIENT = (timeout: string) => [
  'export const client = createClient({',
  "  baseUrl: '/api',",
  `  timeout: ${timeout},`,
  '  retries: 2,',
  '});',
  '',
  'export default client;',
];
const LIMITS = (idle: string) => ['export const limits = {', '  maxBodyBytes: 1_048_576,', `  idleTimeout: ${idle}`, '  maxConnections: 512,', '};'];
const README = (line: string) => [
  '# vimchi',
  '',
  'A browser Vim tutor.',
  '',
  '## Setup',
  '',
  'Run `npm install`, then `npm run dev`.',
  line,
  '',
  '## Lessons',
];

const SHOP = [
  "import { formatPrice } from './money';",
  '',
  'export function cartSummary(cart: Cart) {',
  '  const count = cart.items.length;',
  '  const total = sumBy(cart.items, i => i.price * i.qty);',
  '  const shipping = total > 5000 ? 0 : 499;',
  '  return {',
  '    count,',
  '    total: formatPrice(total + shipping),',
  "    label: count === 1 ? '1 item' : `${count} items`,",
  '  };',
  '}',
];

export const marksJumps: Section = {
  id: 'marks-jumps',
  title: 'Marks & Jumps',
  band: 'project',
  lessons: [
    {
      id: 'setting-marks',
      title: 'Setting Marks',
      chips: ['m', "'", '`'],
      keyCards: [
        { key: 'm', glyph: '⚑', label: 'set a mark', sub: 'ma … mz' },
        { key: "'", glyph: '→⚑', label: "mark's line", sub: 'first non-blank' },
        { key: '`', glyph: '→⚑', label: "mark's exact spot" },
      ],
      intro: (
        <>
          <p>
            <Code>ma</Code> drops mark <Code>a</Code> at the cursor. Later, <Code>'a</Code> jumps back to that line and{' '}
            <Code>`a</Code> to the exact line and column. Lowercase marks <Code>a</Code> to <Code>z</Code> belong to
            the file.
          </p>
          <p>
            Set a mark before you go and look something up, and one keystroke pair brings you back. They also move
            with the text when lines above them are added or deleted.
          </p>
        </>
      ),
      practice: total => (
        <p>
          Set the marks the round asks for, move away, then jump back with <Code>'</Code> or <Code>`</Code>.{' '}
          {total} rounds.
        </p>
      ),
      aside: {
        title: 'Marks on screen',
        body: (
          <p>
            <Code>:marks</Code> lists every mark with its line and text. The marks.nvim plugin also shows them in the
            sign column.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        showGoal: false,
        base: { name: 'server.ts', text: SERVER },
        rounds: [
          {
            setup: { cursor: { line: 9, col: 2 } },
            steps: [
              {
                prompt: 'Set mark a on the "const user" line.',
                goal: { check: markOn('a', 9) },
                mark: { start: { line: 9, col: 2 }, end: { line: 9, col: 49 } },
              },
              { prompt: 'Go to the last line.', goal: { check: onLine(14) } },
            ],
            prompt: 'Jump back to the line of mark a.',
            goal: { cursor: { line: 9, col: 2 }, check: backTo('a', 9) },
            solution: "maG'a",
          },
          {
            setup: { cursor: { line: 10, col: 2 } },
            steps: [
              {
                prompt: 'Set mark s on "404".',
                goal: { check: markOn('s', 10, 31) },
                mark: { start: { line: 10, col: 31 }, end: { line: 10, col: 33 } },
              },
              { prompt: 'Go to the top of the file.', goal: { check: onLine(0) } },
            ],
            prompt: 'Jump to the exact spot of mark s.',
            goal: { cursor: { line: 10, col: 31 }, check: backTo('s', 10, 31) },
            solution: 'f4msgg`s',
          },
          {
            setup: { cursor: { line: 3, col: 0 } },
            steps: [
              {
                prompt: 'Set mark b on the "const app" line.',
                goal: { check: markOn('b', 3) },
                mark: { start: { line: 3, col: 0 }, end: { line: 3, col: 21 } },
              },
              { prompt: 'Go to the top of the file.', goal: { check: onLine(0) } },
            ],
            prompt: 'Jump back to the line of mark b.',
            goal: { cursor: { line: 3, col: 0 }, check: backTo('b', 3) },
            solution: "mbgg'b",
          },
          {
            setup: { cursor: { line: 6, col: 0 } },
            steps: [
              {
                prompt: 'Set mark h on the "/health" line.',
                goal: { check: markOn('h', 6) },
                mark: { start: { line: 6, col: 0 }, end: { line: 6, col: 49 } },
              },
              {
                prompt: 'Set mark r on the "res.json(user)" line.',
                goal: { check: markOn('r', 11) },
                mark: { start: { line: 11, col: 2 }, end: { line: 11, col: 16 } },
              },
            ],
            prompt: 'Jump to the line of mark h.',
            goal: { cursor: { line: 6, col: 0 }, check: backTo('h', 6) },
            solution: "mh5jmr'h",
          },
          {
            setup: { cursor: { line: 9, col: 2 } },
            steps: [
              {
                prompt: 'Set mark f on "find".',
                goal: { check: markOn('f', 9, 30) },
                mark: { start: { line: 9, col: 30 }, end: { line: 9, col: 33 } },
              },
              { prompt: 'Go to the top of the file.', goal: { check: onLine(0) } },
            ],
            prompt: 'Jump to the exact spot of mark f.',
            goal: { cursor: { line: 9, col: 30 }, check: backTo('f', 9, 30) },
            solution: 'ffmfgg`f',
          },
        ],
      },
    },
    {
      id: 'operating-to-marks',
      title: 'Operating to Marks',
      chips: ["d'a", 'y`a'],
      keyCards: [
        { key: "d'a", glyph: '⚑↕', label: 'lines to mark', sub: 'whole lines' },
        { key: 'y`a', glyph: '⚑↔', label: 'chars to mark', sub: 'exact spots' },
      ],
      intro: (
        <>
          <p>
            A mark jump is a motion, so operators take it. <Code>d'a</Code> deletes every line from the cursor to mark{' '}
            <Code>a</Code>. <Code>y`a</Code> yanks from the exact mark to the cursor, character by character.
          </p>
          <p>
            That's how you act on a region too long to count: mark one end, move to the other, and apply{' '}
            <Code>d</Code>, <Code>y</Code>, <Code>c</Code> or <Code>&gt;</Code>.
          </p>
          <BeforeAfter
            lines={['const a = 1;', '// old', 'const b = 2;', 'const c = 3;', 'export { a };']}
            cursor={[1, 0]}
            keys="ma2jd'a"
            caption="Mark the first line, move to the last, delete every line between."
          />
        </>
      ),
      practice: total => (
        <p>
          Mark <Code>a</Code> is already set in each round. Apply the operator from the cursor to it. {total} rounds.
        </p>
      ),
      aside: {
        title: 'Marks in ranges',
        body: (
          <p>
            Coming up in Command Line: Ex commands take marks as line numbers, so <Code>:'a,.d</Code> is the same
            delete as <Code>d'a</Code>, and <Code>:'a,'bs/foo/bar/</Code> substitutes between two marks.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        base: { name: 'render.ts' },
        rounds: [
          {
            prompt: 'Delete every line from mark a, on "// old implementation", down to the cursor line.',
            setup: {
              text: [
                'export function renderList(items: string[]) {',
                '  // old implementation',
                '  const out: string[] = [];',
                '  for (const it of items) out.push(`<li>${it}</li>`);',
                "  return out.join('');",
                '  // end old',
                "  return items.map(it => `<li>${it}</li>`).join('');",
                '}',
              ],
              marks: { a: { line: 1, col: 2 } },
              cursor: { line: 5, col: 2 },
            },
            goal: { text: ['export function renderList(items: string[]) {', "  return items.map(it => `<li>${it}</li>`).join('');", '}'] },
            solution: "d'a",
          },
          {
            setup: {
              text: [
                'function greet(first: string, last: string) {',
                "  const full = [first, last].join(' ');",
                '  console.log();',
                '  return full;',
                '}',
              ],
              marks: { a: { line: 1, col: 15 } },
              cursor: { line: 1, col: 38 },
            },
            steps: [
              {
                prompt: 'Yank from mark a to the cursor.',
                goal: yanked("[first, last].join(' ')"),
                mark: { start: { line: 1, col: 15 }, end: { line: 1, col: 37 } },
              },
            ],
            prompt: 'Put it inside the empty console.log().',
            goal: {
              text: [
                'function greet(first: string, last: string) {',
                "  const full = [first, last].join(' ');",
                "  console.log([first, last].join(' '));",
                '  return full;',
                '}',
              ],
            },
            solution: 'y`ajF(p',
          },
          {
            prompt: 'Indent the lines from mark a to the cursor.',
            setup: {
              name: 'neovide.lua',
              text: [
                'if vim.g.neovide then',
                "vim.o.guifont = 'JetBrains Mono:h14'",
                'vim.g.neovide_cursor_animation_length = 0',
                'vim.g.neovide_scroll_animation_length = 0.1',
                'end',
              ],
              marks: { a: { line: 1, col: 0 } },
              cursor: { line: 3, col: 0 },
            },
            goal: {
              text: [
                'if vim.g.neovide then',
                "  vim.o.guifont = 'JetBrains Mono:h14'",
                '  vim.g.neovide_cursor_animation_length = 0',
                '  vim.g.neovide_scroll_animation_length = 0.1',
                'end',
              ],
            },
            solution: ">'a",
          },
          {
            prompt: 'Delete from mark a, the comma after "cols", up to the cursor.',
            setup: {
              name: 'report.py',
              text: [
                'rows = load_rows(path)',
                'cols = pick_columns(rows)',
                'result = compute(rows, cols, legacy=True, verbose=False)',
                'print(format_table(result))',
              ],
              marks: { a: { line: 2, col: 27 } },
              cursor: { line: 2, col: 56 },
            },
            goal: {
              text: [
                'rows = load_rows(path)',
                'cols = pick_columns(rows)',
                'result = compute(rows, cols)',
                'print(format_table(result))',
              ],
            },
            solution: 'd`a',
          },
          {
            setup: {
              name: 'RELEASING.md',
              text: [
                '## Checklist',
                '- [ ] tests pass',
                '- [ ] changelog updated',
                '- [ ] version bumped',
                '',
                '## Release 2.1',
              ],
              marks: { a: { line: 1, col: 0 } },
              cursor: { line: 3, col: 0 },
            },
            steps: [
              {
                prompt: 'Yank the lines from mark a to the cursor line.',
                goal: yanked('- [ ] tests pass\n- [ ] changelog updated\n- [ ] version bumped\n', 'line'),
                mark: { start: { line: 1, col: 0 }, end: { line: 3, col: 19 } },
              },
            ],
            prompt: 'Put them at the end of the file.',
            goal: {
              text: [
                '## Checklist',
                '- [ ] tests pass',
                '- [ ] changelog updated',
                '- [ ] version bumped',
                '',
                '## Release 2.1',
                '- [ ] tests pass',
                '- [ ] changelog updated',
                '- [ ] version bumped',
              ],
            },
            solution: "y'aGp",
          },
        ],
      },
    },
    {
      id: 'file-marks',
      title: 'File Marks',
      chips: ['mA'],
      keyCards: [
        { key: 'mA', glyph: '⚑F', label: 'mark in any file', sub: 'A … Z' },
        { key: "'A", glyph: '→F', label: 'open file at mark' },
      ],
      intro: (
        <>
          <p>
            Uppercase marks remember the file as well as the position. <Code>mR</Code> in the router, and{' '}
            <Code>'R</Code> from anywhere else opens that file and jumps to the line.
          </p>
          <p>
            Use them as bookmarks for the few places you keep returning to: the config, the test you're fixing, the
            route you're building.
          </p>
        </>
      ),
      practice: total => (
        <p>
          Hop between files with uppercase marks. Each round says which mark to use or set. {total} rounds.
        </p>
      ),
      aside: {
        title: 'They persist',
        body: (
          <p>
            Neovim stores uppercase marks in ShaDa, so <Code>'C</Code> opens your config tomorrow too. Delete one with{' '}
            <Code>:delmarks C</Code>.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        base: { files: PROJECT, open: 'src/app.ts' },
        rounds: [
          {
            prompt: 'Jump to mark R in routes.ts.',
            setup: { cursor: { line: 4, col: 2 }, init: fileMarks({ R: ['src/routes.ts', 5, 2] }) },
            goal: { buffer: 'src/routes.ts', cursor: { line: 5, col: 2 } },
            solution: "'R",
          },
          {
            prompt: 'Jump to the exact spot of mark C in config.ts.',
            setup: { cursor: { line: 0, col: 0 }, init: fileMarks({ C: ['src/config.ts', 4, 30], R: ['src/routes.ts', 5, 2] }) },
            goal: { buffer: 'src/config.ts', cursor: { line: 4, col: 30 } },
            solution: '`C',
          },
          {
            prompt: 'Mark this line A, then jump to mark R.',
            setup: { cursor: { line: 5, col: 2 }, init: fileMarks({ R: ['src/routes.ts', 5, 2] }) },
            goal: {
              buffer: 'src/routes.ts',
              cursor: { line: 5, col: 2 },
              check: vim => vim.globalMarks.get('A')?.buf.name === 'src/app.ts' && vim.globalMarks.get('A')?.pos.line === 5,
            },
            solution: "mA'R",
          },
          {
            prompt: 'You are in config.ts. Go back to mark A in app.ts.',
            setup: {
              files: PROJECT,
              open: 'src/config.ts',
              cursor: { line: 5, col: 4 },
              init: fileMarks({ A: ['src/app.ts', 5, 2], R: ['src/routes.ts', 5, 2] }),
            },
            goal: { buffer: 'src/app.ts', cursor: { line: 5, col: 2 } },
            solution: "'A",
          },
          {
            prompt: 'Jump to mark C, then from there to mark R.',
            setup: { cursor: { line: 0, col: 0 }, init: fileMarks({ C: ['src/config.ts', 4, 4], R: ['src/routes.ts', 4, 2] }) },
            goal: { buffer: 'src/routes.ts', cursor: { line: 4, col: 2 } },
            solution: "'C'R",
          },
        ],
      },
    },
    {
      id: 'back-to-edit',
      title: 'Back to Your Edit',
      typing: true,
      chips: ['`.', 'gi'],
      keyCards: [
        { key: '`.', glyph: '→✎', label: 'last change', sub: "'. for its line" },
        { key: 'gi', glyph: '→|i', label: 'insert where you left' },
      ],
      intro: (
        <>
          <p>
            Vim keeps a mark on your last change. <Code>`.</Code> jumps to it, <Code>'.</Code> to its line. And{' '}
            <Code>gi</Code> goes one better: it returns to where you last left insert mode and starts inserting again.
          </p>
          <p>
            Scroll up to check an import, read a signature, then <Code>gi</Code> and keep typing. No need to find your
            place.
          </p>
        </>
      ),
      practice: total => (
        <p>
          Make an edit, wander off, then get back to it and finish the job. {total} rounds.
        </p>
      ),
      aside: {
        title: 'Two different marks',
        body: (
          <p>
            <Code>gi</Code> uses the <Code>^</Code> mark, where insert mode last stopped. <Code>`.</Code> is where
            anything last changed, including a <Code>dd</Code> or a put.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        base: { name: 'http.ts' },
        rounds: [
          {
            setup: { text: GETJSON(" throw new HttpError('');"), cursor: { line: 4, col: 2 } },
            inOrder: true,
            steps: [
              {
                prompt: 'Type "Not" between the quotes of HttpError(\'\'), then leave insert mode.',
                goal: { text: GETJSON(" throw new HttpError('Not');") },
              },
              { prompt: 'Go to the top of the file.', goal: { text: GETJSON(" throw new HttpError('Not');"), check: onLine(0) } },
            ],
            prompt: 'Go back to where you were typing and finish the message: "Not ok".',
            goal: { text: GETJSON(" throw new HttpError('Not ok');") },
            solution: "ci'Not<Esc>gggi ok<Esc>",
          },
          {
            setup: { text: CLIENT('5000'), cursor: { line: 2, col: 2 } },
            inOrder: true,
            steps: [
              { prompt: 'Change 5000 to 30000.', goal: { text: CLIENT('30000') } },
              { prompt: 'Go to the last line.', goal: { text: CLIENT('30000'), check: onLine(6) } },
            ],
            prompt: 'Jump back to that change and make it 30_000.',
            goal: { text: CLIENT('30_000') },
            solution: 'f5ciw30000<Esc>G`.hhi_<Esc>',
          },
          {
            setup: { text: LIMITS('60000,'), cursor: { line: 2, col: 2 } },
            inOrder: true,
            steps: [
              { prompt: 'Change 60000 to 90000.', goal: { text: LIMITS('90000,') } },
              { prompt: 'Go to the top of the file.', goal: { text: LIMITS('90000,'), check: onLine(0) } },
            ],
            prompt: 'Add a "// ms" comment to the end of the line you changed.',
            goal: { text: LIMITS('90000, // ms') },
            solution: "f6r9gg'.A // ms<Esc>",
          },
          {
            setup: { name: 'README.md', text: README('The tutor opens in a'), cursor: { line: 7, col: 0 } },
            inOrder: true,
            steps: [
              {
                prompt: 'Add " tab" to the end of "The tutor opens in a", then leave insert mode.',
                goal: { text: README('The tutor opens in a tab') },
              },
              { prompt: 'Go to the top of the file.', goal: { text: README('The tutor opens in a tab'), check: onLine(0) } },
            ],
            prompt: 'Go back to where you were typing and end the sentence with a period.',
            goal: { text: README('The tutor opens in a tab.') },
            solution: 'A tab<Esc>gggi.<Esc>',
          },
        ],
      },
    },
    {
      id: 'change-edges',
      title: 'Edges of a Change',
      chips: ['`[', '`]'],
      keyCards: [
        { key: '`[', glyph: '[→', label: 'start of last change', sub: 'or yank' },
        { key: '`]', glyph: '→]', label: 'end of last change', sub: 'or yank' },
      ],
      intro: (
        <>
          <p>
            After a yank, put or change, the marks <Code>[</Code> and <Code>]</Code> sit on its first and last
            character. <Code>`[</Code> and <Code>`]</Code> jump there; <Code>'[</Code> and <Code>']</Code> go to the lines.
          </p>
          <p>
            Put a block and the cursor lands at its start. <Code>`]</Code> takes you to the end, ready to keep going
            below it.
          </p>
          <BeforeAfter
            lines={['- [ ] tests pass', '- [ ] changelog', '', '## 2.1']}
            cursor={[0, 0]}
            keys="yjGp`]"
            caption="Yank two lines, put them at the end, then jump to the last character put."
          />
        </>
      ),
      practice: total => (
        <p>
          Yank, put or type what the round asks, then reach the <span className="hl-green">green box</span> at one of
          its edges.{' '}
          {total} rounds.
        </p>
      ),
      aside: {
        title: 'Select what you pasted',
        body: (
          <p>
            <Code>`[v`]</Code> selects exactly the text you just put, ready to indent with <Code>&gt;</Code> or
            re-indent with <Code>=</Code>.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        showGoal: false,
        base: { name: 'cart.ts', text: SHOP },
        rounds: [
          {
            setup: { cursor: { line: 8, col: 4 } },
            steps: [
              {
                prompt: 'Yank the text inside formatPrice( ).',
                goal: yanked('total + shipping'),
                mark: { start: { line: 8, col: 23 }, end: { line: 8, col: 38 } },
              },
            ],
            prompt: 'Jump to the end of what you yanked.',
            goal: { cursor: { line: 8, col: 38 } },
            solution: 'f(yi(`]',
          },
          {
            setup: { cursor: { line: 3, col: 2 } },
            steps: [
              { prompt: 'Cut the "const count" line.', goal: { text: shop({ 3: null }) } },
              { prompt: 'Put it back below "const total".', goal: { text: shop({ 3: null, 4: [SHOP[4], SHOP[3]] }) } },
            ],
            prompt: 'Jump to the last character you put.',
            goal: { cursor: { line: 4, col: 33 } },
            solution: 'ddp`]',
          },
          {
            setup: { cursor: { line: 5, col: 2 } },
            steps: [
              {
                prompt: 'Change 5000 to 7500.',
                goal: { text: shop({ 5: ['  const shipping = total > 7500 ? 0 : 499;'] }) },
              },
            ],
            prompt: 'Jump to the first character of what you typed.',
            goal: { cursor: { line: 5, col: 27 } },
            solution: 'f5ciw7500<Esc>`[',
          },
          {
            setup: { cursor: { line: 5, col: 2 } },
            steps: [
              { prompt: 'Change the 499 to 0.', goal: { text: shop({ 5: ['  const shipping = total > 5000 ? 0 : 0;'] }) } },
              { prompt: 'Go to the top of the file.', goal: { text: shop({ 5: ['  const shipping = total > 5000 ? 0 : 0;'] }), check: onLine(0) } },
            ],
            prompt: 'Jump back to the line you changed.',
            goal: { cursor: { line: 5, col: 2 } },
            solution: "f4ciw0<Esc>gg'[",
          },
          {
            setup: { cursor: { line: 4, col: 2 } },
            steps: [
              {
                prompt: 'Yank the "const total" line and the two below it.',
                goal: yanked(SHOP.slice(4, 7).join('\n') + '\n', 'line'),
                mark: { start: { line: 4, col: 2 }, end: { line: 6, col: 9 } },
              },
            ],
            prompt: 'Jump to the last character of the yank.',
            goal: { cursor: { line: 6, col: 9 } },
            solution: 'y2j`]',
          },
        ],
      },
    },
    {
      id: 'previous-position',
      title: 'Previous Position',
      chips: ['``', "''"],
      keyCards: [
        { key: '``', glyph: '↩', label: 'back to exact spot', sub: 'before the last jump' },
        { key: "''", glyph: '↩', label: 'back to that line' },
      ],
      intro: (
        <>
          <p>
            Big moves like <Code>G</Code>, <Code>/search</Code>, <Code>%</Code> and <Code>'a</Code> are jumps, and each
            one remembers where you were. <Code>``</Code> goes back to that exact spot, <Code>''</Code> to its line.
          </p>
          <p>
            Press it again to go forward. It's a toggle between two places, like Alt-Tab for your cursor.
          </p>
        </>
      ),
      practice: total => (
        <p>
          Each round has just made a jump. Go back to the <span className="hl-green">green box</span> where it started.{' '}
          {total} rounds.
        </p>
      ),
      aside: {
        title: 'What counts as a jump',
        body: (
          <p>
            <Code>j</Code>, <Code>w</Code> and <Code>f</Code> are not jumps, so they don't move the <Code>'</Code> mark.
            Searches, <Code>G</Code>, <Code>gg</Code>, <Code>%</Code>, <Code>{'{'}</Code>, <Code>{'}'}</Code>,{' '}
            <Code>M</Code> and mark jumps are (and <Code>H</Code> and <Code>L</Code>, in plain Vim; LazyVim gives them
            to buffers).
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        showGoal: false,
        base: { name: 'server.ts', text: SERVER },
        rounds: [
          {
            prompt: 'You pressed G. Go back to the exact spot.',
            setup: { cursor: { line: 9, col: 23 }, init: history('G') },
            goal: { cursor: { line: 9, col: 23 } },
            solution: '``',
          },
          {
            prompt: 'You searched for "listen". Go back to the line you came from.',
            setup: { cursor: { line: 4, col: 12 }, init: history('/listen<CR>') },
            goal: { cursor: { line: 4, col: 0 } },
            solution: "''",
          },
          {
            prompt: 'You jumped to the next blank line with }. Go back.',
            setup: { cursor: { line: 8, col: 42 }, init: history('}') },
            goal: { cursor: { line: 8, col: 42 } },
            solution: '``',
          },
          {
            prompt: 'You pressed gg. Return to that line.',
            setup: { cursor: { line: 11, col: 10 }, init: history('gg') },
            goal: { cursor: { line: 11, col: 2 } },
            solution: "''",
          },
          {
            prompt: 'You pressed * in the middle of "user". Go back to the exact spot.',
            setup: { cursor: { line: 9, col: 10 }, init: history('*') },
            goal: { cursor: { line: 9, col: 10 } },
            solution: '``',
          },
        ],
      },
    },
    {
      id: 'jump-list',
      title: 'Jump List',
      chips: ['C-o', 'C-i'],
      keyCards: [
        { key: 'C-o', glyph: '↶', label: 'older jump' },
        { key: 'C-i', glyph: '↷', label: 'newer jump', sub: 'often the same key as Tab' },
      ],
      intro: (
        <>
          <p>
            Every jump is recorded in a list per window. <Code>C-o</Code> walks back through it, older and older;{' '}
            <Code>C-i</Code> walks forward again. It's the back and forward buttons of a browser.
          </p>
          <p>
            Unlike <Code>``</Code>, it goes more than one step, and it crosses files: <Code>gf</Code> into another
            file, then <Code>C-o</Code> brings you home.
          </p>
        </>
      ),
      practice: total => (
        <p>
          Each round has already made a few jumps. Walk the list to the <span className="hl-green">green box</span>.{' '}
          {total} rounds.
        </p>
      ),
      aside: {
        title: 'See the list',
        body: (
          <p>
            <Code>:jumps</Code> prints the list with a <Code>&gt;</Code> at your place in it. Counts work too:{' '}
            <Code>3 C-o</Code> goes back three jumps at once.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        showGoal: false,
        base: { name: 'server.ts', text: SERVER },
        rounds: [
          {
            prompt: 'Go back one jump.',
            setup: { cursor: { line: 4, col: 8 }, init: history('G') },
            goal: { cursor: { line: 4, col: 8 } },
            solution: '<C-o>',
          },
          {
            prompt: 'You searched, then pressed G. Go back two jumps.',
            setup: { cursor: { line: 1, col: 9 }, init: history('/users<CR>G') },
            goal: { cursor: { line: 1, col: 9 } },
            solution: '<C-o><C-o>',
          },
          {
            prompt: 'You went back too far. Go forward one jump.',
            setup: { cursor: { line: 3, col: 6 }, init: history('/status<CR>G<C-o><C-o>') },
            goal: { cursor: { line: 10, col: 24 } },
            solution: '<C-i>',
          },
          {
            prompt: 'Go back three jumps.',
            setup: { cursor: { line: 6, col: 4 }, init: history('/find<CR>ggG') },
            goal: { cursor: { line: 6, col: 4 } },
            solution: '3<C-o>',
          },
          {
            prompt: 'You searched for "res.json", then pressed G. Go back to where the search landed.',
            setup: { cursor: { line: 0, col: 0 }, init: history("/res.json<CR>G") },
            goal: { cursor: { line: 11, col: 2 } },
            solution: '<C-o>',
          },
        ],
      },
    },
    {
      id: 'change-list',
      title: 'Change List',
      chips: ['g;', 'g,'],
      keyCards: [
        { key: 'g;', glyph: '↶✎', label: 'older change' },
        { key: 'g,', glyph: '↷✎', label: 'newer change' },
      ],
      intro: (
        <>
          <p>
            Vim also keeps a list of the places you changed. <Code>g;</Code> steps back to older edits,{' '}
            <Code>g,</Code> forward to newer ones.
          </p>
          <p>
            Where <Code>C-o</Code> retraces where you looked, <Code>g;</Code> retraces where you worked. It survives
            closing the file, too.
          </p>
        </>
      ),
      practice: total => (
        <p>
          Several edits were made in each round. Walk the change list to the <span className="hl-green">green box</span>.{' '}
          {total} rounds.
        </p>
      ),
      aside: {
        title: 'One entry per line',
        body: (
          <p>
            Several edits close together on one line count as one entry, so <Code>g;</Code> doesn't make you step
            through every character you typed. <Code>:changes</Code> shows the list.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        showGoal: false,
        base: { name: 'cart.ts', text: SHOP },
        rounds: [
          {
            prompt: 'Go to your most recent change.',
            setup: { cursor: { line: 8, col: 23 }, init: history('ciwsubtotal<Esc>gg') },
            goal: { cursor: { line: 8, col: 30 } },
            solution: 'g;',
          },
          {
            prompt: 'Go to the change before the last one.',
            setup: { cursor: { line: 4, col: 8 }, init: history('ciwsubtotal<Esc>jA // cents<Esc>G') },
            goal: { cursor: { line: 4, col: 15 } },
            solution: 'g;g;',
          },
          {
            prompt: 'You stepped back too far. Go one change newer.',
            setup: { cursor: { line: 7, col: 4 }, init: history('A // n<Esc>jA // cents<Esc>ggg;g;') },
            goal: { cursor: { line: 8, col: 49 } },
            solution: 'g,',
          },
          {
            prompt: 'Go back to the oldest of the three changes.',
            setup: { cursor: { line: 0, col: 9 }, init: history('ciwformatCents<Esc>5jA // free over $50<Esc>3jA // cents<Esc>') },
            goal: { cursor: { line: 0, col: 19 } },
            solution: '3g;',
          },
        ],
      },
    },
  ],
};
