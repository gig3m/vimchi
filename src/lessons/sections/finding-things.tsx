import { Code, Mono } from '../../components/Code';
import type { Vim } from '../../vim/editor';
import type { Pos } from '../../vim/types';
import type { Section } from '../types';

// A small invoicing service, shared with the File Navigation section.
export const SHOP: Record<string, string> = {
  'package.json': `{
  "name": "shop-invoices",
  "type": "module",
  "scripts": { "dev": "tsx src/app.ts", "test": "vitest" }
}
`,
  'README.md': `# shop-invoices

Issues invoices for the shop and emails them to customers.

    npm run dev
`,
  'src/app.ts': `import express from 'express';
import { customers } from './routes/customers';
import { invoices } from './routes/invoices';
import { createLogger } from './lib/logger';

const log = createLogger('app');
const app = express();

app.use(express.json());
app.use('/customers', customers);
app.use('/invoices', invoices);

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => log.info(\`listening on \${port}\`));
`,
  'src/routes/invoices.ts': `import { Router } from 'express';
import { db } from '../db/client';
import { addTax, formatCents } from '../lib/money';
import { dueDate } from '../lib/dates';

export const invoices = Router();

invoices.get('/:id', async (req, res) => {
  const invoice = await db.invoice.find(req.params.id);
  const total = formatCents(invoice.total);
  res.json({ ...invoice, total });
});

invoices.post('/', async (req, res) => {
  const total = addTax(req.body.subtotal);
  const due = dueDate(new Date());
  const invoice = await db.invoice.create({
    ...req.body, total, due,
  });
  res.status(201).json(invoice);
});
`,
  'src/routes/customers.ts': `import { Router } from 'express';
import { db } from '../db/client';

export const customers = Router();

// TODO: paginate once we pass a few hundred customers
customers.get('/', async (_req, res) => {
  res.json(await db.customer.all());
});
`,
  'src/db/client.ts': `import { createPool } from './pool';

// TODO: read the connection string from the environment
export const db = createPool('postgres://localhost/shop');
`,
  'src/lib/money.ts': `export const TAX_RATE = 0.2;

export function addTax(cents: number): number {
  return Math.round(cents * (1 + TAX_RATE));
}

// TODO: support currencies other than GBP
export function formatCents(cents: number): string {
  return \`£\${(cents / 100).toFixed(2)}\`;
}
`,
  'src/lib/dates.ts': `const DAY = 24 * 60 * 60 * 1000;

export function dueDate(issued: Date, days = 30): Date {
  return new Date(issued.getTime() + days * DAY);
}
`,
  'src/lib/logger.ts': `export function createLogger(name: string) {
  const tag = \`[\${name}]\`;
  return {
    info: (msg: string) => console.log(tag, msg),
    error: (msg: string) => console.error(tag, msg),
  };
}
`,
  'test/money.test.ts': `import { expect, it } from 'vitest';
import { addTax, formatCents } from '../src/lib/money';

it('adds tax', () => expect(addTax(1000)).toBe(1200));
it('formats pence', () => {
  expect(formatCents(1999)).toBe('£19.99');
});
`,
  'test/invoices.test.ts': `import { expect, it } from 'vitest';
import { dueDate } from '../src/lib/dates';

it('is due in 30 days', () => {
  const due = dueDate(new Date('2026-01-01'));
  expect(due.toISOString())
    .toBe('2026-01-31T00:00:00.000Z');
});
`,
};

/** Position of `needle` in a project file (for cursor goals). */
export function at(files: Record<string, string>, file: string, needle: string): Pos {
  const lines = files[file].split('\n');
  const line = lines.findIndex(l => l.includes(needle));
  if (line < 0) throw new Error(`${needle} not in ${file}`);
  return { line, col: lines[line].indexOf(needle) };
}

