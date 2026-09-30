// "How would a better Vim user have done that?" over a session's key log.
import { MAX_MOTION_KEYS } from '../challenges/generate';
import { LESSONS, sectionOf } from '../lessons';
import { type LogEntry, createVim, shortestPath, solutionKeys } from '../lessons/runtime';
import type { Challenge, Setup } from '../lessons/types';
import type { Generated } from '../challenges/generate';
import { type Oracle, betterMotions } from './motion';
import { type Key, parseKeys as parseNotation } from '../vim/keys';
import type { Vim } from '../vim/editor';
import { type SessionLike, sameOutcome, stateBefore, stateNeeds } from './replay';
import { type Idiom, searchIdioms } from './idiom';
import { PATTERNS, motionPattern } from './patterns';
import { type Segment, segment } from './segment';
import { TEXT_MODES, WARM_UP, coachable, commandTokens, taughtBy, tokenize, usesAllowed, warmUpTaught } from './vocab';

/** One better way: `pattern` names the idea (see PATTERNS) and `why` is its principle. */
export type Suggestion = { keys: string; saves: number; why: string; rule: string; uses: string[]; pattern: string };
/** A key sequence for display: command keys one by one, text typed in insert/replace/cmdline mode as one run. */
export type Chip = { kind: 'key' | 'text'; v: string };
/** `keys` is how many keys the learner spent on the span. */
export type Critique = { unit: number; you: string; youChips: Chip[]; keys: number; better: (Suggestion & { chips: Chip[] })[]; logStart: number; logEnd: number };
/** A round (with the lesson's reference solution) or a generated item (par only). */
export type RefLine = { unit: number; you: number; par: number; ref?: string; chips?: Chip[]; kind?: 'round' | 'item' };
/** Where the keys went: moving the cursor, typing text, and everything else (commands, operators, <Esc>). */
export type Summary = { keys: number; moving: number; typing: number; editing: number; par: number | null };
export type Report = { critiques: Critique[]; reference: RefLine[]; summary: Summary };
export type CoachSession = SessionLike & {
  challenge: Challenge;
  roundPar(unit: number): number | null;
  roundSolution(unit: number): string | null;
  carried(unit: number): boolean;
  generated?: Generated | null;
  /** Warm-up only: the lesson ids the run drew from (its picks). The coach suggests only keys those
   * lessons taught; without them it falls back to the earliest lesson drilling each of the run's kinds. */
  picks?: readonly string[];
};

/** Key count of a notation string: <Esc>, <CR>, <lt> etc. are one key each. */
export const keyCount = (s: string) => s.replace(/<[^>]+>/g, 'K').length;
/** Keys as a notation string (a literal < is <lt>, so the string parses back to the same keys). */
const toNotation = (keys: readonly Key[]) => keys.map(k => (k === '<' ? '<lt>' : k)).join('');

/** Replay keys on a scratch editor and group them by the mode each was fed in. The editor is mutated. */
export function keyChips(vim: Vim, keys: readonly string[]): Chip[] {
  const out: Chip[] = [];
  for (const k of keys) {
    const text = TEXT_MODES.has(vim.mode) && !vim.modal && /^(.|<Space>|<lt>|<Bslash>|<Bar>)$/.test(k);
    const ch = k === '<Space>' ? ' ' : k === '<lt>' ? '<' : k === '<Bslash>' ? '\\' : k === '<Bar>' ? '|' : k;
    const last = out[out.length - 1];
    if (text && last?.kind === 'text') last.v += ch;
    else out.push(text ? { kind: 'text', v: ch } : { kind: 'key', v: k });
    vim.feed(k);
  }
  return out;
}

export const MIN_SAVES = 2;
export const RATIO = 1.5;
/** The ratio rule needs a run long enough for a ratio to mean something (j0 → w is a nitpick). */
const RATIO_MIN_KEYS = 4;
/** Motion critiques must clear the owner's threshold. */
const motionWorth = (learner: number, saves: number) => saves >= MIN_SAVES || (learner >= RATIO_MIN_KEYS && learner >= RATIO * (learner - saves));

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

