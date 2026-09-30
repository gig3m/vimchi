import { describe, expect, it } from 'vitest';
import { Session } from '../../lessons/runtime';
import type { RoundsChallenge } from '../../lessons/types';
import { parseKeys } from '../../vim/keys';
import { coach } from '../index';

// Flash is on in every lesson (owner ruling): a learner who reaches for s is never punished for it,
// and the coach may only point at a shorter plain motion.
function play(text: string[], keys: string, lessonId: string, cursor = { line: 0, col: 0 }) {
  const c: RoundsChallenge = { kind: 'rounds', base: { text, name: 'a.ts', cursor }, rounds: [{ goal: { text: ['__never__'] }, solution: 'x' }] };
  const s = new Session(c);
  let t = 0;
  for (const k of parseKeys(keys)) s.key(k, (t += 50));
  return { s, r: coach(s, lessonId) };
}

describe('coach with flash on everywhere', () => {
  it('an early lesson: s + pattern + label jumps, and no critique names a flash key', () => {
    const { s, r } = play(['const a = 1;', 'let total = sum(a, b);', 'return total;'], 'sa,ax', 'delete-words');
    expect(s.vim!.buf.lines[1]).toBe('let total = sum(, b);');
    for (const c of r.critiques) for (const b of c.better) expect(b.keys, JSON.stringify(c)).not.toMatch(/(^|[^g])[sS]/);
  });
  it('still suggests a shorter plain motion: j beats a jump to the next line', () => {
    const { s, r } = play(['abc def', 'abc xyz', 'end'], 'sabax', 'delete-words');
    expect(s.vim!.buf.lines[1]).toBe('bc xyz');
    const c = r.critiques.find(x => x.you.startsWith('s'));
    expect(c, JSON.stringify(r.critiques)).toBeDefined();
    expect(c!.better.map(b => b.keys)).toContain('j');
  });
});
