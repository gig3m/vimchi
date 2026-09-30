import { Code, Mono } from '../../components/Code';
import { BeforeAfter } from '../../components/diagrams';
import type { Vim } from '../../vim/editor';
import type { CodeAction, Diagnostic, LspData } from '../../vim/plugins/lsp';
import type { Pos } from '../../vim/types';
import type { Section, Setup } from '../types';

/** Position of the `nth` occurrence of `needle` on `line`. */
const at = (lines: string[], line: number, needle: string, nth = 1): Pos => {
  let col = -1;
  for (let i = 0; i < nth; i++) col = lines[line].indexOf(needle, col + 1);
  if (col < 0) throw new Error(`"${needle}" not on line ${line}`);
  return { line, col };
};

/** Give the lsp plugin its data (a fresh copy per editor, since code actions clear diagnostics). */
const server = (data: LspData) => (vim: Vim) => {
  vim.pluginData.lsp = { ...data, diagnostics: data.diagnostics?.map(d => ({ ...d })) };
};

/** A diagnostic on `needle` in `file`. */
const diag = (file: string, lines: string[], line: number, needle: string, message: string, severity: Diagnostic['severity'] = 'error'): Diagnostic => ({
  file, ...at(lines, line, needle), message, severity,
});

/** A code action that replaces lines and clears the diagnostics it fixes. */
const action = (title: string, line: number, edit: (vim: Vim) => void): CodeAction => ({
  title,
  line,
  apply: vim => {
    edit(vim);
    const data = vim.pluginData.lsp as LspData;
    data.diagnostics = (data.diagnostics ?? []).filter(d => d.line !== line);
  },
});

// ---- Diagnostics -----------------------------------------------------------------------------------------------

const PROFILE = [
  "import { fetchUser } from './api';",
  "import { formatDate, formatTime } from './format';",
  '',
  'export async function renderProfile(id: string) {',
  '  const user = await fetchUser(id);',
  '  const joined = formatDate(user.createdAt);',
  '  const unused = user.email;',
  "  if (user.role = 'admin') {",
  '    showBadge(user);',
  '  }',
  '  return `${user.name} joined ${joined}`;',
  '}',
];
const PROFILE_DIAGS = [
  diag('profile.ts', PROFILE, 1, 'formatTime', "'formatTime' is declared but its value is never read.", 'hint'),
  diag('profile.ts', PROFILE, 5, 'createdAt', "Property 'createdAt' does not exist on type 'User'. Did you mean 'created_at'?"),
  diag('profile.ts', PROFILE, 6, 'unused', "'unused' is declared but its value is never read.", 'hint'),
  diag('profile.ts', PROFILE, 7, 'user.role', 'Expected a conditional expression and instead saw an assignment.', 'warn'),
  diag('profile.ts', PROFILE, 8, 'showBadge', "Cannot find name 'showBadge'."),
];
const P = (i: number) => ({ line: PROFILE_DIAGS[i].line, col: PROFILE_DIAGS[i].col });

// ---- a small shop project for gd / K / grr / grn ---------------------------------------------------------------

