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
