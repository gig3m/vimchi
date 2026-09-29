import type { GeneratedChallenge } from '../lessons/types';
import { CORPUS } from './corpus';

export type ChallengeDef = { id: string; title: string; chips: string[]; challenge: GeneratedChallenge };

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
      edits: [8, 12],
    },
  },
];