const MONEY = [
  '/** Formats integer cents as a price. */',
  'export function formatMoney(',
  '  cents: number,',
  '  currency = "USD",',
  '): string {',
  '  return new Intl.NumberFormat("en-US", {',
  '    style: "currency",',
  '    currency,',
  '  }).format(cents / 100);',
  '}',
];
const TYPES = ['export interface CartItem {', '  sku: string;', '  qty: number;', '  priceCents: number;', '}'];
const CART = [
  "import { formatMoney } from './money';",
  "import type { CartItem } from './types';",
  '',
  'const TAX_RATE = 0.0825;',
  '',
  'export function lineTotal(item: CartItem) {',
  '  return formatMoney(item.priceCents * item.qty);',
  '}',
  '',
  'export function cartTotal(items: CartItem[]) {',
  '  const cents = items.reduce(',
  '    (sum, i) => sum + i.priceCents * i.qty,',
  '    0,',
  '  );',
  '  return formatMoney(Math.round(cents * (1 + TAX_RATE)));',
  '}',
];
const RECEIPT = [
  "import { formatMoney } from './money';",
  '',
  'export function receiptLine(label: string, cents: number) {',
  '  return label.padEnd(24) + formatMoney(cents);',
  '}',
];
const PAYMENTS = [
  'export interface PaymentProvider {',
  '  charge(cents: number, token: string): Promise<string>;',
  '}',
  '',
  'export class StripeProvider implements PaymentProvider {',
  '  async charge(cents: number, token: string) {',
  '    const res = await stripe.paymentIntents.create({',
  '      amount: cents,',
  '      payment_method: token,',
  '    });',
  '    return res.id;',
  '  }',
  '}',
  '',
  'export class InvoiceProvider implements PaymentProvider {',
  '  async charge(cents: number, token: string) {',
  '    return invoices.issue({ cents, customer: token });',
  '  }',
  '}',
];
const LOG = [
  'export interface Logger {',
  '  info(message: string): void;',
  '}',
  '',
  'export class ConsoleLogger implements Logger {',
  '  info(message: string) {',
  '    console.log(`[shop] ${message}`);',
  '  }',
  '}',
];
const SHOP = {
  'src/money.ts': MONEY.join('\n') + '\n',
  'src/types.ts': TYPES.join('\n') + '\n',
  'src/cart.ts': CART.join('\n') + '\n',
  'src/receipt.ts': RECEIPT.join('\n') + '\n',
  'src/payments.ts': PAYMENTS.join('\n') + '\n',
  'src/log.ts': LOG.join('\n') + '\n',
};
const SHOP_HOVER = {
  formatMoney: 'function formatMoney(\n  cents: number,\n  currency?: string,\n): string\n\nFormats integer cents as a price.',
  CartItem: 'interface CartItem {\n  sku: string;\n  qty: number;\n  priceCents: number;\n}',
  padEnd: '(method) String.padEnd(\n  maxLength: number,\n  fillString?: string,\n): string\n\nPads the end of the string with fillString\n(default: space) until it is maxLength long.',
};
const shop = (open: string, cursor: Pos): Setup => ({ files: SHOP, open, cursor, init: server({ hover: SHOP_HOVER }) });
const hoverOpen = (vim: Vim) => vim.floats.some(f => f.id === 'lsp');
const rename = (lines: string[], from: RegExp, to: string) => lines.map(l => l.replace(from, to));

