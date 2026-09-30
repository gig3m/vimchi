import type { ReactNode } from 'react';
import type { Vim } from '../vim/editor';
import type { Options, Pos } from '../vim/types';

// ---------------------------------------------------------------------------------------------
// Lesson content

export type KeyCard = {
  /** Key(s) printed on the cap, e.g. "w", "dd", "C-v". */
  key: string;
  /** Small glyph in the corner: an arrow, "del", "e→a". */
  glyph: string;
  glyphColor?: string;
  label: string;
  sub?: string;
};

export type Lesson = {
  /** Stable, URL-safe, unique across the app (e.g. "delete-words"). */
  id: string;
  title: string;
  /** Keys shown as chips in the sidebar (1–4). */
  chips: string[];
  keyCards: KeyCard[];
  /** Key cards are narrow (80px) for single-direction glyphs like hjkl. */
  narrowCards?: boolean;
  /** Two short paragraphs. */
  intro: ReactNode;
  /** Instructions above the practice editor; receives the number of targets/rounds. */
  practice: (total: number) => ReactNode;
  aside: { title: string; body: ReactNode };
  challenge: Challenge;
  /** Optional boss level: not counted toward completion. */
  boss?: boolean;
  /** The skill IS typing (insert-mode editing keys, replace mode): the typed-text budget is 8 characters per round instead of 6. */
  typing?: boolean;
  /** Generated mini-rounds of this lesson's edit, offered after the authored rounds (`#<id>?reps=<seed>`). */
  reps?: RepsSpec;
};

/**
 * A lesson's Reps: 10–15 generated edits of the lesson's own kind on a corpus file. Built into a
 * `generated` challenge by src/challenges/reps.ts; runs are saved as `<lesson-id>-reps`.
 */
export type RepsSpec = {
  /** Mutation kind ids (keys of KINDS in src/challenges/mutations). */
  mutations: string[];
  /** Inclusive range of edits per run. */
  count: [number, number];
  /** Which corpus to draw from (default code). */
  corpus?: 'code' | 'prose';
  /** Section ids whose lessons' keys the coach may suggest. */
  sections: string[];
};

export type Section = { id: string; title: string; band: 'core' | 'repeat' | 'project' | 'patterns' | 'code' | 'challenges'; lessons: Lesson[] };

// ---------------------------------------------------------------------------------------------
// Challenges

export type Challenge = TargetChallenge | MarksChallenge | RoundsChallenge | QuizChallenge | GeneratedChallenge;

/** Reach randomly placed boxes. `word` places them on w/e/b stops. */
export type TargetChallenge = {
  kind: 'target' | 'word';
  file: string;
  code: string[];
  start: Pos;
  /** Motions the par calculation may use (subset of hjklwebWEB). */
  pathKeys: string;
  /** Par time per target, ms. */
  parPer: number;
  /** How many targets (default 12). */
  count?: number;
};

/** Delete (fix) or replace marked characters until the buffer matches `correct`. */
export type MarksChallenge = {
  kind: 'fix' | 'replace';
  file: string;
  code: string[];
  correct: string[];
  start: Pos;
  pathKeys: string;
  parPer: number;
};

/**
 * A sequence of small tasks. Each round sets up an editor, states a goal and
 * carries a reference solution (validated in tests; its length is the par).
 */
export type RoundsChallenge = {
  kind: 'rounds';
  /** Shared setup; each round's setup is merged over it. */
  base: Setup;
  rounds: Round[];
  /** Show the goal text under the editor for text goals (default true). */
  showGoal?: boolean | 'inline' | 'pane';
  /**
   * `false`: start every round at its setup cursor instead of carrying the learner's cursor over.
   * For lessons whose keys depend on the cursor (flash labels), so what the learner sees matches the
   * reference solutions on Results.
   */
  carryCursor?: false;
};

export type CorpusLicense = 'MIT' | 'BSD-2-Clause' | 'BSD-3-Clause' | 'Apache-2.0' | 'ISC';
/** One clean base file for generated challenges, excerpted from a permissively licensed repo. */
export type CorpusFile = {
  name: string;
  lines: string[];
  source: { repo: string; path: string; commit: string; license: CorpusLicense };
};

/**
 * A procedurally generated, seeded edit session: one corpus file with several
 * mutations applied; the goal is the original. See src/challenges/.
 */
export type GeneratedChallenge = {
  kind: 'generated';
  /** Skill tags shown in the intro; documentation only. */
  skills: string[];
  /** Mutation kind ids this challenge may draw from (keys of KINDS). */
  mutations: string[];
  corpus: CorpusFile[];
  /** Inclusive range of mutations per run. */
  edits: [number, number];
  /** Section ids whose lessons' keys the coach may suggest (curriculum ladder). */
  sections: string[];
  /** Plugins the editor needs (mini-ai for `daa`, `<ii`, `daf`). */
  plugins?: string[];
  /**
   * Reps: one skill drilled on purpose, so the mix rules are off. No per-kind cap, and two
   * fixes may be the same edit even without `.` among the skills.
   */
  drill?: boolean;
};

export type Round = {
  /** One line telling the learner what to do. Keep it short; may be omitted for obvious goals. */
  prompt?: string;
  setup?: Setup;
  goal: Goal;
  /** Reference keys in Vim notation, e.g. "d2w" or ":%s/a/b/g<CR>". */
  solution: string;
};

export type Goal = {
  /** Buffer text must equal this (current buffer). */
  text?: string | string[];
  /** Cursor must be here (0-based). Rendered as a green box. */
  cursor?: Pos;
  /** Name of the buffer that must be current. */
  buffer?: string;
  /** Files that must have this content on disk (after :w). */
  files?: Record<string, string>;
  /** Register contents that must match. */
  registers?: Record<string, string>;
  /** Any other condition. */
  check?: (vim: Vim) => boolean;
  /** Which mode the editor must be in (default normal). */
  mode?: 'normal' | 'any';
};

export type Setup = {
  /** Project files (path → content). */
  files?: Record<string, string>;
  /** File to open (must be in files), or… */
  open?: string;
  /** …an unnamed buffer: text plus a display name for syntax colouring. */
  text?: string | string[];
  name?: string;
  cursor?: Pos;
  options?: Partial<Options>;
  /** Plugin ids to enable (see src/vim/plugins). */
  plugins?: string[];
  registers?: Record<string, string | { text: string; kind: 'char' | 'line' | 'block' }>;
  marks?: Record<string, Pos>;
  folds?: { start: number; end: number; closed?: boolean }[];
  /** Last search pattern (for n, gn, :s//). */
  search?: string;
  /** Rows available to the editor (default: fit the buffer, 6–20). */
  height?: number;
  /** Escape hatch for anything else (splits, quickfix lists, …). Runs last. */
  init?: (vim: Vim) => void;
};

/** Multiple choice, for keys the browser can't capture or concepts without a buffer. */
export type QuizChallenge = {
  kind: 'quiz';
  questions: Question[];
};

export type Question = {
  prompt: string;
  /** Optional code shown above the options. */
  code?: string;
  options: string[];
  /** Index into options. */
  answer: number;
  /** Shown after answering. */
  explain?: string;
};
