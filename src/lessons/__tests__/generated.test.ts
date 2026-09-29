import { describe, expect, it } from 'vitest';
import { CHALLENGES } from '../../challenges';
import { generate } from '../../challenges/generate';
import { Session, solutionKeys } from '../runtime';

const ch = CHALLENGES[0].challenge;

describe('generated session', () => {
  it('uses the seed it is given and exposes items', () => {
    const s = new Session(ch, { seed: 99 });
    const g = generate(ch, 99);
    expect(s.view().seed).toBe(99);
    expect(s.vim!.buf.lines).toEqual(g.start);
    expect(s.view().goalText).toEqual(g.goal);
    expect(s.view().items.map(i => i.text)).toEqual(g.items.map(i => i.text));
    expect(s.view().items.every(i => !i.done)).toBe(true);
    expect(s.total).toBe(g.items.length);
  });
  it('completes when every fix is replayed, with acc 1 and correct 1', () => {
    const s = new Session(ch, { seed: 5 });
    const g = generate(ch, 5);
    let t = 0;
    for (const item of g.items) {
      s.vim!.win.cursor = { ...item.fixAt }; // teleport stands in for motion keys (Challenge 1 kinds never shift lines)
      for (const k of solutionKeys(item.fixKeys)) s.key(k, (t += 100));
      expect(s.view().items.find(i => i.text === item.text)!.done).toBe(true);
    }
    expect(s.done).toBe(true);
    const r = s.result();
    expect(r.correct).toBe(1);
    expect(r.keys).toBeLessThanOrEqual(g.parKeys);
    expect(r.parKeys).toBe(g.parKeys);
    expect(r.parTime).toBe(g.parMs);
    expect(s.view().hits).toBe(g.items.length);
  });
  it('collateral is remembered after undo', () => {
    const s = new Session(ch, { seed: 5 });
    const g = generate(ch, 5);
    let t = 0;
    // Delete an untouched line far from every item, then undo it.
    const safe = g.goal.findIndex((_, i) => g.items.every(it => Math.abs(it.goal[0] - i) > 2) && g.start[i] === g.goal[i]);
    expect(safe).toBeGreaterThanOrEqual(0);
    s.vim!.win.cursor = { line: safe, col: 0 };
    for (const k of solutionKeys('ddu')) s.key(k, (t += 100));
    for (const item of g.items) {
      s.vim!.win.cursor = { ...item.fixAt };
      for (const k of solutionKeys(item.fixKeys)) s.key(k, (t += 100));
    }
    expect(s.done).toBe(true);
    expect(s.result().correct).toBeLessThan(1);
    expect(s.result().correct).toBeCloseTo(1 - 1 / g.items.length, 5);
  });
  it('a fresh session without a seed still runs', () => {
    const s = new Session(ch);
    expect(typeof s.view().seed).toBe('number');
    expect(s.view().items.length).toBeGreaterThan(0);
  });
});
