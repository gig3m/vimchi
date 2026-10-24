// Where a round's edits happen, taken from its reference solution rather than from a text diff.
// A diff says what differs between now and the goal, and picks its own way to say it (keep the
// shared ";", strike "he t" instead of "the "). Replaying the solution says what the lesson's
// command actually did: the span it removed, the text it typed, and which edits are `.` repeats.

import type { Annotations } from './goalDiff';
import { createVim, goalMet, solutionKeys, stepsOf } from './runtime';
import type { Round, Setup } from './types';

export type Site = {
  /** The line before the edit, and after it: the site is pending while a buffer line reads `before`. */
  before: string;
  after: string;
  /** Line index in the replay when the edit happened (to pick between identical lines). */
  line: number;
  /** Removed span [start, end] inclusive, or null for a pure insertion. */
  del: [number, number] | null;
  /** Text typed or put at `col` (after the removed span). */
  ins: string;
  col: number;
  /** 1, 2, 3… for an edit and its `.` repeats; 0 when it isn't repeated. */
  num: number;
  /** Step of the round the edit belongs to. */
  step: number;
  /** Keys the edit's command took (a `.` repeat is 1). */
  keys: number;
  /** The edit typed its text in insert mode (a change), so a `.` repeat of it does too. */
  typed?: boolean;
};

/** Letters and digits: an underscore bounds the changed part of a snake_case name. */
const isW = (ch: string | undefined) => !!ch && /[A-Za-z0-9]/.test(ch);

/** A replacement inside a word reads as the whole word (~~True~~ False, not ~~Tru~~ Fals): widen
 * it over the word characters it shares with both lines. Pure insertions and deletions stay exact. */
function wholeWord(b: string, a: string, e: { col: number; del: number; ins: string }) {
  if (!e.del || !e.ins) return e;
  let col = e.col, end = e.col + e.del, aEnd = e.col + e.ins.length;
  // Only into the word the replacement is part of: "=" → ": " leaves "URL" and "postgres" alone.
  while (col > 0 && isW(b[col - 1]) && b[col - 1] === a[col - 1] && (isW(b[col]) || isW(a[col]))) col--;
  while (end < b.length && isW(b[end]) && b[end] === a[aEnd] && (isW(b[end - 1]) || isW(a[aEnd - 1]))) { end++; aEnd++; }
  return { col, del: end - col, ins: a.slice(col, aEnd) };
}

/** Smallest edit turning `b` into `a`, anchored as near column `hint` as the text allows. */
function anchoredEdit(b: string, a: string, hint: number): { col: number; del: number; ins: string } {
  let P = 0;
  while (P < b.length && P < a.length && b[P] === a[P]) P++;
  let S = 0;
  while (S < b.length && S < a.length && b[b.length - 1 - S] === a[a.length - 1 - S]) S++;
  const k = Math.min(P + S, b.length, a.length);
  const lo = Math.max(0, k - S), hi = Math.min(P, k);
  const p = Math.max(lo, Math.min(hi, hint));
  const s = k - p;
  return { col: p, del: b.length - s - p, ins: a.slice(p, a.length - s) };
}

/**
 * Replay the solution and record each single-line edit. Line-level edits (dd, o, J, a linewise put)
 * are left to the diff, which already draws them as whole lines.
 */
