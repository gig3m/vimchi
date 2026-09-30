import { droppedChar, extraChar, wrongChar, wrongLiteral, wrongShortIdent } from './chars';
import { lineToRemove, missingDuplicateLine, strayLine, strayWord, wrongWord } from './lines';
import { EX_KINDS } from './ex';
import { REGISTER_KINDS } from './registers';
import { REPS_KINDS } from './reps';
import type { MutationKind } from './types';
import { VISUAL_KINDS } from './visual';

const all: MutationKind[] = [
  droppedChar, extraChar, wrongChar, wrongLiteral, wrongShortIdent,
  strayLine, strayWord, wrongWord, missingDuplicateLine, lineToRemove,
  ...REPS_KINDS, ...VISUAL_KINDS, ...REGISTER_KINDS, ...EX_KINDS,
];
export const KINDS: Record<string, MutationKind> = Object.fromEntries(all.map(k => [k.id, k]));
