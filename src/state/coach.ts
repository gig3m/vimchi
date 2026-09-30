// Coach memory: what the coach said across runs, so it can say "3rd run in a row" and stop
// repeating a hint the learner has absorbed. Patterns and counts only: no keys or buffer text
// leave the browser (a critique's keys become one bucketed `used` label).
//
// Signed-in learners: events ride on the run (`coach`, `mix`) to the server, which derives the
// profile on read (`GET /api/coach/profile`). Guests: the same profile shape lives in
// localStorage (`vimchi.coach.profile.v1`), and their events move with their runs on sign-in.
// `stepProfile` mirrors the server's fold (server/internal/store/coach.go); keep them in step.
import { useSyncExternalStore } from 'react';
import type { Critique, Report, Summary } from '../coach';
import { ApiError, api } from './api';

/** What the learner did, bucketed: a run of one key (xxxx, llll), retyped text, a motion run, other commands. */
export type Used = 'key-run' | 'retype' | 'motions' | 'commands';
export type CoachEvent = { pattern: string; lesson: string; unit: number; you: number; better: number; used: Used; at: number };
export type KeyMix = { moving: number; typing: number; editing: number };
export type PatternStat = { seen: number; runs: number; lastSeen: number; fixedStreak: number; firstSeenLesson: string };
export type CoachProfile = {
  patterns: Record<string, PatternStat>;
  /** The last KEY_MIX_RUNS coached runs, oldest first. */
  keyMix: (KeyMix & { at: number; lesson: string })[];
  /** The patterns of the last RECENT_RUNS coached runs, oldest first. */
  recent: { at: number; patterns: string[] }[];
};
/** A coached run as the profile sees it. */
export type CoachRun = { lesson: string; at: number; mix?: KeyMix; events: CoachEvent[] };
/** The optional fields a run carries to the server (and into the guest run list, for import). */
export type CoachFields = { coach?: CoachEvent[]; mix?: KeyMix };

export const MAX_EVENTS = 10;
export const KEY_MIX_RUNS = 20;
export const RECENT_RUNS = 5;
/** Clean coached runs after which a pattern's live hint retires. */
export const RETIRE_AFTER = 5;
/** Runs (of the last RECENT_RUNS, this one included) a pattern must show up in to earn a callout. */
export const CALLOUT_MIN = 3;

export const emptyProfile = (): CoachProfile => ({ patterns: {}, keyMix: [], recent: [] });

/** Fold one coached run into the profile (a new object; the input is not changed). */
export function stepProfile(p: CoachProfile, run: CoachRun): CoachProfile {
  const count = new Map<string, number>();
  const first = new Map<string, string>();
  for (const e of run.events) {
    if (!count.has(e.pattern)) first.set(e.pattern, e.lesson);
    count.set(e.pattern, (count.get(e.pattern) ?? 0) + 1);
  }
  const patterns: Record<string, PatternStat> = {};
  for (const [id, s] of Object.entries(p.patterns)) patterns[id] = count.has(id) ? { ...s } : { ...s, fixedStreak: s.fixedStreak + 1 };
  for (const [id, n] of count) {
    const s = patterns[id] ?? { seen: 0, runs: 0, lastSeen: 0, fixedStreak: 0, firstSeenLesson: first.get(id)! };
    patterns[id] = { ...s, seen: s.seen + n, runs: s.runs + 1, lastSeen: Math.max(s.lastSeen, run.at), fixedStreak: 0 };
  }
  const keyMix = run.mix ? [...p.keyMix, { at: run.at, lesson: run.lesson, ...run.mix }].slice(-KEY_MIX_RUNS) : p.keyMix;
  const recent = [...p.recent, { at: run.at, patterns: [...count.keys()] }].slice(-RECENT_RUNS);
  return { patterns, keyMix, recent };
}

/** The bucket for what the learner did in a critique; the keys themselves are not kept. */
export function usedBucket(c: Critique): Used {
  const keys = c.youChips.filter(ch => ch.kind === 'key').map(ch => ch.v);
  for (let i = 2; i < c.youChips.length; i++) {
    const [a, b, d] = c.youChips.slice(i - 2, i + 1);
    if (a.kind === 'key' && b.kind === 'key' && d.kind === 'key' && a.v === b.v && b.v === d.v) return 'key-run';
  }
  if (c.youChips.some(ch => ch.kind === 'text')) return 'retype';
  if (c.better[0]?.rule === 'motion' || !keys.length) return 'motions';
  return 'commands';
}