export function solutionSites(setup: Setup, round: Round): Site[] {
  const steps = stepsOf(round);
  const vim = createVim(setup);
  const sites: Site[] = [];
  let step = 0;
  let start: { lines: string[]; insert: boolean; step: number; dot: boolean; mark: string; keys: number } | null = null;
  let group: Site[] = [];
  for (const k of solutionKeys(round.solution)) {
    if (!start && vim.mode === 'normal' && vim.pending.length === 0) {
      const m = vim.buf.marks.get('[');
      start = { lines: vim.buf.lines.slice(), insert: false, step, dot: k === '.', mark: m ? `${m.line}:${m.col}` : '', keys: 0 };
    }
    if (start) start.keys++;
    vim.feed(k);
    if (start && (vim.mode === 'insert' || vim.mode === 'replace')) start.insert = true;
    while (step < steps.length - 1 && goalMet(vim, steps[step].goal)) step++;
    if (vim.mode !== 'normal' || vim.pending.length > 0) continue;
    const s = start;
    start = null;
    if (!s) continue;
    const now = vim.buf.lines;
    if (now.length !== s.lines.length) { group = []; continue; }
    const changed = now.flatMap((t, i) => (t === s.lines[i] ? [] : [i]));
    if (changed.length !== 1) { if (changed.length) group = []; continue; }
    const line = changed[0], b = s.lines[line], a = now[line];
    const m = vim.buf.marks.get('[');
    const markMoved = !!m && `${m.line}:${m.col}` !== s.mark && m.line === line;
    let edit: { col: number; del: number; ins: string };
    const typed = s.insert || (s.dot && !!group[group.length - 1]?.typed);
    if (typed && markMoved) {
      // A change: `[` is where typing began, `]` its last character.
      const e = vim.buf.marks.get(']');
      const insLen = e && e.line === line ? Math.max(0, e.col - m!.col + 1) : 0;
      edit = { col: m!.col, del: b.length - (a.length - insLen), ins: a.slice(m!.col, m!.col + insLen) };
    } else {
      edit = wholeWord(b, a, anchoredEdit(b, a, markMoved ? m!.col : vim.cursor.col));
    }
    const site: Site = {
      before: b, after: a, line, step: s.step, num: 0, col: edit.col, ins: edit.ins, keys: s.keys, typed,
      del: edit.del > 0 ? [edit.col, edit.col + edit.del - 1] : null,
    };
    if (s.dot && group.length) group.push(site);
    else group = [site];
    if (group.length > 1) group.forEach((g, i) => (g.num = i + 1));
    sites.push(site);
  }
  return sites;
}

/** The states a line passes through while a site is being done: untouched, then cut and typed n
 * characters. A typed state can read exactly like the untouched line (`cl` on "=", then "="). */
function stages(site: Site): { text: string; done: number; cut: boolean }[] {
  const out = [{ text: site.before, done: 0, cut: false }];
  const head = site.before.slice(0, site.col), tail = site.before.slice(site.del ? site.del[1] + 1 : site.col);
  for (let n = 0; n < site.ins.length; n++) out.push({ text: head + site.ins.slice(0, n) + tail, done: n, cut: true });
  return out;
}

/** An insert in progress: where it began and where the cursor is now. */
export type Typing = { start: { line: number; col: number }; cursor: { line: number; col: number } } | null;

/**
 * Redraw the diff's marks for lines that a pending site describes: its exact span and typed text,
 * and its repeat number. Part way through typing, the tag keeps the whole text and counts what's
 * typed. Lines with no site (or edited off-script) keep the diff's marks.
 */
