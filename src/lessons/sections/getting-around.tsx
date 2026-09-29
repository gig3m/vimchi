import { Code, Mono } from '../../components/Code';
import { Motions, Words } from '../../components/diagrams';
import type { Section } from '../types';

export const gettingAround: Section = {
  id: 'getting-around',
  title: 'Getting Around',
  band: 'core',
  lessons: [
    {
      id: 'move',
      title: 'Four Keys to Move',
      chips: ['h', 'j', 'k', 'l'],
      narrowCards: true,
      keyCards: [
        { key: 'h', glyph: '←', label: 'left', sub: 'index' },
        { key: 'j', glyph: '↓', label: 'down', sub: 'index' },
        { key: 'k', glyph: '↑', label: 'up', sub: 'middle' },
        { key: 'l', glyph: '→', label: 'right', sub: 'ring' },
      ],
      intro: (
        <>
          <p>
            In normal mode every key is a command. The four keys under your right hand, <Code>h j k l</Code>, move the
            cursor one character at a time.
          </p>
          <p>
            Rest your index finger on <Code>j</Code>. It reaches <Code>h</Code> too, so your hand never leaves the home row.
          </p>
        </>
      ),
      practice: total => (
        <p>
          Move onto the <span className="hl-green">green box</span>. Clear {total} targets. Type a number before a motion
          to repeat it: <Code>4j</Code> moves down four lines.
        </p>
      ),
      aside: {
        title: 'Why hjkl?',
        body: (
          <p>
            They pull your right hand off the home row, and every trip there and back costs time. Arrow keys are turned off
            in these lessons.
          </p>
        ),
      },
      challenge: {
        kind: 'target',
        file: 'price.ts',
        pathKeys: 'hjkl',
        parPer: 1500,
        start: { line: 1, col: 0 },
        code: [
          '// Move the cursor onto the green box.',
          'function formatPrice(cents: number): string {',
          '  const dollars = Math.floor(cents / 100);',
          "  const rest = String(cents % 100).padStart(2, '0');",
          '  return `$${dollars}.${rest}`;',
          '}',
          '',
          'const total = formatPrice(order.subtotal + order.tax);',
          'console.log(total);',
        ],
      },
    },
    {
      id: 'words',
      title: 'Hopping by Word',
      chips: ['w', 'e', 'b'],
      keyCards: [
        { key: 'w', glyph: '→|', label: 'start of next word' },
        { key: 'e', glyph: '|→', label: 'end of word' },
        { key: 'b', glyph: '|←', label: 'back to word start' },
      ],
      intro: (
        <>
          <p>Crossing a line of code one character at a time is slow. Word motions jump by whole words.</p>
          <p>
            A word is a run of letters, digits and underscores, or a run of punctuation. <Code>res.json();</Code> is four
            words: <Mono>res</Mono>, <Mono>.</Mono>, <Mono>json</Mono> and <Mono>();</Mono>.
          </p>
        </>
      ),
      practice: total => (
        <p>
          The <span className="hl-green">green box</span> sits on the first or last character of a word. Reach it with{' '}
          <Code>w</Code>, <Code>e</Code> or <Code>b</Code> in as few keystrokes as you can. Clear {total} targets.
        </p>
      ),
      aside: {
        title: 'What counts as a word?',
        body: (
          <>
            <p>A run of letters, digits and underscores is one word. So is a run of punctuation. Spaces separate words but aren't part of them.</p>
            <Words text="snake_case test1234 res.json(); a-->b" />
            <p>
              Count before you move: <Code>3w</Code> jumps three words ahead. From the cursor below, each motion lands on the
              green box under its key.
            </p>
            <Motions text="const total = price * qty;" cursor={6} keys={['w', 'e', 'b', '3w']} />
          </>
        ),
      },
      challenge: {
        kind: 'word',
        file: 'api.ts',
        pathKeys: 'hjklweb',
        parPer: 2000,
        start: { line: 0, col: 0 },
        code: [
          'export async function fetchUser(id: string) {',
          '  const res = await fetch(`/api/users/${id}`);',
          "  if (!res.ok) throw new Error('user not found');",
          '  const { name, email, createdAt } = await res.json();',
          '  return { name, email, joined: new Date(createdAt) };',
          '}',
        ],
      },
    },
  ],
};