/** One event per critique (its first better way), at most MAX_EVENTS: the report's own order, biggest saving first. */
export function coachEvents(report: Report, lesson: string, at: number): CoachEvent[] {
  return report.critiques.filter(c => c.better.length).slice(0, MAX_EVENTS).map(c => {
    const b = c.better[0];
    return { pattern: b.pattern, lesson, unit: c.unit, you: c.keys, better: Math.max(0, c.keys - b.saves), used: usedBucket(c), at };
  });
}

export const keyMixOf = (s: Summary): KeyMix => ({ moving: s.moving, typing: s.typing, editing: s.editing });

const ordinal = (n: number) => {
  const t = n % 100;
  return n + (t >= 11 && t <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th');
};

/** How often a pattern shows up now, counting the current run (not yet in the profile) as one. */
export function recurrence(p: CoachProfile, pattern: string): { inRow: number; inLast: number } {
  const prev = p.recent.slice(-(RECENT_RUNS - 1));
  let inRow = 1;
  for (let i = prev.length - 1; i >= 0 && prev[i].patterns.includes(pattern); i--) inRow++;
  return { inRow, inLast: 1 + prev.filter(r => r.patterns.includes(pattern)).length };
}

/** "3rd run in a row:" when the pattern has come up in ≥3 of the last 5 runs (this one included), else null. */
export function calloutPrefix(p: CoachProfile, pattern: string): string | null {
  const { inRow, inLast } = recurrence(p, pattern);
  if (inLast < CALLOUT_MIN) return null;
  // With fewer than RECENT_RUNS runs so far, "of your last 5" would count runs that never happened.
  const window = Math.min(RECENT_RUNS, p.recent.length + 1);
  return inRow >= CALLOUT_MIN ? `${ordinal(inRow)} run in a row:` : `${inLast} of your last ${window} runs:`;
}

/** Callouts for the patterns a report names, from the profile as it was before this run. */
export function callouts(p: CoachProfile, events: readonly CoachEvent[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const e of events) {
    const c = calloutPrefix(p, e.pattern);
    if (c) out[e.pattern] = c;
  }
  return out;
}

/** Mastered: RETIRE_AFTER clean coached runs since it last came up. The live hint goes; the report still lists it. */
export const retired = (p: CoachProfile, pattern: string) => (p.patterns[pattern]?.fixedStreak ?? 0) >= RETIRE_AFTER;

/** The patterns that keep coming back: not retired, most runs first, then most recent. */
export function topRecurring(p: CoachProfile, n = 3): (PatternStat & { id: string })[] {
  return Object.entries(p.patterns)
    .filter(([, s]) => s.fixedStreak < RETIRE_AFTER)
    .map(([id, s]) => ({ id, ...s }))
    .sort((a, b) => b.runs - a.runs || b.seen - a.seen || b.lastSeen - a.lastSeen)
    .slice(0, n);
}

/** Share of keys moving / typing / editing over the profile's key-mix window (0..1 each), or null with no data. */
export function mixShare(p: CoachProfile): (KeyMix & { runs: number }) | null {
  const t = p.keyMix.reduce((a, m) => ({ moving: a.moving + m.moving, typing: a.typing + m.typing, editing: a.editing + m.editing }), { moving: 0, typing: 0, editing: 0 });
  const all = t.moving + t.typing + t.editing;
  if (!all) return null;
  return { moving: t.moving / all, typing: t.typing / all, editing: t.editing / all, runs: p.keyMix.length };
}

// ---- Storage and the live profile ----------------------------------------------------------

export const GUEST_KEY = 'vimchi.coach.profile.v1';
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : 0);

