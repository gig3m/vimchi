// Turns "current buffer vs goal text" into inline annotations: what to add
// (green tags) and what to remove (red strike-through), recomputed on every
// key so the marks shrink as the learner works.

export type Annotations = {
  /** Characters to delete: line → [start, end] inclusive column spans. */
  del: Map<number, [number, number][]>;
  /**
   * Text to insert inside a line: line → ghost text shown before a column (after any deletion
   * there). `done` characters of it are already typed, starting at `col`. A `quiet` one shows only
   * where (a `.` repeat brings its own text), so only the edit in hand carries a tag.
   */
  ins: Map<number, { col: number; text: string; done?: number; quiet?: boolean; kind?: 'case' }[]>;
  /** Whole lines to insert after a line (-1 = before the first line). */
  newLines: Map<number, string[]>;
  /** Whole lines to delete. */
  delLines: Set<number>;
  /** Repeat order of the edit on a line (1, 2, 3… for a change and its `.` repeats), shown in the gutter. */
  num: Map<number, number>;
  /** The last repeat number on a line holding several ("2–3"): two matches of a `cgn` on one line. */
  numTo?: Map<number, number>;
  /** Lines drawn as out-and-in: the goal line that replaces each, and the `newLines` row it sits under. */
  replaced?: Map<number, { text: string; under: number }>;
  /** Spans whose letters only change case (`gU`, `~`): marked as a case change, not a retype. */
  cases?: Map<number, [number, number][]>;
  /** Lines that join the line below them (`J`, `gJ`), with the space a join adds or none. */
  joins?: Map<number, 'space' | 'none' | 'cut'>;
};

const EMPTY = (): Annotations => ({ del: new Map(), ins: new Map(), newLines: new Map(), delLines: new Set(), num: new Map(), cases: new Map(), joins: new Map(), replaced: new Map() });

/** Longest common subsequence alignment of two line arrays. */
export function align(a: readonly string[], b: readonly string[]): [number, number][] {
  const n = a.length, m = b.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const pairs: [number, number][] = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) { pairs.push([i, j]); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) i++;
    else j++;
  }
  return pairs;
}

function push<K, V>(m: Map<K, V[]>, k: K, v: V) {
  const a = m.get(k);
  if (a) a.push(v);
  else m.set(k, [v]);
}

/**
 * Best start for a span of `len` characters at `p` in `str`, among the equivalent positions
 * to its left (each removes or adds the same text): prefer one bounded by word edges on
 * both sides, then on its start, keeping the rightmost on a tie.
 */
export function slide(str: string, p: number, len: number): number {
  const isW = (ch: string | undefined) => !!ch && /\w/.test(ch);
  const edge = (i: number) => i === 0 || i === str.length || isW(str[i - 1]) !== isW(str[i]);
  let best = p, bestScore = -1;
  // Best of all, a whole spaced chunk: from the line start or a space, through a trailing space
  // ("[10:14:02] " off "[10:14:02] [INFO]", not "10:14:02] [").
  const spaced = (i: number) => (i === 0 || /\s/.test(str[i - 1])) && (/\s/.test(str[i + len - 1]) || i + len === str.length);
  for (let q = p; q >= 0; q--) {
    const score = (spaced(q) ? 4 : 0) + (edge(q) ? 2 : 0) + (edge(q + len) ? 1 : 0);
    if (score > bestScore) { best = q; bestScore = score; }
    if (q === 0 || str[q - 1] !== str[q - 1 + len]) break;
  }
  return best;
}

/** A character a replacement widens over: letters and digits. An underscore bounds the part of a
 * snake_case name that changed (~~old~~ new_b, not ~~old_b~~ new_b). */
const isWide = (ch: string | undefined) => !!ch && /[A-Za-z0-9]/.test(ch);

/** One edit inside a line: current [s, e) becomes goal [gs, ge). Text between edits is shared. */
type Edit = { s: number; e: number; gs: number; ge: number };

