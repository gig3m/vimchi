import { Code } from '../../components/Code';
import { BeforeAfter, Motions } from '../../components/diagrams';
import type { Section } from '../types';

export const nextSteps: Section = {
  id: 'next-steps',
  title: 'Next Steps',
  band: 'core',
  lessons: [
    {
      id: 'insert-mode',
      title: 'Insert Mode',
      chips: ['i', 'a', 'esc'],
      keyCards: [
        { key: 'i', glyph: '|x', label: 'insert before cursor' },
        { key: 'a', glyph: 'x|', label: 'append after cursor' },
        { key: 'esc', glyph: '⏎n', label: 'back to normal' },
      ],
      intro: (
        <>
          <p>
            Normal mode is for moving and changing text. To type new text, switch to insert mode. <Code>i</Code> starts
            typing before the cursor, <Code>a</Code> right after it.
          </p>
          <BeforeAfter lines={['greet(name;']} cursor={10} keys="i)<Esc>" caption={<><Code>i</Code> types before the cursor.</>} />
          <BeforeAfter lines={["return 'Hi';"]} cursor={9} keys="a!<Esc>" caption={<><Code>a</Code> types after it.</>} />
          <p>
            Press <Code>esc</Code> as soon as you finish typing. Coming back to normal mode straight away is the habit that
            makes everything else in Vim work.
          </p>
        </>
      ),
      practice: total => (
        <p>
          Green marks in the editor show the missing text. Move there, type it, then press{' '}
          <Code>esc</Code>. {total} rounds.
        </p>
      ),
      aside: {
        title: 'Esc is far away',
        body: (
          <p>
            Many people remap Caps Lock to Escape at the OS level. <Code>C-[</Code> also works as Escape everywhere in
            Vim, and the tutor accepts it too.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        base: { name: 'greet.ts' },
        rounds: [
          {
            prompt: 'Add the missing "l" in "Helo".',
            setup: {
              text: [
                'export function greet(name: string) {',
                "  console.log('Helo');",
                '  return name;',
                '}',
              ],
              cursor: { line: 0, col: 0 },
            },
            goal: {
              text: [
                'export function greet(name: string) {',
                "  console.log('Hello');",
                '  return name;',
                '}',
              ],
            },
            solution: 'j5wlal<Esc>',
          },
          {
            prompt: 'Add "const " before "name".',
            setup: {
              text: [
                'function welcome(user: User) {',
                '  name = user.firstName;',
                '  return `Welcome, ${name}`;',
                '}',
              ],
              cursor: { line: 2, col: 2 },
            },
            goal: {
              text: [
                'function welcome(user: User) {',
                '  const name = user.firstName;',
                '  return `Welcome, ${name}`;',
                '}',
              ],
            },
            solution: 'kiconst <Esc>',
          },
          {
            prompt: 'Add ")" after "greet(name".',
            setup: {
              text: ["const name = prompt('Your name?');", 'greet(name;', "console.log('done');"],
              cursor: { line: 0, col: 0 },
            },
            goal: { text: ["const name = prompt('Your name?');", 'greet(name);', "console.log('done');"] },
            solution: 'j3ea)<Esc>',
          },
          {
            prompt: 'Insert "!" after "Hi".',
            setup: {
              text: [
                'function hello(formal: boolean) {',
                "  if (formal) return 'Good day.';",
                "  return 'Hi';",
                '}',
              ],
              cursor: { line: 0, col: 0 },
            },
            goal: {
              text: [
                'function hello(formal: boolean) {',
                "  if (formal) return 'Good day.';",
                "  return 'Hi!';",
                '}',
              ],
            },
            solution: '2j3ea!<Esc>',
          },
          {
            prompt: 'Add a space after the comma in "[3,4]".',
            setup: {
              text: ['const origin = [0, 0];', 'const point = [3,4];', 'const dist = distance(origin, point);'],
              cursor: { line: 2, col: 5 },
            },
            goal: { text: ['const origin = [0, 0];', 'const point = [3, 4];', 'const dist = distance(origin, point);'] },
            solution: 'k5wa <Esc>',
          },
        ],
      },
    },
    {
      id: 'save-quit',
      title: 'Save & Quit',
      chips: [':w', ':q', ':wq', ':q!'],
      keyCards: [
        { key: ':w', glyph: '💾', label: 'write the file' },
        { key: ':q', glyph: '⏏', label: 'quit', sub: 'refuses unsaved changes' },
        { key: ':wq', glyph: '💾⏏', label: 'write and quit' },
        { key: ':q!', glyph: '⏏!', label: 'quit, discard changes' },
      ],
      intro: (
        <>
          <p>
            Every command that starts with <Code>:</Code> is typed on the line at the bottom and run with{' '}
            <Code>enter</Code>. <Code>:w</Code> writes the buffer to its file. <Code>:q</Code> quits, but only
            if there is nothing unsaved; it tells you so otherwise. <Code>:wq</Code> does both, and{' '}
            <Code>:q!</Code> quits throwing your changes away.
          </p>
          <p>
            Here quitting only prints a note and the tutor stays open, but the habit is the real one: write
            often, and reach for <Code>:q!</Code> only when you mean to lose the edits.
          </p>
        </>
      ),
      practice: total => <p>Each round has a file open with a change already made. Do what the prompt says. {total} rounds.</p>,
      aside: {
        title: 'ZZ and friends',
        body: (
          <p>
            <Code>ZZ</Code> in normal mode is <Code>:wq</Code> (it skips the write when nothing changed), and{' '}
            <Code>ZQ</Code> is <Code>:q!</Code>. With several files open, <Code>:wa</Code> writes them all and{' '}
            <Code>:qa</Code> quits them all.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        base: {
          files: { 'notes.md': '# Notes\n\n- buy milk\n- call Sam\n' },
          open: 'notes.md',
        },
        rounds: [
          {
            prompt: 'You added a line. Save the file.',
            setup: { init: vim => vim.buf.setLine(3, '- call Sam and Ana') },
            goal: { check: vim => vim.fs.read('notes.md') === '# Notes\n\n- buy milk\n- call Sam and Ana\n' && !vim.buf.modified },
            solution: ':w<CR>',
          },
          {
            prompt: 'Nothing changed. Quit.',
            goal: { check: vim => vim.events.includes('quit') },
            solution: ':q<CR>',
          },
          {
            prompt: 'You fixed the typo. Write the file and quit in one command.',
            setup: { init: vim => vim.buf.setLine(2, '- buy oat milk') },
            goal: { check: vim => vim.events.includes('quit') && vim.fs.read('notes.md') === '# Notes\n\n- buy oat milk\n- call Sam\n' },
            solution: ':wq<CR>',
          },
          {
            prompt: 'That edit was a mistake. Quit without saving it.',
            setup: { init: vim => vim.buf.setLine(0, '# Ntoes') },
            goal: { check: vim => vim.events.includes('quit') && vim.fs.read('notes.md') === '# Notes\n\n- buy milk\n- call Sam\n' },
            solution: ':q!<CR>',
          },
        ],
      },
    },
    {
      id: 'line-ends',
      title: 'Line Ends',
      chips: ['0', '$'],
      keyCards: [
        { key: '0', glyph: '|←', label: 'first column' },
        { key: '$', glyph: '→|', label: 'last character' },
      ],
      intro: (
        <>
          <p>
            <Code>0</Code> jumps to the very first column of the line. <Code>$</Code> jumps to the last character.
          </p>
          <p>
            They work from anywhere on the line, and only on the current line: to reach the end of another line, move
            there with <Code>j</Code> or <Code>k</Code> first.
          </p>
          <Motions text="  host: 'localhost'," cursor={9} keys={['0', '$']} />
        </>
      ),
      practice: total => (
        <p>
          Reach the <span className="hl-green">green box</span> at the start or end of a line. Some sit on another
          line, so combine with <Code>j</Code> and <Code>k</Code>. {total} rounds.
        </p>
      ),
      aside: {
        title: 'A count on $',
        body: (
          <p>
            <Code>3$</Code> goes to the end of the line two below. It's rarely worth it; <Code>jj$</Code> reads better.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        showGoal: false,
        base: {
          name: 'config.ts',
          text: [
            'export const config = {',
            "  host: 'localhost',",
            '  port: 8080,',
            '  retries: 3,',
            '  timeout: 500,',
            '  debug: false,',
            '};',
          ],
        },
        rounds: [
          { setup: { cursor: { line: 1, col: 4 } }, goal: { cursor: { line: 1, col: 19 } }, solution: '$' },
          { setup: { cursor: { line: 2, col: 5 } }, goal: { cursor: { line: 2, col: 0 } }, solution: '0' },
          { setup: { cursor: { line: 0, col: 3 } }, goal: { cursor: { line: 0, col: 22 } }, solution: '$' },
          { setup: { cursor: { line: 2, col: 12 } }, goal: { cursor: { line: 3, col: 0 } }, solution: 'j0' },
          { setup: { cursor: { line: 2, col: 0 } }, goal: { cursor: { line: 4, col: 14 } }, solution: 'jj$' },
          { setup: { cursor: { line: 4, col: 8 } }, goal: { cursor: { line: 2, col: 0 } }, solution: 'kk0' },
        ],
      },
    },
    {
      id: 'find-char',
      title: 'Find Character',
      chips: ['f', 't'],
      keyCards: [
        { key: 'f', glyph: '→x', label: 'onto next x' },
        { key: 't', glyph: '→|x', label: 'just before next x' },
      ],
      intro: (
        <>
          <p>
            <Code>f</Code> followed by a character jumps onto the next occurrence of that character on the line.{' '}
            <Code>t</Code> ("till") stops one character before it. Both search the current line only; if the character
            isn't there, the cursor stays put.
          </p>
          <Motions text="send(order, { retries: 3 });" cursor={0} keys={['f,', 't{', 'f)']} />
          <p>
            Aim for a character that's rare on the line, like a bracket or a comma, and you'll get there in two
            keystrokes.
          </p>
        </>
      ),
      practice: total => (
        <p>
          Reach each <span className="hl-green">green box</span> with <Code>f</Code> or <Code>t</Code>. When it's on
          another line, get there with <Code>j</Code> or <Code>k</Code> first. {total} rounds.
        </p>
      ),
      aside: {
        title: 'Why till?',
        body: (
          <p>
            On its own <Code>t</Code> looks pointless. It shines with operators: <Code>dt)</Code> deletes up to a closing
            parenthesis but keeps it.
          </p>
        ),
      },
      challenge: {
        kind: 'rounds',
        showGoal: false,
        base: {
          name: 'order.ts',
          text: [
            'const order = createOrder({ id: 42, items: [apple] });',
            'const total = order.items.reduce((sum, i) => sum + i, 0);',
            "if (total > limit) throw new Error('over limit');",
            'send(order, { retries: 3, timeout: 5_000 });',
          ],
          cursor: { line: 0, col: 0 },
        },
        rounds: [
          { goal: { cursor: { line: 0, col: 25 } }, solution: 'f(' },
          { goal: { cursor: { line: 1, col: 32 } }, solution: 'jf(' },
          { setup: { cursor: { line: 3, col: 0 } }, goal: { cursor: { line: 3, col: 11 } }, solution: 't{' },
          { setup: { cursor: { line: 1, col: 10 } }, goal: { cursor: { line: 2, col: 35 } }, solution: "jf'" },
          { setup: { cursor: { line: 0, col: 5 } }, goal: { cursor: { line: 2, col: 17 } }, solution: '2jf)' },
          { setup: { cursor: { line: 3, col: 20 } }, goal: { cursor: { line: 3, col: 41 } }, solution: 't)' },
        ],
      },
    },
    {
      id: 'change-words',
      title: 'Change Words',
      chips: ['c', 'w'],
      keyCards: [
        { key: 'c', glyph: '✎', label: 'change' },
        { key: 'w', glyph: '→|', label: 'to the word’s end' },
      ],
      intro: (
        <>
          <p>
            <Code>cw</Code> deletes from the cursor to the end of the word and drops you into insert mode, ready to type
            the replacement.
          </p>
          <p>
            It's your first operator: <Code>c</Code> means change, <Code>w</Code> says how far. Press <Code>esc</Code>{' '}
            when the new word is in.
          </p>
          <BeforeAfter lines={['const usr = await getUser(id);']} cursor={6} keys="cwuser<Esc>" />
        </>
      ),
      practice: total => (
        <p>
          Rename each identifier to match the goal. {total}{' '}
          rounds.
        </p>
      ),
      aside: {
        title: 'cw is really ce',
        body: (
          <p>
            <Code>cw</Code> stops at the end of the word, like <Code>ce</Code>, and leaves the space after it, so you
            can type the new word without re-adding the space. (Delete Words shows that <Code>dw</Code> takes the
            space too.)
          </p>
        ),
      },
      reps: { mutations: ['wrong-word-run'], count: [10, 15], sections: ['next-steps'] },
      challenge: {
        kind: 'rounds',
        base: { name: 'user.ts' },
        rounds: [
          {
            prompt: 'Rename "usr" to "user".',
            setup: {
              text: [
                'export async function loadProfile(id: string) {',
                '  const usr = await getUser(id);',
                '  return user.profile;',
                '}',
              ],
              cursor: { line: 1, col: 8 },
            },
            goal: {
              text: [
                'export async function loadProfile(id: string) {',
                '  const user = await getUser(id);',
                '  return user.profile;',
                '}',
              ],
            },
            solution: 'cwuser<Esc>',
          },
          {
            prompt: 'Change "let" to "const".',
            setup: {
              text: [
                'function lineTotal(price: number, qty: number) {',
                '  let total = price * qty;',
                '  return Math.round(total * 100) / 100;',
                '}',
              ],
              cursor: { line: 0, col: 0 },
            },
            goal: {
              text: [
                'function lineTotal(price: number, qty: number) {',
                '  const total = price * qty;',
                '  return Math.round(total * 100) / 100;',
                '}',
              ],
            },
            solution: 'jwcwconst<Esc>',
          },
          {
            prompt: 'Replace "red" with "green".',
            setup: {
              text: [
                "const button = document.querySelector('#save');",
                "button.style.color = 'red';",
                'button.disabled = false;',
              ],
              cursor: { line: 2, col: 0 },
            },
            goal: {
              text: [
                "const button = document.querySelector('#save');",
                "button.style.color = 'green';",
                'button.disabled = false;',
              ],
            },
            solution: "kf'lcwgreen<Esc>",
          },
          {
            prompt: 'Rename "fetchData" to "load".',
            setup: {
              text: ['async function refresh() {', '  const orders = fetchData();', '  render(orders);', '}'],
              cursor: { line: 1, col: 2 },
            },
            goal: { text: ['async function refresh() {', '  const orders = load();', '  render(orders);', '}'] },
            solution: '3wcwload<Esc>',
          },
          {
            prompt: 'Change "false" to "true".',
            setup: {
              text: ['function guard(enabled: boolean) {', '  if (enabled === false) return;', '  start();', '}'],
              cursor: { line: 2, col: 2 },
            },
            goal: { text: ['function guard(enabled: boolean) {', '  if (enabled === true) return;', '  start();', '}'] },
            solution: 'k2ffcwtrue<Esc>',
          },
        ],
      },
    },
  ],
};
