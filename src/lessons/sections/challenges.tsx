// Challenges: combined-skill edits on a generated file. Not counted toward completion.
import { CHALLENGES } from '../../challenges';
import { Code } from '../../components/Code';
import type { Lesson, Section } from '../types';

const intros: Record<string, { intro: Lesson['intro']; aside: Lesson['aside'] }> = {
  'challenge-fix-the-file': {
    intro: (
      <>
        <p>
          Everything from the first five sections, together. A real file with a dozen small mistakes: typos,
          a wrong digit, an identifier with one letter off. The list above the editor (beside it in full screen) says what each one
          is; you decide how to get there and which key fixes it.
        </p>
        <p>
          Work top to bottom, or by whatever is closest. <Code>f</Code> and <Code>/</Code> beat counting
          columns; <Code>r</Code> beats <Code>x</Code> + <Code>i</Code> for a one-character swap.
        </p>
      </>
    ),
    aside: {
      title: 'Every run is new',
      body: <p>The file and its mistakes are generated from a seed. Replay a seed to race yourself, or take a new file.</p>,
    },
  },
  'challenge-operators': {
    intro: (
      <>
        <p>
          Adds operators to the mix: stray lines and words to delete, wrong words to change, a line that is
          missing its near-twin. <Code>dd</Code>, <Code>dw</Code>, <Code>cw</Code> and <Code>yyp</Code> do the
          heavy lifting; <Code>.</Code> repeats the last one.
        </p>
        <p>
          The checklist tells you what changed. Read the item, jump there, pick the operator that does it
          in one go.
        </p>
      </>
    ),
    aside: {
      title: 'Clean means clean',
      body: <p>Stray edits outside the list count against Clean even if you <Code>u</Code> them. Every key, including <Code>u</Code>, counts toward Accuracy.</p>,
    },
  },
  'challenge-objects-visual': {
    intro: (
      <>
        <p>
          The rest of the Core band: a wrong string or argument list (<Code>ci"</Code>, <Code>ci(</Code>), a
          stray word or leftover paragraph (<Code>daw</Code>, <Code>dap</Code>), a block a level off
          (<Code>&gt;ip</Code>, <Code>&lt;ip</Code>), lines out of order (<Code>ddp</Code>, <Code>djp</Code>) and
          a run of commented-out lines, which a block selection clears in one go: <Code>C-v</Code>, across the
          comment, down the run, <Code>d</Code>.
        </p>
        <p>
          Aim the object, not the cursor: anywhere inside the quotes or the paragraph will do, so stop the
          motion as soon as you are in. A visual selection is worth its extra key when the shape is a column.
        </p>
      </>
    ),
    aside: {
      title: 'Objects beat counts',
      body: <p><Code>ci"</Code> works from any column inside the string; <Code>c5l</Code> needs you to count and breaks when the string changes length.</p>,
    },
  },
  'challenge-registers-macros': {
    intro: (
      <>
        <p>
          Edits that move text or say the same thing many times: letters or words the wrong way round
          (<Code>xp</Code>, <Code>dwwP</Code>), lines swapped or moved (<Code>ddp</Code>, <Code>djp</Code>), a missing
          near-copy of a line (<Code>yyp</Code> then <Code>cw</Code>), and runs of lines that all need the same
          two-part fix.
        </p>
        <p>
          For a run, record the fix once on the first line and end it on the next one (<Code>qa</Code> …
          <Code>+</Code> <Code>q</Code>, where <Code>+</Code> moves to the first character of the next line), then <Code>2@a</Code> or <Code>3@a</Code> for the rest. When the fix is a
          single change, <Code>.</Code> is cheaper than a macro; register <Code>a</Code> keeps the macro for the next
          run of the same fix.
        </p>
      </>
    ),
    aside: {
      title: 'Where the put lands',
      body: <p><Code>p</Code> puts a deleted line below the cursor, <Code>P</Code> above it. Delete first, then stand on the line the text belongs after.</p>,
    },
  },
  'challenge-rename-replace': {
    intro: (
      <>
        <p>
          A long file and edits that repeat across it: a name misspelt on every use in a stretch
          (<Code>*</Code> then <Code>cgn</Code> and <Code>.</Code>, or <Code>:%s/old/new/g</Code>), the same
          debugging line left in five places (<Code>:g/pattern/d</Code>), and trailing comments with a different
          word on each line (<Code>:%s/\v …$//</Code>).
        </p>
        <p>
          A command works from anywhere, so it saves the walk; <Code>cgn</Code> saves typing a pattern when there
          are only a few. Count the places and the characters, pick the cheaper one. Keep patterns short: a word
          that appears nowhere else is enough.
        </p>
      </>
    ),
    aside: {
      title: 'Check the matches first',
      body: <p>Search for the pattern with <Code>/</Code> before you run <Code>:g</Code> or <Code>:%s</Code>: every highlight is a line the command will touch.</p>,
    },
  },
};

export const challenges: Section = {
  id: 'challenges',
  title: 'Challenges',
  band: 'challenges',
  lessons: CHALLENGES.map(c => ({
    id: c.id,
    title: c.title,
    chips: c.chips,
    keyCards: [],
    boss: true,
    intro: intros[c.id].intro,
    practice: () => <p>Every fix is on the list. Any keys you like; the file is done when every item is ticked.</p>,
    aside: intros[c.id].aside,
    challenge: c.challenge,
  })),
};
