import { Code, Mono } from '../../components/Code';
import { BeforeAfter } from '../../components/diagrams';
import type { Section } from '../types';

export const globalCommands: Section = {
  id: 'global-commands',
  title: 'Global Commands',
  band: 'patterns',
  lessons: [
    {
      id: 'global-delete',
      title: 'Delete Matching Lines',
      chips: [':g', '/d'],
      keyCards: [
        { key: ':g', glyph: '∀/', label: 'every matching line' },
        { key: '/d', glyph: 'del', label: 'delete it' },
      ],
      intro: (
        <>
          <p>
            <Code>:g/pattern/cmd</Code> runs an Ex command on every line that matches the pattern.{' '}
            <Code>:g/console\.log/d</Code> deletes every line with a <Code>console.log</Code> in it.
          </p>
          <p>
            The pattern is a normal Vim search, so anything you can find with <Code>/</Code> you can act on. Delete is the
            most common command, and the one to learn first.
          </p>
          <BeforeAfter
            lines={['# Network', 'bind 127.0.0.1', '# Memory', 'maxmemory 256mb']}
            cursor={[1, 0]}
            keys=":g/^#/d<CR>"
            caption="Every line starting with # goes, wherever the cursor is."
          />
        </>
      ),
      practice: total => (
        <p>
          Delete the matching lines with one <Code>:g</Code> command. {total} rounds.
        </p>
      ),
      aside: {
        title: 'Check before you delete',
        body: (
          <p>
            <Code>:g/pattern/</Code> with no command prints the matching lines, so you can check what a pattern hits
            before deleting. An empty pattern, <Code>:g//d</Code>, reuses your last search.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        base: {},
        rounds: [
          {
            prompt: 'Delete every console.log line.',
            setup: {
              name: 'cart.ts',
              text: [
                'export function addItem(cart: Cart, item: Item) {',
                "  console.log('adding', item);",
                '  const existing = cart.items.find(i => i.sku === item.sku);',
                '  if (existing) existing.qty += item.qty;',
                '  else cart.items.push(item);',
                '  console.log(cart.items.length);',
                '  return cart;',
                '}',
              ],
              cursor: { line: 0, col: 0 },
            },
            goal: {
              text: [
                'export function addItem(cart: Cart, item: Item) {',
                '  const existing = cart.items.find(i => i.sku === item.sku);',
                '  if (existing) existing.qty += item.qty;',
                '  else cart.items.push(item);',
                '  return cart;',
                '}',
              ],
            },
            solution: ':g/console/d<CR>',
          },
          {
            prompt: 'Delete the lines that start with "#".',
            setup: {
              name: 'redis.conf',
              text: [
                '# Network',
                'bind 127.0.0.1',
                'port 6379',
                '# Memory: evict least recently used keys',
                'maxmemory 256mb',
                'maxmemory-policy allkeys-lru',
                '# Persistence',
                'appendonly yes',
              ],
              cursor: { line: 4, col: 0 },
            },
            goal: { text: ['bind 127.0.0.1', 'port 6379', 'maxmemory 256mb', 'maxmemory-policy allkeys-lru', 'appendonly yes'] },
            solution: ':g/^#/d<CR>',
          },
          {
            prompt: 'Delete the empty lines.',
            setup: {
              name: 'signups.csv',
              text: ['date,plan,count', '', '2026-09-01,free,118', '2026-09-01,pro,14', '', '', '2026-09-02,free,97', '2026-09-02,pro,21'],
              cursor: { line: 2, col: 11 },
            },
            goal: { text: ['date,plan,count', '2026-09-01,free,118', '2026-09-01,pro,14', '2026-09-02,free,97', '2026-09-02,pro,21'] },
            solution: ':g/^$/d<CR>',
          },
          {
            prompt: 'Delete every DEBUG line.',
            setup: {
              name: 'api.log',
              text: [
                '10:02:11 INFO  GET /orders 200 41ms',
                '10:02:11 DEBUG cache hit orders:page=1',
                '10:02:12 DEBUG pool size=10 idle=7',
                '10:02:14 WARN  GET /reports 200 2210ms',
                '10:02:15 DEBUG cache miss reports:q3',
                '10:02:19 ERROR POST /checkout 500 card_declined',
              ],
              cursor: { line: 0, col: 0 },
            },
            goal: {
              text: [
                '10:02:11 INFO  GET /orders 200 41ms',
                '10:02:14 WARN  GET /reports 200 2210ms',
                '10:02:19 ERROR POST /checkout 500 card_declined',
              ],
            },
            solution: ':g/DEBUG/d<CR>',
          },
          {
            prompt: 'Delete the lines that start with "--", indented or not.',
            setup: {
              name: 'keymaps.lua',
              text: [
                '-- window navigation',
                "vim.keymap.set('n', '<C-h>', '<C-w>h')",
                "vim.keymap.set('n', '<C-l>', '<C-w>l')",
                'if vim.g.neovide then',
                '  -- neovide wants a bigger font',
                "  vim.o.guifont = 'JetBrains Mono:h14'",
                'end',
              ],
              cursor: { line: 5, col: 2 },
            },
            goal: {
              text: [
                "vim.keymap.set('n', '<C-h>', '<C-w>h')",
                "vim.keymap.set('n', '<C-l>', '<C-w>l')",
                'if vim.g.neovide then',
                "  vim.o.guifont = 'JetBrains Mono:h14'",
                'end',
              ],
            },
            solution: ':g/^\\s*--/d<CR>',
          },
        ],
      },
    },
    {
      id: 'global-keep',
      title: 'Keep Matching Lines',
      chips: [':v', ':g!'],
      keyCards: [
        { key: ':v', glyph: '∀≠', label: 'every non-matching line' },
        { key: ':g!', glyph: '∀≠', label: 'same thing' },
      ],
      intro: (
        <>
          <p>
            <Code>:v/pattern/cmd</Code> is the inverse of <Code>:g</Code>: it runs the command on every line that does{' '}
            <em>not</em> match. <Code>:g!</Code> is the same command.
          </p>
          <p>
            <Code>:v/ERROR/d</Code> reads as "keep only the errors". It's grep, inside the buffer.
          </p>
          <BeforeAfter
            lines={['INFO  GET /orders 200', 'ERROR GET /invoices 500', 'WARN  GET /reports 200', 'ERROR POST /checkout 500']}
            cursor={[0, 0]}
            keys=":v/ERROR/d<CR>"
          />
        </>
      ),
      practice: total => (
        <p>
          Keep only the lines you want with <Code>:v</Code>. {total} rounds.
        </p>
      ),
      aside: {
        title: 'Protect the header',
        body: (
          <p>
            Both commands take a range. <Code>:2,$v/pat/d</Code> leaves line 1 alone, which keeps a CSV header in place.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        base: {},
        rounds: [
          {
            prompt: 'Keep only the ERROR lines.',
            setup: {
              name: 'api.log',
              text: [
                '10:02:11 INFO  GET /orders 200 41ms',
                '10:02:13 ERROR GET /invoices/88 500 null customer',
                '10:02:14 WARN  GET /reports 200 2210ms',
                '10:02:19 ERROR POST /checkout 500 card_declined',
                '10:02:20 INFO  GET /health 200 1ms',
              ],
              cursor: { line: 0, col: 0 },
            },
            goal: { text: ['10:02:13 ERROR GET /invoices/88 500 null customer', '10:02:19 ERROR POST /checkout 500 card_declined'] },
            solution: ':v/ERROR/d<CR>',
          },
          {
            prompt: 'Keep line 1 and the lines ending in DE; delete the rest.',
            setup: {
              name: 'customers.csv',
              text: ['id,name,country', '101,Ada Lovelace,GB', '102,Jonas Weber,DE', '103,Lea Fischer,DE', '104,Marta Silva,PT'],
              cursor: { line: 3, col: 4 },
            },
            goal: { text: ['id,name,country', '102,Jonas Weber,DE', '103,Lea Fischer,DE'] },
            solution: ':2,$v/DE/d<CR>',
          },
          {
            prompt: 'Keep only the lines that start with "export".',
            setup: {
              name: 'money.ts',
              text: [
                'const CENTS = 100;',
                'export const toCents = (n: number) => n * CENTS;',
                'const pad = (n: number) => String(n).padStart(2, "0");',
                'export const fmt = (c: number) => `${c / CENTS}`;',
                '// TODO: currency codes',
                'export const add = (a: number, b: number) => a + b;',
              ],
              cursor: { line: 2, col: 6 },
            },
            goal: {
              text: [
                'export const toCents = (n: number) => n * CENTS;',
                'export const fmt = (c: number) => `${c / CENTS}`;',
                'export const add = (a: number, b: number) => a + b;',
              ],
            },
            solution: ':v/^export/d<CR>',
          },
          {
            prompt: 'Delete every line that is empty or only spaces and tabs.',
            setup: {
              name: 'notes.md',
              text: ['# Standup', '   ', '- shipped the export fix', '', '- pairing on auth after lunch', '\t', '- blocked on staging creds'],
              cursor: { line: 2, col: 2 },
            },
            goal: { text: ['# Standup', '- shipped the export fix', '- pairing on auth after lunch', '- blocked on staging creds'] },
            solution: ':v/\\S/d<CR>',
          },
        ],
      },
    },
    {
      id: 'global-normal',
      title: 'Global Normal',
      chips: [':g', 'norm'],
      keyCards: [
        { key: ':g', glyph: '∀/', label: 'every matching line' },
        { key: 'norm', glyph: '↻', label: 'run normal keys' },
      ],
      intro: (
        <>
          <p>
            <Code>:g</Code> can run any Ex command, and <Code>:normal</Code> is one. Together they apply a normal-mode
            edit to every matching line: <Code>:g/^let/norm A;</Code>.
          </p>
          <p>
            Each run starts with the cursor at column 0 of the matching line, so begin with a motion if the edit isn't at
            the start. The keys can move off the line, too.
          </p>
          <BeforeAfter
            lines={['let a = 1', 'const b = 2', 'let c = 3']}
            cursor={[1, 0]}
            keys=":g/^let/norm A;<CR>"
          />
        </>
      ),
      practice: total => (
        <p>
          Combine <Code>:g</Code> with <Code>norm</Code>. {total} rounds.
        </p>
      ),
      aside: {
        title: 'Mark, then act',
        body: (
          <p>
            <Code>:g</Code> marks every matching line first and only then runs the command, so deleting or adding lines
            along the way doesn't make it lose its place.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        base: {},
        rounds: [
          {
            prompt: 'Comment out every console.log line: put "// " before its text.',
            setup: {
              name: 'sync.ts',
              text: [
                'export async function sync(ids: string[]) {',
                "  console.log('syncing', ids.length);",
                '  const rows = await db.users.findMany(ids);',
                '  console.log(rows);',
                '  return push(rows);',
                '}',
              ],
              cursor: { line: 0, col: 0 },
            },
            goal: {
              text: [
                'export async function sync(ids: string[]) {',
                "  // console.log('syncing', ids.length);",
                '  const rows = await db.users.findMany(ids);',
                '  // console.log(rows);',
                '  return push(rows);',
                '}',
              ],
            },
            solution: ':g/console/norm I// <CR>',
          },
          {
            prompt: 'Change "[ ]" to "[x]" on every line with @lin.',
            setup: {
              name: 'sprint.md',
              text: [
                '- [ ] migrate billing to Stripe @lin',
                '- [ ] flaky login test @priya',
                '- [ ] drop the legacy export @lin',
                '- [ ] update onboarding copy @sam',
              ],
              cursor: { line: 1, col: 6 },
            },
            goal: {
              text: [
                '- [x] migrate billing to Stripe @lin',
                '- [ ] flaky login test @priya',
                '- [x] drop the legacy export @lin',
                '- [ ] update onboarding copy @sam',
              ],
            },
            solution: ':g/@lin/norm f[lrx<CR>',
          },
          {
            prompt: 'Add a "#" to the start of every line that starts with "## ".',
            setup: {
              name: 'guide.md',
              text: ['# Setup', '## Install', 'Run npm install.', '## Configure', 'Copy .env.example to .env.', '## Run', 'npm run dev'],
              cursor: { line: 4, col: 0 },
            },
            goal: {
              text: ['# Setup', '### Install', 'Run npm install.', '### Configure', 'Copy .env.example to .env.', '### Run', 'npm run dev'],
            },
            solution: ':g/^## /norm I#<CR>',
          },
          {
            prompt: 'Delete the line under each ERROR line.',
            setup: {
              name: 'worker.log',
              text: [
                '09:12:01 INFO  job 311 started',
                '09:12:03 ERROR job 311: connection reset',
                '    at Socket.onEnd (net.js:412)',
                '09:12:09 INFO  job 312 started',
                '09:12:10 ERROR job 312: timeout after 5000ms',
                '    at Timeout._onTimeout (queue.js:88)',
              ],
              cursor: { line: 3, col: 9 },
            },
            goal: {
              text: [
                '09:12:01 INFO  job 311 started',
                '09:12:03 ERROR job 311: connection reset',
                '09:12:09 INFO  job 312 started',
                '09:12:10 ERROR job 312: timeout after 5000ms',
              ],
            },
            solution: ':g/ERROR/norm jdd<CR>',
          },
        ],
      },
    },
    {
      id: 'global-move',
      title: 'Reverse Lines',
      chips: [':g/^/m0', 'm$', 't$'],
      keyCards: [
        { key: ':g/^/m0', glyph: '⇅', label: 'reverse the file' },
        { key: 'm$', glyph: '→$', label: 'move matches to end' },
        { key: 't$', glyph: '⧉$', label: 'copy matches to end' },
      ],
      intro: (
        <>
          <p>
            <Code>^</Code> matches every line, and <Code>:m0</Code> moves a line to the top. Run one on each line in order
            and the file comes out reversed: <Code>:g/^/m0</Code>.
          </p>
          <p>
            The same idea gathers lines. <Code>:g/TODO/m$</Code> moves every TODO to the end of the file, in order, and{' '}
            <Code>:g/TODO/t$</Code> copies them there instead.
          </p>
          <BeforeAfter
            lines={['a1f3c9e init project', '4be02d1 add login form', 'e02b5f4 release v1.2.0']}
            cursor={[0, 0]}
            keys=":g/^/m0<CR>"
            caption="Each line in turn moves to the top, so the last one ends up first."
          />
        </>
      ),
      practice: total => (
        <p>
          Reverse or gather lines with <Code>:g</Code> and <Code>:m</Code> or <Code>:t</Code>. {total} rounds.
        </p>
      ),
      aside: {
        title: 'Reversing part of a file',
        body: (
          <p>
            Give <Code>:g</Code> a range and move to the line above it: <Code>:5,9g/^/m4</Code> reverses lines 5 to 9.
            On Unix, <Code>:5,9!tac</Code> does the same.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        base: {},
        rounds: [
          {
            prompt: 'Reverse the order of all the lines.',
            setup: {
              name: 'commits.txt',
              text: ['a1f3c9e init project', '4be02d1 add login form', '9c71aa0 fix session expiry', 'e02b5f4 release v1.2.0'],
              cursor: { line: 2, col: 8 },
            },
            goal: { text: ['e02b5f4 release v1.2.0', '9c71aa0 fix session expiry', '4be02d1 add login form', 'a1f3c9e init project'] },
            solution: ':g/^/m0<CR>',
          },
          {
            prompt: 'Reverse lines 2 to 5. Line 1 stays on top.',
            setup: {
              name: 'uptime.csv',
              text: ['day,uptime', 'mon,99.98', 'tue,99.91', 'wed,100.00', 'thu,99.72'],
              cursor: { line: 0, col: 0 },
            },
            goal: { text: ['day,uptime', 'thu,99.72', 'wed,100.00', 'tue,99.91', 'mon,99.98'] },
            solution: ':2,$g/^/m1<CR>',
          },
          {
            prompt: 'Move every TODO line to the end of the file.',
            setup: {
              name: 'NOTES.md',
              text: [
                '# Release 2.4',
                'TODO: bump the API version',
                'Export now streams large files.',
                'TODO: update the changelog',
                'Login rate limit raised to 10/min.',
              ],
              cursor: { line: 2, col: 0 },
            },
            goal: {
              text: [
                '# Release 2.4',
                'Export now streams large files.',
                'Login rate limit raised to 10/min.',
                'TODO: bump the API version',
                'TODO: update the changelog',
              ],
            },
            solution: ':g/TODO/m$<CR>',
          },
          {
            prompt: 'Copy every line that starts with "export" to the end of the file.',
            setup: {
              name: 'index.ts',
              text: [
                "export { Button } from './Button';",
                "import './theme.css';",
                "export { Modal } from './Modal';",
                "export { Toast } from './Toast';",
                '',
                '// public API:',
              ],
              cursor: { line: 5, col: 3 },
            },
            goal: {
              text: [
                "export { Button } from './Button';",
                "import './theme.css';",
                "export { Modal } from './Modal';",
                "export { Toast } from './Toast';",
                '',
                '// public API:',
                "export { Button } from './Button';",
                "export { Modal } from './Modal';",
                "export { Toast } from './Toast';",
              ],
            },
            solution: ':g/^export/t$<CR>',
          },
        ],
      },
    },
    {
      id: 'ex-sort',
      title: 'Sorting',
      chips: [':sort', 'n', '!', 'i'],
      keyCards: [
        { key: ':sort', glyph: 'a→z', label: 'sort lines' },
        { key: 'n', glyph: '1→9', label: 'by number' },
        { key: '!', glyph: 'z→a', label: 'reverse' },
        { key: 'i', glyph: 'Aa', label: 'ignore case' },
      ],
      intro: (
        <>
          <p>
            <Code>:sort</Code> sorts the whole file, or a range: <Code>:2,$sort</Code>, or a selection with{' '}
            <Code>{"'<,'>"}</Code>. Flags change the order: <Code>n</Code> sorts by the first number on each line,{' '}
            <Code>i</Code> ignores case, and <Code>:sort!</Code> reverses.
          </p>
          <p>
            Sorted imports, keys and lists are easier to scan and produce smaller diffs. Without <Code>n</Code>, numbers
            sort as text, so <Mono>10</Mono> comes before <Mono>9</Mono>:
          </p>
          <BeforeAfter lines={['9 src', '10 dist', '1 README.md']} cursor={[0, 0]} keys=":sort n<CR>" />
        </>
      ),
      practice: total => (
        <p>
          Sort each block with <Code>:sort</Code> and the right flags. {total} rounds.
        </p>
      ),
      aside: {
        title: 'Sort by a column',
        body: (
          <p>
            <Code>:sort /pattern/</Code> sorts by what comes after the match. <Code>:sort /[^,]*,/</Code> sorts CSV rows
            by their second column.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        base: {},
        rounds: [
          {
            prompt: 'Sort all the lines.',
            setup: {
              name: 'requirements.txt',
              text: ['requests==2.32.3', 'fastapi==0.115.0', 'uvicorn==0.30.6', 'pydantic==2.9.2', 'httpx==0.27.2'],
              cursor: { line: 3, col: 0 },
            },
            goal: { text: ['fastapi==0.115.0', 'httpx==0.27.2', 'pydantic==2.9.2', 'requests==2.32.3', 'uvicorn==0.30.6'] },
            solution: ':sort<CR>',
          },
          {
            prompt: 'Sort by the number at the start of each line, smallest first.',
            setup: {
              name: 'du.txt',
              text: ['412 node_modules', '8 src', '96 dist', '1 README.md', '24 public'],
              cursor: { line: 2, col: 0 },
            },
            goal: { text: ['1 README.md', '8 src', '24 public', '96 dist', '412 node_modules'] },
            solution: ':sort n<CR>',
          },
          {
            prompt: 'Sort by the number at the start of each line, highest first.',
            setup: {
              name: 'scores.txt',
              text: ['1840 ada', '2210 grace', '975 linus', '3120 margaret'],
              cursor: { line: 1, col: 5 },
            },
            goal: { text: ['3120 margaret', '2210 grace', '1840 ada', '975 linus'] },
            solution: ':sort! n<CR>',
          },
          {
            prompt: 'Sort the lines inside the { } block.',
            setup: {
              name: 'card.css',
              text: ['.card {', '  padding: 16px;', '  border: 1px solid #ddd;', '  display: flex;', '  color: #222;', '}'],
              cursor: { line: 2, col: 2 },
            },
            goal: { text: ['.card {', '  border: 1px solid #ddd;', '  color: #222;', '  display: flex;', '  padding: 16px;', '}'] },
            solution: 'vi{:sort<CR>',
          },
          {
            prompt: 'Sort the rows under the header, ignoring case.',
            setup: {
              name: 'team.csv',
              text: ['name,role', 'priya,backend', 'Ada,design', 'sam,frontend', 'Grace,infra'],
              cursor: { line: 2, col: 0 },
            },
            goal: { text: ['name,role', 'Ada,design', 'Grace,infra', 'priya,backend', 'sam,frontend'] },
            solution: ':2,$sort i<CR>',
          },
        ],
      },
    },
    {
      id: 'sort-unique',
      title: 'Unique Sort',
      chips: [':sort u'],
      keyCards: [{ key: ':sort u', glyph: 'a→z·1', label: 'sort, drop duplicates' }],
      intro: (
        <>
          <p>
            The <Code>u</Code> flag keeps only the first of each run of identical lines after sorting.{' '}
            <Code>:sort u</Code> turns a messy list into a clean, deduplicated one.
          </p>
          <p>
            It combines with the other flags: <Code>:sort ui</Code> treats <Code>Vim</Code> and <Code>vim</Code> as
            duplicates, and <Code>:sort nu</Code> compares lines by their number.
          </p>
          <BeforeAfter lines={['sam', 'ada', 'priya', 'ada', 'sam']} cursor={[0, 0]} keys=":sort u<CR>" />
        </>
      ),
      practice: total => (
        <p>
          Sort and remove the duplicates in one command. {total} rounds.
        </p>
      ),
      aside: {
        title: 'Dedupe without sorting',
        body: (
          <p>
            To drop duplicates but keep the original order, there's a classic regex: <Code>:g/^\(.*\)\n\1$/d</Code>{' '}
            removes a line when the next one is identical. For scattered duplicates, sorting is the practical way.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        base: {},
        rounds: [
          {
            prompt: 'Sort the lines and drop the duplicates.',
            setup: {
              name: 'emails.txt',
              text: ['sam@example.com', 'ada@example.com', 'priya@example.com', 'ada@example.com', 'sam@example.com'],
              cursor: { line: 2, col: 0 },
            },
            goal: { text: ['ada@example.com', 'priya@example.com', 'sam@example.com'] },
            solution: ':sort u<CR>',
          },
          {
            prompt: 'Sort the numbers by value and drop the duplicates.',
            setup: {
              name: 'ports.txt',
              text: ['8080', '443', '5432', '80', '443', '8080'],
              cursor: { line: 0, col: 0 },
            },
            goal: { text: ['80', '443', '5432', '8080'] },
            solution: ':sort nu<CR>',
          },
          {
            prompt: 'Sort and drop the duplicates, treating Lua and lua as the same.',
            setup: {
              name: 'tags.txt',
              text: ['neovim', 'lua', 'Neovim', 'terminal', 'Lua', 'dotfiles'],
              cursor: { line: 3, col: 0 },
            },
            goal: { text: ['dotfiles', 'lua', 'neovim', 'terminal'] },
            solution: ':sort ui<CR>',
          },
          {
            prompt: 'Sort line 5 to the end and drop the duplicates. The lines above stay.',
            setup: {
              name: '.gitignore',
              text: ['# deps', 'node_modules/', '', '# build', 'dist/', 'coverage/', 'dist/', '.cache/', 'coverage/'],
              cursor: { line: 4, col: 0 },
            },
            goal: { text: ['# deps', 'node_modules/', '', '# build', '.cache/', 'coverage/', 'dist/'] },
            solution: ':5,$sort u<CR>',
          },
        ],
      },
    },
    {
      id: 'shell-filters',
      title: 'Shell Filters',
      chips: ['!', ':%!'],
      keyCards: [
        { key: '!{motion}', glyph: '|sh', label: 'filter lines' },
        { key: ':%!', glyph: '%|sh', label: 'filter the file' },
      ],
      intro: (
        <>
          <p>
            <Code>:{'{range}'}!cmd</Code> sends those lines through a shell command and replaces them with its output.{' '}
            <Code>:%!jq .</Code> pretty-prints a JSON file. The operator <Code>!</Code> does the same for a motion:{' '}
            <Code>!ip</Code> fills in the range and waits for the command.
          </p>
          <p>
            Every Unix tool becomes an editing command: <Code>sort</Code>, <Code>column -t</Code>, <Code>awk</Code>,{' '}
            <Code>jq</Code>. The tutor emulates a handful of them.
          </p>
        </>
      ),
      practice: total => (
        <p>
          Filter the text through a command. {total} rounds.
        </p>
      ),
      aside: {
        title: 'Read, not filter',
        body: (
          <p>
            <Code>:r !cmd</Code> inserts a command's output below the cursor without replacing anything, and{' '}
            <Code>:!cmd</Code> with no range just shows it.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        base: {},
        rounds: [
          {
            prompt: 'Pretty-print the JSON with jq.',
            setup: {
              name: 'response.json',
              text: [
                '{"id":42,"status":"paid",',
                '"items":[{"sku":"A-100",',
                '"qty":2}]}',
              ],
              cursor: { line: 1, col: 0 },
            },
            goal: {
              text: [
                '{',
                '  "id": 42,',
                '  "status": "paid",',
                '  "items": [',
                '    {',
                '      "sku": "A-100",',
                '      "qty": 2',
                '    }',
                '  ]',
                '}',
              ],
            },
            solution: ':%!jq .<CR>',
          },
          {
            prompt: 'Sort this paragraph through the shell with !ip.',
            setup: {
              name: 'Brewfile',
              text: ['brew "ripgrep"', 'brew "fd"', 'brew "neovim"', 'brew "fzf"', '', '# apps', 'cask "ghostty"'],
              cursor: { line: 1, col: 0 },
            },
            goal: { text: ['brew "fd"', 'brew "fzf"', 'brew "neovim"', 'brew "ripgrep"', '', '# apps', 'cask "ghostty"'] },
            solution: '!ipsort<CR>',
          },
          {
            prompt: 'Line the columns up with column -t.',
            setup: {
              name: 'hosts.txt',
              text: ['web-1 10.0.1.12 running', 'db-primary 10.0.2.5 running', 'cache 10.0.3.40 stopped'],
              cursor: { line: 1, col: 0 },
            },
            goal: {
              text: ['web-1       10.0.1.12  running', 'db-primary  10.0.2.5   running', 'cache       10.0.3.40  stopped'],
            },
            solution: ':%!column -t<CR>',
          },
          {
            prompt: "Keep only the third field of each line, like /orders. awk '{print $3}' prints it.",
            setup: {
              name: 'access.log',
              text: ['10:02:11 GET /orders 200', '10:02:13 GET /invoices/88 500', '10:02:19 POST /checkout 500'],
              cursor: { line: 2, col: 9 },
            },
            goal: { text: ['/orders', '/invoices/88', '/checkout'] },
            solution: ":%!awk '{print $3}'<CR>",
          },
        ],
      },
    },
  ],
};
