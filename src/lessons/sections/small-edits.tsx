import { Code, Mono } from '../../components/Code';
import { BeforeAfter } from '../../components/diagrams';
import type { Vim } from '../../vim/editor';
import { HELP_FILES, helpTags } from '../../vim/help';
import { pos } from '../../vim/types';
import type { Section } from '../types';

const SERVER = [
  "import express from 'express';",
  "import { orders } from './routes/orders';",
  '',
  'const app = express();',
  'app.use(express.json());',
  "app.use('/orders', orders);",
  '',
  'app.get(\'/health\', (_req, res) => {',
  "  res.json({ ok: true });",
  '});',
  '',
  'app.listen(3000);',
];

/** Where a help tag sits, or (with `link`) the first |link| at or after it on its page. */
function spot(tag: string, link?: string) {
  const t = helpTags().get(tag);
  if (!t) throw new Error(`no help tag ${tag}`);
  if (!link) return t;
  const lines = HELP_FILES[t.file];
  for (let l = t.pos.line; l < lines.length; l++) {
    const c = lines[l].indexOf(`|${link}|`);
    if (c >= 0) return { file: t.file, pos: pos(l, c) };
  }
  throw new Error(`no |${link}| after *${tag}*`);
}
/** The help window shows `tag`'s page with the cursor on the tag (or on its |link|). */
const helpGoal = (tag: string, link?: string) => {
  const s = spot(tag, link);
  return { buffer: s.file, cursor: s.pos };
};
/** Open help on `tag`, then put the cursor at the start of the line holding |link|. */
const toLink = (vim: Vim, tag: string, link: string) => vim.setCursor(pos(spot(tag, link).pos.line, 0));
const openAt = (vim: Vim, tag: string, link: string) => {
  vim.feedKeys(`:h ${tag}<CR>`);
  toLink(vim, tag, link);
};
/** Open help on `tag` with the cursor on its |link| itself. */
const onLink = (vim: Vim, tag: string, link: string) => {
  if (!vim.buf.data.help) vim.feedKeys(`:h ${tag}<CR>`);
  vim.setCursor(spot(tag, link).pos);
};

