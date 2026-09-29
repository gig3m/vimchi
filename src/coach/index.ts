// "How would a better Vim user have done that?" over a session's key log.
import { LESSONS, sectionOf } from '../lessons';
import { solutionKeys } from '../lessons/runtime';
import type { Challenge } from '../lessons/types';
import { betterMotions } from './motion';
import { type SessionLike, sameOutcome, stateBefore, stateNeeds } from './replay';
import { RULES, type Suggestion, WHY, keyCount } from './rules';
import { type Segment, segment } from './segment';
import { coachable, taughtBy, tokenize, usesAllowed } from './vocab';

export type { Suggestion };
export type Critique = { unit: number; you: string; better: Suggestion[]; logStart: number; logEnd: number };
export type RefLine = { unit: number; you: number; par: number; ref?: string };
export type Report = { critiques: Critique[]; reference: RefLine[] };
export type CoachSession = SessionLike & {
  challenge: Challenge;
  roundPar(unit: number): number | null;
  roundSolution(unit: number): string | null;
  carried(unit: number): boolean;
};

export const MIN_SAVES = 2;
export const RATIO = 1.5;
/** The ratio rule needs a run long enough for a ratio to mean something (j0 → w is a nitpick). */
const RATIO_MIN_KEYS = 4;
const worth = (learner: number, s: Suggestion) => s.saves >= MIN_SAVES || (learner >= RATIO_MIN_KEYS && learner >= RATIO * (learner - s.saves));
const notation = (keys: string[]) => keys.join('');

/** Segments recorded inside a macro: between a `q<reg>` break and the next `q` break in the same unit. */
function recordingSpans(segs: Segment[]): Set<number> {
  const out = new Set<number>();
  let open = -1;
  segs.forEach((s, i) => {
    if (s.kind === 'break' && s.keys.length === 2 && s.keys[0] === 'q') open = i;
    else if (s.kind === 'break' && s.keys.length === 1 && s.keys[0] === 'q') open = -1;
    else if (open >= 0) out.add(i);
  });
  return out;
}

/** Replay both routes from the segment start; the suggestion must end in the same outcome. */
function verify(session: CoachSession, seg: Segment, endSeg: Segment, keys: string): boolean {
  const log = session.log();
  const a = stateBefore(session, seg.logStart);
  for (let k = seg.logStart; k <= endSeg.logEnd; k++) a.feed(log[k].key);
  const b = stateBefore(session, seg.logStart);
  b.feedKeys(keys);
  return sameOutcome(a, b, stateNeeds(log, endSeg.logEnd, seg.unit));
}

export function coachSegment(session: CoachSession, lessonId: string, seg: Segment, segs: Segment[], i: number): Critique | null {
  if (!coachable(lessonId)) return null;
  const taught = taughtBy(lessonId);
  // Never undercut what this lesson's section drills: a Search lesson must not be told not to search.
  const lesson = LESSONS[lessonId];
  const drilled = new Set((lesson.challenge.kind === 'generated' ? [lesson] : sectionOf(lessonId).lessons).flatMap(l => l.chips.flatMap(tokenize)));
  const usedDrilled = (keys: string[]) => keys.some(k => drilled.has(k));
  if (recordingSpans(segs).has(i)) return null;

  if (seg.kind === 'motion') {
    if (usedDrilled(seg.keys)) return null;
    const vim = stateBefore(session, seg.logStart);
    const cands = betterMotions(vim.buf.lines, seg.from, vim.win.want, seg.to, seg.keys.length, taught);
    const better: Suggestion[] = [];
    for (const c of cands) {
      const s: Suggestion = { keys: c.keys, saves: seg.keys.length - c.cost, why: WHY.motion, rule: 'motion', uses: c.uses };
      if (!worth(seg.keys.length, s) || !usesAllowed(c.uses, taught)) continue;
      if (!verify(session, seg, seg, c.keys)) continue;
      better.push(s);
      if (better.length === 2) break;
    }
    return better.length ? { unit: seg.unit, you: notation(seg.keys), better, logStart: seg.logStart, logEnd: seg.logEnd } : null;
  }
  if (seg.kind === 'edit') {
    const lines = stateBefore(session, seg.logStart).buf.lines;
    for (const r of RULES) {
      const hit = r.apply(segs, i, { lines });
      if (!hit) continue;
      const span = segs.slice(i, i + hit.consumed);
      const learner = span.reduce((a, s) => a + s.keys.length, 0);
      if (span.some(s => s.kind === 'edit' && usedDrilled(s.keys))) continue;
      for (const sug of hit.suggestions) {
        if (!worth(learner, sug) || !usesAllowed(sug.uses, taught)) continue;
        if (!verify(session, seg, span[span.length - 1], sug.keys)) continue;
        return { unit: seg.unit, you: span.map(s => notation(s.keys)).join(''), better: [sug], logStart: seg.logStart, logEnd: span[span.length - 1].logEnd };
      }
    }
  }
  return null;
}

export function coach(session: CoachSession, lessonId: string): Report {
  const empty: Report = { critiques: [], reference: [] };
  if (!coachable(lessonId)) return empty;
  const segs = segment(session.log());
  const critiques: Critique[] = [];
  let i = 0;
  while (i < segs.length) {
    const c = coachSegment(session, lessonId, segs[i], segs, i);
    if (!c) { i++; continue; }
    critiques.push(c);
    const next = segs.findIndex((s, k) => k > i && s.logStart > c.logEnd);
    if (next < 0) break;
    i = next;
  }
  // Merge a motion critique with a rule critique that consumed the same motion (jj$a → 2j + A).
  for (let k = critiques.length - 1; k > 0; k--) {
    const a = critiques[k - 1], b = critiques[k];
    if (a.logEnd >= b.logStart) { a.better = [...a.better, ...b.better]; a.logEnd = b.logEnd; critiques.splice(k, 1); }
  }
  const bestSaves = (c: Critique) => Math.max(...c.better.map(s => s.saves));
  critiques.sort((a, b) => bestSaves(b) - bestSaves(a) || a.unit - b.unit || a.logStart - b.logStart);

  const reference: RefLine[] = [];
  const taught = taughtBy(lessonId);
  if (session.challenge.kind === 'rounds') {
    const log = session.log();
    for (let u = 0; u < session.challenge.rounds.length; u++) {
      const par = session.roundPar(u);
      const sol = session.roundSolution(u);
      if (par === null || sol === null) continue;
      const you = log.filter(e => e.unit === u).length;
      if (you - par < MIN_SAVES) continue;
      const refKeys = solutionKeys(sol);
      const ok = usesAllowed(refKeys.flatMap(k => tokenize(k)), taught);
      reference.push({ unit: u, you, par, ref: ok && !session.carried(u) ? sol : undefined });
    }
  }
  reference.sort((a, b) => (b.you - b.par) - (a.you - a.par));
  return { critiques, reference: reference.slice(0, 3) };
}

export { keyCount };
