import type { CorpusFile, GeneratedChallenge } from '../lessons/types';
import { CORPUS, JOINED, PAIRS } from './corpus';

export type ChallengeDef = { id: string; title: string; chips: string[]; challenge: GeneratedChallenge };

// The ladder (docs/superpowers/specs/2026-09-29-challenges-design.md). Each rung adds kinds that
// reward its sections' keys and keeps a few of the rungs below, so the old keys stay in the mix.
//
// | # | id                          | after band | new kinds (par)                                              |
// |---|-----------------------------|------------|--------------------------------------------------------------|
// | 1 | challenge-fix-the-file      | Core start | dropped/extra/wrong-char, wrong-literal, wrong-short-ident  |
// | 2 | challenge-operators         | Core       | stray-line/-word, wrong-word, missing-duplicate-line, …      |
// | 3 | challenge-objects-visual    | Core       | ci" ci( ciw daw dap; swapped-lines ddp, moved-block djp,    |
// |   |                             |            | block-indent >ip/<ip, commented-block <C-v>2l3jd             |
// | 4 | challenge-registers-macros  | Repeat     | line-run-transform qa…q N@a (or dw +.), swapped-chars xp,   |
// |   |                             |            | swapped-words dwwP, duplicate-and-change yyp + cw            |
// | 5 | challenge-rename-replace    | Patterns   | renamed-ident *cgn. or :%s, junk-lines :g/…/d,               |
// |   |                             |            | mixed-tails :%s/\v…//  (Ex text ≤ 24 chars)                  |

const CORE_MOTION = ['getting-around', 'small-edits', 'next-steps', 'essential-motions', 'search'];
const CORE = [...CORE_MOTION, 'basic-operators', 'text-objects', 'visual-mode', 'indent-case'];
const REPEAT = [...CORE, 'registers', 'macros'];
const PATTERNS = [...REPEAT, 'command-line', 'substitute', 'global-commands'];

/** Same-language files joined: room for Ex edits that span many lines, and a file worth a `:%s`. */
const PROJECT: CorpusFile[] = JOINED.map(f => ({ ...f, name: f.name.replace(/^reps\./, 'project.') }));

export const CHALLENGES: ChallengeDef[] = [
  {
    id: 'challenge-fix-the-file',
    title: 'Fix the File',
    chips: ['f', 'x', 'r', 'i'],
    challenge: {
      kind: 'generated',
      skills: ['movement', 'delete', 'replace', 'insert', 'find'],
      mutations: ['dropped-char', 'extra-char', 'wrong-char', 'wrong-literal', 'wrong-short-ident'],
      corpus: CORPUS,
      edits: [8, 12],
      sections: CORE_MOTION,
    },
  },
  {
    id: 'challenge-operators',
    title: 'Operators',
    chips: ['d', 'c', 'dd', '.'],
    challenge: {
      kind: 'generated',
      skills: ['movement', 'delete', 'replace', 'insert', 'find', 'operators', 'repeat'],
      mutations: [
        'dropped-char', 'extra-char', 'wrong-char', 'wrong-literal', 'wrong-short-ident',
        'stray-line', 'stray-word', 'wrong-word', 'missing-duplicate-line', 'line-to-remove',
      ],
      corpus: CORPUS,
      edits: [10, 14],
      sections: [...CORE_MOTION, 'basic-operators'],
    },
  },
  {
    id: 'challenge-objects-visual',
    title: 'Objects and Visual',
    chips: ['ci"', 'dap', '>ip', 'C-v'],
    challenge: {
      kind: 'generated',
      skills: ['movement', 'operators', 'repeat', 'text-objects', 'visual', 'indent'],
      mutations: [
        'wrong-string-contents', 'wrong-args', 'wrong-inner-word', 'stray-word-aw', 'extra-block',
        'swapped-lines', 'moved-block', 'block-indent', 'commented-block',
      ],
      corpus: PAIRS,
      edits: [10, 14],
      sections: CORE,
    },
  },
  {
    id: 'challenge-registers-macros',
    title: 'Registers and Macros',
    chips: ['xp', 'ddp', 'q', '@a'],
    challenge: {
      kind: 'generated',
      skills: ['movement', 'operators', 'repeat', 'text-objects', 'registers', 'macros'],
      mutations: [
        'line-run-transform', 'swapped-chars', 'swapped-words', 'duplicate-and-change', 'swapped-lines', 'moved-block',
        'stray-line', 'wrong-inner-word', 'wrong-string-contents',
      ],
      corpus: PAIRS,
      edits: [10, 14],
      sections: REPEAT,
    },
  },
  {
    id: 'challenge-rename-replace',
    title: 'Rename and Replace',
    chips: ['*', 'cgn', ':s', ':g'],
    challenge: {
      kind: 'generated',
      skills: ['movement', 'operators', 'repeat', 'search', 'substitute', 'global'],
      mutations: ['renamed-ident', 'junk-lines', 'mixed-tails', 'line-to-remove', 'wrong-inner-word', 'stray-word-aw'],
      corpus: PROJECT,
      edits: [10, 14],
      sections: PATTERNS,
    },
  },
];
