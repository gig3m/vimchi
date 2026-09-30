// The nine hand rules the idiom search replaced: each scenario must still get its suggestion,
// now found by the edit-equivalence search (coach/idiom.ts) rather than a literal pattern.
import { describe, expect, it } from 'vitest';
import { Session } from '../../lessons/runtime';
import type { RoundsChallenge } from '../../lessons/types';
import { parseKeys } from '../../vim/keys';
import { coach } from '../index';

/** A lesson past which A, I, o, dd, p, s and counts are taught (text objects are not yet). */
const LATE = 'counts-operators';

function suggest(text: string[], keys: string, cursor = { line: 0, col: 0 }, lesson = LATE) {
  const c: RoundsChallenge = { kind: 'rounds', base: { text, name: 'a.ts', cursor }, rounds: [{ goal: { text: ['__never__'] }, solution: 'x' }] };
  const s = new Session(c);
  let t = 0;
  for (const k of parseKeys(keys)) s.key(k, (t += 50));
  const cr = coach(s, lesson).critiques.filter(x => x.better[0].rule !== 'motion');
  return cr[0]?.better[0] ?? null;
}

describe('former rules, found by the idiom search', () => {
  it('count-x: xxx → 3x, and a whole word → de', () => {
    expect(suggest(['abcdef ghi'], 'xxx')?.keys).toBe('3x');
    expect(suggest(['abc def'], 'xxx')?.keys).toBe('de');
  });
  it('count-x does not fire at end of line (x walks backwards)', () => {
    expect(suggest(['abc'], '$xxx')?.keys).not.toBe('3x');
  });
  it('x-i-to-r', () => { expect(suggest(['abc'], 'xiz<Esc>')?.keys).toBe('rz'); });
  it('A-at-eol', () => { expect(suggest(['abc'], '$a!<Esc>')?.keys).toBe('A!<Esc>'); });
  it('I-at-bol fires on ^i but not 0i', () => {
    expect(suggest(['  abc'], '^i//<Esc>', { line: 0, col: 4 })?.keys).toBe('I//<Esc>');
    expect(suggest(['  abc'], '0i//<Esc>', { line: 0, col: 4 })?.keys).not.toBe('I//<Esc>');
  });
  it('ddp: ddjP → ddp; ddjp is not', () => {
    expect(suggest(['a', 'b', 'c'], 'ddjP')?.keys).toBe('ddp');
    expect(suggest(['a', 'b', 'c'], 'ddjp')?.keys).not.toBe('ddp');
  });
  it('count-dd', () => { expect(suggest(['a', 'b', 'c', 'd'], 'dddd')?.keys).toBe('2dd'); });
  it('dot-repeat needs saves ≥ 2', () => {
    expect(suggest(['foo a foo b'], 'cwbar<Esc>wwcwbar<Esc>')?.keys).toBe('cwbar<Esc>ww.');
    expect(suggest(['ab ab'], 'xwx')?.pattern).not.toBe('dot');
  });
  it('cw: de then insert', () => { expect(suggest(['abc def'], 'deixyz<Esc>')?.keys).toBe('cwxyz<Esc>'); });
  it('o-not-A-CR', () => { expect(suggest(['abc'], 'A<CR>new<Esc>')?.keys).toBe('onew<Esc>'); });
  it('every suggestion names a pattern with a principle', () => {
    const s = suggest(['abc def'], 'deixyz<Esc>')!;
    expect(s.pattern).toBe('change-word');
    expect(s.why.length).toBeGreaterThan(10);
  });
});