export function applySites(ann: Annotations, cur: readonly string[], sites: readonly Site[], step: number, typing: Typing = null): Annotations {
  const out: Annotations = { ...ann, del: new Map(ann.del), ins: new Map(ann.ins), num: new Map(ann.num), numTo: new Map(ann.numTo), cases: new Map(ann.cases), delLines: new Set(ann.delLines), newLines: new Map(ann.newLines) };
  // A line the diff draws as out-and-in (it kept too little of itself) is still the site's edit
  // when the solution changed it in place (cc, C): the site's span reads as the lesson's command.
  const swapped = (i: number) => ann.delLines.has(i) && !!ann.replaced?.has(i);
  const claimed = new Set<number>();
  let tagged = false;
  const folded = new Set<Site>();
  const lineOf = new Map<Site, number>();
  sites.forEach((site, k) => {
    if (site.step !== step || folded.has(site)) return;
    // A repeat that lands again on a line an earlier repeat is still pending on (two matches of a
    // cgn on one line): count it on that line's badge, 2–3, instead of skipping its number.
    const prev = sites[k - 1];
    if (site.num && prev && prev.num && prev.line === site.line && prev.after === site.before && lineOf.has(prev)) {
      const l = lineOf.get(prev)!;
      out.numTo!.set(l, site.num);
      lineOf.set(site, l);
      return;
    }
    const forms = stages(site);
    let best = -1, form = forms[0];
    cur.forEach((t, i) => {
      if (claimed.has(i) || !(ann.del.has(i) || ann.ins.has(i) || swapped(i))) return;
      // Text alone can't tell an untouched line from one retyped to read the same; insert mode
      // begun at the site's column can.
      const typed = typing && typing.start.line === i && typing.cursor.line === i && typing.start.col === site.col
        ? forms.find(x => x.cut && x.done === typing.cursor.col - site.col && x.text === t) : undefined;
      const f = typed ?? forms.find(x => x.text === t);
      if (!f) return;
      if (best < 0 || Math.abs(i - site.line) < Math.abs(best - site.line)) { best = i; form = f; }
    });
    if (best < 0) return;
    claimed.add(best);
    lineOf.set(site, best);
    // The diff already reads better for an untouched line it splits into several edits (a pair of
    // quotes, two words) or marks as a change of case: one site span would picture a retype.
    const diffEdits = new Set([...(ann.del.get(best) ?? []).map(([a]) => a), ...(ann.ins.get(best) ?? []).map(t => t.col)]).size;
    if (!form.cut && (diffEdits > 1 || ann.cases?.has(best))) {
      if (site.num) out.num.set(best, site.num);
      return;
    }
    out.del.delete(best);
    out.ins.delete(best);
    out.cases!.delete(best);
    const swap = ann.replaced?.get(best);
    if (swapped(best) && swap!.text === site.after) {
      // Its own block's row, not another block's row with the same text.
      out.delLines.delete(best);
      const ls = out.newLines.get(swap!.under) ?? [];
      const j = ls.indexOf(site.after);
      const rest = ls.filter((_, n) => n !== j);
      if (rest.length) out.newLines.set(swap!.under, rest);
      else out.newLines.delete(swap!.under);
    }
    if (site.del && !form.cut) out.del.set(best, [site.del]);
    if (site.ins) out.ins.set(best, [{ col: site.col, text: site.ins, done: form.done, quiet: tagged }]);
    if (site.ins) tagged = true;
    if (site.num) out.num.set(best, site.num);
    // A put that follows on the same line (`xp`: cut a letter, put it one along) is drawn on the
    // untouched line too, where it will land, instead of waiting for the cut.
    const next = sites[k + 1];
    if (!form.cut && site.del && !site.ins && next && next.step === step && next.before === site.after && !next.del && next.ins) {
      const n = site.del[1] - site.del[0] + 1;
      if (next.col > site.del[0]) {
        out.ins.set(best, [...(out.ins.get(best) ?? []), { col: next.col + n, text: next.ins, done: 0, quiet: tagged }]);
        tagged = true;
        folded.add(next);
      }
    }
  });
  return out;
}

/**
 * Finish the marks for display, whatever the challenge: while typing, the tag at the cursor shows
 * the whole text with the typed part counted (the diff alone only knows what's left); then only the
 * edit in hand, nearest the cursor, keeps its tag, so tags never stack on neighbouring rows.
 */
export function focusTags(ann: Annotations, cursor: { line: number; col: number }, insertStart: { line: number; col: number } | null, lines: readonly string[]): Annotations {
  const out: Annotations = { ...ann, ins: new Map() };
  for (const [l, tags] of ann.ins) {
    out.ins.set(l, tags.map(t => {
      if (t.done != null || !insertStart || insertStart.line !== l || l !== cursor.line || t.col !== cursor.col || insertStart.col > cursor.col) return { ...t };
      const typed = lines[l].slice(insertStart.col, cursor.col);
      return typed ? { col: insertStart.col, text: typed + t.text, done: typed.length } : { ...t };
    }));
  }
  let keep: { l: number; i: number; d: number } | null = null;
  for (const [l, tags] of out.ins) tags.forEach((t, i) => {
    if (t.quiet) return;
    const d = (t.done ? 0 : 1) * 1e6 + Math.abs(l - cursor.line) * 1000 + Math.abs(t.col - cursor.col);
    if (!keep || d < keep.d) keep = { l, i, d };
  });
  for (const [l, tags] of out.ins) tags.forEach((t, i) => { if (!(keep && keep.l === l && keep.i === i)) t.quiet = true; });
  return out;
}