/** Cursor goal without the green box (which would sit in the wrong file until you get there). */
export const cursorAt = (p: Pos) => (vim: Vim) => vim.cursor.line === p.line && vim.cursor.col === p.col;
const windows = (n: number) => (vim: Vim) => vim.tab.windows().length === n;

export const findingThings: Section = {
  id: 'finding-things',
  title: 'Pickers',
  band: 'project',
  lessons: [
    {
      id: 'picker-files',
      title: 'Find Files',
      chips: ['␣sf', 'C-n', 'C-v'],
      keyCards: [
        { key: '␣sf', glyph: '⌕', label: 'find files', sub: 'kickstart' },
        { key: 'C-n', glyph: '↓', label: 'next result', sub: 'C-p: previous' },
        { key: 'CR', glyph: '⏎', label: 'open it' },
        { key: 'C-v', glyph: '▯▯', label: 'open in vsplit', sub: 'C-x: split' },
      ],
      intro: (
        <>
          <p>
            <Code>Space sf</Code> opens the file picker (LazyVim binds <Code>Space Space</Code> to the same thing): a
            prompt, the matching files and a preview of the one selected. Type a few letters of the path, in order but not necessarily together, and <Code>CR</Code> opens
            the best match. <Code>C-n</Code> and <Code>C-p</Code> move down and up the list.
          </p>
          <p>
            <Code>C-v</Code> opens the file in a vertical split and <Code>C-x</Code> in a horizontal one. Typing{' '}
            <Code>money</Code> is quicker than remembering that the file lives in <Code>src/lib/</Code>.
          </p>
        </>
      ),
      practice: total => (
        <p>
          Open each file the prompt names with <Code>Space sf</Code>. Type just enough to put it at the top. (In the
          browser, <Code>Alt-n</Code> stands in for <Code>C-n</Code>.) {total} rounds.
        </p>
      ),
      aside: {
        title: 'The same picker, other keys',
        body: (
          <p>
            LazyVim's default is <Code>Space Space</Code> for files and <Code>Space /</Code> for grep, both on
            snacks.picker; kickstart uses <Code>Space sf</Code> and <Code>Space sg</Code> on Telescope. The prompt,{' '}
            <Code>C-n</Code> / <Code>C-p</Code> and <Code>CR</Code> behave the same in all of them.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        base: { files: SHOP, open: 'src/app.ts', plugins: ['telescope'] },
        rounds: [
          {
            prompt: 'Open src/lib/money.ts.',
            goal: { buffer: 'src/lib/money.ts' },
            solution: '<Space>sfmoney<CR>',
          },
          {
            prompt: 'Open the customers route.',
            goal: { buffer: 'src/routes/customers.ts' },
            solution: '<Space>sfcust<CR>',
          },
          {
            prompt: 'Open the README.',
            setup: { open: 'src/lib/dates.ts' },
            goal: { buffer: 'README.md' },
            solution: '<Space>sfread<CR>',
          },
          {
            prompt: 'Open test/money.test.ts: type "money", then take the second result.',
            goal: { buffer: 'test/money.test.ts' },
            solution: '<Space>sfmoney<C-n><CR>',
          },
          {
            prompt: 'Open dates.ts in a vertical split.',
            goal: { buffer: 'src/lib/dates.ts', check: windows(2) },
            solution: '<Space>sfdates<C-v>',
          },
          {
            prompt: 'Open the logger in a horizontal split.',
            setup: { open: 'src/routes/invoices.ts' },
            goal: { buffer: 'src/lib/logger.ts', check: windows(2) },
            solution: '<Space>sflog<C-x>',
          },
        ],
      },
    },
    {
      id: 'picker-grep',
      title: 'Live Grep',
      chips: ['␣sg'],
      keyCards: [
        { key: '␣sg', glyph: '⌕', label: 'grep the project', sub: 'kickstart; LazyVim: ␣/' },
        { key: 'CR', glyph: '⏎', label: 'jump to the hit' },
      ],
      intro: (
        <>
          <p>
            <Code>Space sg</Code> searches the contents of every file as you type and lists each matching line as{' '}
            <Mono>file:line:col:text</Mono>. <Code>CR</Code> opens the file with the cursor on the match.
          </p>
          <p>
            The prompt is a regular expression, run through ripgrep with smart case: all lowercase ignores case, one
            capital makes it exact. Use it when you know a name but not which file it lives in.
          </p>
        </>
      ),
      practice: total => (
        <p>
          Grep for the code the prompt describes and jump to it. (In the browser, <Code>Alt-n</Code> stands in for <Code>C-n</Code>.) {total} rounds.
        </p>
      ),
      aside: {
        title: 'Narrowing to files',
        body: (
          <p>
            Type the pattern, then two spaces and a glob — <Mono>parse  *.ts</Mono> — and multi-grep restricts the
            search to matching files (TJ's multi-ripgrep picker; snacks does it with <Mono>-- -g *.ts</Mono>). Live
            grep needs <Mono>ripgrep</Mono> installed.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        base: { files: SHOP, open: 'src/app.ts', plugins: ['telescope'] },
        rounds: [
          {
            prompt: 'Jump to where TAX_RATE is defined.',
            goal: { buffer: 'src/lib/money.ts', check: cursorAt(at(SHOP, 'src/lib/money.ts', 'TAX_RATE =')) },
            solution: '<Space>sgTAX_RATE =<CR>',
          },
          {
            prompt: 'Jump to the handler for POST /invoices.',
            goal: { buffer: 'src/routes/invoices.ts', check: cursorAt(at(SHOP, 'src/routes/invoices.ts', 'invoices.post')) },
            solution: '<Space>sginvoices.post<CR>',
          },
          {
            prompt: 'Find where the port is read from the environment.',
            setup: { open: 'README.md' },
            goal: { buffer: 'src/app.ts', check: cursorAt(at(SHOP, 'src/app.ts', 'env.PORT')) },
            solution: '<Space>sgenv.PORT<CR>',
          },
          {
            prompt: 'Jump to the TODO in money.ts: grep "todo", then take the second hit.',
            goal: { buffer: 'src/lib/money.ts', check: cursorAt(at(SHOP, 'src/lib/money.ts', 'TODO')) },
            solution: '<Space>sgtodo<C-n><CR>',
          },
          {
            prompt: 'Jump to the definition of createLogger.',
            goal: { buffer: 'src/lib/logger.ts', check: cursorAt(at(SHOP, 'src/lib/logger.ts', 'function createLogger')) },
            solution: '<Space>sgfunction createL<CR>',
          },
        ],
      },
    },
    {
      id: 'picker-word',
      title: 'Grep Word Under Cursor',
      chips: ['␣sw'],
      keyCards: [
        { key: '␣sw', glyph: '⌕w', label: 'grep this word', sub: 'kickstart' },
        { key: 'CR', glyph: '⏎', label: 'open the match' },
      ],
      intro: (
        <>
          <p>
            <Code>Space sw</Code> opens live grep with the word under the cursor already typed, so every use in the
            project is one key away. It is the picker form of <Code>*</Code>: where <Code>*</Code> finds the next use in
            this file, <Code>sw</Code> lists every use in every file.
          </p>
          <p>
            The first result is usually the line you are on. <Code>C-n</Code> steps to the others, and the preview
            shows each one before you commit with <Code>CR</Code>.
          </p>
        </>
      ),
      practice: total => (
        <p>
          Put the cursor on the named word, open its uses with <Code>Space sw</Code> and pick the match the prompt
          names. (In the browser, <Code>Alt-n</Code> stands in for <Code>C-n</Code>.) {total} rounds.
        </p>
      ),
      aside: {
        title: 'Buffers picker',
        body: (
          <p>
            kickstart's <Code>Space Space</Code> (LazyVim <Code>Space ,</Code> or <Code>Space fb</Code>) lists open
            buffers in the same picker. To close one from the list, it is <Code>M-d</Code> in Telescope and{' '}
            <Code>dd</Code> in the snacks picker.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        base: { files: SHOP, open: 'src/app.ts', plugins: ['telescope'] },
        rounds: [
          {
            prompt: 'From the import of createLogger, jump to its definition.',
            setup: { cursor: at(SHOP, 'src/app.ts', 'createLogger') },
            goal: { buffer: 'src/lib/logger.ts', check: cursorAt(at(SHOP, 'src/lib/logger.ts', 'createLogger')) },
            solution: '<Space>sw<C-n><C-n><CR>',
          },
          {
            prompt: 'From the import of formatCents, jump to its definition (hits list by file, so it comes first).',
            setup: { open: 'src/routes/invoices.ts', cursor: at(SHOP, 'src/routes/invoices.ts', 'formatCents') },
            goal: { buffer: 'src/lib/money.ts', check: cursorAt(at(SHOP, 'src/lib/money.ts', 'formatCents')) },
            solution: '<Space>sw<CR>',
          },
          {
            prompt: 'From the test, jump to the definition of addTax.',
            setup: { open: 'test/money.test.ts', cursor: at(SHOP, 'test/money.test.ts', 'addTax') },
            goal: { buffer: 'src/lib/money.ts', check: cursorAt(at(SHOP, 'src/lib/money.ts', 'addTax(cents')) },
            solution: '<Space>sw<CR>',
          },
        ],
      },
    },
    {
      id: 'picker-quickfix',
      title: 'Send to Quickfix',
      chips: ['C-q'],
      keyCards: [
        { key: 'C-q', glyph: '☰', label: 'results to quickfix', sub: 'and open it' },
        { key: 'CR', glyph: '⏎', label: 'jump from the list' },
      ],
      intro: (
        <>
          <p>
            <Code>C-q</Code> in any picker sends every result to the quickfix list and opens it. The picker closes; the
            results stay.
          </p>
          <p>
            Use it when there is more than one hit to visit: grep for a name, <Code>C-q</Code>, then walk the list with{' '}
            <Code>]q</Code> or <Code>CR</Code>, or change them all with <Code>:cdo</Code>.
          </p>
        </>
      ),
      practice: total => (
        <p>
          Fill the quickfix list from a picker. (In the browser, <Code>Alt-q</Code> stands in for <Code>C-q</Code>.){' '}
          {total} rounds.
        </p>
      ),
      aside: {
        title: 'Only some results',
        body: (
          <p>
            <Code>Tab</Code> marks results one by one and <Code>M-q</Code> sends just the marked ones. The quickfix list
            outlives the picker, so <Code>:copen</Code> brings it back later.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        base: { files: SHOP, open: 'src/app.ts', plugins: ['telescope'] },
        rounds: [
          {
            prompt: 'Send every TODO in the project to the quickfix list.',
            goal: { check: vim => vim.quickfix.items.length === 3 && vim.buf.kind === 'quickfix' },
            solution: '<Space>sgTODO<C-q>',
          },
          {
            prompt: 'Put both test files in the quickfix list.',
            goal: { check: vim => vim.quickfix.items.length === 2 && vim.quickfix.items.every(i => i.file.startsWith('test/')) && vim.buf.kind === 'quickfix' },
            solution: '<Space>sftest/<C-q>',
          },
          {
            prompt: 'List every formatCents, then open the second hit from the quickfix window.',
            goal: { buffer: 'src/routes/invoices.ts', check: cursorAt(at(SHOP, 'src/routes/invoices.ts', 'formatCents')) },
            solution: '<Space>sgformatCents<C-q>j<CR>',
          },
          {
            prompt: 'List the console calls and jump to the last one.',
            goal: { buffer: 'src/lib/logger.ts', check: cursorAt(at(SHOP, 'src/lib/logger.ts', 'console.error')) },
            solution: '<Space>sgconsole<C-q>G<CR>',
          },
        ],
      },
    },
  ],
};
