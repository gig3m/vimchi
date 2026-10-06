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
};

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
    if (s.insert && markMoved) {
      // A change: `[` is where typing began, `]` its last character.
      const e = vim.buf.marks.get(']');
      const insLen = e && e.line === line ? Math.max(0, e.col - m!.col + 1) : 0;
      edit = { col: m!.col, del: b.length - (a.length - insLen), ins: a.slice(m!.col, m!.col + insLen) };
    } else {
      edit = anchoredEdit(b, a, markMoved ? m!.col : vim.cursor.col);
    }
    const site: Site = {
      before: b, after: a, line, step: s.step, num: 0, col: edit.col, ins: edit.ins, keys: s.keys,
      del: edit.del > 0 ? [edit.col, edit.col + edit.del - 1] : null,
    };
    if (s.dot && group.length) group.push(site);
    else group = [site];
    if (group.length > 1) group.forEach((g, i) => (g.num = i + 1));
    sites.push(site);
  }
  return sites;
}

/** The states a line passes through while a site is being done: untouched, then cut and typed n characters. */
function stages(site: Site): { text: string; done: number; cut: boolean }[] {
  const out = [{ text: site.before, done: 0, cut: false }];
  const head = site.before.slice(0, site.col), tail = site.before.slice(site.del ? site.del[1] + 1 : site.col);
  for (let n = 0; n < site.ins.length; n++) {
    const text = head + site.ins.slice(0, n) + tail;
    if (text !== site.before) out.push({ text, done: n, cut: true });
  }
  return out;
}

/**
 * Redraw the diff's marks for lines that a pending site describes: its exact span and typed text,
 * and its repeat number. Part way through typing, the tag keeps the whole text and counts what's
 * typed. Lines with no site (or edited off-script) keep the diff's marks.
 */
export function applySites(ann: Annotations, cur: readonly string[], sites: readonly Site[], step: number): Annotations {
  const out: Annotations = { ...ann, del: new Map(ann.del), ins: new Map(ann.ins), num: new Map(ann.num) };
  const claimed = new Set<number>();
  let tagged = false;
  for (const site of sites) {
    if (site.step !== step) continue;
    const forms = stages(site);
    let best = -1, form = forms[0];
    cur.forEach((t, i) => {
      if (claimed.has(i) || !(ann.del.has(i) || ann.ins.has(i))) return;
      const f = forms.find(x => x.text === t);
      if (!f) return;
      if (best < 0 || Math.abs(i - site.line) < Math.abs(best - site.line)) { best = i; form = f; }
    });
    if (best < 0) continue;
    claimed.add(best);
    out.del.delete(best);
    out.ins.delete(best);
    if (site.del && !form.cut) out.del.set(best, [site.del]);
    if (site.ins) out.ins.set(best, [{ col: site.col, text: site.ins, done: form.done, quiet: tagged }]);
    if (site.ins) tagged = true;
    if (site.num) out.num.set(best, site.num);
  }
  return out;
}