/** The commands a solution runs on a setup, replayed through the engine: typed text and arguments are not "keys". */
export function solutionCommands(setup: Setup, sol: string): string[] {
  const vim = createVim(setup);
  const out: string[] = [];
  let last = vim.lastCommand;
  let keys: string[] = [];
  for (const k of solutionKeys(sol)) {
    const text = TEXT_MODES.has(vim.mode) || !!vim.modal;
    vim.feed(k);
    if (!text) keys.push(k);
    if (vim.lastCommand && vim.lastCommand !== last) {
      last = vim.lastCommand;
      if (!last.error && last.kind !== 'modal') out.push(...commandTokens(keys));
      keys = [];
    }
  }
  return out;
}
const referenceTokens = (session: CoachSession, unit: number, sol: string) => solutionCommands(session.setupFor(unit), sol);

/** The one-line live hint: the idea's name, the keys, and the count it replaces. */
export const nudgeText = (c: Critique) => {
  const b = c.better[0];
  return `${PATTERNS[b.pattern]?.name ?? 'Better'}: ${b.keys} (${keyCount(b.keys)} instead of ${c.keys})`;
};

/** Does a route use one of this lesson's chips? A chip with a count (`d3w`) needs a count too. */
function reinforcer(lessonId: string): (uses: readonly string[]) => boolean {
  const chips = (LESSONS[lessonId]?.chips ?? []).map(c => [...tokenize(c), ...(/\d/.test(c) ? ['COUNT'] : [])]).filter(t => t.length);
  return uses => chips.some(need => need.every(t => uses.includes(t)));
}

/** Replay the learner's keys [start..end] and the suggestion from the same state; same outcome?
 * The cursor may differ when the learner moves on (a motion, a break or the end follows): where an
 * idiom leaves the cursor (`~` steps right, `>>` goes to the indent) is not part of the edit. */
function verifyKeys(session: CoachSession, start: number, end: number, keys: readonly Key[], relaxCursor: boolean): boolean {
  const log = session.log();
  const a = stateBefore(session, start);
  for (let k = start; k <= end; k++) a.feed(log[k].key);
  const b = stateBefore(session, start);
  for (const k of keys) b.feed(k);
  return sameOutcome(a, b, stateNeeds(log, end, log[start].unit), { cursor: !relaxCursor });
}

/** `own`: this lesson's chip tokens; `drilled`: those of the section's lessons up to this one (the motion critic never removes one the learner ran). */
type Ctx = { lessonId: string; taught: Set<string>; own: Set<string>; drilled: Set<string>; reinforces: (uses: readonly string[]) => boolean };

/** The edit-window critique for segment i: the learner's keys from a start (the edit, or a
 * command boundary inside the motion run before it) through one to four edits, against one
 * idiom that makes the same change. Best saving wins. */
