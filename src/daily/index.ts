// The Daily: one generated file a day, the same for everyone. The puzzle number counts local
// calendar days from launch (so #N is one date everywhere, like Wordle), the rung of the
// Challenges ladder rotates with it, and the seed is derived from the number. The first finished
// run of the day is the one the share card reports; replays are practice.
import { CHALLENGES, type ChallengeDef } from '../challenges';
import { type Generated, generate, motionKeys } from '../challenges/generate';
import { parseKeys } from '../vim/keys';
import type { Pos } from '../vim/types';
import { fmtClock } from '../state/format';
import type { Run } from '../state/store';
import { DAY } from '../warmup/select';

/** The route (`#daily`) and the prefix of the run ids dailies are saved under (`daily-<n>`). */
export const DAILY_ROUTE = 'daily';
export const dailyRunId = (n: number) => `${DAILY_ROUTE}-${n}`;
export const isDailyRun = (runId: string) => /^daily-\d+$/.test(runId);
export const SHARE_URL = 'https://vimchi.dev/#daily';

/** Local calendar day number of a timestamp. */
const dayOf = (now: number) => {
  const d = new Date(now);
  return Math.round(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / DAY);
};
/** Daily #1 is 2026-10-17. */
const LAUNCH = Math.round(Date.UTC(2026, 9, 17) / DAY);

export const dailyNumber = (now: number) => Math.max(1, dayOf(now) - LAUNCH + 1);

export type Daily = { n: number; id: string; rung: ChallengeDef; seed: number; generated: Generated };

const cache = new Map<number, Daily>();

export function daily(n: number): Daily {
  const hit = cache.get(n);
  if (hit) return hit;
  const rung = CHALLENGES[(n - 1) % CHALLENGES.length];
  const seed = Math.imul(n, 2654435761) >>> 0;
  const out = { n, id: dailyRunId(n), rung, seed, generated: generate(rung.challenge, seed) };
  cache.set(n, out);
  return out;
}

export const GREEN = '🟩', YELLOW = '🟨', RED = '🟥';

/**
 * One square per checklist item, in the order they were finished: green at or under par, yellow
 * near it (the rounds' "near par" rule: 1.5x + 1), red past that. Keys spent are those since the
 * previous finish; par is the item's fix plus the motion from where the previous finished item's
 * fix was (the generator's own motion model, so any order is graded on the trip actually taken,
 * and a checklist-order run's pars add up to the run's). Items finished by one key (a `:%s`)
 * share that span and the sum of their pars. A fix the generator wrote as `.` or `N@a` gets that
 * discount only when it holds in finishing order: `.` right after an item with the same keys, `@a`
 * while register a still holds the same macro body (the last macro recorded, in finishing order). `ticks[i]` is the key count at which item i settled
 * (Session.ticks); the last group is charged every key up to `keys`, the run's total.
 */
export function dailyGrid(g: Pick<Generated, 'start' | 'items'>, ticks: readonly number[], keys: number): string {
  const order = g.items.map((_, i) => i).filter(i => ticks[i] > 0).sort((a, b) => ticks[a] - ticks[b] || a - b);
  let out = '', prev = 0, at: Pos = { line: 0, col: 0 };
  const own = (i: number) => g.items[i].soloKeys ?? g.items[i].fixKeys;
  let before: string | null = null;
  let register: string | null = null;
  for (let k = 0; k < order.length;) {
    const t = ticks[order[k]];
    const same = order.slice(k).filter(i => ticks[i] === t);
    let budget = 0;
    for (const i of same) {
      const it = g.items[i];
      const reuse = it.soloKeys != null && (it.fixKeys === '.' ? before === it.soloKeys : it.macro != null && register === it.macro);
      budget += parseKeys(reuse ? it.fixKeys : own(i)).length + (it.anywhere ? 0 : motionKeys(g.start, at, it.fixAt));
      before = own(i);
      if (it.macro != null) register = it.macro;
      if (!it.anywhere) at = it.fixAt;
    }
    const last = k + same.length === order.length;
    const spent = (last ? Math.max(t, keys) : t) - prev;
    const sq = spent <= budget ? GREEN : spent <= Math.ceil(budget * 1.5) + 1 ? YELLOW : RED;
    out += sq.repeat(same.length);
    prev = t;
    k += same.length;
  }
  return out;
}

/** The first finished run of a daily, or null. */
export const firstRun = (runs: readonly Run[]) => (runs.length ? runs.reduce((a, r) => (r.at < a.at ? r : a)) : null);

/** The share card's text. `grid` is omitted when this browser did not see the run. */
export function shareText(d: Daily, run: Pick<Run, 'keys' | 'time'>, grid: string | null): string {
  return [
    `vimchi daily #${d.n} · ${d.rung.title}`,
    `${run.keys} keys (par ${d.generated.parKeys}) · ${fmtClock(run.time)}`,
    ...(grid ? [grid] : []),
    SHARE_URL,
  ].join('\n');
}

const GRID_KEY = 'vimchi.daily.grid';

/**
 * The first run's grid, kept in this browser (runs on the server carry no per-item detail). It is
 * keyed by the run's `at`, so a grid from another account or a later run never lands on the card.
 */
export function loadGrid(n: number, at: number): string | null {
  try {
    const v = JSON.parse(localStorage.getItem(GRID_KEY) ?? 'null');
    return v && v.n === n && v.at === at && typeof v.grid === 'string' ? v.grid : null;
  } catch {
    return null;
  }
}

export function saveGrid(n: number, at: number, grid: string) {
  try {
    localStorage.setItem(GRID_KEY, JSON.stringify({ n, at, grid }));
  } catch {
    /* storage unavailable: the card goes without its grid */
  }
}
