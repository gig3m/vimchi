// Review findings (third pass): typo fixes with Backspace, the Warm-up's vocabulary, Ex item pars.
import { describe, expect, it } from 'vitest';
import { CHALLENGES } from '../../challenges';
import { generate } from '../../challenges/generate';
import { LESSONS } from '../../lessons';
import { Session } from '../../lessons/runtime';
import type { GeneratedChallenge, RoundsChallenge } from '../../lessons/types';
import { parseKeys } from '../../vim/keys';
import { coach, itemPars } from '../index';
import { WARM_UP, taughtBy, warmUpTaught } from '../vocab';

function playLesson(lessonId: string, keys: string) {
  const s = new Session(LESSONS[lessonId].challenge as RoundsChallenge);
  let t = 0;
  for (const k of parseKeys(keys)) s.key(k, (t += 50));
  return coach(s, lessonId);
}
const suggested = (r: ReturnType<typeof coach>) => r.critiques.flatMap(c => c.better.map(b => b.keys));

describe('typed text is compared net of Backspace', () => {
  it('control: wxxxiuser<Esc> → cwuser<Esc>', () => {
    expect(suggested(playLesson('change-words', 'wxxxiuser<Esc>'))).toContain('cwuser<Esc>');
  });
  it('a typo fixed with <BS> still gets the real critique: wxxxiuse<BS>er<Esc> → cwuser<Esc>', () => {
    expect(suggested(playLesson('change-words', 'wxxxiuse<BS>er<Esc>'))).toContain('cwuser<Esc>');
  });
});

describe('a count-only rewrite of a key run must save two keys', () => {
  it('xxx is not told 3x', () => {
    const c: RoundsChallenge = { kind: 'rounds', base: { text: ['abcdefgh ij'], name: 'a.ts', cursor: { line: 0, col: 0 } }, rounds: [{ goal: { text: ['__never__'] }, solution: 'x' }] };
    const s = new Session(c);
    let t = 0;
    for (const k of parseKeys('xxxw')) s.key(k, (t += 50));
    expect(suggested(coach(s, 'change-words'))).not.toContain('3x');
  });
});

describe('the Warm-up coaches only what its picks taught', () => {
  it('warmUpTaught is the union of the picks\' vocabularies', () => {
    const t = warmUpTaught(['change-words', 'open-lines']);
    for (const k of taughtBy('change-words')) expect(t.has(k)).toBe(true);
    for (const k of taughtBy('open-lines')) expect(t.has(k)).toBe(true);
    expect(t.has('#')).toBe(false);
    expect(t.has('*')).toBe(false);
    expect(t.has('gn')).toBe(false);
  });
  it('a warm-up session with early picks is never told a key they have not met (<C-d>, #, *)', () => {
    const picks = ['change-words'];
    const c: RoundsChallenge = { kind: 'rounds', base: { text: ['one', 'foo', 'a b c', 'x y z', 'q r s', 't u v', 'foo bar', 'end', 'end'], name: 'a.ts', cursor: { line: 1, col: 0 } }, rounds: [{ goal: { text: ['__never__'] }, solution: 'x' }] };
    const s = Object.assign(new Session(c), { picks });
    let t = 0;
    for (const k of parseKeys('jjjjjwx')) s.key(k, (t += 50));
    const all = coach(s, WARM_UP).critiques.flatMap(cr => cr.better.flatMap(b => b.uses));
    const taught = taughtBy('change-words');
    for (const u of all) expect(taught.has(u), u).toBe(true);
  });
  it('without picks, a warm-up challenge falls back to the earliest lesson teaching each of its kinds', () => {
    const c = { kind: 'generated', skills: ['warm-up'], mutations: ['wrong-word-run'], corpus: [], edits: [1, 1], sections: [] } as unknown as GeneratedChallenge;
    const t = warmUpTaught(undefined, c);
    expect(t.has('#')).toBe(false);
    expect(t.has('*')).toBe(false);
    expect(t.has('c')).toBe(true);
  });
});

describe('per-item pars add up to the run par', () => {
  for (const ch of CHALLENGES.slice(2, 5)) for (const seed of [1, 2, 3, 7]) {
    it(`${ch.id} seed ${seed}`, () => {
      const g = generate(ch.challenge as GeneratedChallenge, seed);
      expect(itemPars(g).reduce((a, b) => a + b, 0)).toBe(g.parKeys);
    });
  }
});
