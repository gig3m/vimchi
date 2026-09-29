import { describe, expect, it } from 'vitest';
import { CHALLENGES } from '../../challenges';
import { generate } from '../../challenges/generate';
import { SECTIONS } from '../../lessons';
import { Session, solutionKeys } from '../../lessons/runtime';
import type { RoundsChallenge } from '../../lessons/types';
import { parseKeys } from '../../vim/keys';
import { coach } from '../index';
import { coachable } from '../vocab';

function play(text: string[], keys: string, lessonId = 'insert-mode', cursor = { line: 0, col: 0 }) {
  const c: RoundsChallenge = { kind: 'rounds', base: { text, name: 'a.ts', cursor }, rounds: [{ goal: { text: ['__never__'] }, solution: 'x' }] };
  const s = new Session(c);
  let t = 0;
  for (const k of parseKeys(keys)) s.key(k, (t += 50));
  return coach(s, lessonId);
}

describe('coach', () => {
  it('hhhhhh → 6h with counts taught', () => {
    const r = play(['abcdefgh'], 'hhhhhhx', 'insert-mode', { line: 0, col: 7 });
    const c = r.critiques.find(x => x.you === 'hhhhhh');
    expect(c).toBeDefined();
    expect(c!.better.map(b => b.keys)).toContain('6h');
  });
  it('minimum saving: one key saved is not shown', () => {
    const r = play(['abc def ghi jkl'], 'wwx');
    expect(r.critiques).toEqual([]);
  });
  it('never undercuts the lesson key the learner used', () => {
    const r = play(['a,b,c,d,e,f'], 'f,;;;x', 'repeat-find');
    expect(r.critiques.filter(c => c.you.includes(';'))).toEqual([]);
  });
  it('drops a suggestion whose state a later key reads', () => {
    // A later p pastes the unnamed register: xxxx leaves "d", de leaves "abcd", 4x leaves "abcd".
    const withP = play(['abcd efg', 'x'], 'xxxxjp');
    expect(withP.critiques.filter(c => c.you.startsWith('xxxx'))).toEqual([]);
    const noP = play(['abcd efg', 'x'], 'xxxxj');
    expect(noP.critiques.some(c => c.better.some(b => b.keys === 'de' || b.keys === '4x'))).toBe(true);
  });
  it('reference lines use par, not raw solution length', () => {
    const lesson = SECTIONS.flatMap(s => s.lessons).find(l => l.id === 'insert-mode')!;
    const c = lesson.challenge as RoundsChallenge;
    const s = new Session(c);
    let t = 0;
    for (const r of c.rounds) { for (const k of solutionKeys(r.solution)) s.key(k, (t += 50)); if (!s.done) s.advance(); }
    const rep = coach(s, 'insert-mode');
    for (const line of rep.reference) expect(line.par).toBeGreaterThanOrEqual(solutionKeys(c.rounds[line.unit].solution).length);
  });
  it('lists which reference playthroughs still get critiques (audit input)', () => {
    const offenders: string[] = [];
    for (const sec of SECTIONS) for (const l of sec.lessons) {
      if (!coachable(l.id) || l.challenge.kind !== 'rounds') continue;
      const c = l.challenge;
      const s = new Session(c, { carryCursor: false });
      let t = 0;
      for (const r of c.rounds) { for (const k of solutionKeys(r.solution)) s.key(k, (t += 50)); if (!s.done) s.advance(); }
      const rep = coach(s, l.id);
      for (const cr of rep.critiques) offenders.push(`${l.id} r${cr.unit + 1}: ${cr.you} → ${cr.better.map(b => `${b.keys} (${b.rule})`).join(' | ')}`);
    }
    console.log(`reference critiques (${offenders.length}):\n` + offenders.join('\n'));
    expect(offenders.length).toBeLessThan(400);
  });
  it('a generated run replayed with par motions gets no critiques', () => {
    const ch = CHALLENGES[0];
    for (let seed = 1; seed <= 20; seed++) {
      const s = new Session(ch.challenge, { seed });
      const g = generate(ch.challenge, seed);
      let t = 0;
      for (const item of g.items) { s.vim!.win.cursor = { ...item.fixAt }; for (const k of solutionKeys(item.fixKeys)) s.key(k, (t += 50)); }
      const rep = coach(s, ch.id);
      expect(rep.critiques.filter(c => c.better.some(b => b.rule !== 'motion')), `seed ${seed}`).toEqual([]);
    }
  });
});
