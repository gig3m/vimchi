// "How would a better Vim user have done that?" over a session's key log.
import { LESSONS, sectionOf } from '../lessons';
import { createVim, solutionKeys } from '../lessons/runtime';
import type { Challenge } from '../lessons/types';
import { betterMotions } from './motion';
import { type SessionLike, sameOutcome, stateBefore, stateNeeds } from './replay';
import { RULES, type Suggestion, WHY, keyCount } from './rules';
import { type Segment, segment } from './segment';
import { coachable, commandTokens, taughtBy, tokenize, usesAllowed } from './vocab';

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
/** Motion critiques must clear the owner's threshold; an edit rule teaches a named command, so any real saving counts. */
const worth = (learner: number, s: Suggestion) =>
  s.rule === 'motion' ? s.saves >= MIN_SAVES || (learner >= RATIO_MIN_KEYS && learner >= RATIO * (learner - s.saves)) : s.saves >= 1;
const notation = (keys: string[]) => keys.join('');

/** Segments recorded inside a macro: between a `q<reg>` break and the next `q` break (or a boundary). */
function recordingSpans(segs: Segment[], log: { boundary: boolean }[]): Set<number> {
  const out = new Set<number>();
  let open = -1;
  segs.forEach((s, i) => {
    if (log[s.logStart]?.boundary) open = -1;
    if (s.kind === 'break' && s.keys.length === 2 && s.keys[0] === 'q') open = i;
    else if (s.kind === 'break' && s.keys.length === 1 && s.keys[0] === 'q') open = -1;
    else if (open >= 0) out.add(i);
  });
  return out;
}

/** The commands a reference solution runs, replayed on the round's setup: typed text and arguments are not "keys". */
function referenceTokens(session: CoachSession, unit: number, sol: string): string[] {
  const vim = createVim(session.setupFor(unit));
  const out: string[] = [];
  let last = vim.lastCommand;
  for (const k of solutionKeys(sol)) {
    vim.feed(k);
    if (vim.lastCommand && vim.lastCommand !== last) { last = vim.lastCommand; if (!last.error) out.push(...commandTokens(last.keys)); }
  }
  return out;
}

/** The one-line live hint for a critique. */
export const nudgeText = (c: Critique) => `${c.better[0].keys} does that in ${keyCount(c.better[0].keys)}`;

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
  // Never undercut what this lesson (and the section's lessons before it) drills: a Search lesson
  // must not be told not to search. Compared as commands the learner ran, not raw keys, so the
  // `k` in a `dk` chip is an operator motion, not a walk, and an `f,` target is not the `,` chip.
  const lesson = LESSONS[lessonId];
  const upTo = lesson.challenge.kind === 'generated' ? [lesson] : (() => { const ls = sectionOf(lessonId).lessons; return ls.slice(0, ls.findIndex(l => l.id === lessonId) + 1); })();
  const drilled = new Set(upTo.flatMap(l => l.chips.flatMap(tokenize)));
  const log = session.log();
  const ranTokens = (seg: Segment) => { const t: string[] = []; for (let k = seg.logStart; k <= seg.logEnd; k++) { const c = log[k].command; if (c) t.push(...commandTokens(c.keys)); } return t; };
  /** A suggestion undercuts when it drops a drilled command the learner ran; a shorter search pattern
   * for a search the learner already made is a nitpick, not a better way. */
  const undercuts = (seg: Segment, sug: Suggestion) => {
    const ran = ranTokens(seg);
    if (ran.some(t => t === '/' || t === '?') && sug.uses.some(u => u === '/' || u === '?')) return true;
    return ran.some(t => drilled.has(t) && !sug.uses.includes(t));
  };
  if (recordingSpans(segs, log).has(i)) return null;

  // Edit rules first: some windows start with a motion (`$a` → `A`), and a rule that consumes the
  // motion says more than a shorter route to the same spot would.
  if (seg.kind === 'edit' || seg.kind === 'motion') {
    const lines = stateBefore(session, seg.logStart).buf.lines;
    // A rule window never crosses a boundary (round load, :reset): cut the segment list there.
    let end = i + 1;
    while (end < segs.length && !log[segs[end].logStart]?.boundary) end++;
    const window = segs.slice(0, end);
    for (const r of RULES) {
      const hit = r.apply(window, i, { lines });
      if (!hit) continue;
      // Never-undercut does not apply here: a rule replaces the drilled key with a better command
      // on purpose, and the vocabulary gate has already checked that command is taught.
      const span = segs.slice(i, i + hit.consumed);
      const learner = span.reduce((a, s) => a + s.keys.length, 0);
      for (const sug of hit.suggestions) {
        if (!worth(learner, sug) || !usesAllowed(sug.uses, taught)) continue;
        if (!verify(session, seg, span[span.length - 1], sug.keys)) continue;
        return { unit: seg.unit, you: span.map(s => notation(s.keys)).join(''), better: [sug], logStart: seg.logStart, logEnd: span[span.length - 1].logEnd };
      }
    }
  }
  if (seg.kind === 'motion') {
    const vim = stateBefore(session, seg.logStart);
    const rnu = !!((vim.win as { opts?: { relativenumber?: boolean } }).opts?.relativenumber ?? vim.options.relativenumber);
    // Reinforce this lesson: a route using its own key is kept and ranked before a cheaper one that does not.
    const own = new Set(lesson.chips.flatMap(tokenize));
    const cands = betterMotions(vim.buf.lines, seg.from, vim.win.want, seg.to, seg.keys.length, taught, { relativenumber: rnu, prefer: own });
    const reinforces = (c: { uses: string[] }) => c.uses.some(u => own.has(u));
    cands.sort((a, b) => Number(reinforces(b)) - Number(reinforces(a)) || a.cost - b.cost);
    const better: Suggestion[] = [];
    for (const c of cands) {
      const s: Suggestion = { keys: c.keys, saves: seg.keys.length - c.cost, why: WHY.motion, rule: 'motion', uses: c.uses };
      if (!worth(seg.keys.length, s) || !usesAllowed(c.uses, taught) || undercuts(seg, s)) continue;
      if (!verify(session, seg, seg, c.keys)) continue;
      better.push(s);
      if (better.length === 2) break;
    }
    return better.length ? { unit: seg.unit, you: notation(seg.keys), better, logStart: seg.logStart, logEnd: seg.logEnd } : null;
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
      const ok = usesAllowed(referenceTokens(session, u, sol), taught);
      reference.push({ unit: u, you, par, ref: ok && !session.carried(u) ? sol : undefined });
    }
  }
  reference.sort((a, b) => (b.you - b.par) - (a.you - a.par));
  return { critiques, reference: reference.slice(0, 3) };
}

export { keyCount };
