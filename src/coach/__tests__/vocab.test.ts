import { describe, expect, it } from 'vitest';
import { LESSONS, ORDER, SECTIONS } from '../../lessons';
import { COUNTS_TAUGHT_FROM, coachable, commandTokens, taughtBy, tokenize, usesAllowed } from '../vocab';

describe('tokenize', () => {
  it.each([
    ['dt', ['d', 't']], ['ci"', ['c', 'i"']], ['$A', ['$', 'A']], ['"ap', ['"', 'p']], ['C-w h', ['<C-w>', 'h']],
    ['␣ff', ['<Space>', 'f', 'f']], [':noh', [':']], ['/e', ['/']], ['3dw', ['d', 'w']], ['esc', ['<Esc>']], ['CR', ['<CR>']],
    ['C-r C-w', ['<C-r>', '<C-w>']], ['gcc', ['gc', 'c']], ['<leader>', ['<Space>']], ['ddp', ['dd', 'p']], ['xp', ['x', 'p']],
  ] as [string, string[]][])('%s → %j', (chip, want) => expect(tokenize(chip)).toEqual(want));
  it('prose chips tokenize to nothing', () => {
    for (const chip of ['macros', 'init.lua', 'vim.opt', 'vim.keymap.set', 'tab', 'norm']) expect(tokenize(chip), chip).toEqual([]);
  });
  it('every chip and key card in the curriculum tokenizes without throwing and yields only notation tokens', () => {
    for (const l of ORDER) for (const chip of [...l.chips, ...l.keyCards.map(k => k.key)]) {
      for (const t of tokenize(chip)) expect(t, `${l.id}: ${chip}`).toMatch(/^(<[^\s>]+>|[^\s]{1,3})$/);
    }
  });
});

describe('commandTokens: the command a learner ran, arguments and text stripped', () => {
  it.each([
    [['f', '('], ['f']], [['2', 'w'], ['w']], [['"', 'a', 'y', 'y'], ['"', 'yy']], [['c', 'i', '('], ['c', 'i(']],
    [[':', 'n', 'o', 'h', '<CR>'], [':']], [['/', 'l', 'e', 'a', 'd', 'e', 'r', '<CR>'], ['/']], [['d', 'k'], ['d', 'k']],
    [['r', 'z'], ['r']], [['m', 'a'], ['m']], [['`', 'a'], ['`']], [['@', 'q'], ['@']], [['3', 'd', 'w'], ['d', 'w']],
    [['A', ';', '<Esc>'], ['A']], [['c', 'w', 'u', 's', 'e', 'r', '<Esc>'], ['c', 'w']], [['g', 'g'], ['gg']],
  ] as [string[], string[]][])('%j → %j', (keys, want) => expect(commandTokens(keys)).toEqual(want));
});

describe('taughtBy', () => {
  it('grows monotonically along ORDER', () => {
    let prev = new Set<string>();
    for (const l of ORDER) {
      if (l.challenge.kind === 'generated') continue;
      const cur = taughtBy(l.id);
      for (const k of prev) expect(cur.has(k), `${l.id} lost ${k}`).toBe(true);
      prev = cur;
    }
  });
  it('counts appear from the words lesson', () => {
    expect(taughtBy('move').has('COUNT')).toBe(false);
    expect(taughtBy(COUNTS_TAUGHT_FROM).has('COUNT')).toBe(true);
  });
  it('a cgn suggestion is dropped early and kept after its section', () => {
    const early = taughtBy('insert-mode');
    const late = taughtBy(ORDER.filter(l => l.challenge.kind !== 'generated').slice(-1)[0].id);
    expect(usesAllowed(['c', 'gn'], early)).toBe(false);
    expect(usesAllowed(['c', 'gn'], late)).toBe(true);
  });
  it('a challenge is taught by its sections, not the whole curriculum', () => {
    const t = taughtBy('challenge-fix-the-file');
    expect(t.has('f')).toBe(true);
    expect(t.has('i"')).toBe(false); // text objects come after the sections Challenge 1 draws on
  });
});

describe('coachable', () => {
  it('rounds and generated only; no macros section, no plugins band', () => {
    expect(coachable('insert-mode')).toBe(true);
    expect(coachable('challenge-operators')).toBe(true);
    expect(coachable('move')).toBe(false);
    expect(coachable('robust-macros')).toBe(false);
    const plugin = SECTIONS.find(s => s.id === 'finding-things')!.lessons[0].id;
    expect(coachable(plugin)).toBe(false);
    expect(coachable(SECTIONS.find(s => s.id === 'surround')!.lessons[0].id)).toBe(false);
    expect(Object.keys(LESSONS).length).toBeGreaterThan(0);
  });
});
