import { describe, expect, it } from 'vitest';
import { SECTIONS } from '../../lessons';
import { Session } from '../../lessons/runtime';
import type { RoundsChallenge } from '../../lessons/types';
import { parseKeys } from '../../vim/keys';
import { segment } from '../segment';

/** A rounds session on a plain buffer so logs come from the real engine. */
function play(text: string[], keys: string) {
  const c: RoundsChallenge = { kind: 'rounds', base: { text, name: 'a.ts' }, rounds: [{ goal: { text: ['__never__'] }, solution: 'x' }] };
  const s = new Session(c);
  let t = 0;
  for (const k of parseKeys(keys)) s.key(k, (t += 50));
  return segment(s.log());
}
const kinds = (segs: ReturnType<typeof segment>) => segs.map(s => (s.kind === 'break' ? `break:${s.reason}` : `${s.kind}:${s.keys.join('')}`));

describe('segment', () => {
  it('splits a motion run from the edit that follows', () => {
    expect(kinds(play(['abcdefgh'], 'llllx'))).toEqual(['motion:llll', 'edit:x']);
  });
  it('keeps a pending key with the command it starts', () => {
    const segs = play(['abc def ghi'], 'fdfgx');
    expect(kinds(segs)).toEqual(['motion:fdfg', 'edit:x']);
    expect(segs[0]).toMatchObject({ from: { line: 0, col: 0 }, to: { line: 0, col: 8 } });
  });
  it('an insert spanning keys is one edit', () => {
    expect(kinds(play(['abc'], 'lifoo<Esc>'))).toEqual(['motion:l', 'edit:ifoo<Esc>']);
  });
  it('a typo key is removed from a run', () => {
    expect(kinds(play(['abc def'], 'fzfdx'))).toEqual(['break:error', 'motion:fd', 'edit:x']);
  });
  it('undo discards the undone edit and itself', () => {
    expect(kinds(play(['abc def'], 'xuwx'))).toEqual(['break:undo', 'break:undo', 'motion:w', 'edit:x']);
  });
  it('a yank is a break, not a motion', () => {
    expect(kinds(play(['abc', 'def'], 'yyjp'))).toEqual(['break:other', 'motion:j', 'edit:p']);
  });
  it('a boundary splits runs', () => {
    const lesson = SECTIONS.flatMap(s => s.lessons).find(l => l.id === 'insert-mode')!;
    const c = lesson.challenge as RoundsChallenge;
    const s = new Session(c, { carryCursor: false });
    let t = 0;
    for (const k of parseKeys(c.rounds[0].solution)) s.key(k, (t += 50));
    s.advance();
    for (const k of parseKeys('kk')) s.key(k, (t += 50));
    const segs = segment(s.log());
    expect(segs[segs.length - 1]).toMatchObject({ kind: 'motion', unit: 1, keys: ['k', 'k'] });
    expect(segs.some(x => x.kind === 'break' && x.reason === 'boundary')).toBe(false);
  });
  it('visual mode is one edit', () => {
    expect(kinds(play(['abc def'], 'vlld'))).toEqual(['edit:vlld']);
  });
});