export const smallEdits: Section = {
  id: 'small-edits',
  title: 'Small Edits',
  band: 'core',
  lessons: [
    {
      id: 'x',
      title: 'Deleting Characters',
      chips: ['x', 'u'],
      keyCards: [
        { key: 'x', glyph: 'del', glyphColor: 'var(--red)', label: 'delete character' },
        { key: 'u', glyph: '↺', label: 'undo' },
      ],
      intro: (
        <>
          <p>
            <Code>x</Code> deletes the character under the cursor. It's the quickest fix for a stray keystroke.
          </p>
          <BeforeAfter lines={['  retturn sum;']} cursor={5} keys="x" />
          <p>
            Deleted the wrong one? <Code>u</Code> undoes the last change.
          </p>
        </>
      ),
      practice: total => (
        <p>
          This function has {total} typos, marked in <span className="hl-red">red</span>. Move to each one and delete it
          with <Code>x</Code>. Word motions from the last lesson still work.
        </p>
      ),
      aside: {
        title: 'Deleting several at once',
        body: (
          <p>
            <Code>3x</Code> deletes three characters, starting at the cursor.
          </p>
        ),
      },
      challenge: {
        kind: 'fix',
        file: 'average.js',
        pathKeys: 'hjklweb',
        parPer: 2600,
        start: { line: 0, col: 0 },
        code: [
          'function averagge(values) {',
          '  if (values.lengthh === 0) return 0;',
          '  const sum = values.reducce((a, b) => a + b, 0);;',
          '  retturn sum / values.length;',
          '}',
          '',
          'const scores = [92, 78,, 85];',
          'console.log(average(scores)));',
        ],
        correct: [
          'function average(values) {',
          '  if (values.length === 0) return 0;',
          '  const sum = values.reduce((a, b) => a + b, 0);',
          '  return sum / values.length;',
          '}',
          '',
          'const scores = [92, 78, 85];',
          'console.log(average(scores));',
        ],
      },
    },
    {
      id: 'r',
      title: 'Replacing Characters',
      chips: ['r'],
      keyCards: [
        { key: 'r', glyph: 'e→a', glyphColor: 'var(--orange)', label: 'replace character' },
        { key: 'u', glyph: '↺', label: 'undo' },
      ],
      intro: (
        <>
          <p>
            <Code>r</Code> followed by any character replaces the one under the cursor. You stay in normal mode the whole
            time.
          </p>
          <p>It's the fastest way to fix a misspelled name, as long as the fix is one letter.</p>
          <BeforeAfter lines={['this.itens = [];']} cursor={8} keys="rm" />
        </>
      ),
      practice: () => (
        <p>
          Some names in this class are misspelled. Each <span className="hl-orange">orange</span> character has its correct
          letter tagged above it. Move there, press <Code>r</Code>, then type the letter.
        </p>
      ),
      aside: {
        title: 'One character at a time',
        body: (
          <p>
            <Code>r</Code> changes exactly one character. Renaming a whole identifier is a job for <Code>cw</Code>, covered
            in Change Words.
          </p>
        ),
      },
      challenge: {
        kind: 'replace',
        file: 'cart.js',
        pathKeys: 'hjklweb',
        parPer: 2800,
        start: { line: 0, col: 0 },
        code: [
          'class ShoppingCard {',
          '  constructor(owner) {',
          '    this.owner = ownar;',
          '    this.itens = [];',
          '  }',
          '',
          '  addItem(item, qtx) {',
          '    this.items.push({ ...item, qty });',
          '    return this.items.lenght;',
          '  }',
          '}',
        ],
        correct: [
          'class ShoppingCart {',
          '  constructor(owner) {',
          '    this.owner = owner;',
          '    this.items = [];',
          '  }',
          '',
          '  addItem(item, qty) {',
          '    this.items.push({ ...item, qty });',
          '    return this.items.length;',
          '  }',
          '}',
        ],
      },
    },
    {
      id: 'undo-redo',
      title: 'Undo & Redo',
      chips: ['u', 'C-r'],
      keyCards: [
        { key: 'u', glyph: '↺', label: 'undo' },
        { key: 'C-r', glyph: '↻', label: 'redo' },
      ],
      intro: (
        <>
          <p>
            <Code>u</Code> undoes the last change. <Code>C-r</Code> redoes what you just undid. Both take a count:{' '}
            <Code>3u</Code> undoes three changes.
          </p>
          <p>
            A change is one command, however much text it touches. A whole line typed in one visit to insert mode
            (next section) is one change too, so it goes with a single <Code>u</Code>.
          </p>
        </>
      ),
      practice: total => (
        <p>
          Someone has been editing these files. Undo and redo until the buffer matches the goal. {total} rounds.
        </p>
      ),
      aside: {
        title: 'Undo is a tree',
        body: (
          <p>
            Undo, then make a new change, and the undone branch isn't lost. <Code>g-</Code> and <Code>g+</Code> walk
            through every state the buffer has been in, in time order.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        base: { name: 'cart.ts' },
        rounds: [
          {
            prompt: 'The return line was deleted by mistake. Bring it back.',
            setup: {
              text: [
                'export function total(items: Item[]) {',
                '  const sum = items.reduce((a, i) => a + i.price, 0);',
                '  return sum;',
                '}',
              ],
              cursor: { line: 2, col: 0 },
              init: vim => vim.feedKeys('dd'),
            },
            goal: {
              text: [
                'export function total(items: Item[]) {',
                '  const sum = items.reduce((a, i) => a + i.price, 0);',
                '  return sum;',
                '}',
              ],
            },
            solution: 'u',
          },
          {
            prompt: 'Undo the whole line that was typed in.',
            setup: {
              name: 'init.lua',
              text: ['vim.opt.number = true', 'vim.opt.wrap = false', 'vim.opt.tabstop = 2'],
              cursor: { line: 0, col: 0 },
              init: vim => vim.feedKeys('ovim.opt.mouse = ""<Esc>'),
            },
            goal: { text: ['vim.opt.number = true', 'vim.opt.wrap = false', 'vim.opt.tabstop = 2'] },
            solution: 'u',
          },
          {
            prompt: 'Undo both renames.',
            setup: {
              text: [
                'function lineTotal(price: number, quantity: number) {',
                '  const total = price * quantity;',
                '  return total;',
                '}',
              ],
              cursor: { line: 1, col: 2 },
              init: vim => vim.feedKeys('wcwsum<Esc>4wcwqty<Esc>'),
            },
            goal: {
              text: [
                'function lineTotal(price: number, quantity: number) {',
                '  const total = price * quantity;',
                '  return total;',
                '}',
              ],
            },
            solution: 'uu',
          },
          {
            prompt: 'You undid one step too many. Redo it.',
            setup: {
              name: 'README.md',
              text: ['# vimchi', 'A Vim tutor.', '', '## Install'],
              cursor: { line: 1, col: 0 },
              init: vim => vim.feedKeys('A It runs in the browser.<Esc>oMIT licensed.<Esc>uu'),
            },
            goal: { text: ['# vimchi', 'A Vim tutor. It runs in the browser.', '', '## Install'] },
            solution: '<C-r>',
          },
          {
            prompt: 'Undo all three edits, then redo only the first.',
            setup: {
              name: 'routes.ts',
              text: [
                "app.get('/users', listUsers);",
                "app.get('/users/:id', getUser);",
                "app.post('/users', createUser);",
                "app.delete('/users/:id', removeUser);",
              ],
              cursor: { line: 0, col: 0 },
              init: vim => vim.feedKeys("f/aapi/<Esc>jdd0x"),
            },
            goal: {
              text: [
                "app.get('/api/users', listUsers);",
                "app.get('/users/:id', getUser);",
                "app.post('/users', createUser);",
                "app.delete('/users/:id', removeUser);",
              ],
            },
            solution: '3u<C-r>',
          },
        ],
      },
    },
    {
      id: 'undo-in-time',
      title: 'Undo in Time',
      chips: ['g-', 'g+'],
      keyCards: [
        { key: 'g-', glyph: '◷↺', label: 'older state' },
        { key: 'g+', glyph: '◷↻', label: 'newer state' },
      ],
      intro: (
        <>
          <p>
            Undo, then make a new change, and <Code>u</Code> and <Code>C-r</Code> can no longer reach what you
            undid: it sits on a branch of the undo tree. <Code>g-</Code> steps back through every state the buffer
            has been in, in time order, branches included. <Code>g+</Code> steps forward. Both take a count.
          </p>
          <BeforeAfter
            lines={['const port = 3000;']}
            cursor={[0, 13]}
            keys="ciw8080<Esc>uciw3001<Esc>g-"
            caption={<>Here <Code>u</Code> would give back 3000; <Code>g-</Code> goes to the state before 3001, which was 8080.</>}
          />
          <p>
            Use it when you undid something, typed on, and then wanted the undone version after all.
          </p>
        </>
      ),
      practice: total => (
        <p>
          Each file has a history: edits, undos, and new edits on top. Step through time until the buffer matches
          the goal. {total} rounds.
        </p>
      ),
      aside: {
        title: 'By count or by clock',
        body: (
          <p>
            <Code>:earlier 3</Code> is <Code>3g-</Code> and <Code>:later 3</Code> is <Code>3g+</Code>. In Neovim
            they also take time: <Code>:earlier 10m</Code> puts the buffer back as it was ten minutes ago, and{' '}
            <Code>:earlier 1f</Code> as it was at the last write.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        base: { name: 'config.ts' },
        rounds: [
          {
            prompt: 'The port went to 8080, back to 3000, then 3001. Bring back 8080.',
            setup: {
              text: ['export const config = {', "  host: 'localhost',", '  port: 3000,', '  debug: false,', '};'],
              cursor: { line: 2, col: 8 },
              init: vim => vim.feedKeys('ciw8080<Esc>uciw3001<Esc>'),
            },
            goal: { text: ['export const config = {', "  host: 'localhost',", '  port: 8080,', '  debug: false,', '};'] },
            solution: 'g-',
          },
          {
            prompt: 'Go back to the version where only tabstop was changed.',
            setup: {
              name: 'init.lua',
              text: ['vim.opt.number = true', 'vim.opt.tabstop = 8', 'vim.opt.wrap = true'],
              cursor: { line: 0, col: 0 },
              init: vim => vim.feedKeys('jf8r2jf=wcwfalse<Esc>uuggA -- ui<Esc>'),
            },
            goal: { text: ['vim.opt.number = true', 'vim.opt.tabstop = 2', 'vim.opt.wrap = true'] },
            solution: '2g-',
          },
          {
            prompt: 'You stepped back too far. Step forward to the /api/users version.',
            setup: {
              name: 'routes.ts',
              text: ["app.get('/users', listUsers);", "app.post('/users', createUser);", "app.delete('/users/:id', removeUser);"],
              cursor: { line: 0, col: 0 },
              init: vim => vim.feedKeys('f/aapi/<Esc>ujddg-g-'),
            },
            goal: { text: ["app.get('/api/users', listUsers);", "app.post('/users', createUser);", "app.delete('/users/:id', removeUser);"] },
            solution: 'g+',
          },
          {
            prompt: 'Bring back the version where "update docs" was deleted.',
            setup: {
              name: 'TODO.md',
              text: ['## Release', '- [ ] write tests', '- [ ] update docs', '- [ ] bump version', '- [ ] publish'],
              cursor: { line: 1, col: 0 },
              init: vim => vim.feedKeys('jddukA!<Esc>uGdd'),
            },
            goal: { text: ['## Release', '- [ ] write tests', '- [ ] bump version', '- [ ] publish'] },
            solution: '2g-',
          },
          {
            prompt: 'Step forward to the newest version, the one without the npm line.',
            setup: {
              name: 'README.md',
              text: ['# jobq', '', 'A tiny job queue for Node.', 'Install it with npm.', 'MIT licensed.'],
              cursor: { line: 2, col: 0 },
              init: vim => vim.feedKeys('A Zero deps.<Esc>ujdd3g-'),
            },
            goal: { text: ['# jobq', '', 'A tiny job queue for Node.', 'MIT licensed.'] },
            solution: '2g+',
          },
          {
            prompt: 'C-r would redo the deleted line. Bring back the 1.2 version.',
            setup: {
              name: 'cart.ts',
              text: [
                'export function total(items: Item[]) {',
                '  const sum = items.reduce((a, i) => a + i.price, 0);',
                '  return sum;',
                '}',
              ],
              cursor: { line: 2, col: 2 },
              init: vim => vim.feedKeys('wcwsum * 1.2<Esc>ukddu'),
            },
            goal: {
              text: [
                'export function total(items: Item[]) {',
                '  const sum = items.reduce((a, i) => a + i.price, 0);',
                '  return sum * 1.2;',
                '}',
              ],
            },
            solution: 'g+',
          },
        ],
      },
    },
    {
      id: 'getting-help',
      title: 'Getting Help',
      chips: [':h', 'C-]', 'C-o'],
      keyCards: [
        { key: ':h', glyph: '?', label: 'open help', sub: ':h {subject}' },
        { key: 'C-]', glyph: '→*', label: 'follow link' },
        { key: 'C-o', glyph: '↩', label: 'jump back' },
      ],
      intro: (
        <>
          <p>
            <Code>:h x</Code> opens Neovim's manual at the entry for <Code>x</Code>, in a window above your file.
            Name a key the way the manual writes it: <Code>:h dd</Code>, <Code>:h CTRL-E</Code> for{' '}
            <Code>C-e</Code>, <Code>:h 'wrap'</Code> for an option.
          </p>
          <p>
            Words between bars, like <Mono>|linewise|</Mono>, are links. Put the cursor on one and press{' '}
            <Code>C-]</Code> to jump to it. <Code>C-o</Code> jumps back, one link at a time. <Code>:q</Code> closes
            the help window.
          </p>
        </>
      ),
      practice: total => (
        <p>
          The tutor carries a few pages of the manual. Open them, follow their links and come back. {total} rounds.
        </p>
      ),
      aside: {
        title: 'Search help by name',
        body: (
          <p>
            Both kickstart and LazyVim map <Code>␣sh</Code> to a picker over every help tag: type part of a name,
            then <Code>enter</Code>. It is the quickest way in when you don't know the exact tag.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        showGoal: false,
        base: { name: 'server.ts', text: SERVER },
        rounds: [
          {
            prompt: 'Open the help for x, the key that deletes a character.',
            setup: { cursor: { line: 5, col: 0 } },
            goal: helpGoal('x'),
            solution: ':h x<CR>',
          },
          {
            prompt: 'Look up dd.',
            setup: { cursor: { line: 1, col: 4 } },
            goal: helpGoal('dd'),
            solution: ':h dd<CR>',
          },
          {
            prompt: 'Follow the |linewise| link on this line.',
            setup: { cursor: { line: 0, col: 0 }, init: vim => openAt(vim, 'dd', 'linewise') },
            goal: helpGoal('linewise'),
            solution: '<C-]>',
          },
          {
            prompt: 'Jump back to the |linewise| link you came from.',
            setup: { cursor: { line: 0, col: 0 }, init: vim => (onLink(vim, 'dd', 'linewise'), vim.feedKeys('<C-]>')) },
            goal: helpGoal('dd', 'linewise'),
            solution: '<C-o>',
          },
          {
            prompt: 'Follow the |scroll.txt| link to the scrolling page.',
            setup: { cursor: { line: 0, col: 0 }, init: vim => openAt(vim, 'help.txt', 'scroll.txt') },
            goal: helpGoal('scroll.txt'),
            solution: '<C-]>',
          },
          {
            prompt: 'You followed |scroll.txt|, then |zz|. Go back to the main page.',
            setup: { cursor: { line: 0, col: 0 }, init: vim => {
                openAt(vim, 'help.txt', 'scroll.txt');
                vim.feedKeys('<C-]>');
                onLink(vim, 'scroll.txt', 'zz');
                vim.feedKeys('<C-]>');
              },
            },
            goal: helpGoal('help.txt', 'scroll.txt'),
            solution: '2<C-o>',
          },
          {
            prompt: 'Look up CTRL-Y, the key that scrolls up a line.',
            setup: { cursor: { line: 11, col: 0 } },
            goal: helpGoal('CTRL-Y'),
            solution: ':h CTRL-Y<CR>',
          },
        ],
      },
    },
  ],
};
