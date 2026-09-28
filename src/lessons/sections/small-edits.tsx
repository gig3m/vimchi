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
  ],
};