/** Accept a profile from storage or the server, dropping anything malformed. */
export function normalizeProfile(v: unknown): CoachProfile {
  const out = emptyProfile();
  if (!v || typeof v !== 'object') return out;
  const o = v as Record<string, unknown>;
  if (o.patterns && typeof o.patterns === 'object') {
    for (const [id, s] of Object.entries(o.patterns as Record<string, Record<string, unknown>>)) {
      if (!/^[a-z-]{1,32}$/.test(id) || !s || typeof s !== 'object') continue;
      out.patterns[id] = { seen: num(s.seen), runs: num(s.runs), lastSeen: num(s.lastSeen), fixedStreak: num(s.fixedStreak), firstSeenLesson: typeof s.firstSeenLesson === 'string' ? s.firstSeenLesson : '' };
    }
  }
  if (Array.isArray(o.keyMix)) {
    out.keyMix = o.keyMix.filter(m => m && typeof m === 'object').map(m => ({ at: num(m.at), lesson: typeof m.lesson === 'string' ? m.lesson : '', moving: num(m.moving), typing: num(m.typing), editing: num(m.editing) })).slice(-KEY_MIX_RUNS);
  }
  if (Array.isArray(o.recent)) {
    out.recent = o.recent.filter(r => r && typeof r === 'object').map(r => ({ at: num(r.at), patterns: Array.isArray(r.patterns) ? r.patterns.filter((x: unknown): x is string => typeof x === 'string') : [] })).slice(-RECENT_RUNS);
  }
  return out;
}

export function loadGuestProfile(): CoachProfile {
  try { return normalizeProfile(JSON.parse(localStorage.getItem(GUEST_KEY) ?? 'null')); } catch { return emptyProfile(); }
}
function saveGuestProfile(p: CoachProfile) {
  try { localStorage.setItem(GUEST_KEY, JSON.stringify(p)); } catch { /* tab-only until storage comes back */ }
}

type State = { mode: 'loading' | 'guest' | 'account'; profile: CoachProfile };
let state: State = { mode: 'loading', profile: emptyProfile() };
/** Runs finished before we knew guest vs account: a guest's are folded in once known (an account's are on the server). */
let pending: CoachRun[] = [];
const subs = new Set<() => void>();
const set = (s: State) => { state = s; subs.forEach(f => f()); };

function asGuest() {
  let p = loadGuestProfile();
  for (const r of pending) p = stepProfile(p, r);
  if (pending.length) saveGuestProfile(p);
  pending = [];
  set({ mode: 'guest', profile: p });
}

// Guest or account is the progress store's call (it owns /api/me and the guest import), so the
// coach never asks the server on its own: a guest gets no /api/coach/profile 401, and a new
// account's profile is read only after its guest runs (and their coach events) have moved over.

/** No session (a guest, a signed-out learner, or an expired session): the browser's guest profile. */
export function coachGuest() { asGuest(); }

/**
 * Signed in, and the guest import (if any) is done: read the account's profile. A 401 means the
 * session went meanwhile (guest). Any other failure (a 5xx, offline) keeps account mode with this
 * session's runs held in memory: an account's runs never land in the guest profile.
 */
export async function coachSignedIn(): Promise<void> {
  try {
    const p = await api.coachProfile();
    pending = [];
    set({ mode: 'account', profile: normalizeProfile(p) });
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) return asGuest();
    let p = emptyProfile();
    for (const r of pending) p = stepProfile(p, r);
    pending = [];
    set({ mode: 'account', profile: p });
  }
}

/** The guest's runs moved to an account: their profile went with them, so the browser's copy goes. */
export function forgetGuestCoach() {
  try { localStorage.removeItem(GUEST_KEY); } catch { /* storage unavailable */ }
}

/** Tests only: back to the state before the first load. */
export function resetCoach() { state = { mode: 'loading', profile: emptyProfile() }; pending = []; }

export const getCoachProfile = () => state.profile;
export const coachMode = () => state.mode;

/** A finished coached run: fold it in now so the next hint sees it. Guests keep it in localStorage. */
export function recordCoachRun(run: CoachRun) {
  if (state.mode === 'loading') pending.push(run);
  const profile = stepProfile(state.profile, run);
  if (state.mode === 'guest') saveGuestProfile(profile);
  set({ ...state, profile });
}

const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; };
export function useCoachProfile(): CoachProfile {
  return useSyncExternalStore(subscribe, getCoachProfile, getCoachProfile);
}
