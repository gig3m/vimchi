import { describe, expect, it } from 'vitest';
import { Session } from '../../lessons/runtime';
import type { RoundsChallenge } from '../../lessons/types';
import { parseKeys } from '../../vim/keys';
import { stateBefore } from '../replay';
import { RULES } from '../rules';
import { segment } from '../segment';

function play(text: string[], keys: string, cursor = { line: 0, col: 0 }) {
  const c: RoundsChallenge = { kind: 'rounds', base: { text, name: 'a.ts', cursor }, rounds: [{ goal: { text: ['__never__'] }, solution: 'x' }] };
  const s = new Session(c);
  let t = 0;
  for (const k of parseKeys(keys)) s.key(k, (t += 50));
  return s;
}
/** Run every rule over the segments; return the first suggestion, verified by replay. */
function suggest(text: string[], keys: string, cursor?: { line: number; col: number }) {
  const s = play(text, keys, cursor);
  const segs = segment(s.log());
  for (let i = 0; i < segs.length; i++) for (const r of RULES) {
    const lines = stateBefore(s, segs[i].logStart).buf.lines;
    const hit = r.apply(segs, i, { lines });
    if (!hit) continue;
    const a = stateBefore(s, segs[i].logStart); for (let k = i; k < i + hit.consumed; k++) a.feedKeys(segs[k].keys);
    const b = stateBefore(s, segs[i].logStart); b.feedKeys(hit.suggestion.keys);
    expect(b.buf.text(), `${r.id}: ${hit.suggestion.keys}`).toBe(a.buf.text());
    expect(b.cursor, `${r.id}: ${hit.suggestion.keys} cursor`).toEqual(a.cursor);
    return hit.suggestion;
  }
  return null;
}

describe('rules', () => {
  it('count-x: xxx → 3x, and a whole word → de', () => {
    expect(suggest(['abcdef ghi'], 'xxx')?.keys).toBe('3x');
    expect(suggest(['abc def'], 'xxx')?.keys).toBe('de');
  });
  it('count-x does not fire at end of line (x walks backwards)', () => {
    expect(suggest(['abc'], '$xxx')?.rule).not.toBe('count-x');
  });
  it('x-i-to-r', () => { expect(suggest(['abc'], 'xiz<Esc>')?.keys).toBe('rz'); });
  it('A-at-eol', () => { expect(suggest(['abc'], '$a!<Esc>')?.keys).toBe('A!<Esc>'); });
  it('I-at-bol fires on ^i but not 0i', () => {
    expect(suggest(['  abc'], '^i//<Esc>', { line: 0, col: 4 })?.keys).toBe('I//<Esc>');
    expect(suggest(['  abc'], '0i//<Esc>', { line: 0, col: 4 })?.rule).not.toBe('I-at-bol');
  });
  it('ddp: ddjP → ddp; ddjp is not', () => {
    expect(suggest(['a', 'b', 'c'], 'ddjP')?.keys).toBe('ddp');
    expect(suggest(['a', 'b', 'c'], 'ddjp')?.rule).not.toBe('ddp');
  });
  it('count-dd', () => { expect(suggest(['a', 'b', 'c', 'd'], 'dddd')?.keys).toBe('2dd'); });
  it('dot-repeat needs saves ≥ 2', () => {
    expect(suggest(['foo a foo b'], 'cwbar<Esc>wwcwbar<Esc>')?.keys).toBe('.');
    expect(suggest(['ab ab'], 'xwx')?.rule).not.toBe('dot-repeat');
  });
  it('cw: de then insert', () => { expect(suggest(['abc def'], 'deixyz<Esc>')?.keys).toBe('cwxyz<Esc>'); });
  it('o-not-A-CR', () => { expect(suggest(['abc'], 'A<CR>new<Esc>')?.keys).toBe('onew<Esc>'); });
});
