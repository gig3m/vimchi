// The typed-text budget: a round exercises a key, not the keyboard. Every rounds lesson may type
// at most 6 literal characters in insert/replace mode (8 where the lesson opts in with
// `typing: true`, because the skill is insert-mode editing) and at most 24 on the command line
// (the syntax is the skill there; long identifiers are not). <CR> is not counted anywhere, and a
// register name after <C-r> counts as a character (harmless: it is one key either way).
import { describe, expect, it } from 'vitest';
import { ORDER, SECTIONS } from '..';
import { createVim, mergeSetup, solutionKeys } from '../runtime';
import type { Vim } from '../../vim/editor';

const PRINT = /^(.|<Space>|<Tab>|<lt>|<Bslash>|<Bar>)$/;
const BUDGET = 6, BUDGET_TYPING = 8, CMD_BUDGET = 24;

/** Literal characters typed by a key sequence on a setup: in insert/replace mode, and on the command line. */
function typedChars(vim: Vim, keys: string[]): { ins: number; cmd: number } {
  let ins = 0, cmd = 0;
  for (const k of keys) {
    if ((vim.mode === 'insert' || vim.mode === 'replace') && PRINT.test(k)) ins++;
    else if (vim.mode === 'cmdline' && PRINT.test(k)) cmd++;
    vim.feed(k);
  }
  return { ins, cmd };
}

describe('typed-text budget', () => {
  const insOver: string[] = [], cmdOver: string[] = [];
  for (const s of SECTIONS) for (const l of s.lessons) {
    const c = l.challenge;
    if (c.kind !== 'rounds') continue;
    const limit = l.typing ? BUDGET_TYPING : BUDGET;
    c.rounds.forEach((r, i) => {
      const n = typedChars(createVim(mergeSetup(c.base, r.setup)), solutionKeys(r.solution));
      if (n.ins > limit) insOver.push(`${l.id} r${i + 1} types ${n.ins} (limit ${limit}): ${r.solution}`);
      if (n.cmd > CMD_BUDGET) cmdOver.push(`${l.id} r${i + 1} types ${n.cmd} on the cmdline (limit ${CMD_BUDGET}): ${r.solution}`);
    });
  }
  it('every round types at most 6 literal characters (8 with typing: true)', () => { expect(insOver).toEqual([]); });
  it('every round types at most 24 characters on the command line', () => { expect(cmdOver).toEqual([]); });
  it('walks the whole registry', () => { expect(ORDER.filter(l => l.challenge.kind === 'rounds').length).toBeGreaterThan(150); });
});
