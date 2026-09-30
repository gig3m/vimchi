import { Code } from '../../components/Code';
import { BeforeAfter } from '../../components/diagrams';
import type { Section } from '../types';
import type { Vim } from '../../vim/editor';

/** The grug-far report float has been dismissed (the round ends on reading and closing it). */
const closed = (vim: Vim) => !vim.floats.some(f => f.id === 'grug-far');

export const substitute: Section = {
  id: 'substitute',
  title: 'Substitute',
  band: 'patterns',
  lessons: [
    {
      id: 'sub-basics',
      title: 'Substitute',
      chips: [':s'],
      keyCards: [{ key: ':s', glyph: 'a→b', label: 'substitute', sub: ':s/old/new/' }],
      intro: (
        <>
          <p>
            <Code>:s/old/new/</Code> replaces the first match of <Code>old</Code> on the cursor's line with{' '}
            <Code>new</Code>. The pattern is a Vim regex; the replacement is plain text.
          </p>
          <p>
            It fixes a line without moving along it, and every bulk edit in this section starts from it. Leave the
            replacement empty to delete the match.
          </p>
          <BeforeAfter
            lines={['DEBUG = True', 'USE_TZ = True', 'LOG_SQL = True']}
            cursor={[0, 0]}
            keys=":s/True/False/<CR>"
            caption="Only the cursor's line changes."
          />
        </>
      ),
      practice: total => (
        <p>
          Fix the cursor's line with one <Code>:s</Code>. Other lines stay as they are. {total} rounds.
        </p>
      ),
      aside: {
        title: 'The last slash is optional',
        body: (
          <p>
            <Code>:s/True/False</Code> works without the closing slash. You need it only when flags follow, which is
            the next lesson.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        base: {},
        rounds: [
          {
            prompt: 'Change "var" to "const" on this line.',
            setup: {
              name: 'server.js',
              text: ["const express = require('express');", 'var app = express();', 'app.listen(3000);'],
              cursor: { line: 1, col: 6 },
            },
            goal: { text: ["const express = require('express');", 'const app = express();', 'app.listen(3000);'] },
            solution: ':s/var/const/<CR>',
          },
          {
            prompt: 'Fix the spelling of "instalation".',
            setup: {
              name: 'README.md',
              text: [
                '# vimchi',
                '',
                'A Vim tutor that runs in the browser,',
                'with no instalation step.',
                '',
                'Open the page and start typing.',
              ],
              cursor: { line: 3, col: 10 },
            },
            goal: {
              text: [
                '# vimchi',
                '',
                'A Vim tutor that runs in the browser,',
                'with no installation step.',
                '',
                'Open the page and start typing.',
              ],
            },
            solution: ':s/instalation/installation/<CR>',
          },
          {
            prompt: 'Turn debug mode off.',
            setup: {
              name: 'settings.py',
              text: ['SECRET_KEY = env("SECRET_KEY")', 'DEBUG = True', 'ALLOWED_HOSTS = ["localhost"]', 'USE_TZ = True'],
              cursor: { line: 1, col: 8 },
            },
            goal: { text: ['SECRET_KEY = env("SECRET_KEY")', 'DEBUG = False', 'ALLOWED_HOSTS = ["localhost"]', 'USE_TZ = True'] },
            solution: ':s/True/False/<CR>',
          },
          {
            prompt: 'Turn the first "=" into ": " (YAML style). The one in the URL stays.',
            setup: {
              name: 'config.yml',
              text: ['APP_NAME: billing', 'DATABASE_URL=postgres://db:5432/app?sslmode=require', 'LOG_LEVEL: info'],
              cursor: { line: 1, col: 0 },
            },
            goal: { text: ['APP_NAME: billing', 'DATABASE_URL: postgres://db:5432/app?sslmode=require', 'LOG_LEVEL: info'] },
            solution: ':s/=/: /<CR>',
          },
          {
            prompt: "Delete the 'debug' label from the log call.",
            setup: {
              name: 'checkout.ts',
              text: ['const total = cart.total();', "console.log('debug', total);", 'return total;'],
              cursor: { line: 1, col: 12 },
            },
            goal: { text: ['const total = cart.total();', 'console.log(total);', 'return total;'] },
            solution: ":s/'debug', //<CR>",
          },
        ],
      },
    },
    {
      id: 'sub-whole-file',
      title: 'Whole File',
      chips: ['%s', '/g'],
      keyCards: [
        { key: '%', glyph: '1–$', label: 'every line', sub: 'range before s' },
        { key: 'g', glyph: '∀', label: 'every match', sub: 'flag after the last /' },
      ],
      intro: (
        <>
          <p>
            A range goes in front of <Code>s</Code>. <Code>%</Code> means every line, so <Code>:%s/old/new/</Code>{' '}
            changes the whole file. The <Code>g</Code> flag after the last slash replaces every match on a line, not
            just the first.
          </p>
          <p>
            <Code>:%s/old/new/g</Code> is the one to memorise. Leave off <Code>g</Code> only when you want the first
            match on each line.
          </p>
          <BeforeAfter
            lines={['api.get(api.url);', 'return api;']}
            cursor={[0, 0]}
            keys=":%s/api/client/<CR>"
            caption="Without g: the first match on each line."
          />
          <BeforeAfter
            lines={['api.get(api.url);', 'return api;']}
            cursor={[0, 0]}
            keys=":%s/api/client/g<CR>"
            caption="With g: every match."
          />
        </>
      ),
      practice: total => (
        <p>
          Make each file match the goal with one <Code>:%s</Code>. {total} rounds.
        </p>
      ),
      aside: {
        title: 'Other ranges',
        body: (
          <p>
            <Code>:5,12s</Code> works on lines 5 to 12. Press <Code>:</Code> in visual mode and Vim types{' '}
            <Code>{":'<,'>"}</Code> for you, so the substitute only touches the selection.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        base: {},
        rounds: [
          {
            prompt: 'Rename "api" to "client" everywhere.',
            setup: {
              name: 'sync.ts',
              text: [
                "const users = await api.get('/users');",
                "await api.post('/audit', { event: 'sync' });",
                'if (api.pending) await api.flush();',
              ],
            },
            goal: {
              text: [
                "const users = await client.get('/users');",
                "await client.post('/audit', { event: 'sync' });",
                'if (client.pending) await client.flush();',
              ],
            },
            solution: ':%s/api/client/g<CR>',
          },
          {
            prompt: 'Swap every ";" for a ",".',
            setup: {
              name: 'orders.csv',
              text: ['id;customer;total', '1001;Acme;249.00', '1002;Globex;80.50', '1003;Initech;1200.00'],
            },
            goal: { text: ['id,customer,total', '1001,Acme,249.00', '1002,Globex,80.50', '1003,Initech,1200.00'] },
            solution: ':%s/;/,/g<CR>',
          },
          {
            prompt: 'Switch every link to https.',
            setup: {
              name: 'links.md',
              text: [
                '- [Neovim](http://neovim.io)',
                '- [Lua guide](http://neovim.io/doc/user/lua-guide.html)',
                '- [Plugins](http://dotfyle.com)',
              ],
            },
            goal: {
              text: [
                '- [Neovim](https://neovim.io)',
                '- [Lua guide](https://neovim.io/doc/user/lua-guide.html)',
                '- [Plugins](https://dotfyle.com)',
              ],
            },
            solution: ':%s/http:/https:/<CR>',
          },
          {
            prompt: 'Use American spelling: "colour" becomes "color".',
            setup: {
              name: 'theme.md',
              text: [
                'Pick a colour for the background and a colour for text.',
                'Each colour needs enough contrast.',
                'Accent colours are optional.',
              ],
            },
            goal: {
              text: [
                'Pick a color for the background and a color for text.',
                'Each color needs enough contrast.',
                'Accent colors are optional.',
              ],
            },
            solution: ':%s/colour/color/g<CR>',
          },
        ],
      },
    },
    {
      id: 'sub-confirm',
      title: 'Confirm Each',
      chips: ['/c'],
      keyCards: [
        { key: 'c', glyph: '?', label: 'ask each time', sub: 'flag' },
        { key: 'y', glyph: '✓', label: 'replace this' },
        { key: 'n', glyph: '✗', label: 'skip this' },
        { key: 'a', glyph: '∀', label: 'replace the rest' },
        { key: 'q', glyph: '■', label: 'stop' },
      ],
      intro: (
        <>
          <p>
            With the <Code>c</Code> flag, Vim stops at each match, highlights it and asks{' '}
            <Code>replace with … (y/n/a/q/l)?</Code>. <Code>y</Code> replaces it, <Code>n</Code> skips it,{' '}
            <Code>a</Code> replaces it and every match after, <Code>q</Code> stops.
          </p>
          <p>
            Use it when the pattern hits a few things it shouldn't, and pressing <Code>n</Code> twice is quicker than
            writing a tighter regex.
          </p>
        </>
      ),
      practice: total => (
        <p>
          Run a <Code>:%s</Code> with <Code>gc</Code> and answer each prompt so the file matches the goal. {total}{' '}
          rounds.
        </p>
      ),
      aside: {
        title: 'l for last',
        body: (
          <p>
            <Code>l</Code> replaces the current match and stops, for when you can see it's the last one you want.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        base: {},
        rounds: [
          {
            prompt: 'Rename the variable "item" to "product". Leave the message text alone.',
            setup: {
              name: 'cart.ts',
              text: ['const item = cart.first();', "toast('Removed item from cart');", "track('remove', item.id);"],
            },
            goal: { text: ['const product = cart.first();', "toast('Removed item from cart');", "track('remove', product.id);"] },
            solution: ':%s/item/product/gc<CR>yny',
          },
          {
            prompt: 'Rename master to main, except in the comment.',
            setup: {
              name: 'deploy.sh',
              text: ['git checkout master', 'git pull origin master', '# master was renamed in March', 'git push origin master'],
            },
            goal: { text: ['git checkout main', 'git pull origin main', '# master was renamed in March', 'git push origin main'] },
            solution: ':%s/master/main/gc<CR>yyny',
          },
          {
            prompt: 'Turn print( into log.info( everywhere but the first one.',
            setup: {
              name: 'cli.py',
              text: [
                'if args.help:',
                '    print(USAGE)',
                'print("loading", path)',
                'print("rows:", len(rows))',
                'print("done")',
              ],
            },
            goal: {
              text: [
                'if args.help:',
                '    print(USAGE)',
                'log.info("loading", path)',
                'log.info("rows:", len(rows))',
                'log.info("done")',
              ],
            },
            solution: ':%s/print(/log.info(/gc<CR>na',
          },
          {
            prompt: 'Tick off the first two tasks only.',
            setup: {
              name: 'TODO.md',
              text: ['- [ ] Write the migration', '- [ ] Add an index on email', '- [ ] Backfill old rows'],
            },
            goal: { text: ['- [x] Write the migration', '- [x] Add an index on email', '- [ ] Backfill old rows'] },
            solution: ':%s/\\[ ]/[x]/gc<CR>yyq',
          },
          {
            prompt: 'Bump the package version to 1.3.0, not the dependency.',
            setup: {
              name: 'package.json',
              text: [
                '{',
                '  "name": "@acme/ui",',
                '  "dependencies": { "@acme/tokens": "1.2.0" },',
                '  "version": "1.2.0",',
                '  "license": "MIT"',
                '}',
              ],
            },
            goal: {
              text: [
                '{',
                '  "name": "@acme/ui",',
                '  "dependencies": { "@acme/tokens": "1.2.0" },',
                '  "version": "1.3.0",',
                '  "license": "MIT"',
                '}',
              ],
            },
            solution: ':%s/1.2.0/1.3.0/gc<CR>nl',
          },
        ],
      },
    },
    {
      id: 'sub-ignore-case',
      title: 'Ignoring Case',
      chips: ['/i', '\\c'],
      keyCards: [
        { key: 'i', glyph: 'Aa', label: 'ignore case', sub: 'flag' },
        { key: '\\c', glyph: 'Aa', label: 'ignore case', sub: 'anywhere in the pattern' },
        { key: '\\C', glyph: 'A≠a', label: 'match case' },
      ],
      intro: (
        <>
          <p>
            Patterns match case exactly unless you say otherwise. The <Code>i</Code> flag ignores case for one
            substitute; <Code>\c</Code> anywhere in the pattern does the same, and <Code>\C</Code> forces an exact
            match.
          </p>
          <p>
            Many Neovim configs set <Code>ignorecase</Code> and <Code>smartcase</Code>: an all-lowercase pattern
            ignores case, and a capital letter makes it exact. <Code>\c</Code> and <Code>\C</Code> override both.
          </p>
        </>
      ),
      practice: total => (
        <p>
          Replace every match whatever its case, or exactly one case where the prompt says so. {total} rounds.
        </p>
      ),
      aside: {
        title: 'The I flag',
        body: (
          <p>
            Capital <Code>I</Code> is the opposite flag: <Code>:%s/user/account/gI</Code> matches case exactly, even
            with <Code>ignorecase</Code> on.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        base: {},
        rounds: [
          {
            prompt: 'Spell JavaScript one way throughout.',
            setup: {
              name: 'notes.md',
              text: ['## Why javascript', 'Javascript runs everywhere.', 'Most of our JAVASCRIPT is typed now.'],
            },
            goal: { text: ['## Why JavaScript', 'JavaScript runs everywhere.', 'Most of our JavaScript is typed now.'] },
            solution: ':%s/javascript/JavaScript/gi<CR>',
          },
          {
            prompt: 'Make every log level uppercase.',
            setup: {
              name: 'app.log',
              text: ['09:14:02 Warn disk at 81%', '09:14:07 warn retrying upload', '09:15:30 WARN queue is backing up'],
            },
            goal: { text: ['09:14:02 WARN disk at 81%', '09:14:07 WARN retrying upload', '09:15:30 WARN queue is backing up'] },
            solution: ':%s/\\cwarn/WARN/<CR>',
          },
          {
            prompt: 'smartcase is on. Make every "todo:" read "TODO:".',
            setup: {
              name: 'worker.go',
              text: ['// todo: handle timeouts', 'func run() {', '\t// Todo: close the channel', '}'],
              options: { ignorecase: true, smartcase: true },
            },
            goal: { text: ['// TODO: handle timeouts', 'func run() {', '\t// TODO: close the channel', '}'] },
            solution: ':%s/todo:/TODO:/<CR>',
          },
          {
            prompt: 'smartcase is on. Rename the variable "user" to "account", but not the type "User".',
            setup: {
              name: 'session.ts',
              text: ['const user: User = await load();', 'if (!user) throw new Error("no user");', 'return user;'],
              options: { ignorecase: true, smartcase: true },
            },
            goal: { text: ['const account: User = await load();', 'if (!account) throw new Error("no account");', 'return account;'] },
            solution: ':%s/\\Cuser/account/g<CR>',
          },
        ],
      },
    },
    {
      id: 'sub-word-boundaries',
      title: 'Word Boundaries',
      chips: ['\\<', '\\>'],
      keyCards: [
        { key: '\\<', glyph: '|w', label: 'word start' },
        { key: '\\>', glyph: 'w|', label: 'word end' },
      ],
      intro: (
        <>
          <p>
            <Code>{'\\<'}</Code> matches where a word starts and <Code>{'\\>'}</Code> where it ends. They match no
            characters themselves. <Code>{'\\<id\\>'}</Code> finds <Code>id</Code> but not the letters inside{' '}
            <Code>idle</Code> or <Code>valid</Code>.
          </p>
          <p>
            Without them, renaming a short name also rewrites every longer name that contains it. Wrap the name and
            the rename stays exact.
          </p>
          <BeforeAfter lines={['if (valid(id)) load(id);']} cursor={0} keys=":s/id/uid/g<CR>" caption="valid turns into valuid." />
          <BeforeAfter
            lines={['if (valid(id)) load(id);']}
            cursor={0}
            keys={':s/\\<lt>id\\>/uid/g<CR>'}
            caption="Only the whole word id changes."
          />
        </>
      ),
      practice: total => (
        <p>
          Rename only the whole word. Longer names that contain it must survive. {total} rounds.
        </p>
      ),
      aside: {
        title: '* adds them for you',
        body: (
          <p>
            <Code>*</Code> searches for the word under the cursor wrapped in <Code>{'\\< \\>'}</Code>. Follow it
            with <Code>:%s//new/g</Code> and you never type the pattern.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        base: {},
        rounds: [
          {
            prompt: 'Rename the loop variable "i" to "idx".',
            setup: {
              name: 'render.js',
              text: ['for (let i = 0; i < items.length; i++) {', '  if (items[i].hidden) continue;', '  draw(items[i]);', '}'],
            },
            goal: {
              text: ['for (let idx = 0; idx < items.length; idx++) {', '  if (items[idx].hidden) continue;', '  draw(items[idx]);', '}'],
            },
            solution: ':%s/\\<lt>i\\>/idx/g<CR>',
          },
          {
            prompt: 'Rename "id" to "user_id".',
            setup: {
              name: 'users.py',
              text: ['def load(id):', '    valid = id is not None', '    return db.get(id) if valid else None'],
            },
            goal: { text: ['def load(user_id):', '    valid = user_id is not None', '    return db.get(user_id) if valid else None'] },
            solution: ':%s/\\<lt>id\\>/user_id/g<CR>',
          },
          {
            prompt: 'Rename the local "map" to "nmap". Leave keymap and mapleader alone.',
            setup: {
              name: 'keymaps.lua',
              text: [
                "vim.g.mapleader = ' '",
                'local map = vim.keymap.set',
                "map('n', '<leader>w', '<cmd>w<cr>')",
                "map('n', '<leader>q', '<cmd>q<cr>')",
              ],
            },
            goal: {
              text: [
                "vim.g.mapleader = ' '",
                'local nmap = vim.keymap.set',
                "nmap('n', '<leader>w', '<cmd>w<cr>')",
                "nmap('n', '<leader>q', '<cmd>q<cr>')",
              ],
            },
            solution: ':%s/\\<lt>map\\>/nmap/g<CR>',
          },
          {
            prompt: 'Rename test classes ending in "Test" to end in "Spec". TestHelpers stays.',
            setup: {
              name: 'suite.kt',
              text: ['class LoginTest : TestHelpers()', 'class CartTest : TestHelpers()', 'val all = listOf(LoginTest, CartTest)'],
            },
            goal: { text: ['class LoginSpec : TestHelpers()', 'class CartSpec : TestHelpers()', 'val all = listOf(LoginSpec, CartSpec)'] },
            solution: ':%s/Test\\>/Spec/g<CR>',
          },
        ],
      },
    },
    {
      id: 'sub-very-magic',
      title: 'Very Magic',
      chips: ['\\v'],
      keyCards: [
        { key: '\\v', glyph: '( | +', label: 'very magic', sub: 'punctuation is special' },
        { key: '\\V', glyph: 'abc', label: 'very nomagic', sub: 'everything literal' },
      ],
      intro: (
        <>
          <p>
            By default, <Code>( ) | + ? {'{ }'}</Code> are plain characters and need a backslash to do regex work.
            Start the pattern with <Code>\v</Code> ("very magic") and every punctuation character except{' '}
            <Code>_</Code> is special, much like a JavaScript regex.
          </p>
          <p>
            Reach for it when a pattern has groups, alternation or counts; it removes most of the backslashes. In{' '}
            <Code>\v</Code> mode the word boundaries are plain <Code>{'<'}</Code> and <Code>{'>'}</Code>.
          </p>
        </>
      ),
      practice: total => (
        <p>
          Write each pattern with <Code>\v</Code>. {total} rounds.
        </p>
      ),
      aside: {
        title: 'The literal end',
        body: (
          <p>
            <Code>\V</Code> is the opposite: only a backslash is special. <Code>:%s/\V1.2.0/1.3.0/g</Code> matches
            the dots as dots. In <Code>\v</Code>, remember <Code>=</Code> and <Code>@</Code> are special too.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        base: {},
        rounds: [
          {
            prompt: 'Spell it "color" everywhere, with one optional "u".',
            setup: {
              name: 'tokens.css',
              text: ['/* Base colour tokens */', ':root {', '  --text-color: #222;', '  --bg-colour: #fff;', '}'],
            },
            goal: { text: ['/* Base color tokens */', ':root {', '  --text-color: #222;', '  --bg-color: #fff;', '}'] },
            solution: ':%s/\\vcolou?r/color/g<CR>',
          },
          {
            prompt: 'Replace every var and let with const. Don\'t touch "variant".',
            setup: {
              name: 'theme.js',
              text: ["var base = '/api';", 'let retries = 3;', 'const timeout = 5000;', "let variant = 'dark';"],
            },
            goal: { text: ["const base = '/api';", 'const retries = 3;', 'const timeout = 5000;', "const variant = 'dark';"] },
            solution: ':%s/\\v<lt>(var|let)>/const/g<CR>',
          },
          {
            prompt: 'Strip trailing whitespace.',
            setup: {
              name: 'main.py',
              text: ['import sys   ', '', 'def main():  ', '    return 0\t'],
            },
            goal: { text: ['import sys', '', 'def main():', '    return 0'] },
            solution: ':%s/\\v\\s+$//<CR>',
          },
          {
            prompt: 'Squeeze every run of two or more spaces down to one.',
            setup: {
              name: 'post.md',
              text: ['## Releasing', '', 'Save the file.  Then run the tests.   Then ship it.', 'Nothing else  to do.'],
            },
            goal: { text: ['## Releasing', '', 'Save the file. Then run the tests. Then ship it.', 'Nothing else to do.'] },
            solution: ':%s/\\v {2,}/ /g<CR>',
          },
        ],
      },
    },
    {
      id: 'sub-capture-groups',
      title: 'Capture Groups',
      chips: ['()', '\\1'],
      keyCards: [
        { key: '( )', glyph: '[…]', label: 'capture', sub: '\\( \\) without \\v' },
        { key: '\\1', glyph: '→1', label: 'first group', sub: '\\1 to \\9' },
      ],
      intro: (
        <>
          <p>
            Parentheses capture part of the match. In the replacement, <Code>\1</Code> puts back what the first
            group matched, <Code>\2</Code> the second, up to <Code>\9</Code>.
          </p>
          <p>
            That lets you move pieces around: swap arguments, reorder a date, turn one syntax into another. Use{' '}
            <Code>\v</Code> so the groups are plain <Code>( )</Code>.
          </p>
          <BeforeAfter
            lines={['resize(800, 600);', 'resize(1024, 768);']}
            cursor={[0, 0]}
            keys={':%s/\\v(\\d+), (\\d+)/\\2, \\1/<CR>'}
            caption="Group 1 and group 2 trade places."
          />
        </>
      ),
      practice: total => (
        <p>
          Capture the pieces and rearrange them in the replacement. {total} rounds.
        </p>
      ),
      aside: {
        title: 'Change the delimiter',
        body: (
          <p>
            When the text is full of slashes, use another delimiter: <Code>:s#a/b#c/d#</Code>. Any
            non-word character works, as long as you use it all three times.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        base: {},
        rounds: [
          {
            prompt: 'Turn "Last, First" into "First Last".',
            setup: { name: 'speakers.txt', text: ['Lovelace, Ada', 'Hopper, Grace', 'Liskov, Barbara'], cursor: { line: 1, col: 0 } },
            goal: { text: ['Ada Lovelace', 'Grace Hopper', 'Barbara Liskov'] },
            solution: ':%s/\\v(\\w+), (\\w+)/\\2 \\1/<CR>',
          },
          {
            prompt: 'Rewrite the asserts as expect(…).toBe(…).',
            setup: {
              name: 'cart.test.ts',
              text: ['assert.equal(cart.count, 3);', "assert.equal(cart.currency, 'EUR');", 'assert.equal(total(cart), 42);'],
            },
            goal: {
              text: ['expect(cart.count).toBe(3);', "expect(cart.currency).toBe('EUR');", 'expect(total(cart)).toBe(42);'],
            },
            solution: ':%s/\\vassert.equal\\((.+), (.+)\\)/expect(\\1).toBe(\\2)/<CR>',
          },
          {
            prompt: 'Reformat the dates from 2026-03-15 to 15/03/2026.',
            setup: {
              name: 'payments.csv',
              text: ['date,amount', '2026-03-15,120.00', '2026-04-01,89.90', '2026-04-22,15.00'],
            },
            goal: { text: ['date,amount', '15/03/2026,120.00', '01/04/2026,89.90', '22/04/2026,15.00'] },
            solution: ':%s#\\v(\\d+)-(\\d+)-(\\d+)#\\3/\\2/\\1#<CR>',
          },
          {
            prompt: 'Convert the requires to imports.',
            setup: {
              name: 'index.js',
              text: ["const fs = require('fs');", "const path = require('path');", '', 'main();'],
            },
            goal: { text: ["import fs from 'fs';", "import path from 'path';", '', 'main();'] },
            solution: ':%s/\\vconst (\\w+).*\\((.*)\\);/import \\1 from \\2;/<CR>',
          },
        ],
      },
    },
    {
      id: 'sub-whole-match',
      title: 'The Whole Match',
      chips: ['&'],
      keyCards: [{ key: '&', glyph: '[…]', label: 'whole match', sub: 'in the replacement' }],
      intro: (
        <>
          <p>
            In the replacement, <Code>&</Code> stands for everything the pattern matched. <Code>:s/\d\+/&px/</Code>{' '}
            turns <Code>16</Code> into <Code>16px</Code>.
          </p>
          <p>
            It's the quickest way to wrap or decorate text without capturing anything: quotes, backticks, units. For
            a literal ampersand, write <Code>\&</Code>.
          </p>
          <BeforeAfter
            lines={['width: 50;', 'height: 25;']}
            cursor={[0, 0]}
            keys={':%s/\\d\\+/&%/<CR>'}
            caption="& puts the matched number back, then % follows it."
          />
        </>
      ),
      practice: total => (
        <p>
          Keep each match and add to it with <Code>&</Code>. {total} rounds.
        </p>
      ),
      aside: {
        title: '~ is the last replacement',
        body: (
          <p>
            <Code>~</Code> in a replacement inserts the previous substitute's replacement string. Like <Code>&</Code>,
            it needs a backslash (<Code>\~</Code>) to be literal.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        base: {},
        rounds: [
          {
            prompt: 'Add "px" to every number.',
            setup: { name: 'card.css', text: ['.card {', '  padding: 8 16;', '  gap: 4;', '  border-radius: 6;', '}'] },
            goal: { text: ['.card {', '  padding: 8px 16px;', '  gap: 4px;', '  border-radius: 6px;', '}'] },
            solution: ':%s/\\d\\+/&px/g<CR>',
          },
          {
            prompt: 'Wrap each npm command in backticks.',
            setup: {
              name: 'CONTRIBUTING.md',
              text: ['## Setup', '', 'Run npm install, then npm test before you push.'],
            },
            goal: { text: ['## Setup', '', 'Run `npm install`, then `npm test` before you push.'] },
            solution: ':%s/npm \\w\\+/`&`/g<CR>',
          },
          {
            prompt: 'Quote every field.',
            setup: { name: 'contacts.csv', text: ['name,city', 'Ada,London', 'Grace,New York'], cursor: { line: 2, col: 4 } },
            goal: { text: ['"name","city"', '"Ada","London"', '"Grace","New York"'] },
            solution: ':%s/[^,]\\+/"&"/g<CR>',
          },
          {
            prompt: 'Make every TODO bold.',
            setup: { name: 'plan.md', text: ['- TODO: pick a host', '- Buy the domain', '- TODO: set up DNS'] },
            goal: { text: ['- **TODO**: pick a host', '- Buy the domain', '- **TODO**: set up DNS'] },
            solution: ':%s/TODO/**&**/<CR>',
          },
        ],
      },
    },
    {
      id: 'sub-case',
      title: 'Case in Replacements',
      chips: ['\\u', '\\U', '\\E'],
      keyCards: [
        { key: '\\u', glyph: 'a→A', label: 'next char upper' },
        { key: '\\l', glyph: 'A→a', label: 'next char lower' },
        { key: '\\U', glyph: 'ab→AB', label: 'upper until \\E' },
        { key: '\\L', glyph: 'AB→ab', label: 'lower until \\E' },
        { key: '\\E', glyph: '■', label: 'stop changing case' },
      ],
      intro: (
        <>
          <p>
            In the replacement, <Code>\u</Code> uppercases the next character and <Code>\l</Code> lowercases it.{' '}
            <Code>\U</Code> and <Code>\L</Code> change everything after them until <Code>\E</Code> or the end of the
            replacement.
          </p>
          <p>
            Combined with <Code>&</Code> and groups, they convert naming styles: snake_case to camelCase, keys to
            constants, words to Title Case.
          </p>
        </>
      ),
      practice: total => (
        <p>
          Change the case of the matched text in the replacement. {total} rounds.
        </p>
      ),
      aside: {
        title: 'Stacking them',
        body: (
          <>
            <p>
              <Code>\u\L</Code> lowercases everything and capitalises the first letter.
            </p>
            <BeforeAfter
              lines={['ADA LOVELACE', 'GRACE HOPPER']}
              cursor={[0, 0]}
              keys={':%s/\\v<lt>\\w+>/\\u\\L&/g<CR>'}
            />
          </>
        ),
      },
      challenge: {
        kind: 'rounds',
        base: {},
        rounds: [
          {
            prompt: 'Convert snake_case names to camelCase.',
            setup: {
              name: 'profile.js',
              text: [
                'const user = await getProfile(id);',
                'const first_name = user.first_name;',
                'const last_login_at = user.last_login_at;',
                'render(first_name, last_login_at);',
              ],
              cursor: { line: 2, col: 6 },
            },
            goal: {
              text: [
                'const user = await getProfile(id);',
                'const firstName = user.firstName;',
                'const lastLoginAt = user.lastLoginAt;',
                'render(firstName, lastLoginAt);',
              ],
            },
            solution: ':%s/\\v_(\\l)/\\u\\1/g<CR>',
          },
          {
            prompt: 'Uppercase every key.',
            setup: { name: '.env', text: ['db_host=localhost', 'db_port=5432', 'api_key=dev-123'] },
            goal: { text: ['DB_HOST=localhost', 'DB_PORT=5432', 'API_KEY=dev-123'] },
            solution: ':%s/\\v^\\w+/\\U&/<CR>',
          },
          {
            prompt: "Turn each name into a member: PENDING = 'pending',",
            setup: {
              name: 'status.ts',
              text: ['enum Status {', '  pending', '  active', '  archived', '}'],
            },
            goal: {
              text: ['enum Status {', "  PENDING = 'pending',", "  ACTIVE = 'active',", "  ARCHIVED = 'archived',", '}'],
            },
            solution: ":%s/\\v\\w+$/\\U&\\E = '&',/<CR>",
          },
          {
            prompt: 'Capitalise every word of the heading.',
            setup: {
              name: 'guide.md',
              text: ['## getting started with lua', '', 'Neovim runs init.lua on startup.'],
              cursor: { line: 0, col: 0 },
            },
            goal: { text: ['## Getting Started With Lua', '', 'Neovim runs init.lua on startup.'] },
            solution: ':s/\\v<lt>\\l/\\u&/g<CR>',
          },
        ],
      },
    },
    {
      id: 'sub-line-breaks',
      title: 'Line Breaks',
      chips: ['\\r', '\\n'],
      keyCards: [
        { key: '\\n', glyph: '↵?', label: 'end of line', sub: 'in the pattern' },
        { key: '\\r', glyph: '↵', label: 'line break', sub: 'in the replacement' },
      ],
      intro: (
        <>
          <p>
            In a pattern, <Code>\n</Code> matches the end of a line, so a match can join lines together. In a
            replacement, <Code>\r</Code> inserts a line break, so one line can become several.
          </p>
          <p>
            The mismatch is historical and trips everyone up once: <Code>\n</Code> in a replacement inserts a null
            byte, shown as <Code>^@</Code>.
          </p>
          <BeforeAfter lines={['red, green, blue']} cursor={0} keys={':s/, /\\r/g<CR>'} caption="One line becomes three." />
          <BeforeAfter
            lines={['red', 'green', 'blue']}
            cursor={0}
            keys={':1,2s/\\n/, /<CR>'}
            caption="Three lines become one."
          />
        </>
      ),
      practice: total => (
        <p>
          Split lines apart with <Code>\r</Code> or join them with <Code>\n</Code>. {total} rounds.
        </p>
      ),
      aside: {
        title: 'Across lines',
        body: (
          <p>
            <Code>\_s</Code> matches whitespace or a newline, and <Code>\_.</Code> any character including a newline.
            They let one pattern span a line break wherever it falls.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        base: {},
        rounds: [
          {
            prompt: 'Put each directory of the PATH on its own line.',
            setup: {
              name: 'path.txt',
              text: ['# PATH on the CI runner', '', '/usr/local/bin:/usr/bin:/bin:/opt/homebrew/bin', '# checked weekly'],
              cursor: { line: 2, col: 5 },
            },
            goal: {
              text: ['# PATH on the CI runner', '', '/usr/local/bin', '/usr/bin', '/bin', '/opt/homebrew/bin', '# checked weekly'],
            },
            solution: ':s/:/\\r/g<CR>',
          },
          {
            prompt: 'Join the ids into one comma-separated line. Leave the last line alone, or its newline gets a comma too.',
            setup: { name: 'ids.sql', text: ['-- ids from the refund export', '1042', '1043', '1057', '1101'], cursor: { line: 4, col: 0 } },
            goal: { text: ['-- ids from the refund export', '1042, 1043, 1057, 1101'] },
            solution: ':2,4s/\\n/, /<CR>',
          },
          {
            prompt: 'Start each sentence on a new line.',
            setup: {
              name: 'intro.md',
              text: ['# Modes', '', 'Vim has modes. Normal moves. Insert types. Visual selects.', '', 'Esc gets you back.'],
              cursor: { line: 2, col: 0 },
            },
            goal: {
              text: ['# Modes', '', 'Vim has modes.', 'Normal moves.', 'Insert types.', 'Visual selects.', '', 'Esc gets you back.'],
            },
            solution: ':s/\\. /.\\r/g<CR>',
          },
          {
            prompt: 'Collapse the runs of blank lines to a single blank line.',
            setup: {
              name: 'notes.md',
              text: ['# Notes', '', '', '', 'First idea.', '', '', 'Second idea.'],
            },
            goal: { text: ['# Notes', '', 'First idea.', '', 'Second idea.'] },
            solution: ':%s/\\n\\{3,}/\\r\\r/<CR>',
          },
        ],
      },
    },
    {
      id: 'sub-zs-ze',
      title: 'Trimming a Match',
      chips: ['\\zs', '\\ze'],
      keyCards: [
        { key: '\\zs', glyph: '[→', label: 'match starts here' },
        { key: '\\ze', glyph: '←]', label: 'match ends here' },
      ],
      intro: (
        <>
          <p>
            The whole pattern has to match, but only the part between <Code>\zs</Code> and <Code>\ze</Code> is
            replaced. Anything before <Code>\zs</Code> or after <Code>\ze</Code> is context that stays put.
          </p>
          <p>
            It saves capturing the context and putting it back with <Code>\1</Code>. Use either one alone, or both.
          </p>
          <BeforeAfter
            lines={['width: 100px;', 'max-width: 100px;']}
            cursor={[0, 0]}
            keys={':%s/max-width: \\zs100/80/<CR>'}
            caption="max-width: must match, but only 100 is replaced."
          />
        </>
      ),
      practice: total => (
        <p>
          Match with context, but replace only the part that changes. {total} rounds.
        </p>
      ),
      aside: {
        title: 'Search with it too',
        body: (
          <p>
            <Code>\zs</Code> works in <Code>/</Code> searches: <Code>/function \zs\w\+</Code> lands the cursor on
            each function's name instead of the keyword.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        base: {},
        rounds: [
          {
            prompt: 'Set the version to 2.0.0.',
            setup: {
              name: 'package.json',
              text: ['{', '  "name": "vimchi",', '  "version": "1.9.4",', '  "private": true', '}'],
            },
            goal: { text: ['{', '  "name": "vimchi",', '  "version": "2.0.0",', '  "private": true', '}'] },
            solution: ':%s/"version": "\\zs[^"]*/2.0.0/<CR>',
          },
          {
            prompt: 'Change the "get" prefix to "fetch", only on User functions.',
            setup: {
              name: 'account.ts',
              text: ['const user = await getUser(id);', 'const team = await getUsers(teamId);', 'const cfg = getConfig();'],
            },
            goal: {
              text: ['const user = await fetchUser(id);', 'const team = await fetchUsers(teamId);', 'const cfg = getConfig();'],
            },
            solution: ':%s/get\\zeUser/fetch/<CR>',
          },
          {
            prompt: 'Extend the copyright to 2026. Leave the other years alone.',
            setup: {
              name: 'LICENSE',
              text: ['MIT License', '', 'Copyright (c) 2019-2024 Acme Inc.', 'First released in 2019.'],
            },
            goal: { text: ['MIT License', '', 'Copyright (c) 2019-2026 Acme Inc.', 'First released in 2019.'] },
            solution: ':%s/-\\zs2024/2026/<CR>',
          },
          {
            prompt: 'Change console.log calls to console.debug. logger.log stays.',
            setup: {
              name: 'poller.js',
              text: ["console.log('polling', url);", "logger.log('tick');", 'console.log(res.status);'],
            },
            goal: { text: ["console.debug('polling', url);", "logger.log('tick');", 'console.debug(res.status);'] },
            solution: ':%s/console.\\zslog\\ze(/debug/<CR>',
          },
        ],
      },
    },
    {
      id: 'sub-lazy',
      title: 'Lazy Matches',
      chips: ['\\{-}'],
      keyCards: [
        { key: '\\{-}', glyph: '…?', label: 'as few as possible' },
        { key: '*', glyph: '……', label: 'as many as possible' },
      ],
      intro: (
        <>
          <p>
            <Code>*</Code> is greedy: on <Code>"a" and "b"</Code>, the pattern <Code>".*"</Code> runs from the first
            quote to the last. <Code>{'\\{-}'}</Code> is the lazy version and stops at the first place the rest of the
            pattern can match.
          </p>
          <p>
            Use it whenever a match should end at the next delimiter: a tag, a quote, a bracket. With{' '}
            <Code>\v</Code> it's written <Code>{'{-}'}</Code>.
          </p>
          <BeforeAfter lines={['say("a") + say("b")']} cursor={0} keys={':s/".*"/"x"/g<CR>'} caption="Greedy: one match, quote to quote." />
          <BeforeAfter
            lines={['say("a") + say("b")']}
            cursor={0}
            keys={':s/".\\{-}"/"x"/g<CR>'}
            caption="Lazy: each quoted string on its own."
          />
        </>
      ),
      practice: total => (
        <p>
          Each greedy <Code>.*</Code> here would swallow too much. Use <Code>.{'\\{-}'}</Code>. {total} rounds.
        </p>
      ),
      aside: {
        title: 'Counts, lazily',
        body: (
          <p>
            <Code>{'\\{-1,}'}</Code> is a lazy <Code>\+</Code>: at least one, as few as possible. For a single
            delimiter, <Code>[^"]*</Code> does the same job as <Code>.{'\\{-}'}</Code>.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        base: {},
        rounds: [
          {
            prompt: 'Strip the tags from the paragraph, keep the text.',
            setup: {
              name: 'excerpt.html',
              text: [
                '<!-- docs home, first paragraph -->',
                '<p>Press <kbd>Esc</kbd> to leave <em>insert</em> mode.</p>',
                '<!-- end -->',
              ],
              cursor: { line: 1, col: 9 },
            },
            goal: { text: ['<!-- docs home, first paragraph -->', 'Press Esc to leave insert mode.', '<!-- end -->'] },
            solution: ':s/<lt>.\\{-}>//g<CR>',
          },
          {
            prompt: 'Drop the timestamp in brackets. Keep the level.',
            setup: {
              name: 'api.log',
              text: [
                '[2026-09-27 10:14:02] [INFO] server started',
                '[2026-09-27 10:14:09] [WARN] slow query',
                '[2026-09-27 10:14:11] [INFO] GET /health 200',
              ],
              cursor: { line: 1, col: 22 },
            },
            goal: { text: ['[INFO] server started', '[WARN] slow query', '[INFO] GET /health 200'] },
            solution: ':%s/^.\\{-}] //<CR>',
          },
          {
            prompt: 'Turn **bold** into _italics_.',
            setup: {
              name: 'release.md',
              text: ['## 2.1.0', '', 'This release is **faster** and **smaller**.', 'Upgrade is **optional**.'],
            },
            goal: { text: ['## 2.1.0', '', 'This release is _faster_ and _smaller_.', 'Upgrade is _optional_.'] },
            solution: ':%s/\\v\\*\\*(.{-})\\*\\*/_\\1_/g<CR>',
          },
          {
            prompt: 'Redact every quoted value on the login line.',
            setup: {
              name: 'audit.log',
              text: [
                'boot host="api-2"',
                'login user="lin" token="a1b2c3" ip="10.0.0.4"',
                'fetch path="/me" status="200"',
              ],
              cursor: { line: 1, col: 6 },
            },
            goal: { text: ['boot host="api-2"', 'login user="***" token="***" ip="***"', 'fetch path="/me" status="200"'] },
            solution: ':s/".\\{-}"/"***"/g<CR>',
          },
        ],
      },
    },
    {
      id: 'sub-last-search',
      title: 'Reuse the Last Search',
      chips: [':s//'],
      keyCards: [
        { key: ':s//', glyph: '/…/', label: 'last search', sub: 'empty pattern' },
        { key: '*', glyph: '→w', label: 'search word' },
      ],
      intro: (
        <>
          <p>
            Leave the pattern empty and <Code>:s</Code> uses the last search. Build the pattern with <Code>/</Code>{' '}
            first, watch what the highlight hits, then run <Code>:%s//new/g</Code>.
          </p>
          <p>
            With <Code>*</Code> it's the quickest rename there is: <Code>*</Code> on the word, then{' '}
            <Code>:%s//newName/g</Code>.
          </p>
        </>
      ),
      practice: total => (
        <p>
          Search (or reuse the search already set), then substitute with an empty pattern. {total} rounds.
        </p>
      ),
      aside: {
        title: 'Tweak it instead',
        body: (
          <p>
            <Code>C-r /</Code> on the command line pastes the last search pattern, for when you want to edit it rather
            than reuse it as is.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        base: {},
        rounds: [
          {
            prompt: 'The last search was /\\<tmp\\>. Replace every match with "buf".',
            setup: {
              name: 'copy.c',
              search: '\\<tmp\\>',
              text: ['char *tmp = malloc(len);', 'memcpy(tmp, src, len);', 'unlink(tmpfile);', 'free(tmp);'],
            },
            goal: { text: ['char *buf = malloc(len);', 'memcpy(buf, src, len);', 'unlink(tmpfile);', 'free(buf);'] },
            solution: ':%s//buf/g<CR>',
          },
          {
            prompt: 'Rename the variable under the cursor to "total".',
            setup: {
              name: 'report.py',
              text: ['sum = 0', 'for row in rows:', '    sum += row.amount', 'summary = f"{sum} across {len(rows)}"'],
              cursor: { line: 0, col: 0 },
            },
            goal: { text: ['total = 0', 'for row in rows:', '    total += row.amount', 'summary = f"{total} across {len(rows)}"'] },
            solution: '*:%s//total/g<CR>',
          },
          {
            prompt: 'Search for the durations like 250ms, then wrap each in backticks.',
            setup: {
              name: 'perf.md',
              text: ['## Performance', '', 'Cold start dropped from 900ms to 250ms.', 'The p99 is still 1200ms.'],
              cursor: { line: 3, col: 0 },
            },
            goal: {
              text: ['## Performance', '', 'Cold start dropped from `900ms` to `250ms`.', 'The p99 is still `1200ms`.'],
            },
            solution: '/\\d\\+ms<CR>:%s//`&`/g<CR>',
          },
          {
            prompt: 'The last search was /colou\\?r. Fix this line only.',
            setup: {
              name: 'style.md',
              search: 'colou\\?r',
              text: [
                'Headings use the accent colour.',
                'Body text uses the base colour, links the accent colour.',
                'Borders use a lighter colour.',
              ],
              cursor: { line: 1, col: 10 },
            },
            goal: {
              text: [
                'Headings use the accent colour.',
                'Body text uses the base color, links the accent color.',
                'Borders use a lighter colour.',
              ],
            },
            solution: ':s//color/g<CR>',
          },
        ],
      },
    },
    {
      id: 'sub-repeat',
      title: 'Repeat Substitute',
      chips: ['&', 'g&'],
      keyCards: [
        { key: '&', glyph: '↻', label: 'repeat on this line', sub: ':&&' },
        { key: 'g&', glyph: '↻%', label: 'repeat on every line', sub: ':%s//~/&' },
      ],
      intro: (
        <>
          <p>
            In normal mode, <Code>&</Code> reruns the last <Code>:s</Code> on the current line with the same flags.{' '}
            <Code>g&</Code> reruns it on every line of the file.
          </p>
          <p>
            Try a substitute on one line, check the result, then <Code>g&</Code> to apply it everywhere. Or step
            through with <Code>n&</Code> and choose the lines yourself.
          </p>
        </>
      ),
      practice: total => (
        <p>
          A substitute has already run on the cursor's line. Repeat it where the goal needs it. {total} rounds.
        </p>
      ),
      aside: {
        title: 'Vim drops the flags',
        body: (
          <p>
            In classic Vim, <Code>&</Code> is <Code>:s</Code> and forgets the flags, so a <Code>/g</Code> substitute
            only replaces the first match. Neovim maps <Code>&</Code> to <Code>:&&</Code>, which keeps them.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        base: {},
        rounds: [
          {
            prompt: `Line 1 went through :s/"/'/g. Do the same to the whole file.`,
            setup: {
              name: 'App.jsx',
              text: ["import React from 'react';", 'import { Button } from "./ui";', 'import styles from "./App.css";'],
              init: vim => {
                vim.lastSub = { pattern: '"', replacement: "'", flags: 'g' };
                vim.search = { pattern: '"', dir: 1, offset: '' };
              },
            },
            goal: { text: ["import React from 'react';", "import { Button } from './ui';", "import styles from './App.css';"] },
            solution: 'g&',
          },
          {
            prompt: 'Line 1 went through :s/;/,/g. Repeat it on line 3 only.',
            setup: {
              name: 'export.csv',
              text: ['id,name,plan', '7;Ada;pro', 'id;name;plan', '9;Grace;free'],
              cursor: { line: 0, col: 0 },
              init: vim => {
                vim.lastSub = { pattern: ';', replacement: ',', flags: 'g' };
                vim.search = { pattern: ';', dir: 1, offset: '' };
              },
            },
            goal: { text: ['id,name,plan', '7;Ada;pro', 'id,name,plan', '9;Grace;free'] },
            solution: 'jj&',
          },
          {
            prompt: 'Line 1 went through :s/\\s\\+$//. Repeat it on the next two matches only.',
            setup: {
              name: 'poem.md',
              text: ['Roses are red,', 'violets are blue,  ', 'sugar is sweet,  ', 'and so are you.  '],
              cursor: { line: 0, col: 0 },
              init: vim => {
                vim.lastSub = { pattern: '\\s\\+$', replacement: '', flags: '' };
                vim.search = { pattern: '\\s\\+$', dir: 1, offset: '' };
              },
            },
            goal: { text: ['Roses are red,', 'violets are blue,', 'sugar is sweet,', 'and so are you.  '] },
            solution: 'n&n&',
          },
          {
            prompt: 'Line 1 went through :s/px/rem/g. Repeat it on the last line.',
            setup: {
              name: 'spacing.css',
              text: ['.a { margin: 1rem 2rem; }', '.b { margin: 1px; }', '.c { padding: 1px 2px; }'],
              cursor: { line: 0, col: 0 },
              init: vim => {
                vim.lastSub = { pattern: 'px', replacement: 'rem', flags: 'g' };
                vim.search = { pattern: 'px', dir: 1, offset: '' };
              },
            },
            goal: { text: ['.a { margin: 1rem 2rem; }', '.b { margin: 1px; }', '.c { padding: 1rem 2rem; }'] },
            solution: 'G&',
          },
        ],
      },
    },
    {
      id: 'sub-expressions',
      title: 'Expressions',
      chips: ['\\='],
      keyCards: [
        { key: '\\=', glyph: 'f(x)', label: 'expression', sub: 'the rest is Vim script' },
        { key: 'submatch(0)', glyph: '[…]', label: 'the match', sub: 'submatch(1) is \\1' },
      ],
      intro: (
        <>
          <p>
            When the replacement starts with <Code>\=</Code>, the rest is a Vim script expression, evaluated for every
            match. <Code>submatch(0)</Code> is the whole match and <Code>submatch(1)</Code> the first group.
          </p>
          <p>
            That covers what plain text can't: arithmetic, padding with <Code>printf()</Code>, numbering with{' '}
            <Code>line('.')</Code>.
          </p>
          <BeforeAfter
            lines={['width: 12', 'height: 30']}
            cursor={[0, 0]}
            keys={':%s/\\d\\+/\\=submatch(0)*4/<CR>'}
            caption="Each number is multiplied by 4."
          />
        </>
      ),
      practice: total => (
        <p>
          Compute each replacement with <Code>\=</Code>. {total} rounds.
        </p>
      ),
      aside: {
        title: 'Numbers from strings',
        body: (
          <p>
            <Code>submatch(0)</Code> is a string; arithmetic turns it into a whole number. For decimals, wrap it in{' '}
            <Code>str2float()</Code> first.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        base: {},
        rounds: [
          {
            prompt: 'Bump the patch version by one.',
            setup: {
              name: 'package.json',
              text: ['{', '  "name": "vimchi",', '  "version": "2.4.7"', '}'],
              cursor: { line: 2, col: 0 },
            },
            goal: { text: ['{', '  "name": "vimchi",', '  "version": "2.4.8"', '}'] },
            solution: ':s/\\d\\+\\ze"/\\=submatch(0)+1/<CR>',
          },
          {
            prompt: 'Double the recipe.',
            setup: {
              name: 'bread.md',
              text: ['- 500 g flour', '- 350 ml water', '- 10 g salt', '- 4 g yeast'],
            },
            goal: { text: ['- 1000 g flour', '- 700 ml water', '- 20 g salt', '- 8 g yeast'] },
            solution: ':%s/\\d\\+/\\=submatch(0)*2/<CR>',
          },
          {
            prompt: 'Renumber the steps to match their line numbers.',
            setup: {
              name: 'steps.md',
              text: ['1. Clone the repo', '2. Install Node', '4. Run npm install', '5. Run npm test'],
            },
            goal: { text: ['1. Clone the repo', '2. Install Node', '3. Run npm install', '4. Run npm test'] },
            solution: ":%s/^\\d\\+/\\=line('.')/<CR>",
          },
          {
            prompt: 'Pad the track numbers to two digits.',
            setup: {
              name: 'playlist.m3u',
              text: ['track-1-intro.mp3', 'track-2-theme.mp3', 'track-10-outro.mp3'],
            },
            goal: { text: ['track-01-intro.mp3', 'track-02-theme.mp3', 'track-10-outro.mp3'] },
            solution: ":%s/\\d\\+/\\=printf('%02d', submatch(0))/<CR>",
          },
        ],
      },
    },
    {
      id: 'project-replace',
      title: 'Project Replace',
      chips: ['␣sr'],
      keyCards: [
        { key: '␣sr', glyph: '⇄', label: 'search & replace', sub: 'across files' },
        { key: 'CR', glyph: '⏎', label: 'apply' },
      ],
      intro: (
        <>
          <p>
            <Code>:%s</Code> changes one file. <Code>Space sr</Code> opens grug-far, which takes a search and a
            replacement and applies them to every file in the project, listing what changed. The word under
            the cursor is the default search, so renaming a symbol is: cursor on it, <Code>Space sr</Code>,
            type the new name, <Code>CR</Code>.
          </p>
          <p>
            It matches whole words, so <Code>id</Code> leaves <Code>identity</Code> alone. For a rename the
            language server understands, <Code>grn</Code> is safer still; for strings, comments and config,
            this is the tool.
          </p>
        </>
      ),
      practice: total => <p>Rename the word the prompt names everywhere in the project. {total} rounds.</p>,
      aside: {
        title: 'Before grug-far',
        body: <p><Code>:grep</Code>, then <Code>:cdo s/old/new/g | update</Code>, does the same by hand — the Quickfix lessons show it.</p>,
      },
      challenge: {
        kind: 'rounds',
        base: {
          files: {
            'src/cart.ts': 'export function total(items) {\n  let sum = 0;\n  return sum;\n}\n',
            'src/app.ts': "import { total } from './cart';\nconsole.log(total([]));\n",
            'README.md': '# shop\n\ntotal() adds up the cart.\n',
          },
          open: 'src/cart.ts', plugins: ['grugfar'],
        },
        rounds: [
          {
            prompt: 'Rename total to cartTotal everywhere.',
            setup: { cursor: { line: 0, col: 16 } },
            goal: { check: vim => closed(vim) && ['src/cart.ts', 'src/app.ts', 'README.md'].every(f => !/\btotal\b/.test(vim.fs.read(f) ?? 'total') && (vim.fs.read(f) ?? '').includes('cartTotal')) },
            solution: '<Space>srcartTotal<CR>q',
          },
          {
            prompt: 'Rename sum to subtotal (it appears only in cart.ts).',
            setup: { cursor: { line: 1, col: 6 } },
            goal: { check: vim => closed(vim) && (vim.fs.read('src/cart.ts') ?? '').includes('let subtotal = 0') && !(vim.fs.read('src/cart.ts') ?? '').includes(' sum') },
            solution: '<Space>srsubtotal<CR>q',
          },
          {
            prompt: 'From the README, rename shop to store everywhere.',
            setup: { open: 'README.md', cursor: { line: 0, col: 2 } },
            goal: { check: vim => closed(vim) && (vim.fs.read('README.md') ?? '').startsWith('# store') },
            solution: '<Space>srstore<CR>q',
          },
        ],
      },
    },
    {
      id: 'sub-boss',
      title: 'Rename & Reformat',
      boss: true,
      chips: [':%s'],
      keyCards: [{ key: ':%s', glyph: '×3', label: 'three commands' }],
      intro: (
        <>
          <p>
            An old script needs a cleanup: modern declarations, camelCase names, single-quoted strings. Each change is
            one <Code>:%s</Code> over the whole file.
          </p>
          <p>
            Use what this section taught: word boundaries, <Code>\v</Code>, groups, case changes and lazy matches.
            Three commands, no hand edits.
          </p>
        </>
      ),
      practice: total => (
        <p>
          One command per round; each round starts from the result of the last. {total} rounds.
        </p>
      ),
      aside: {
        title: 'Check before g&',
        body: (
          <p>
            On a real file, run the substitute on one line first, look at it, then <Code>g&</Code>. If it goes
            wrong, <Code>u</Code> undoes the whole substitute in one step.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        base: { name: 'retry.js' },
        rounds: [
          {
            prompt: '1/3: Replace every var with let. Leave "variant" alone.',
            setup: {
              text: [
                'var retry_count = 0;',
                'var max_retries = config.max_retries;',
                'var variant = "exponential";',
                'if (retry_count > max_retries) {',
                '  console.log("giving up after " + retry_count);',
                '}',
              ],
            },
            goal: {
              text: [
                'let retry_count = 0;',
                'let max_retries = config.max_retries;',
                'let variant = "exponential";',
                'if (retry_count > max_retries) {',
                '  console.log("giving up after " + retry_count);',
                '}',
              ],
            },
            solution: ':%s/\\<lt>var\\>/let/<CR>',
          },
          {
            prompt: '2/3: Convert every snake_case name to camelCase.',
            setup: {
              text: [
                'let retry_count = 0;',
                'let max_retries = config.max_retries;',
                'let variant = "exponential";',
                'if (retry_count > max_retries) {',
                '  console.log("giving up after " + retry_count);',
                '}',
              ],
            },
            goal: {
              text: [
                'let retryCount = 0;',
                'let maxRetries = config.maxRetries;',
                'let variant = "exponential";',
                'if (retryCount > maxRetries) {',
                '  console.log("giving up after " + retryCount);',
                '}',
              ],
            },
            solution: ':%s/\\v_(\\l)/\\u\\1/g<CR>',
          },
          {
            prompt: '3/3: Switch every double-quoted string to single quotes.',
            setup: {
              text: [
                'let retryCount = 0;',
                'let maxRetries = config.maxRetries;',
                'let variant = "exponential";',
                'if (retryCount > maxRetries) {',
                '  console.log("giving up after " + retryCount);',
                '}',
              ],
            },
            goal: {
              text: [
                'let retryCount = 0;',
                'let maxRetries = config.maxRetries;',
                "let variant = 'exponential';",
                'if (retryCount > maxRetries) {',
                "  console.log('giving up after ' + retryCount);",
                '}',
              ],
            },
            solution: ":%s/\\v\"(.{-})\"/'\\1'/g<CR>",
          },
        ],
      },
    },
  ],
};
