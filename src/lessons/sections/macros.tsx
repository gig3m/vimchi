import { Code } from '../../components/Code';
import { BeforeAfter } from '../../components/diagrams';
import type { Section } from '../types';

export const macros: Section = {
  id: 'macros',
  title: 'Macros',
  band: 'repeat',
  lessons: [
    {
      id: 'recording-macro',
      title: 'Recording a Macro',
      chips: ['q', '@'],
      keyCards: [
        { key: 'q', glyph: '●', label: 'record / stop', sub: 'qa records into a' },
        { key: '@', glyph: '▶', label: 'play', sub: '@a plays a' },
      ],
      intro: (
        <>
          <p>
            <Code>qa</Code> starts recording every key you press into register <Code>a</Code>. Do the edit once, then{' '}
            <Code>q</Code> stops. <Code>@a</Code> plays those keys back.
          </p>
          <p>
            Finish the recording on the next line, usually with <Code>j</Code>, so each replay picks up where the last
            one left off.
          </p>
          <BeforeAfter
            lines={['oat milk', 'lemons', 'sourdough']}
            cursor={[0, 0]}
            keys="qaI- <Esc>jq@a@a"
            caption="Record the edit and a j once, then each @a does the next line."
          />
        </>
      ),
      practice: total => (
        <p>
          Record the edit on the first line, then replay it on the rest with <Code>@a</Code>. {total} rounds.
        </p>
      ),
      aside: {
        title: 'Watch the mode line',
        body: (
          <p>
            While recording, the bottom line shows <Code>recording @a</Code>. If you see it when you didn't mean to,
            press <Code>q</Code> to stop.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        base: { name: 'groceries.md' },
        rounds: [
          {
            prompt: 'Put "- " in front of each item line.',
            setup: {
              text: ['# Saturday', '', 'oat milk', 'coffee beans', 'lemons', 'sourdough'],
              cursor: { line: 2, col: 4 },
            },
            goal: { text: ['# Saturday', '', '- oat milk', '- coffee beans', '- lemons', '- sourdough'] },
            solution: 'qaI- <Esc>jq@a@a@a',
          },
          {
            prompt: 'Add ";" to the end of every line.',
            setup: {
              name: 'setup.ts',
              text: [
                "import express from 'express'",
                "import cors from 'cors'",
                'const app = express()',
                'app.use(cors())',
                'app.listen(3000)',
              ],
              cursor: { line: 0, col: 7 },
            },
            goal: {
              text: [
                "import express from 'express';",
                "import cors from 'cors';",
                'const app = express();',
                'app.use(cors());',
                'app.listen(3000);',
              ],
            },
            solution: 'qaA;<Esc>jq@a@a@a@a',
          },
          {
            prompt: 'Put double quotes around the word before each ":".',
            setup: {
              name: 'theme.json',
              text: ['{', '  background: "#1e1e2e",', '  foreground: "#cdd6f4",', '  accent: "#f5c2e7"', '}'],
              cursor: { line: 1, col: 6 },
            },
            goal: { text: ['{', '  "background": "#1e1e2e",', '  "foreground": "#cdd6f4",', '  "accent": "#f5c2e7"', '}'] },
            solution: 'qaI"<Esc>f:i"<Esc>jq@a@a',
          },
          {
            prompt: 'Change each "print" to "debug".',
            setup: {
              name: 'sync.py',
              text: [
                'from logging import debug',
                'def sync(rows):',
                "    print('fetching accounts')",
                "    print('found %d', len(rows))",
                "    print('writing cache')",
                '    return rows',
              ],
              cursor: { line: 1, col: 4 },
            },
            goal: {
              text: [
                'from logging import debug',
                'def sync(rows):',
                "    debug('fetching accounts')",
                "    debug('found %d', len(rows))",
                "    debug('writing cache')",
                '    return rows',
              ],
            },
            solution: 'jqa^cwdebug<Esc>jq@a@a',
          },
        ],
      },
    },
    {
      id: 'replaying-macros',
      title: 'Replaying',
      chips: ['@@', '5@a'],
      keyCards: [
        { key: '@@', glyph: '▶▶', label: 'replay last macro' },
        { key: '5@a', glyph: '5×▶', label: 'play a five times' },
      ],
      intro: (
        <>
          <p>
            <Code>@@</Code> replays whichever macro ran last, so after one <Code>@a</Code> you can keep going with a
            key that's easier to hit. A count plays it that many times: <Code>5@a</Code>.
          </p>
          <p>
            Record once, check the result, then fire off the rest with a count.
          </p>
          <BeforeAfter
            lines={['BEGIN;', 'INSERT INTO seats VALUES (1);', 'COMMIT;']}
            cursor={[1, 0]}
            keys="qayyp<C-a>q3@a"
            caption="Record one copy-and-bump, then 3@a makes three more."
          />
        </>
      ),
      practice: total => (
        <p>
          Use a count or <Code>@@</Code> instead of pressing <Code>@a</Code> over and over. {total} rounds.
        </p>
      ),
      aside: {
        title: 'Overshooting is fine',
        body: (
          <p>
            If a motion fails, like <Code>j</Code> on the last line, the macro stops. So <Code>99@a</Code> means "until
            the end of the file".
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        base: { name: 'seed.sql' },
        rounds: [
          {
            prompt: 'Add "," to the end of every quoted line except the last.',
            setup: {
              name: 'regions.ts',
              text: ['const regions = [', "  'us-east-1'", "  'us-west-2'", "  'eu-west-1'", "  'eu-central-1'", "  'ap-south-1'", "  'ap-northeast-1'", '];'],
              cursor: { line: 0, col: 6 },
            },
            goal: {
              text: ['const regions = [', "  'us-east-1',", "  'us-west-2',", "  'eu-west-1',", "  'eu-central-1',", "  'ap-south-1',", "  'ap-northeast-1'", '];'],
            },
            solution: 'jqaA,<Esc>jq4@a',
          },
          {
            prompt: 'Register a puts "-- " at the start of a line and moves down. Run it on four lines, from the cursor.',
            setup: {
              name: 'init.lua',
              text: [
                '-- prose',
                "vim.opt.spell = true",
                "vim.opt.spelllang = { 'en_gb' }",
                "vim.opt.conceallevel = 2",
                "vim.opt.textwidth = 80",
                "vim.opt.number = true",
              ],
              registers: { a: 'I-- \x1bj' },
              cursor: { line: 1, col: 8 },
            },
            goal: {
              text: [
                '-- prose',
                '-- vim.opt.spell = true',
                "-- vim.opt.spelllang = { 'en_gb' }",
                '-- vim.opt.conceallevel = 2',
                '-- vim.opt.textwidth = 80',
                'vim.opt.number = true',
              ],
            },
            solution: '4@a',
          },
          {
            prompt: 'Add seats 2 to 6: copy the INSERT line and bump its first number by one each time.',
            setup: {
              text: ['-- hall A, front row', 'BEGIN;', "INSERT INTO seats (id, row) VALUES (1, 'A');", 'COMMIT;'],
              cursor: { line: 2, col: 12 },
            },
            goal: {
              text: [
                '-- hall A, front row',
                'BEGIN;',
                "INSERT INTO seats (id, row) VALUES (1, 'A');",
                "INSERT INTO seats (id, row) VALUES (2, 'A');",
                "INSERT INTO seats (id, row) VALUES (3, 'A');",
                "INSERT INTO seats (id, row) VALUES (4, 'A');",
                "INSERT INTO seats (id, row) VALUES (5, 'A');",
                "INSERT INTO seats (id, row) VALUES (6, 'A');",
                'COMMIT;',
              ],
            },
            solution: 'qayyp<C-a>q4@a',
          },
          {
            prompt: 'Uppercase the name after each "export const".',
            setup: {
              name: 'status.ts',
              text: [
                '// HTTP status codes',
                'export const ok = 200;',
                'export const created = 201;',
                'export const accepted = 202;',
                'export const conflict = 409;',
              ],
              cursor: { line: 1, col: 13 },
            },
            goal: {
              text: ['// HTTP status codes', "export const OK = 200;", "export const CREATED = 201;", "export const ACCEPTED = 202;", "export const CONFLICT = 409;"],
            },
            solution: 'qa02wgUiwjq@a@@@@',
          },
        ],
      },
    },
    {
      id: 'robust-macros',
      title: 'Robust Macros',
      chips: ['0', 'f', 'A'],
      keyCards: [
        { key: '0', glyph: '|←', label: 'start from a known spot' },
        { key: 'f', glyph: '→x', label: 'move by content', sub: 'not by counting' },
        { key: 'A', glyph: '→|', label: 'append at the end', sub: 'however long the line' },
      ],
      intro: (
        <>
          <p>
            A macro replays keys, not intentions. <Code>5l</Code> works on the line you recorded and misses on a
            longer one. Move by what the text says instead: <Code>f=</Code>, <Code>t,</Code>, <Code>w</Code>,{' '}
            <Code>$</Code>, <Code>I</Code> and <Code>A</Code>.
          </p>
          <p>
            Start with <Code>0</Code> or <Code>^</Code> so each run begins in the same place, and finish on the next
            line so the next run can start.
          </p>
        </>
      ),
      practice: total => (
        <p>
          The lines differ in length. Record a macro that works on all of them, then replay it. {total} rounds.
        </p>
      ),
      aside: {
        title: 'Test before you count',
        body: (
          <p>
            Run the macro once with <Code>@a</Code> and check the line before you reach for <Code>99@a</Code>. If it's
            wrong, <Code>u</Code> and record again; <Code>qa</Code> overwrites.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        base: { name: '.envrc' },
        rounds: [
          {
            prompt: 'Put double quotes around everything after each "=".',
            setup: {
              text: [
                '# local dev',
                'export DATABASE_URL=postgres://localhost/app',
                'export PORT=8080',
                'export LOG_LEVEL=debug',
                'export SENTRY_DSN=https://key@o1.ingest.sentry.io/42',
              ],
              cursor: { line: 1, col: 5 },
            },
            goal: {
              text: [
                '# local dev',
                'export DATABASE_URL="postgres://localhost/app"',
                'export PORT="8080"',
                'export LOG_LEVEL="debug"',
                'export SENTRY_DSN="https://key@o1.ingest.sentry.io/42"',
              ],
            },
            solution: 'qa0f=a"<Esc>A"<Esc>jq3@a',
          },
          {
            prompt: 'Rewrite each "name url" line as [name](url).',
            setup: {
              name: 'links.md',
              text: [
                '## Links',
                '',
                'vimchi https://github.com/gig3m/vimchi',
                'neovim https://neovim.io',
                'lazy.nvim https://lazy.folke.io',
              ],
              cursor: { line: 2, col: 0 },
            },
            goal: { text: ['## Links', '', '[vimchi](https://github.com/gig3m/vimchi)', '[neovim](https://neovim.io)', '[lazy.nvim](https://lazy.folke.io)'] },
            solution: 'qaI[<Esc>f cl](<Esc>A)<Esc>jq2@a',
          },
          {
            prompt: "Turn each bare name into 'name': name, with a comma at the end.",
            setup: {
              name: 'payload.py',
              text: ['payload = {', '    user_id', '    amount', '    currency', '    idempotency_key', '}'],
              cursor: { line: 1, col: 6 },
            },
            goal: {
              text: [
                'payload = {',
                "    'user_id': user_id,",
                "    'amount': amount,",
                "    'currency': currency,",
                "    'idempotency_key': idempotency_key,",
                '}',
              ],
            },
            solution: "qa^yiwI'<Esc>A': <C-r>0,<Esc>jq3@a",
          },
          {
            prompt: 'Change each value after ":" to null, keeping the commas.',
            setup: {
              name: 'defaults.ts',
              text: [
                'const defaults = {',
                '  timeout: 30_000,',
                '  retries: 3,',
                '  baseUrl: "https://api.example.com",',
                '  onError: console.error,',
                '};',
              ],
              cursor: { line: 0, col: 0 },
            },
            goal: {
              text: ['const defaults = {', '  timeout: null,', '  retries: null,', '  baseUrl: null,', '  onError: null,', '};'],
            },
            solution: 'jqa^f:wct,null<Esc>jq3@a',
          },
        ],
      },
    },
    {
      id: 'recursive-macros',
      title: 'Recursive Macros',
      chips: ['qaq', '@a'],
      keyCards: [
        { key: 'qaq', glyph: '∅', label: 'clear register a' },
        { key: '@a', glyph: '↻', label: 'call itself', sub: 'last key of the macro' },
      ],
      intro: (
        <>
          <p>
            A macro can end by playing itself. Clear the register with <Code>qaq</Code>, record the edit, finish with{' '}
            <Code>j@a</Code>, stop with <Code>q</Code>, and one <Code>@a</Code> runs to the end of the file.
          </p>
          <p>
            It stops when a motion fails: <Code>j</Code> on the last line, or a search with no more matches. No
            counting lines.
          </p>
          <BeforeAfter
            lines={['renew the cert', 'bump node', 'drop old flags']}
            cursor={[0, 0]}
            keys="qaqqaI- <Esc>j@aq@a"
            caption="One @a keeps calling itself until j fails on the last line."
          />
        </>
      ),
      practice: total => (
        <p>
          Clear the register, record a macro that calls itself, then start it once. {total} rounds.
        </p>
      ),
      aside: {
        title: 'Why clear it first',
        body: (
          <p>
            The <Code>@a</Code> you type while recording runs right away. If <Code>a</Code> still held an old macro,
            that would play in the middle of your recording.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        base: { name: 'todo.md' },
        rounds: [
          {
            prompt: 'Add "[ ] " after the "- " on every item line.',
            setup: {
              text: [
                '## Ops',
                '',
                '- renew the TLS cert',
                '- rotate the staging DB password',
                '- bump node to 22',
                '- archive the old dashboards',
                '- move CI to arm runners',
                '- delete the feature flags',
              ],
              cursor: { line: 2, col: 5 },
            },
            goal: {
              text: [
                '## Ops',
                '',
                '- [ ] renew the TLS cert',
                '- [ ] rotate the staging DB password',
                '- [ ] bump node to 22',
                '- [ ] archive the old dashboards',
                '- [ ] move CI to arm runners',
                '- [ ] delete the feature flags',
              ],
            },
            solution: 'qaqqa0a [ ]<Esc>j@aq@a',
          },
          {
            prompt: 'Delete every console.debug line. The search failing ends the macro.',
            setup: {
              name: 'checkout.ts',
              text: [
                'export async function checkout(cart: Cart) {',
                "  console.debug('cart', cart);",
                '  const order = await createOrder(cart);',
                "  console.debug('order', order.id);",
                '  await charge(order);',
                "  console.debug('charged');",
                '  return order;',
                '}',
              ],
              cursor: { line: 2, col: 8 },
            },
            goal: {
              text: [
                'export async function checkout(cart: Cart) {',
                '  const order = await createOrder(cart);',
                '  await charge(order);',
                '  return order;',
                '}',
              ],
            },
            solution: 'qaqqa/debug<CR>dd@aq@a',
          },
          {
            prompt: 'Wrap the word before each " - " in backticks.',
            setup: {
              name: 'API.md',
              text: [
                '## Functions',
                '',
                'parse - read a config file',
                'validate - check it against the schema',
                'merge - combine two configs',
                'resolve - expand env vars',
                'dump - write it back out',
              ],
              cursor: { line: 2, col: 0 },
            },
            goal: {
              text: [
                '## Functions',
                '',
                '`parse` - read a config file',
                '`validate` - check it against the schema',
                '`merge` - combine two configs',
                '`resolve` - expand env vars',
                '`dump` - write it back out',
              ],
            },
            solution: 'qaqqaI`<Esc>ea`<Esc>j@aq@a',
          },
          {
            prompt: 'Join the lines in pairs, with ": " between the two halves.',
            setup: {
              name: 'headers.txt',
              text: ['Content-Type', 'application/json', 'Cache-Control', 'no-store', 'X-Request-Id', 'a1b2c3', 'Accept', '*/*'],
              cursor: { line: 0, col: 0 },
            },
            goal: { text: ['Content-Type: application/json', 'Cache-Control: no-store', 'X-Request-Id: a1b2c3', 'Accept: */*'] },
            solution: 'qaqqaA:<Esc>Jj@aq@a',
          },
        ],
      },
    },
    {
      id: 'editing-macros',
      title: 'Editing a Macro',
      chips: ['"ap', '"ay$'],
      keyCards: [
        { key: '"ap', glyph: '⎘', label: 'put the macro', sub: 'as text' },
        { key: '"ay$', glyph: 'y', label: 'yank it back', sub: 'without the newline' },
      ],
      intro: (
        <>
          <p>
            A macro is just text in a register. When one is almost right, don't re-record it: put it on an empty line
            with <Code>"ap</Code>, fix it like any other text, then <Code>0"ay$</Code> to store it again and{' '}
            <Code>dd</Code> the scratch line.
          </p>
          <p>
            Yank with <Code>y$</Code>, not <Code>yy</Code>. <Code>yy</Code> takes the line's newline too, and the
            macro would press <Code>enter</Code> at the end.
          </p>
        </>
      ),
      practice: total => (
        <p>
          Each register holds a macro with one mistake. Put it on a new line at the end, fix it, yank it back, delete the
          scratch line, then use it if the round asks. {total} rounds.
        </p>
      ),
      aside: {
        title: 'Or use :let',
        body: (
          <p>
            <Code>:let @a = '0f=r:j'</Code> writes a register directly. Press <Code>C-r a</Code> inside the quotes to
            start from the current contents.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        base: { name: 'legacy.py' },
        rounds: [
          {
            prompt: 'Register a deletes a trailing semicolon but forgets to move down. Add the j, then run it on all four lines.',
            setup: {
              text: ['import json;', 'rows = load();', 'total = sum(r.amount for r in rows);', 'print(json.dumps(total));'],
              registers: { a: '$x' },
              cursor: { line: 0, col: 0 },
            },
            goal: { text: ['import json', 'rows = load()', 'total = sum(r.amount for r in rows)', 'print(json.dumps(total))'], registers: { a: '$xj' } },
            solution: 'Go<Esc>"apAj<Esc>0"ay$ddgg4@a',
          },
          {
            prompt: 'Register v should delete the version at the start of a line, but dw stops at the dot. Make it dW.',
            setup: {
              name: 'CHANGELOG.md',
              text: ['v2.4.0 Add dark mode', 'v2.3.1 Fix login redirect', 'v2.3.0 Drop Node 18'],
              registers: { v: '0dwj' },
              cursor: { line: 0, col: 0 },
            },
            goal: { text: ['v2.4.0 Add dark mode', 'v2.3.1 Fix login redirect', 'v2.3.0 Drop Node 18'], registers: { v: '0dWj' } },
            solution: 'Go<Esc>"vpFwrW0"vy$dd',
          },
          {
            prompt: 'Register c removes one character, but each line starts with "# ". Make it 02xj, then run it on all three lines.',
            setup: {
              name: 'config.py',
              text: ['# DEBUG = True', '# ALLOWED_HOSTS = ["*"]', '# CACHE_TTL = 0'],
              registers: { c: '0xj' },
              cursor: { line: 0, col: 0 },
            },
            goal: { text: ['DEBUG = True', 'ALLOWED_HOSTS = ["*"]', 'CACHE_TTL = 0'], registers: { c: '02xj' } },
            solution: 'Go<Esc>"cp0a2<Esc>0"cy$ddgg3@c',
          },
        ],
      },
    },
    {
      id: 'boss-csv-to-object',
      title: 'Boss: CSV to Object Literal',
      boss: true,
      chips: ['q', '@a'],
      keyCards: [
        { key: 'q', glyph: '●', label: 'record once' },
        { key: '4@a', glyph: '4×▶', label: 'replay the rest' },
      ],
      intro: (
        <>
          <p>
            A CSV export pasted into a TypeScript file needs to become code. A handful of rows, a few fields each:
            exactly the kind of repetition a macro is for.
          </p>
          <p>
            The wrapper lines are already there. Record one row with <Code>f,</Code> and a short insert, and replay it
            on the rest. Three exports, three shapes.
          </p>
        </>
      ),
      practice: total => (
        <p>
          Turn each CSV export into the code shown below the editor. Par assumes one recorded macro and a count per
          round. {total} rounds.
        </p>
      ),
      aside: {
        title: 'Commas in fields',
        body: (
          <p>
            Real CSV can quote a field that contains a comma, and <Code>f,</Code> will stop inside it. Search the data
            for <Code>"</Code> first; if a row is odd, run the macro on the others and fix that one by hand.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        base: { name: 'users.ts' },
        rounds: [
          {
            prompt: "Turn each row into [id, 'name'],",
            setup: {
              text: [
                'const users = new Map([',
                '  1,Ada Lovelace',
                '  2,Grace Hopper',
                '  3,Alan Turing',
                '  4,Katherine Johnson',
                '  5,Margaret Hamilton',
                ']);',
              ],
              cursor: { line: 1, col: 0 },
            },
            goal: {
              text: [
                'const users = new Map([',
                "  [1, 'Ada Lovelace'],",
                "  [2, 'Grace Hopper'],",
                "  [3, 'Alan Turing'],",
                "  [4, 'Katherine Johnson'],",
                "  [5, 'Margaret Hamilton'],",
                ']);',
              ],
            },
            solution: "qaI[<Esc>f,a '<Esc>A'],<Esc>jq4@a",
          },
          {
            prompt: "Turn each row into ['code', price],",
            setup: {
              name: 'prices.ts',
              text: ['export const prices = new Map([', '  MUG-01,12.5', '  TEE-BLK-M,24', '  PIN-03,6.75', '  TOTE-02,18', ']);'],
              cursor: { line: 1, col: 0 },
            },
            goal: {
              text: [
                'export const prices = new Map([',
                "  ['MUG-01', 12.5],",
                "  ['TEE-BLK-M', 24],",
                "  ['PIN-03', 6.75],",
                "  ['TOTE-02', 18],",
                ']);',
              ],
            },
            solution: "qaI['<Esc>f,i'<Esc>la <Esc>A],<Esc>jq3@a",
          },
          {
            prompt: 'Turn each row into name: value,',
            setup: {
              name: 'limits.ts',
              text: ['export const limits = {', '  maxUsers,500', '  maxOrgs,20', '  maxSeats,50', '  maxRepos,100', '  maxHooks,10', '};'],
              cursor: { line: 1, col: 0 },
            },
            goal: {
              text: [
                'export const limits = {',
                '  maxUsers: 500,',
                '  maxOrgs: 20,',
                '  maxSeats: 50,',
                '  maxRepos: 100,',
                '  maxHooks: 10,',
                '};',
              ],
            },
            solution: 'qa0f,cl: <Esc>A,<Esc>jq4@a',
          },
        ],
      },
    },
  ],
};