/** The character edits between two lines, by longest common subsequence (prefix/suffix only when long). */
function charEdits(cur: string, goal: string): Edit[] {
  let p = 0;
  while (p < cur.length && p < goal.length && cur[p] === goal[p]) p++;
  let q = 0;
  while (q < cur.length - p && q < goal.length - p && cur[cur.length - 1 - q] === goal[goal.length - 1 - q]) q++;
  const a = cur.slice(p, cur.length - q), b = goal.slice(p, goal.length - q);
  if (!a.length || !b.length || a.length * b.length > 40000) return [{ s: p, e: cur.length - q, gs: p, ge: goal.length - q }];
  const dp: number[][] = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) for (let j = b.length - 1; j >= 0; j--) dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const out: Edit[] = [];
  let i = 0, j = 0, open: Edit | null = null;
  const close = () => { if (open) { out.push(open); open = null; } };
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) { close(); i++; j++; continue; }
    open ??= { s: p + i, e: p + i, gs: p + j, ge: p + j };
    if (j >= b.length || (i < a.length && dp[i + 1][j] >= dp[i][j + 1])) { i++; open.e = p + i; }
    else { j++; open.ge = p + j; }
  }
  close();
  return out;
}

/**
 * Character-level edits for one changed line, shaped the way a person reads them: edits a
 * character or two apart inside a word are one edit, a replacement inside a word is the whole
 * word (~~usr~~ user), a pure insertion or deletion slides to word edges, and a change of case
 * alone is marked as one, not as a retype.
 */
function lineEdit(cur: string, goal: string, line: number, out: Annotations) {
  const raw = charEdits(cur, goal);
  // Merge edits a short, unbroken gap apart: "cfg" → "config" is one change, not two inserts.
  const merged: Edit[] = [];
  for (const ed of raw) {
    const last = merged[merged.length - 1];
    const gap = last ? cur.slice(last.e, ed.s) : '';
    if (last && ed.s - last.e <= 2 && !/\s/.test(gap)) { last.e = ed.e; last.ge = ed.ge; }
    else merged.push({ ...ed });
  }
  // Widen replacements to whole words, merging any edit the widening reaches.
  const edits: Edit[] = [];
  for (const ed of merged) {
    // Only into the word the edit is part of: swapping quotes (' for ") leaves the word between alone.
    if (ed.e > ed.s && ed.ge > ed.gs) {
      while (ed.s > 0 && isWide(cur[ed.s - 1]) && ed.gs > 0 && (isWide(cur[ed.s]) || isWide(goal[ed.gs]))) { ed.s--; ed.gs--; }
      while (ed.e < cur.length && isWide(cur[ed.e]) && ed.ge < goal.length && isWide(goal[ed.ge]) && (isWide(cur[ed.e - 1]) || isWide(goal[ed.ge - 1]))) { ed.e++; ed.ge++; }
    }
    const last = edits[edits.length - 1];
    if (last && ed.s <= last.e) { last.e = Math.max(last.e, ed.e); last.ge = Math.max(last.ge, ed.ge); }
    else edits.push(ed);
  }
  for (const ed of edits) {
    // A pure deletion or insertion can sit anywhere along a repeated run ("the the tests" loses
    // "he t" as readily as "the "): slide it to word boundaries, as a person reads it.
    if (ed.e === ed.s || ed.ge === ed.gs) {
      const del = ed.e > ed.s;
      const str = del ? cur : goal, at = del ? ed.s : ed.gs, len = del ? ed.e - ed.s : ed.ge - ed.gs;
      const shift = at - slide(str, at, len);
      ed.s -= shift; ed.e -= shift; ed.gs -= shift; ed.ge -= shift;
    }
    const was = cur.slice(ed.s, ed.e), text = goal.slice(ed.gs, ed.ge);
    if (ed.e > ed.s) push(out.del, line, [ed.s, ed.e - 1] as [number, number]);
    if (text) push(out.ins, line, { col: ed.s, text, ...(was && was !== text && was.toLowerCase() === text.toLowerCase() ? { kind: 'case' as const } : {}) });
    if (was && was !== text && was.toLowerCase() === text.toLowerCase()) push(out.cases!, line, [ed.s, ed.e - 1] as [number, number]);
  }
}

/** Where a delete across line breaks cuts: the goal's one line is `cs[0]` up to `a` and the last
 * line from `b`. Null when it isn't that (or when no break is crossed). */