function idiomCritique(session: CoachSession, ctx: Ctx, segs: Segment[], i: number): Critique | null {
  const log = session.log();
  const seg = segs[i];
  const firstEdit = seg.kind === 'edit' ? i : segs[i + 1]?.kind === 'edit' && !log[segs[i + 1].logStart].boundary ? i + 1 : -1;
  if (firstEdit < 0) return null;
  // Window starts: the edit itself, or the last few commands of the motion run leading into it
  // (`b` + `cw…` is `ciw…` from where the learner stood).
  // The edit's own start is tried too, so a window that absorbs a motion must beat the edit alone.
  const editStart = segs[firstEdit].logStart;
  const starts: number[] = [editStart];
  if (seg.kind === 'motion') {
    for (let k = seg.logEnd; k >= seg.logStart && starts.length < 4; k--) if (k === seg.logStart || log[k - 1].command) starts.push(k);
  }
  // Window ends: up to four edits, motions allowed between, never across a break or boundary. A
  // run of the same edit (x x x …) is one: the window ends where the run does.
  const ends: number[] = [];
  const same = (a: Segment, b: Segment | undefined) => !!b && b.kind === 'edit' && a.kind === 'edit' && b.keys.join('') === a.keys.join('') && !log[b.logStart].boundary;
  for (let j = firstEdit, edits = 0; j < segs.length && edits < 4; j++) {
    const s = segs[j];
    if (s.kind === 'break' || (j > i && log[s.logStart].boundary) || s.unit !== seg.unit) break;
    if (s.kind === 'edit' && !same(s, segs[j + 1])) { ends.push(j); edits++; }
  }
  const scratch = createVim(session.setupFor(seg.unit));
  let best: { c: Critique; own: boolean } | null = null;
  for (const start of starts) {
    const from = stateBefore(session, start);
    const learner = stateBefore(session, start);
    let fed = start;
    for (const j of ends) {
      const end = segs[j].logEnd;
      for (; fed <= end; fed++) learner.feed(log[fed].key);
      const keys = log.slice(start, end + 1).map(e => e.key);
      if (keys.length < 2) continue;
      const commands = commandCount(segs, log, start, end);
      const ran = ranTokens(log, start, end);
      const dotUsed = ran.includes('.');
      const typed = typedText(log, start, end);
      const lastEdit = segs[j].keys.join('');
      // The learner already did this lesson's thing in one command: nothing to add.
      if (commands === 1 && ctx.reinforces(ran)) continue;
      const target = learner.buf.text();
      const cands: Idiom[] = searchIdioms(scratch, from, target, { taught: ctx.taught, maxKeys: keys.length });
      const dot = dotCandidate(segs, firstEdit, j, start, log.map(e => e.key));
      if (dot) cands.push(dot);
      const next = segs[j + 1];
      const relax = !next || next.kind !== 'edit' || next.unit !== seg.unit || log[next.logStart].boundary;
      const ok = cands.filter(c => {
        const saves = keys.length - c.keys.length;
        const k = c.keys.join('');
        if (k === keys.join('') || k === lastEdit) return false; // the same keys, or only the motion dropped (the motion critic's call)
        if (dotUsed && saves < 2) return false; // `.` is the idiom; a count that saves one key is a nitpick
        if (saves < MIN_SAVES && countOnly(c.keys, keys)) return false; // xxx → 3x: the same key, counted, saving one is noise
        // Equal keys are worth it only for a command that carries its own motion (^C → cc, bdw → daw).
        if (saves < 0 || (saves === 0 && !(c.commands < commands && CARRIES.has(c.pattern)))) return false;
        // Type what the learner typed: an idiom never "saves" by retyping only the part of a word
        // that changed. A normal-mode command may replace typed whitespace or one character (>>, J, ~, r).
        if (c.pattern !== 'dot' && flat(c.typed) !== flat(typed) && !(c.typed === '' && (flat(typed).trim() === '' || flat(typed).length <= 1))) return false;
        // Never undercut the lesson: a learner who used this lesson's key keeps it.
        if (ctx.reinforces(ran) && !ctx.reinforces(c.uses)) return false;
        // A text object the learner used is already the robust form (daw at a word start is not worse than dw).
        if (ran.some(isObject) && !c.uses.some(isObject)) return false;
        // A long count (27x, 13~) counts characters: only the fallback for a plain run of that key.
        if (c.longCount && !keys.every(k => k === c.keys[c.keys.length - 1])) return false;
        return usesAllowed(c.uses, ctx.taught);
      });
      // Reinforce this lesson: its own chips first, then style.
      ok.sort((a, b) => Number(ctx.reinforces(b.uses)) - Number(ctx.reinforces(a.uses)) || a.style - b.style || a.keys.length - b.keys.length);
      for (const c of ok) {
        if (!verifyKeys(session, start, end, c.keys, relax)) continue;
        const own = ctx.reinforces(c.uses);
        const saves = keys.length - c.keys.length;
        if (best && (Number(own) < Number(best.own) || (own === best.own && saves <= best.c.better[0].saves))) break;
        const sug: Suggestion = { keys: toNotation(c.keys), saves, why: PATTERNS[c.pattern].principle, rule: c.pattern, uses: c.uses, pattern: c.pattern };
        best = {
          own,
          c: {
            unit: seg.unit, you: keys.join(''), keys: keys.length, logStart: start, logEnd: end,
            youChips: keyChips(stateBefore(session, start), keys),
            better: [{ ...sug, chips: keyChips(stateBefore(session, start), c.keys) }],
          },
        };
        break;
      }
    }
  }
  // From a motion run, a window that absorbs none of it is the edit's own critique, made when the
  // coach reaches that segment; the run gets its motion critique first.
  if (seg.kind === 'motion' && best?.c.logStart === editStart) return null;
  return best?.c ?? null;
}

