import { Code } from '../../components/Code';
import { BeforeAfter } from '../../components/diagrams';
import type { Section } from '../types';

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
  ],
};
