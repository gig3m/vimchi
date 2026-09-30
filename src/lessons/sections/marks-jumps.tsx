import { Code } from '../../components/Code';
import { BeforeAfter } from '../../components/diagrams';
import type { Vim } from '../../vim/editor';
import type { Section } from '../types';

/** Replay some keys as history the learner didn't type (jumps, edits). */
const history = (keys: string) => (vim: Vim) => {
  vim.feedKeys(keys);
  vim.typedKeys = 0;
};

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
          Reach the <span className="hl-green">green box</span> using the mark the prompt names. {total} rounds.
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
            prompt: 'Jump to the line of mark a.',
            setup: { cursor: { line: 0, col: 0 }, marks: { a: { line: 9, col: 21 } } },
            goal: { cursor: { line: 9, col: 2 } },
            solution: "'a",
          },
          {
            prompt: 'Jump to the exact spot of mark a.',
            setup: { cursor: { line: 13, col: 0 }, marks: { a: { line: 9, col: 21 } } },
            goal: { cursor: { line: 9, col: 21 } },
            solution: '`a',
          },
          {
            prompt: 'Back to mark d, exact column.',
            setup: { cursor: { line: 14, col: 0 }, marks: { d: { line: 1, col: 9 } } },
            goal: { cursor: { line: 1, col: 9 } },
            solution: '`d',
          },
          {
            prompt: 'Mark this spot b, then jump to the line of mark a.',
            setup: { cursor: { line: 11, col: 6 }, marks: { a: { line: 3, col: 6 } } },
            goal: {
              cursor: { line: 3, col: 0 },
              check: vim => vim.buf.marks.get('b')?.line === 11 && vim.buf.marks.get('b')?.col === 6,
            },
            solution: "mb'a",
          },
          {
            prompt: 'Jump to the line of mark r.',
            setup: { cursor: { line: 4, col: 4 }, marks: { h: { line: 6, col: 9 }, r: { line: 10, col: 25 } } },
            goal: { cursor: { line: 10, col: 2 } },
            solution: "'r",
          },
          {
            prompt: 'Jump to the exact spot of mark h.',
            setup: { cursor: { line: 12, col: 0 }, marks: { h: { line: 6, col: 9 }, r: { line: 10, col: 25 } } },
            goal: { cursor: { line: 6, col: 9 } },
            solution: '`h',
          },
        ],
      },
    },
    {
      id: 'operating-to-marks',
      title: 'Operating to Marks',
      chips: ["d'a", 'y`a'],
      keyCards: [
        { key: "d'a", glyph: '⚑↕', label: 'lines to mark', sub: 'linewise' },
        { key: 'y`a', glyph: '⚑↔', label: 'chars to mark', sub: 'exclusive' },
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
            Ex commands take marks as addresses: <Code>:'a,.d</Code> is the same delete as <Code>d'a</Code>, and{' '}
            <Code>:'a,'bs/foo/bar/</Code> substitutes between two marks.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        base: { name: 'render.ts' },
        rounds: [
          {
            prompt: 'Delete the old implementation, from mark a down to the cursor line.',
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
            prompt: 'Yank from mark a to the cursor and put it inside the log call.',
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
            prompt: 'Delete the legacy arguments, from mark a up to the cursor.',
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
            prompt: 'Copy the checklist, mark a to the cursor line, to the end of the file.',
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
          You made an edit, then wandered off. Get back to it and finish the job. {total} rounds.
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
            prompt: 'You went to check the import mid-line. Finish the throw: "res.status);".',
            setup: {
              text: [
                "import { HttpError } from './errors';",
                '',
                'export async function getJson(url: string) {',
                '  const res = await fetch(url);',
                '  if (!res.ok)',
                '  return res.json();',
                '}',
              ],
              cursor: { line: 4, col: 0 },
              init: history('A throw new HttpError(<Esc>gg'),
            },
            goal: {
              text: [
                "import { HttpError } from './errors';",
                '',
                'export async function getJson(url: string) {',
                '  const res = await fetch(url);',
                '  if (!res.ok) throw new HttpError(res.status);',
                '  return res.json();',
                '}',
              ],
            },
            solution: 'gires.status);<Esc>',
          },
          {
            prompt: 'Jump back to the number you just typed and make it 30_000.',
            setup: {
              text: [
                'export const client = createClient({',
                "  baseUrl: '/api',",
                '  timeout: 5000,',
                '  retries: 2,',
                '});',
                '',
                'export default client;',
              ],
              cursor: { line: 2, col: 11 },
              init: history('ciw30000<Esc>G'),
            },
            goal: {
              text: [
                'export const client = createClient({',
                "  baseUrl: '/api',",
                '  timeout: 30_000,',
                '  retries: 2,',
                '});',
                '',
                'export default client;',
              ],
            },
            solution: '`.hhi_<Esc>',
          },
          {
            prompt: 'Add a "// ms" comment to the end of the line you last changed.',
            setup: {
              text: [
                'export const limits = {',
                '  maxBodyBytes: 1_048_576,',
                '  idleTimeout: 60_000,',
                '  maxConnections: 512,',
                '};',
              ],
              cursor: { line: 2, col: 15 },
              init: history('ciw60_000<Esc>gg'),
            },
            goal: {
              text: [
                'export const limits = {',
                '  maxBodyBytes: 1_048_576,',
                '  idleTimeout: 60_000, // ms',
                '  maxConnections: 512,',
                '};',
              ],
            },
            solution: "'.A // ms<Esc>",
          },
          {
            prompt: 'You jumped to the top to check the title. Finish the sentence: "on first run."',
            setup: {
              name: 'README.md',
              text: [
                '# vimchi',
                '',
                'A browser Vim tutor.',
                '',
                '## Setup',
                '',
                'Run `npm install`, then `npm run dev`.',
                'The tutor opens',
                '',
                '## Lessons',
              ],
              cursor: { line: 7, col: 0 },
              init: history('A in your browser<Esc>gg'),
            },
            goal: {
              text: [
                '# vimchi',
                '',
                'A browser Vim tutor.',
                '',
                '## Setup',
                '',
                'Run `npm install`, then `npm run dev`.',
                'The tutor opens in your browser on first run.',
                '',
                '## Lessons',
              ],
            },
            solution: 'gi on first run.<Esc>',
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
          Something was just yanked, put or typed. Reach the <span className="hl-green">green box</span> at one of its edges.{' '}
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
            prompt: 'You yanked the arguments of formatPrice. Jump to the end of them.',
            setup: { cursor: { line: 8, col: 22 }, init: history('yi(') },
            goal: { cursor: { line: 8, col: 38 } },
            solution: '`]',
          },
          {
            prompt: 'You put three lines below. Jump to the last character put.',
            setup: {
              cursor: { line: 3, col: 2 },
              registers: { a: '  const tax = Math.round(total * 0.2);\n  const discount = cart.coupon?.amount ?? 0;\n  const net = total - discount;\n' },
              init: history('"ap'),
            },
            goal: { cursor: { line: 6, col: 30 } },
            solution: '`]',
          },
          {
            prompt: 'You replaced 5000 with an expression. Jump to its first character.',
            setup: { cursor: { line: 5, col: 27 }, init: history('ciwFREE_MIN * 2<Esc>') },
            goal: { cursor: { line: 5, col: 27 } },
            solution: '`[',
          },
          {
            prompt: 'You just typed two new lines. Jump to the line where you started.',
            setup: { cursor: { line: 3, col: 0 }, init: history('oif (count === 0) {<CR>return null;<Esc>') },
            goal: { cursor: { line: 4, col: 2 } },
            solution: "'[",
          },
          {
            prompt: 'You yanked three lines. Jump to the last character of the yank.',
            setup: { cursor: { line: 4, col: 2 }, init: history('y2j') },
            goal: { cursor: { line: 6, col: 9 } },
            solution: '`]',
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
            <Code>H</Code>, <Code>M</Code>, <Code>L</Code> and mark jumps are.
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
            prompt: 'You searched twice. Go back to where the last search started.',
            setup: { cursor: { line: 0, col: 0 }, init: history('/app.get<CR>n') },
            goal: { cursor: { line: 6, col: 0 } },
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
        { key: 'C-i', glyph: '↷', label: 'newer jump', sub: 'same key as Tab' },
      ],
      intro: (
        <>
          <p>
            Every jump is recorded in a list per window. <Code>C-o</Code> walks back through it, older and older;{' '}
            <Code>C-i</Code> walks forward again. It's the back and forward buttons of a browser.
          </p>
          <p>
            Unlike <Code>``</Code>, it goes more than one step, and it crosses files: <Code>gd</Code> into a definition,
            then <Code>C-o</Code> brings you home.
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
            <Code>3C-o</Code> goes back three jumps at once.
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
            prompt: 'Go back two jumps.',
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
            prompt: 'Go back to where the search landed.',
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
