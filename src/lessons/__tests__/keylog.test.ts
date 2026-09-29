import { describe, expect, it } from 'vitest';
import { CHALLENGES } from '../../challenges';
import { SECTIONS } from '..';
import { Session, solutionKeys } from '../runtime';
import type { RoundsChallenge } from '../types';

const rounds = (id: string) => SECTIONS.flatMap(s => s.lessons).find(l => l.id === id)!.challenge as RoundsChallenge;

describe('key log', () => {
  it('logs a rounds lesson with units and boundaries', () => {
    const c = rounds('insert-mode');
    const s = new Session(c, { carryCursor: false });
    let t = 0;
    for (const k of solutionKeys(c.rounds[0].solution)) s.key(k, (t += 100));
    if (!s.done) s.advance();
    for (const k of solutionKeys(c.rounds[1].solution)) s.key(k, (t += 100));
    const log = s.log();
    expect(log.length).toBe(solutionKeys(c.rounds[0].solution).length + solutionKeys(c.rounds[1].solution).length);
    expect(log[0].boundary).toBe(true);
    expect(log[0].unit).toBe(0);
    const first1 = log.findIndex(e => e.unit === 1);
    expect(log[first1].boundary).toBe(true);
    expect(s.unitStart(1)).toBe(first1);
    expect(log.find(e => e.command?.kind === 'motion')).toBeDefined();
    expect(log.some(e => e.before.mode === 'insert' && e.command === null)).toBe(true);
    expect(s.setupFor(1).text).toBeDefined();
  });
  it('arrow keys the session rejects are not logged', () => {
    const s = new Session(rounds('insert-mode'));
    s.key('<Left>');
    expect(s.log()).toEqual([]);
  });
  it('logs generated challenges by checklist item', () => {
    const ch = CHALLENGES[0].challenge;
    const s = new Session(ch, { seed: 5 });
    s.key('j'); s.key('j');
    const log = s.log();
    expect(log.length).toBe(2);
    expect(log[0].boundary).toBe(true);
    expect(log[0].unit).toBeGreaterThanOrEqual(0);
    expect(s.setupFor(0).text).toEqual(s.generated!.start);
  });
  it(':reset is a boundary and keeps earlier log entries', () => {
    const s = new Session(rounds('insert-mode'));
    s.key('j'); s.key(':'); for (const k of 'reset') s.key(k); s.key('<CR>');
    return new Promise<void>(resolve => queueMicrotask(() => {
      s.key('k');
      const log = s.log();
      expect(log[log.length - 1].boundary).toBe(true);
      expect(log[log.length - 1].key).toBe('k');
      expect(log.length).toBe(9);
      resolve();
    }));
  });
  it('challenges declare the sections they draw on', () => {
    for (const c of CHALLENGES) expect(c.challenge.sections.length).toBeGreaterThan(0);
  });
});
