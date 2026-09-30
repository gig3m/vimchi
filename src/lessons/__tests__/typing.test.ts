// The typed-text budget: a round exercises a key, not the keyboard. In the Core and Code bands
// a reference solution may type at most 6 literal characters (8 where the lesson opts in with
// `typing: true`, because the skill is insert-mode editing). Ex-band lessons are the syntax
// itself and are measured separately below.
import { describe, expect, it } from 'vitest';
import { ORDER, SECTIONS } from '..';
import { createVim, mergeSetup, solutionKeys } from '../runtime';
import type { Vim } from '../../vim/editor';

const PRINT = /^(.|<Space>|<Tab>|<lt>|<Bslash>|<Bar>)$/;
export const BUDGET = 6, BUDGET_TYPING = 8;

/** Literal characters typed by a key sequence on a setup: in insert/replace mode, and on the command line. */
export function typedChars(vim: Vim, keys: string[]): { ins: number; cmd: number } {
  let ins = 0, cmd = 0;
  for (const k of keys) {
    if ((vim.mode === 'insert' || vim.mode === 'replace') && PRINT.test(k)) ins++;
    else if (vim.mode === 'cmdline' && PRINT.test(k)) cmd++;
    vim.feed(k);
  }
  return { ins, cmd };
}
export const CMD_BUDGET = 24;

describe('typed-text budget', () => {
  it('core and code rounds type at most 6 literal characters (8 with typing: true)', () => {
    const over: string[] = [];
    for (const s of SECTIONS) {
      if (s.band !== 'core' && s.band !== 'code') continue;
      for (const l of s.lessons) {
        const c = l.challenge;
        if (c.kind !== 'rounds') continue;
        const limit = l.typing ? BUDGET_TYPING : BUDGET;
        c.rounds.forEach((r, i) => {
          const n = typedChars(createVim(mergeSetup(c.base, r.setup)), solutionKeys(r.solution)).ins;
          if (n > limit) over.push(`${l.id} r${i + 1} types ${n} (limit ${limit}): ${r.solution}`);
        });
      }
    }
    expect(over).toEqual([]);
  });
  it('project and patterns rounds type at most 24 characters on the command line (the syntax is the skill; the identifiers are not)', () => {
    const over: string[] = [];
    for (const s of SECTIONS) {
      if (s.band !== 'project' && s.band !== 'patterns') continue;
      for (const l of s.lessons) {
        const c = l.challenge;
        if (c.kind !== 'rounds') continue;
        c.rounds.forEach((r, i) => {
          const n = typedChars(createVim(mergeSetup(c.base, r.setup)), solutionKeys(r.solution)).cmd;
          if (n > CMD_BUDGET) over.push(`${l.id} r${i + 1} types ${n} on the cmdline (limit ${CMD_BUDGET}): ${r.solution}`);
        });
      }
    }
    expect(over).toEqual([]);
  });
  it('the registry ORDER is what the budget walks', () => {
    expect(ORDER.length).toBeGreaterThan(100);
  });
});