/** Commands that carry their own motion: worth suggesting even at the same key count. */
const CARRIES = new Set(['text-object', 'quote-object', 'bracket-object', 'block-object', 'tag-object', 'change-line', 'line-end-insert', 'open-line', 'join', 'indent', 'to-line-end', 'delete-line']);
const isObject = (t: string) => /^[ia].$/.test(t);
/** Is `cand` only a count on the learner's own repeated keys (xxx → 3x, >>>> → 2>>)? */
function countOnly(cand: readonly Key[], keys: readonly Key[]): boolean {
  let d = 0;
  while (d < cand.length && /^[0-9]$/.test(cand[d]) && !(d === 0 && cand[d] === '0')) d++;
  const body = cand.slice(d);
  if (!d || !body.length || keys.length % body.length) return false;
  return keys.every((k, i) => k === body[i % body.length]);
}
/** Typed text net of edits-in-typing, without line breaks: what ends up as characters. A <BS>
 * takes back the character before it (`use<BS>er` is `user`); <Del> reaches past what was typed. */
function flat(s: string): string {
  let out = '';
  for (const t of s.match(/<BS>|<CR>|<Del>|[^]/g) ?? []) {
    if (t === '<BS>') out = out.slice(0, -1);
    else if (t === '\n' || t === '<CR>' || t === '<Del>') continue;
    else out += t;
  }
  return out;
}

/** Commands in a log span: an edit (with its insert text) is one; a motion run counts each motion. */
function commandCount(segs: Segment[], log: LogEntry[], start: number, end: number): number {
  let n = 0;
  for (const s of segs) {
    if (s.logEnd < start || s.logStart > end) continue;
    if (s.kind === 'edit') n++;
    else for (let k = Math.max(start, s.logStart); k <= Math.min(end, s.logEnd); k++) if (log[k].command) n++;
  }
  return n;
}
/** The command tokens a log span ran (arguments and typed text dropped). */
function ranTokens(log: LogEntry[], start: number, end: number): string[] {
  const t: string[] = [];
  let keys: string[] = [];
  for (let k = start; k <= end; k++) {
    const e = log[k];
    if (!TEXT_MODES.has(e.before.mode)) keys.push(e.key);
    if (e.command) { if (e.command.kind !== 'modal') t.push(...commandTokens(keys)); keys = []; }
  }
  return t;
}
/** What the learner typed as text in a span (insert/replace mode keys, <Esc> excluded). */
function typedText(log: LogEntry[], start: number, end: number): string {
  let out = '';
  for (let k = start; k <= end; k++) {
    const e = log[k];
    if ((e.before.mode === 'insert' || e.before.mode === 'replace') && e.key !== '<Esc>') out += e.key;
  }
  return out;
}

/** The same change typed again after motions: keep the first, replace the repeats with `.`. */
function dotCandidate(segs: Segment[], first: number, last: number, start: number, keys: Key[]): Idiom | null {
  const a = segs[first];
  if (a.kind !== 'edit' || !(a.command === 'operator' || a.command === 'action' || a.command === 'insert')) return null;
  const edits = segs.slice(first, last + 1).filter(s => s.kind === 'edit');
  if (edits.length < 2 || edits.some(s => s.keys.join('') !== a.keys.join(''))) return null;
  const out: Key[] = keys.slice(start, a.logEnd + 1);
  let adjacent = 0;
  for (let j = first + 1; j <= last; j++) {
    const s = segs[j];
    if (s.kind === 'edit') { if (segs[j - 1].kind === 'edit') adjacent++; out.push('.'); } else out.push(...s.keys);
  }
  // Saves at least 2, as a named rule always required.
  if (keys.slice(start, segs[last].logEnd + 1).length - out.length < 2) return null;
  return { keys: out, uses: ['.'], pattern: 'dot', style: out.length + 2 * adjacent, commands: 1, typed: '' };
}

