// Warm-up: a spaced, mixed review. Lessons with Reps that the learner last finished about 1, 3,
// 7 or 21 days ago are due; when more are due than fit, weak ones (low acc / speed) are likelier.
// A learner with nothing due gets the Reps lessons they finished most recently.
import { type Rng, randInt } from '../challenges/rng';
import { lessonOfRepsRun } from '../challenges/reps';
import { ORDER } from '../lessons';
import type { Lesson } from '../lessons/types';
import { WARMUP_ROUTE } from '../state/seed';
import type { Run } from '../state/store';

export const DAY = 86_400_000;
/** The run id Warm-ups are saved under. */
export const WARMUP_ID = WARMUP_ROUTE;
/** Lessons a Warm-up can draw from: those with a Reps spec. */
export const REPS_LESSONS: Lesson[] = ORDER.filter(l => l.reps);

/** Review intervals in days, each with its tolerance window [lo, hi) in days. */
const WINDOWS: { days: number; lo: number; hi: number }[] = [
  { days: 1, lo: 0.5, hi: 2 },
  { days: 3, lo: 2, hi: 4.5 },
  { days: 7, lo: 5.5, hi: 9.5 },
  { days: 21, lo: 17, hi: 26 },
];

/** The interval (1, 3, 7 or 21) an age in ms falls in, or null when it is not due. */
export function dueWindow(ageMs: number): number | null {
  const d = ageMs / DAY;
  return WINDOWS.find(w => d >= w.lo && d < w.hi)?.days ?? null;
}

/** A picked lesson: its own seed, whether it is due, and days since it was last finished. */
export type WarmUpPick = { lesson: Lesson; seed: number; due: boolean; ago: number };
export type WarmUpPlan = { picks: WarmUpPick[]; due: number };

/** Runs of the latest few per lesson that feed the weakness weight. */
const RECENT = 3;

/** Heavier for a lesson whose recent runs were slow or keyed well over par. */
const weight = (runs: Run[]) => {
  const r = runs.slice(-RECENT);
  const mean = (f: (x: Run) => number) => r.reduce((a, x) => a + f(x), 0) / r.length;
  const clamp = (v: number) => Math.min(1, Math.max(0, Number.isFinite(v) ? v : 1));
  return 1 + 3 * (1 - clamp(mean(x => x.acc))) + 3 * (1 - clamp(mean(x => x.speed)));
};

/** The Warm-up's lessons (8–10 when the learner has finished that many) and how many are due. */
export function planWarmUp(runs: Run[], now: number, rng: Rng): WarmUpPlan {
  const target = randInt(rng, 8, 10);
  const byLesson = new Map<string, Run[]>();
  for (const r of runs) {
    if (!(r.at <= now)) continue;
    const id = lessonOfRepsRun(r.lesson) ?? r.lesson;
    (byLesson.get(id) ?? byLesson.set(id, []).get(id)!).push(r);
  }
  const done = REPS_LESSONS.flatMap(lesson => {
    const rs = byLesson.get(lesson.id);
    if (!rs?.length) return [];
    rs.sort((a, b) => a.at - b.at);
    const last = rs[rs.length - 1].at;
    return [{ lesson, last, due: dueWindow(now - last) != null, w: weight(rs) }];
  });
  // Weighted sampling without replacement (Efraimidis–Spirakis): key = u^(1/w), highest first.
  const due = done.filter(x => x.due).map(x => ({ x, k: Math.pow(rng(), 1 / x.w) })).sort((a, b) => b.k - a.k).slice(0, target).map(e => e.x);
  const rest = done.filter(x => !x.due).sort((a, b) => b.last - a.last).slice(0, Math.max(0, target - due.length));
  const picks = [...due, ...rest].map(x => ({ lesson: x.lesson, seed: Math.floor(rng() * 0x100000000), due: x.due, ago: (now - x.last) / DAY }));
  return { picks, due: due.length };
}

/** The Warm-up's lessons, due ones first; each with its own seed. Deterministic given `rng`. */
export const selectWarmUp = (runs: Run[], now: number, rng: Rng): WarmUpPick[] => planWarmUp(runs, now, rng).picks;
