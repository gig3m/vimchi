// Warm-up selection: lessons with Reps, last finished about 1, 3, 7 or 21 days ago, weighted
// toward weak runs, never twice; the most recent Reps lessons when nothing is due.
import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../../challenges/rng';
import { repsRunId } from '../../challenges/reps';
import { ORDER } from '../../lessons';
import type { Run } from '../../state/store';
import { DAY, REPS_LESSONS, WARMUP_ID, dueWindow, planWarmUp, selectWarmUp } from '../select';

const NOW = Date.UTC(2026, 8, 30, 12);
const run = (lesson: string, daysAgo: number, acc = 0.9, speed = 0.9): Run =>
  ({ lesson, at: NOW - daysAgo * DAY, time: 30000, keys: 40, speed, acc, correct: 1, score: 80 });
const ids = (runs: Run[], seed = 1) => selectWarmUp(runs, NOW, mulberry32(seed)).map(p => p.lesson.id);
const R = REPS_LESSONS.map(l => l.id);
const NO_REPS = ORDER.find(l => !l.reps && !l.boss)!.id;

describe('dueWindow', () => {
  it('matches about 1, 3, 7 and 21 days, nothing else', () => {
    expect(dueWindow(1 * DAY)).toBe(1);
    expect(dueWindow(1.4 * DAY)).toBe(1);
    expect(dueWindow(3 * DAY)).toBe(3);
    expect(dueWindow(7.8 * DAY)).toBe(7);
    expect(dueWindow(20 * DAY)).toBe(21);
    for (const d of [0, 0.2, 5, 12, 15, 30, 90]) expect(dueWindow(d * DAY), `${d}`).toBeNull();
  });
});

describe('selectWarmUp', () => {
  it('has at least ten lessons to draw from', () => {
    expect(REPS_LESSONS.length).toBeGreaterThanOrEqual(10);
    expect(REPS_LESSONS.every(l => l.reps)).toBe(true);
  });
  it('is empty for a learner with no Reps lesson finished', () => {
    expect(ids([])).toEqual([]);
    expect(ids([run(NO_REPS, 1), run(WARMUP_ID, 1)])).toEqual([]);
  });
  it('picks every due lesson (1, 3, 7, 21 days) and fills with recent ones, never a lesson twice', () => {
    const runs = [run(R[0], 1), run(R[1], 3), run(R[2], 7), run(R[3], 21), run(R[4], 12), run(R[4], 13)];
    const plan = planWarmUp(runs, NOW, mulberry32(3));
    expect(plan.due).toBe(4);
    const got = plan.picks.map(p => p.lesson.id);
    expect(got.slice(0, 4).sort()).toEqual(R.slice(0, 4).sort());
    expect(got).toContain(R[4]);
    expect(new Set(got).size).toBe(got.length);
    expect(plan.picks.filter(p => p.due).length).toBe(4);
  });
  it('counts a Reps run as finishing its lesson, and the latest run decides', () => {
    // Finished 7 days ago, then reps yesterday: due at 1 day, not at 7.
    const plan = planWarmUp([run(R[0], 7), run(repsRunId(R[0]), 1)], NOW, mulberry32(1));
    expect(plan.picks.map(p => p.lesson.id)).toEqual([R[0]]);
    expect(plan.due).toBe(1);
    // Finished yesterday and today: today wins, not due; still offered as a recent lesson.
    const today = planWarmUp([run(R[1], 1), run(R[1], 0.1)], NOW, mulberry32(1));
    expect(today.due).toBe(0);
    expect(today.picks.map(p => p.lesson.id)).toEqual([R[1]]);
  });
  it('falls back to the most recently finished Reps lessons for a new learner', () => {
    const runs = R.map((id, i) => run(id, 0.05 + i * 0.01)); // all today, R[0] newest
    const got = ids(runs);
    expect(got.length).toBeGreaterThanOrEqual(8);
    expect(got.length).toBeLessThanOrEqual(10);
    expect(got).toEqual(R.slice(0, got.length));
  });
  it('ignores runs in the future and runs of lessons without Reps', () => {
    expect(ids([run(R[0], -2), run(NO_REPS, 3)])).toEqual([]);
  });
  it('is deterministic given the rng', () => {
    const runs = R.map((id, i) => run(id, [1, 3, 7, 21][i % 4], 0.3 + (i % 5) * 0.15));
    for (const s of [1, 2, 99]) expect(ids(runs, s)).toEqual(ids(runs, s));
    const all = new Set([1, 2, 3, 4, 5, 6, 7, 8].map(s => ids(runs, s).join()));
    expect(all.size).toBeGreaterThan(1);
  });
  it('weights toward low acc and speed when more lessons are due than fit', () => {
    // Every Reps lesson due; half weak, half strong.
    const weak = new Set(R.filter((_, i) => i % 2 === 0));
    const runs = R.map((id, i) => (weak.has(id) ? run(id, [1, 3, 7, 21][i % 4], 0.3, 0.3) : run(id, [1, 3, 7, 21][i % 4], 1, 1)));
    let w = 0, s = 0;
    for (let seed = 1; seed <= 300; seed++) for (const id of ids(runs, seed)) (weak.has(id) ? w++ : s++);
    expect(w / weak.size).toBeGreaterThan(1.15 * (s / (R.length - weak.size)));
  });
  it('holds its invariants over random histories', () => {
    const rnd = mulberry32(2026);
    for (let t = 0; t < 400; t++) {
      const runs: Run[] = [];
      const n = Math.floor(rnd() * 40);
      for (let i = 0; i < n; i++) {
        const pool = [...R, NO_REPS, WARMUP_ID, ...R.map(repsRunId)];
        runs.push(run(pool[Math.floor(rnd() * pool.length)], rnd() * 40 - 1, rnd(), rnd()));
      }
      const plan = planWarmUp(runs, NOW, mulberry32(t));
      const got = plan.picks.map(p => p.lesson.id);
      const finished = new Set(R.filter(id => runs.some(r => (r.lesson === id || r.lesson === repsRunId(id)) && r.at <= NOW)));
      expect(new Set(got).size).toBe(got.length);
      for (const id of got) expect(finished.has(id), id).toBe(true);
      expect(got.length).toBeLessThanOrEqual(10);
      if (finished.size >= 8) expect(got.length).toBeGreaterThanOrEqual(8);
      else expect(got.length).toBe(finished.size);
      expect(plan.due).toBe(plan.picks.filter(p => p.due).length);
      for (const p of plan.picks) expect(p.seed >>> 0).toBe(p.seed);
      expect(planWarmUp(runs, NOW, mulberry32(t))).toEqual(plan);
    }
  });
});