function motionCritique(session: CoachSession, ctx: Ctx, seg: Segment & { kind: 'motion' }): Critique | null {
  const log = session.log();
  const vim = stateBefore(session, seg.logStart);
  const rnu = !!((vim.win as { opts?: { relativenumber?: boolean } }).opts?.relativenumber ?? vim.options.relativenumber);
  // Screen- and state-dependent moves (<C-d>, H/M/L, n, %) run on the engine from the segment start.
  const probe = stateBefore(session, seg.logStart);
  const home = { cursor: { ...probe.cursor }, want: probe.win.want, top: probe.win.top };
  const oracle: Oracle = (keys, from) => {
    probe.win.cursor = { ...(from?.pos ?? home.cursor) };
    probe.win.want = from?.want ?? home.want;
    probe.win.top = home.top;
    const before = probe.lastCommand;
    probe.feedKeys(keys);
    const err = probe.lastCommand && probe.lastCommand !== before && probe.lastCommand.error;
    if (probe.mode !== 'normal' || probe.pending.length) { probe.feed('<Esc>'); return null; }
    return err ? null : { pos: { ...probe.cursor }, want: probe.win.want };
  };
  // In a quickfix or location list only the line matters (<CR> opens its entry), and searching for
  // the entry's name is how you pick one: a count or a G there is not better, only different.
  if (vim.buf.kind === 'quickfix' && ranTokens(log, seg.logStart, seg.logEnd).some(t => t === '/' || t === '?')) return null;
  const cands = betterMotions(vim.buf.lines, seg.from, vim.win.want, seg.to, seg.keys.length, ctx.taught, { relativenumber: rnu, prefer: ctx.own, oracle });
  // Reinforce this lesson: a route using its own key is ranked before a cheaper one that does not.
  // A search to a spot on the line you are on is not what a Search lesson teaches: f/t first there.
  const sameLine = seg.from.line === seg.to.line;
  const reinforces = (c: { uses: string[] }) => c.uses.some(u => ctx.own.has(u)) && !(sameLine && c.uses.some(u => u === '/' || u === '?' || u === 'n' || u === 'N'));
  cands.sort((a, b) => Number(reinforces(b)) - Number(reinforces(a)));
  // Never undercut what this lesson drills: compared as the commands the learner ran, not raw
  // keys, so an `f,` target is not the `,` chip.
  const ran = ranTokens(log, seg.logStart, seg.logEnd);
  const undercuts = (uses: string[]) =>
    (ran.some(t => t === '/' || t === '?') && uses.some(u => u === '/' || u === '?')) // a shorter pattern for a search already made is a nitpick
    || ran.some(t => ctx.drilled.has(t) && !uses.includes(t));
  for (const c of cands) {
    const saves = seg.keys.length - c.cost;
    if (!motionWorth(seg.keys.length, saves) || !usesAllowed(c.uses, ctx.taught) || undercuts(c.uses)) continue;
    const ks = parseNotation(c.keys);
    if (!verifyKeys(session, seg.logStart, seg.logEnd, ks, false)) continue;
    const pattern = motionPattern(c.uses);
    const s: Suggestion = { keys: c.keys, saves, why: PATTERNS[pattern].principle, rule: 'motion', uses: c.uses, pattern };
    // One suggestion per critique: near-duplicates (`$2j` | `2j$`) teach nothing more.
    return {
      unit: seg.unit, you: seg.keys.join(''), keys: seg.keys.length, logStart: seg.logStart, logEnd: seg.logEnd,
      youChips: keyChips(stateBefore(session, seg.logStart), seg.keys),
      better: [{ ...s, chips: keyChips(stateBefore(session, seg.logStart), ks) }],
    };
  }
  return null;
}

const ctxCache = new Map<string, Ctx>();
function context(lessonId: string, session: CoachSession): Ctx {
  const warm = lessonId === WARM_UP;
  const ch = session.challenge;
  const key = !warm ? lessonId : `${lessonId}|${(session.picks ?? []).join(',')}|${ch.kind === 'generated' ? ch.mutations.join(',') : ''}`;
  let c = ctxCache.get(key);
  if (!c) {
    // Warm-up has no lesson of its own: nothing is "drilled", so any better way may be named.
    const lesson = LESSONS[lessonId];
    const own = new Set(lesson ? lesson.chips.flatMap(ch => tokenize(ch)) : []);
    // A Search lesson must not be told not to search: the section's lessons so far are drilled too.
    const ls = lesson ? sectionOf(lessonId).lessons : [];
    const upTo = !lesson ? [] : lesson.challenge.kind === 'generated' ? [lesson] : ls.slice(0, ls.findIndex(l => l.id === lessonId) + 1);
    const drilled = new Set(upTo.flatMap(l => l.chips.flatMap(ch => tokenize(ch))));
    const taught = warm ? warmUpTaught(session.picks, ch) : taughtBy(lessonId);
    c = { lessonId, taught, own, drilled, reinforces: reinforcer(lessonId) };
    ctxCache.set(key, c);
  }
  return c;
}