function acrossBreak(cs: readonly string[], gs: readonly string[]): [number, number] | null {
  if (cs.length < 2 || gs.length !== 1) return null;
  const g = gs[0], first = cs[0], last = cs[cs.length - 1];
  let p = 0;
  while (p < first.length && p < g.length && first[p] === g[p]) p++;
  for (let a = p; a >= 0; a--) {
    const b = last.length - (g.length - a);
    if (b >= 0 && last.slice(b) === g.slice(a) && (a < first.length || b > 0)) return [a, b];
  }
  return null;
}

/** Two versions of a line that share under 40% of their characters (indentation aside). */
function unlike(a: string, b: string): boolean {
  const x = a.trim(), y = b.trim();
  if (!x || !y) return false;
  const kept = x.length - charEdits(x, y).reduce((n, e) => n + e.e - e.s, 0);
  return kept < 0.4 * Math.max(x.length, y.length);
}

/** `J` (one space, leading blanks dropped; none after a blank end or before a ")") or `gJ` (as is). */
function joinsTo(lines: readonly string[], goal: string): ('space' | 'none')[] | null {
  let acc = lines[0];
  const how: ('space' | 'none')[] = [];
  for (const next of lines.slice(1)) {
    const t = next.trimStart();
    const space = !!t && !!acc && !/\s$/.test(acc) && !t.startsWith(')');
    const j = acc + (space ? ' ' : '') + t, g = acc + next;
    if (goal.startsWith(j)) { how.push(space ? 'space' : 'none'); acc = j; }
    else if (goal.startsWith(g)) { how.push('none'); acc = g; }
    else return null;
  }
  return acc === goal ? how : null;
}

/** The hunk is lines joined, each goal line made of whole current lines in order: line → kind. */
function joinPlan(cs: readonly string[], gs: readonly string[]): Map<number, 'space' | 'none'> | null {
  if (cs.length <= gs.length) return null;
  const plan = new Map<number, 'space' | 'none'>();
  let i = 0;
  for (const g of gs) {
    let found = false;
    for (let n = 1; i + n <= cs.length; n++) {
      const how = n === 1 ? (cs[i] === g ? [] : null) : joinsTo(cs.slice(i, i + n), g);
      if (how) { how.forEach((h, k) => plan.set(i + k, h)); i += n; found = true; break; }
    }
    if (!found) return null;
  }
  return i === cs.length && plan.size ? plan : null;
}

const words = (ls: readonly string[]) => ls.join(' ').match(/\w+/g) ?? [];
/** How many of the goal's words the current lines already have (each used once). */
function reused(cur: readonly string[], goal: readonly string[]): number {
  const have = new Map<string, number>();
  for (const w of words(cur)) have.set(w, (have.get(w) ?? 0) + 1);
  let n = 0;
  for (const w of words(goal)) {
    const c = have.get(w) ?? 0;
    if (c) { n++; have.set(w, c - 1); }
  }
  return n;
}

export type GoalView = { mode: 'inline'; ann: Annotations } | { mode: 'pane' } | { mode: 'none' };

/**
 * Annotate the difference. Falls back to the goal pane when inline marks
 * would be noisy: many hunks, long insertions, or whitespace-only changes.
 * `force` keeps the inline marks regardless (generated challenges: the
 * checklist is the guide, the marks are hints, and the pane would be huge).
 */
