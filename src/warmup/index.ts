// Today's Warm-up: the plan is fixed for the calendar day (the selection rng is seeded by the
// date), so the sidebar, the page and a `#warm-up?seed=N` replay agree all day.
import { mulberry32 } from '../challenges/rng';
import type { Run } from '../state/store';
import { MAX_EDITS, MIN_EDITS } from './build';
import { DAY, type WarmUpPlan, planWarmUp } from './select';

export { warmUpChallenge, coverage } from './build';
export { WARMUP_ID, type WarmUpPick, type WarmUpPlan } from './select';

/** Local calendar day number of a timestamp. */
const dayOf = (now: number) => {
  const d = new Date(now);
  return Math.round(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / DAY);
};

export function todaysWarmUp(runs: Run[], now: number): WarmUpPlan {
  return planWarmUp(runs, now, mulberry32(dayOf(now) * 2654435761));
}

/** Edits in a Warm-up of this many lessons. */
export const editsFor = (lessons: number) => Math.max(MIN_EDITS, Math.min(MAX_EDITS, lessons));

/** The sidebar's line under "Warm-up". */
export function warmUpSub(plan: WarmUpPlan): string {
  if (!plan.picks.length) return 'nothing due yet';
  const items = `${editsFor(plan.picks.length)} items`;
  return plan.due ? `${items} · ${plan.due} ${plan.due === 1 ? 'lesson' : 'lessons'} due` : `${items} · recent lessons`;
}