export function coachSegment(session: CoachSession, lessonId: string, seg: Segment, segs: Segment[], i: number): Critique | null {
  if (!coachable(lessonId)) return null;
  const log = session.log();
  if (recordingSpans(segs, log).has(i)) return null;
  const ctx = context(lessonId, session);
  const idiom = seg.kind === 'edit' || seg.kind === 'motion' ? idiomCritique(session, ctx, segs, i) : null;
  if (seg.kind !== 'motion') return idiom;
  // A motion run leading into an edit: the idiom may absorb only its last commands (`b` of `jfLb`).
  // When the run itself was the bigger waste, say that instead.
  const motion = motionCritique(session, ctx, seg);
  if (idiom && (!motion || idiom.better[0].saves >= motion.better[0].saves)) return idiom;
  return motion;
}

/** Where the keys went. A key in a motion run is moving; a key typed as text is typing; the rest is editing. */
function summarize(session: CoachSession, segs: Segment[]): Summary {
  const log = session.log();
  let moving = 0, typing = 0;
  for (const s of segs) if (s.kind === 'motion') moving += s.logEnd - s.logStart + 1;
  const inMotion = new Set<number>();
  for (const s of segs) if (s.kind === 'motion') for (let k = s.logStart; k <= s.logEnd; k++) inMotion.add(k);
  log.forEach((e, k) => { if (!inMotion.has(k) && TEXT_MODES.has(e.before.mode) && e.key !== '<Esc>') typing++; });
  const c = session.challenge;
  let par: number | null = null;
  if (c.kind === 'rounds') {
    const pars = c.rounds.map((_, u) => session.roundPar(u)).filter((p): p is number => p !== null);
    par = pars.length ? pars.reduce((a, b) => a + b, 0) : null;
  } else if (session.generated) par = session.generated.parKeys;
  return { keys: log.length, moving, typing, editing: log.length - moving - typing, par };
}

/** The reference fix's basic moves (mirrors the generator's par, `challenges/generate.ts`). */
const PATH_KEYS = 'hjklwbeWBE0$';
/** Par per checklist item, as the generator counts it: the motion from the previous item plus the
 * fix. An Ex fix (`anywhere`) needs no motion and leaves the cursor where it was. Sums to parKeys. */
export function itemPars(g: Generated): number[] {
  let prev = { line: 0, col: 0 };
  return g.items.map(item => {
    const motion = item.anywhere ? 0 : Math.min(shortestPath(g.start, prev, item.fixAt, PATH_KEYS, MAX_MOTION_KEYS + 1), MAX_MOTION_KEYS);
    if (!item.anywhere) prev = item.fixAt;
    return motion + parseNotation(item.fixKeys).length;
  });
}

export function coach(session: CoachSession, lessonId: string): Report {
  const segs = segment(session.log());
  const summary = summarize(session, segs);
  const empty: Report = { critiques: [], reference: [], summary };
  if (!coachable(lessonId)) return empty;
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
  const taught = context(lessonId, session).taught;
  const log = session.log();
  if (session.challenge.kind === 'rounds') {
    for (let u = 0; u < session.challenge.rounds.length; u++) {
      const par = session.roundPar(u);
      const sol = session.roundSolution(u);
      if (par === null || sol === null) continue;
      const you = log.filter(e => e.unit === u).length;
      if (you - par < MIN_SAVES) continue;
      const ok = usesAllowed(referenceTokens(session, u, sol), taught);
      const show = ok && !session.carried(u);
      reference.push({ unit: u, you, par, kind: 'round', ref: show ? sol : undefined, chips: show ? keyChips(createVim(session.setupFor(u)), solutionKeys(sol)) : undefined });
    }
  } else if (session.generated) {
    itemPars(session.generated).forEach((par, u) => {
      const you = log.filter(e => e.unit === u).length;
      if (you - par >= MIN_SAVES) reference.push({ unit: u, you, par, kind: 'item' });
    });
  }
  reference.sort((a, b) => (b.you - b.par) - (a.you - a.par));
  return { critiques, reference: reference.slice(0, 3), summary };
}
