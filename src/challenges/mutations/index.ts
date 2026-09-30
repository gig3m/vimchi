import { droppedChar, extraChar, wrongChar, wrongLiteral, wrongShortIdent } from './chars';
import { lineToRemove, missingDuplicateLine, strayLine, strayWord, wrongWord } from './lines';
import { REPS_KINDS } from './reps';
import type { MutationKind } from './types';

const all: MutationKind[] = [
  droppedChar, extraChar, wrongChar, wrongLiteral, wrongShortIdent,
  strayLine, strayWord, wrongWord, missingDuplicateLine, lineToRemove,
  ...REPS_KINDS,
];
export const KINDS: Record<string, MutationKind> = Object.fromEntries(all.map(k => [k.id, k]));