export function diffGoal(cur: readonly string[], goal: readonly string[], opts: { force?: boolean } = {}): GoalView {
  if (cur.length === goal.length && cur.every((l, i) => l === goal[i])) return { mode: 'none' };
  const out = EMPTY();
  const pairs = align(cur, goal);
  let hunks = 0, noisy = false, reflow = false;
  let ci = 0, gi = 0;
  /** First line of a cut across line breaks → its last line. */
  const cutEnds = new Map<number, number>();
  const flush = (cEnd: number, gEnd: number) => {
    const cs = cur.slice(ci, cEnd), gs = goal.slice(gi, gEnd);
    if (!cs.length && !gs.length) return;
    hunks++;
    // A block replaced by fewer, different lines (two legacy lines → one new one) is whole lines
    // out and in: pairing its first line for a character edit pictures a retype. A join, a reflow
    // or a delete across a line break reuses the block's own words, so it stays an edit; a split
    // (more lines) always does. Only an untouched block: once a line in it starts a goal line
    // (blank after `cc`, half typed) the learner is typing, and the plain pairing below is kept.
    const joined = joinPlan(cs, gs);
    if (joined) {
      joined.forEach((how, k) => out.joins!.set(ci + k, how));
      return;
    }
    // A delete across line breaks (d/Then, dap mid-sentence): the goal line is the head of the
    // first line and the tail of the last. One strike from there to there, lines between gone.
    const across = acrossBreak(cs, gs);
    if (across) {
      const [a, b] = across, last = ci + cs.length - 1;
      if (a < cs[0].length) push(out.del, ci, [a, cs[0].length - 1] as [number, number]);
      for (let k = 1; k < cs.length - 1; k++) out.delLines.add(ci + k);
      if (b > 0) push(out.del, last, [0, b - 1] as [number, number]);
      out.joins!.set(ci, 'cut');
      cutEnds.set(ci, last);
      return;
    }
    // Lines rewrapped (gq, a reflow): the same words across a different number of lines. Marks
    // on each line would picture a retype; the pane shows the result.
    if (cs.length > 1 && gs.length > 1 && cs.length !== gs.length && words(cs).join(' ') === words(gs).join(' ')) reflow = true;
    const typing = cs.some(a => gs.some(g => g.startsWith(a)));
    if (cs.length > gs.length && !typing && reused(cs, gs) * 2 < words(gs).length) {
      cs.forEach((_, k) => out.delLines.add(ci + k));
      out.newLines.set(ci + cs.length - 1, gs);
      return;
    }
    const paired = Math.min(cs.length, gs.length);
    const addNew = (after: number, ls: string[]) => out.newLines.set(after, [...(out.newLines.get(after) ?? []), ...ls]);
    for (let k = 0; k < paired; k++) {
      const a = cs[k], b = gs[k];
      if (a.trim() === b.trim()) noisy = true; // indentation-only change
      // In a block that shrinks, a line that keeps little of itself is a new line, not
      // an edit: a character splice of "inc() {" into "n = 0;" reads as nonsense. The new lines go
      // below the whole block, so the old lines read as one block out. Not while it is being
      // typed, and not line for line (ci( on two lines keeps both as edits).
      if (!typing && cs.length > gs.length && unlike(a, b)) {
        out.delLines.add(ci + k);
        addNew(ci + cs.length - 1, [b]);
        out.replaced!.set(ci + k, { text: b, under: ci + cs.length - 1 });
        continue;
      }
      lineEdit(a, b, ci + k, out);
    }
    for (let k = paired; k < cs.length; k++) out.delLines.add(ci + k);
    if (gs.length > paired) addNew(ci + paired - 1, gs.slice(paired));
  };
  for (const [a, b] of pairs) {
    flush(a, b);
    ci = a + 1;
    gi = b + 1;
  }
  flush(cur.length, goal.length);
  const tags = [...out.ins.values()].flat();
  const longTag = tags.some(t => t.text.length > 40) || [...out.newLines.values()].some(ls => ls.length > 3 || ls.some(l => l.length > 50));
  // Busy-ness counts changed lines, not marks: a line split into word edits is still one line.
  // A cut across a line break is one change though it marks two lines: count its second line once.
  const cutTails = [...(out.joins?.entries() ?? [])].filter(([l, how]) => how === 'cut' && out.del.has(l) && out.del.has(cutEnds.get(l)!)).length;
  const spans = new Set([...out.del.keys(), ...out.ins.keys()]).size * 2 - cutTails + out.delLines.size + out.newLines.size;
  // Lines put in a new order (:sort, a filter): line moves drawn one by one read as edits.
  // Every goal line is already in the file, yet they don't all line up in order: lines moved.
  // One line moved (ddp) stays inline; a sort, or a sort that also drops lines (:sort u), doesn't.
  const have = new Map<string, number>();
  for (const l of cur) have.set(l, (have.get(l) ?? 0) + 1);
  const fromFile = goal.every(g => { const n = have.get(g) ?? 0; have.set(g, n - 1); return n > 0; }); // a copied line is new
  const reordered = pairs.length < goal.length && goal.length <= cur.length && fromFile && (hunks > 2 || goal.length < cur.length);
  if (!opts.force && (noisy || reflow || reordered || longTag || hunks > 4 || spans > 6)) return { mode: 'pane' };
  return { mode: 'inline', ann: out };
}