export const neovimBuiltins: Section = {
  id: 'neovim-builtins',
  title: 'Neovim Built-ins',
  band: 'code',
  lessons: [
    {
      id: 'commenting',
      title: 'Commenting',
      chips: ['gcc', 'gc'],
      keyCards: [
        { key: 'gcc', glyph: '//', label: 'toggle line comment' },
        { key: 'gc', glyph: '//…', label: 'comment operator', sub: 'motion, object or selection' },
      ],
      intro: (
        <>
          <p>
            <Code>gcc</Code> comments out the current line, or uncomments it if it's already a comment.{' '}
            <Code>gc</Code> is the operator: <Code>gcip</Code> toggles a paragraph, <Code>gc3j</Code> four lines,{' '}
            <Code>gc</Code> in visual mode the selection.
          </p>
          <p>
            Neovim picks the comment style from the file type (<Code>//</Code>, <Code>--</Code>, <Code>#</Code>) and
            keeps the indent lined up. Commenting was a plugin for years; since 0.10 it's built in.
          </p>
          <BeforeAfter
            lines={['export EDITOR=nvim', 'export PAGER=less', 'alias ll="ls -la"']}
            cursor={[1, 0]}
            keys="gcc"
            caption="gcc toggles the cursor line. Press it again to uncomment."
          />
          <BeforeAfter
            lines={['alias g=git', 'alias gs="git status"', '', 'export EDITOR=nvim']}
            cursor={[0, 0]}
            keys="gcip"
            caption="gc takes a motion or text object: ip is the paragraph."
          />
        </>
      ),
      practice: total => <p>Comment and uncomment code to match the marks in the editor. {total} rounds.</p>,
      aside: {
        title: 'gc is also a text object',
        body: (
          <p>
            <Code>gc</Code> after an operator means "this block of comments": <Code>dgc</Code> deletes it, and{' '}
            <Code>gcgc</Code> uncomments the whole block from any line inside.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        base: { name: 'checkout.ts' },
        rounds: [
          {
            prompt: 'Comment out the debug log.',
            setup: {
              text: ['export function checkout(order: Order) {', '  console.log(order);', '  return submit(order);', '}'],
              cursor: { line: 1, col: 2 },
            },
            goal: { text: ['export function checkout(order: Order) {', '  // console.log(order);', '  return submit(order);', '}'] },
            solution: 'gcc',
          },
          {
            prompt: 'Turn off the whole block of options.',
            setup: {
              name: 'options.lua',
              text: ['vim.opt.number = true', '', 'vim.opt.wrap = false', 'vim.opt.list = true', 'vim.opt.colorcolumn = "100"'],
              cursor: { line: 3, col: 0 },
            },
            goal: {
              text: ['vim.opt.number = true', '', '-- vim.opt.wrap = false', '-- vim.opt.list = true', '-- vim.opt.colorcolumn = "100"'],
            },
            solution: 'gcip',
          },
          {
            prompt: 'Bring the commented-out retry loop back.',
            setup: {
              text: [
                'async function send(req: Request) {',
                '  // for (let i = 0; i < 3; i++) {',
                '  //   if (await trySend(req)) return;',
                '  // }',
                '  await trySend(req);',
                '}',
              ],
              cursor: { line: 2, col: 4 },
            },
            goal: {
              text: [
                'async function send(req: Request) {',
                '  for (let i = 0; i < 3; i++) {',
                '    if (await trySend(req)) return;',
                '  }',
                '  await trySend(req);',
                '}',
              ],
            },
            solution: 'gcgc',
          },
          {
            prompt: 'Select the two print lines and comment them.',
            setup: {
              name: 'report.py',
              text: ['def report(rows):', '    total = sum(r.amount for r in rows)', '    print(rows)', '    print(total)', '    return total'],
              cursor: { line: 2, col: 4 },
            },
            goal: {
              text: ['def report(rows):', '    total = sum(r.amount for r in rows)', '    # print(rows)', '    # print(total)', '    return total'],
            },
            solution: 'Vjgc',
          },
          {
            prompt: 'Comment out the three export lines.',
            setup: {
              name: '.zshrc',
              text: ['export EDITOR=nvim', 'export GOPATH="$HOME/go"', 'export PATH="$GOPATH/bin:$PATH"', 'export NODE_ENV=development', 'alias vim=nvim'],
              cursor: { line: 1, col: 0 },
            },
            goal: {
              text: ['export EDITOR=nvim', '# export GOPATH="$HOME/go"', '# export PATH="$GOPATH/bin:$PATH"', '# export NODE_ENV=development', 'alias vim=nvim'],
            },
            solution: '3gcc',
          },
          {
            prompt: 'Uncomment the colorscheme line.',
            setup: {
              name: 'init.lua',
              text: ["local ok = pcall(require, 'tokyonight')", 'if ok then', "  -- vim.cmd.colorscheme('tokyonight')", 'end'],
              cursor: { line: 2, col: 9 },
            },
            goal: { text: ["local ok = pcall(require, 'tokyonight')", 'if ok then', "  vim.cmd.colorscheme('tokyonight')", 'end'] },
            solution: 'gcc',
          },
        ],
      },
    },
    {
      id: 'diagnostics',
      title: 'Diagnostics',
      chips: ['[d', ']d'],
      keyCards: [
        { key: '[d', glyph: '↑!', glyphColor: 'var(--red)', label: 'previous diagnostic' },
        { key: ']d', glyph: '↓!', glyphColor: 'var(--red)', label: 'next diagnostic' },
      ],
      intro: (
        <>
          <p>
            A language server reports errors and warnings as diagnostics: a letter in the sign column and the message
            at the end of the line. <Code>]d</Code> jumps to the next one, <Code>[d</Code> to the previous.
          </p>
          <p>
            Both wrap around the file and take a count. Fix, <Code>]d</Code>, fix: no scrolling to find the next red
            squiggle.
          </p>
        </>
      ),
      practice: total => (
        <p>
          Reach the <span className="hl-green">green box</span> on each diagnostic with <Code>]d</Code> and{' '}
          <Code>[d</Code>. {total} rounds.
        </p>
      ),
      aside: {
        title: 'First, last and the full message',
        body: (
          <p>
            <Code>[D</Code> and <Code>]D</Code> jump to the first and last diagnostic. <Code>C-w d</Code> opens the one
            under the cursor in a float, for messages too long to read at the end of the line.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        base: { name: 'profile.ts', text: PROFILE, plugins: ['lsp'], init: server({ diagnostics: PROFILE_DIAGS }) },
        rounds: [
          { setup: { cursor: { line: 0, col: 0 } }, goal: { cursor: P(0) }, solution: ']d' },
          { setup: { cursor: { line: 4, col: 2 } }, goal: { cursor: P(1) }, solution: ']d' },
          { setup: { cursor: { line: 10, col: 2 } }, goal: { cursor: P(4) }, solution: '[d' },
          { setup: { cursor: { line: 3, col: 0 } }, goal: { cursor: P(2) }, solution: '2]d' },
          { setup: { cursor: { line: 0, col: 0 } }, goal: { cursor: P(4) }, solution: '[d' },
          { setup: { cursor: { line: 8, col: 4 } }, goal: { cursor: P(1) }, solution: '3[d' },
        ],
      },
    },
    {
      id: 'definition-hover',
      title: 'Definitions & Hover',
      chips: ['gd', 'K'],
      keyCards: [
        { key: 'gd', glyph: '→def', label: 'go to definition' },
        { key: 'K', glyph: '?', label: 'hover docs' },
      ],
      intro: (
        <>
          <p>
            With a language server attached, <Code>gd</Code> jumps to where the name under the cursor is defined, even
            in another file. <Code>K</Code> shows its type and documentation in a float.
          </p>
          <p>
            <Code>C-o</Code> takes you back after a jump, so you can dive into a definition, read it and return to
            where you were.
          </p>
        </>
      ),
      practice: total => (
        <p>
          Jump to definitions with <Code>gd</Code> and open docs with <Code>K</Code>. Any key closes the float. {total}{' '}
          rounds.
        </p>
      ),
      aside: {
        title: 'Out of the box',
        body: (
          <p>
            Neovim 0.11 maps <Code>K</Code> for you and points <Code>C-]</Code> at the server's definition. Most configs
            add <Code>gd</Code> with <Code>vim.keymap.set('n', 'gd', vim.lsp.buf.definition)</Code>; without a server it
            finds the local declaration.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        base: { plugins: ['lsp'] },
        rounds: [
          {
            prompt: 'Jump to where formatMoney is defined.',
            setup: shop('src/cart.ts', at(CART, 6, 'formatMoney')),
            goal: { buffer: 'src/money.ts', cursor: at(MONEY, 1, 'formatMoney') },
            solution: 'gd',
          },
          {
            prompt: 'Read the docs for formatMoney.',
            setup: shop('src/receipt.ts', at(RECEIPT, 3, 'return')),
            goal: { check: hoverOpen },
            solution: 'ffK',
          },
          {
            prompt: 'Go to the TAX_RATE constant.',
            setup: shop('src/cart.ts', at(CART, 14, 'TAX_RATE')),
            goal: { buffer: 'src/cart.ts', cursor: at(CART, 3, 'TAX_RATE') },
            solution: 'gd',
          },
          {
            prompt: 'What does CartItem hold? Show its type.',
            setup: shop('src/cart.ts', at(CART, 5, 'export')),
            goal: { check: hoverOpen },
            solution: 'fCK',
          },
          {
            prompt: 'Jump to the CartItem interface.',
            setup: shop('src/cart.ts', at(CART, 9, 'CartItem')),
            goal: { buffer: 'src/types.ts', cursor: at(TYPES, 0, 'CartItem') },
            solution: 'gd',
          },
          {
            prompt: 'What does padEnd take? Show its docs.',
            setup: shop('src/receipt.ts', at(RECEIPT, 3, 'padEnd')),
            goal: { check: hoverOpen },
            solution: 'K',
          },
        ],
      },
    },
    {
      id: 'references',
      title: 'References',
      chips: ['grr', 'gri'],
      keyCards: [
        { key: 'grr', glyph: '←→', label: 'list references' },
        { key: 'gri', glyph: '⇣impl', label: 'implementations' },
      ],
      intro: (
        <>
          <p>
            <Code>grr</Code> asks the language server for every reference to the name under the cursor and opens them
            in the quickfix list. <Code>gri</Code> lists implementations: the classes behind an interface, the bodies
            behind a method.
          </p>
          <p>
            From the list, <Code>]q</Code> and <Code>[q</Code> walk through the hits and <Code>]Q</Code> jumps to the
            last. With a single implementation, <Code>gri</Code> jumps straight there.
          </p>
        </>
      ),
      practice: total => (
        <p>
          List the references or implementations, then walk the quickfix list to the one the prompt asks for. {total}{' '}
          rounds.
        </p>
      ),
      aside: {
        title: 'Better than grep',
        body: (
          <p>
            <Code>:vimgrep</Code> finds text; <Code>grr</Code> finds uses of a symbol, so a <Code>total</Code> in a
            comment or another scope doesn't show up. The list includes the definition itself.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        base: { plugins: ['lsp'] },
        rounds: [
          {
            prompt: 'List the references to formatMoney and jump to the last one.',
            setup: shop('src/cart.ts', at(CART, 6, 'formatMoney')),
            goal: { buffer: 'src/receipt.ts', cursor: at(RECEIPT, 3, 'formatMoney') },
            solution: 'grr]Q',
          },
          {
            prompt: 'From receipt.ts, list the references and jump to the second: the call in lineTotal.',
            setup: shop('src/receipt.ts', at(RECEIPT, 3, 'formatMoney')),
            goal: { buffer: 'src/cart.ts', cursor: at(CART, 6, 'formatMoney') },
            solution: 'grr]q',
          },
          {
            prompt: 'List the classes implementing PaymentProvider and go to the second.',
            setup: shop('src/payments.ts', at(PAYMENTS, 0, 'PaymentProvider')),
            goal: { buffer: 'src/payments.ts', cursor: at(PAYMENTS, 14, 'InvoiceProvider') },
            solution: 'gri]q',
          },
          {
            prompt: 'Logger has one implementation. Go to it.',
            setup: shop('src/log.ts', at(LOG, 0, 'Logger')),
            goal: { buffer: 'src/log.ts', cursor: at(LOG, 4, 'ConsoleLogger') },
            solution: 'gri',
          },
          {
            prompt: 'Find the charge method implementations and go to the last.',
            setup: shop('src/payments.ts', at(PAYMENTS, 1, 'charge')),
            goal: { buffer: 'src/payments.ts', cursor: at(PAYMENTS, 15, 'charge') },
            solution: 'gri]Q',
          },
        ],
      },
    },
    {
      id: 'lsp-rename',
      title: 'Rename',
      chips: ['grn'],
      keyCards: [{ key: 'grn', glyph: 'a→b', label: 'rename symbol', sub: 'across the project' }],
      intro: (
        <>
          <p>
            <Code>grn</Code> renames the symbol under the cursor everywhere it's used. Neovim prompts{' '}
            <Mono>New Name:</Mono> with the old name filled in; edit it and press <Code>enter</Code>.
          </p>
          <p>
            The prompt is a normal command line: type to append, <Code>C-u</Code> to clear it, <Code>bs</Code> to trim.
            Other files are changed in their buffers; <Code>:wa</Code> writes them all.
          </p>
        </>
      ),
      practice: total => <p>Rename each symbol to match the goal. {total} rounds.</p>,
      aside: {
        title: 'Why not :s?',
        body: (
          <p>
            A substitute changes text. Rename changes one symbol, so a <Code>user</Code> inside <Code>users</Code> or
            in an unrelated scope stays put. <Code>u</Code> undoes the whole rename in the current buffer.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        base: { plugins: ['lsp'] },
        rounds: [
          {
            prompt: 'Rename d to daysLate.',
            setup: {
              name: 'invoice.ts',
              text: ['function isOverdue(inv: Invoice, now: Date) {', '  const d = daysBetween(inv.dueDate, now);', '  return d > 30;', '}'],
              cursor: { line: 1, col: 8 },
            },
            goal: {
              text: ['function isOverdue(inv: Invoice, now: Date) {', '  const daysLate = daysBetween(inv.dueDate, now);', '  return daysLate > 30;', '}'],
            },
            solution: 'grn<C-u>daysLate<CR>',
          },
          {
            prompt: 'Rename user to userId by adding "Id".',
            setup: {
              name: 'routes.ts',
              text: [
                "router.get('/users/:id', async (req, res) => {",
                '  const user = req.params.id;',
                '  const profile = await loadProfile(user);',
                '  res.json(profile);',
                '});',
              ],
              cursor: { line: 1, col: 8 },
            },
            goal: {
              text: [
                "router.get('/users/:id', async (req, res) => {",
                '  const userId = req.params.id;',
                '  const profile = await loadProfile(userId);',
                '  res.json(profile);',
                '});',
              ],
            },
            solution: 'grnId<CR>',
          },
          {
            prompt: 'Shorten bufnr to buf.',
            setup: {
              name: 'lsp.lua',
              text: [
                'local function on_attach(client, bufnr)',
                '  local opts = { buffer = bufnr }',
                "  vim.keymap.set('n', 'gD', vim.lsp.buf.declaration, opts)",
                "  vim.bo[bufnr].omnifunc = 'v:lua.vim.lsp.omnifunc'",
                'end',
              ],
              cursor: { line: 0, col: 33 },
            },
            goal: {
              text: [
                'local function on_attach(client, buf)',
                '  local opts = { buffer = buf }',
                "  vim.keymap.set('n', 'gD', vim.lsp.buf.declaration, opts)",
                "  vim.bo[buf].omnifunc = 'v:lua.vim.lsp.omnifunc'",
                'end',
              ],
            },
            solution: 'grn<BS><BS><CR>',
          },
          {
            prompt: 'Rename tmp to rows.',
            setup: {
              name: 'load.py',
              text: [
                'def load(path):',
                '    tmp = []',
                '    with open(path) as f:',
                '        for line in f:',
                '            tmp.append(line.strip().split(","))',
                '    return tmp',
              ],
              cursor: { line: 5, col: 11 },
            },
            goal: {
              text: [
                'def load(path):',
                '    rows = []',
                '    with open(path) as f:',
                '        for line in f:',
                '            rows.append(line.strip().split(","))',
                '    return rows',
              ],
            },
            solution: 'grn<C-u>rows<CR>',
          },
          {
            prompt: 'Rename formatMoney to formatCents in every file, then write them all.',
            setup: shop('src/cart.ts', at(CART, 6, 'formatMoney')),
            goal: {
              files: {
                'src/cart.ts': rename(CART, /formatMoney/g, 'formatCents').join('\n'),
                'src/money.ts': rename(MONEY, /formatMoney/g, 'formatCents').join('\n'),
                'src/receipt.ts': rename(RECEIPT, /formatMoney/g, 'formatCents').join('\n'),
              },
            },
            solution: 'grn<C-u>formatCents<CR>:wa<CR>',
          },
        ],
      },
    },
    {
      id: 'code-actions',
      title: 'Code Actions',
      chips: ['gra'],
      keyCards: [{ key: 'gra', glyph: 'fix', label: 'code actions', sub: 'fixes for the cursor spot' }],
      intro: (
        <>
          <p>
            <Code>gra</Code> asks the language server what it can do at the cursor: add a missing import, remove an
            unused variable, convert a string. Pick one from the list with <Code>j</Code>/<Code>k</Code> and{' '}
            <Code>enter</Code>, or its number.
          </p>
          <p>
            Pair it with <Code>]d</Code>: jump to the problem, <Code>gra</Code>, pick the fix. The change is one undo
            step.
          </p>
        </>
      ),
      practice: total => <p>Jump to the problem if needed, then apply the code action the prompt asks for. {total} rounds.</p>,
      aside: {
        title: 'A nicer menu',
        body: (
          <p>
            Stock Neovim lists the actions with <Code>vim.ui.select</Code>, a numbered prompt. Pickers such as
            Telescope or fzf-lua can take over <Code>vim.ui.select</Code> to give you a fuzzy menu instead.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        base: { plugins: ['lsp'] },
        rounds: (() => {
          const dash = ['export function Dashboard() {', "  const [range, setRange] = useState('7d');", '  return <Chart range={range} onChange={setRange} />;', '}'];
          const greet = [
            'export function welcome(user: User) {',
            "  const greeting = 'Hello, ' + user.name + '!';",
            '  return greeting;',
            '}',
          ];
          const handler = ["app.get('/health', (req, res) => {", "  res.send('ok');", '});'];
          const load = ['async function loadUser(id: string) {', '  const res = fetch(`/api/users/${id}`);', '  return res.json();', '}'];
          const lua = ['local function setup()', '  local unused = 1', "  require('telescope').setup({})", 'end'];
          return [
            {
              prompt: 'useState is not imported. Jump to the error and add the import.',
              setup: {
                name: 'Dashboard.tsx',
                text: dash,
                cursor: { line: 0, col: 0 },
                init: server({
                  diagnostics: [diag('Dashboard.tsx', dash, 1, 'useState', "Cannot find name 'useState'.")],
                  actions: [
                    action('Add import from "react"', 1, v => v.insertLines(0, ["import { useState } from 'react';", ''])),
                    action("Add missing function declaration 'useState'", 1, v => v.insertLines(4, ['', 'function useState(arg0: string) {', '}'])),
                  ],
                }),
              },
              goal: { text: ["import { useState } from 'react';", '', ...dash] },
              solution: ']dgra<CR>',
            },
            {
              prompt: 'Convert the concatenation to a template string.',
              setup: {
                name: 'greet.ts',
                text: greet,
                cursor: at(greet, 1, "'Hello"),
                init: server({
                  actions: [
                    action('Convert to template string', 1, v => v.buf.setLine(1, '  const greeting = `Hello, ${user.name}!`;')),
                    action('Extract to constant in enclosing scope', 1, v =>
                      v.buf.splice(1, 1, ["  const newLocal = 'Hello, ';", "  const greeting = newLocal + user.name + '!';"]),
                    ),
                  ],
                }),
              },
              goal: { text: [greet[0], '  const greeting = `Hello, ${user.name}!`;', ...greet.slice(2)] },
              solution: 'gra<CR>',
            },
            {
              prompt: 'req is unused. Keep the parameter but prefix it with an underscore (the second action).',
              setup: {
                name: 'server.ts',
                text: handler,
                cursor: { line: 1, col: 2 },
                init: server({
                  diagnostics: [diag('server.ts', handler, 0, 'req', "'req' is declared but its value is never read.", 'hint')],
                  actions: [
                    action("Remove unused declaration for: 'req'", 0, v => v.buf.setLine(0, "app.get('/health', (res) => {")),
                    action("Prefix 'req' with an underscore", 0, v => v.buf.setLine(0, "app.get('/health', (_req, res) => {")),
                  ],
                }),
              },
              goal: { text: ["app.get('/health', (_req, res) => {", "  res.send('ok');", '});'] },
              solution: '[dgraj<CR>',
            },
            {
              prompt: 'res is a Promise. Let the server add the missing await.',
              setup: {
                name: 'users.ts',
                text: load,
                cursor: { line: 0, col: 0 },
                init: server({
                  diagnostics: [diag('users.ts', load, 2, 'json', "Property 'json' does not exist on type 'Promise<Response>'.")],
                  actions: [
                    action("Add 'await' to initializer for 'res'", 2, v => v.buf.setLine(1, '  const res = await fetch(`/api/users/${id}`);')),
                  ],
                }),
              },
              goal: { text: ['async function loadUser(id: string) {', '  const res = await fetch(`/api/users/${id}`);', '  return res.json();', '}'] },
              solution: ']dgra<CR>',
            },
            {
              prompt: 'Silence the unused-local warning for this line only.',
              setup: {
                name: 'telescope.lua',
                text: lua,
                cursor: { line: 1, col: 2 },
                init: server({
                  diagnostics: [diag('telescope.lua', lua, 1, 'unused', 'Unused local `unused`.', 'warn')],
                  actions: [
                    action('Disable diagnostics on this line (unused-local).', 1, v => v.insertLines(1, ['  ---@diagnostic disable-next-line: unused-local'])),
                    action('Disable diagnostics in this file (unused-local).', 1, v => v.insertLines(0, ['---@diagnostic disable: unused-local'])),
                  ],
                }),
              },
              goal: {
                text: ['local function setup()', '  ---@diagnostic disable-next-line: unused-local', '  local unused = 1', "  require('telescope').setup({})", 'end'],
              },
              solution: 'gra1',
            },
          ];
        })(),
      },
    },
    {
      id: 'blank-lines',
      title: 'Blank Lines',
      chips: ['[␣', ']␣'],
      keyCards: [
        { key: '[␣', glyph: '⏎↑', label: 'blank line above' },
        { key: ']␣', glyph: '⏎↓', label: 'blank line below' },
      ],
      intro: (
        <>
          <p>
            <Code>[&lt;Space&gt;</Code> adds a blank line above the cursor and <Code>]&lt;Space&gt;</Code> one below. A
            count adds that many.
          </p>
          <p>
            Unlike <Code>o</Code> and <Code>O</Code>, you stay in normal mode and the cursor stays on its line, so you
            can space out code without stopping what you're doing.
          </p>
          <BeforeAfter
            lines={['}', 'export function lerp() {']}
            cursor={[0, 0]}
            keys="]<Space>"
            caption="A blank line below; the cursor stays on the brace."
          />
          <BeforeAfter
            lines={['import os', 'def main():', '    pass']}
            cursor={[1, 4]}
            keys="2[<Space>"
            caption="With a count: two blank lines above."
          />
        </>
      ),
      practice: total => <p>Add the blank lines the goal shows. {total} rounds.</p>,
      aside: {
        title: 'Borrowed from unimpaired',
        body: (
          <p>
            These came from Tim Pope's vim-unimpaired, along with <Code>[b</Code>, <Code>[q</Code> and friends. Neovim
            0.11 built them in; in classic Vim you still need the plugin. To see how a real config wires the
            plugins in the next sections together, read kickstart.nvim's single <Code>init.lua</Code> next: it is
            written to be read top to bottom.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        base: { name: 'utils.ts' },
        rounds: [
          {
            prompt: 'Separate the two functions.',
            setup: {
              text: ['export function clamp(n: number, lo: number, hi: number) {', '  return Math.min(hi, Math.max(lo, n));', '}', 'export function lerp(a: number, b: number, t: number) {', '  return a + (b - a) * t;', '}'],
              cursor: { line: 2, col: 0 },
            },
            goal: {
              text: ['export function clamp(n: number, lo: number, hi: number) {', '  return Math.min(hi, Math.max(lo, n));', '}', '', 'export function lerp(a: number, b: number, t: number) {', '  return a + (b - a) * t;', '}'],
            },
            solution: '] ',
          },
          {
            prompt: 'Give the heading room above it.',
            setup: {
              name: 'README.md',
              text: ['Run `npm install` first.', '## Usage', '', 'Start the server with `npm run dev`.'],
              cursor: { line: 1, col: 3 },
            },
            goal: { text: ['Run `npm install` first.', '', '## Usage', '', 'Start the server with `npm run dev`.'] },
            solution: '[ ',
          },
          {
            prompt: 'PEP 8 wants two blank lines before a top-level def.',
            setup: {
              name: 'shapes.py',
              text: ['def area(r):', '    return 3.14159 * r * r', 'def circumference(r):', '    return 2 * 3.14159 * r'],
              cursor: { line: 2, col: 0 },
            },
            goal: { text: ['def area(r):', '    return 3.14159 * r * r', '', '', 'def circumference(r):', '    return 2 * 3.14159 * r'] },
            solution: '2[ ',
          },
          {
            prompt: 'Put a blank line on both sides of the rule.',
            setup: {
              name: 'CHANGELOG.md',
              text: ['- Fixed the login redirect.', '---', '## 1.4.0'],
              cursor: { line: 1, col: 0 },
            },
            goal: { text: ['- Fixed the login redirect.', '', '---', '', '## 1.4.0'] },
            solution: '[ ] ',
          },
          {
            prompt: 'Split the keymaps from the options.',
            setup: {
              name: 'init.lua',
              text: ['vim.opt.number = true', 'vim.opt.relativenumber = true', "vim.keymap.set('n', '<Esc>', '<cmd>nohlsearch<CR>')", "vim.keymap.set('n', '<leader>w', '<cmd>write<CR>')"],
              cursor: { line: 1, col: 8 },
            },
            goal: {
              text: ['vim.opt.number = true', 'vim.opt.relativenumber = true', '', "vim.keymap.set('n', '<Esc>', '<cmd>nohlsearch<CR>')", "vim.keymap.set('n', '<leader>w', '<cmd>write<CR>')"],
            },
            solution: '] ',
          },
        ],
      },
    },
  ],
};
