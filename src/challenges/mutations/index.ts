import { droppedChar, extraChar, wrongChar, wrongLiteral, wrongShortIdent } from './chars';
import type { MutationKind } from './types';

const all: MutationKind[] = [droppedChar, extraChar, wrongChar, wrongLiteral, wrongShortIdent];
export const KINDS: Record<string, MutationKind> = Object.fromEntries(all.map(k => [k.id, k]));
