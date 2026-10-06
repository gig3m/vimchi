// Turns "current buffer vs goal text" into inline annotations: what to add
// (green tags) and what to remove (red strike-through), recomputed on every
// key so the marks shrink as the learner works.

export type Annotations = {
  /** Characters to delete: line → [start, end] inclusive column spans. */
  del: Map<number, [number, number][]>;
  /** Text to insert inside a line: line → ghost text shown before a column (after any deletion there). */
  ins: Map<number, { col: number; text: string }[]>;
  /** Whole lines to insert after a line (-1 = before the first line). */
  newLines: Map<number, string[]>;
  /** Whole lines to delete. */
  delLines: Set<number>;
  /** Repeat order of the edit on a line (1, 2, 3… for a change and its `.` repeats), shown in the gutter. */
  num: Map<number, number>;
};

const EMPTY = (): Annotations => ({ del: new Map(), ins: new Map(), newLines: new Map(), delLines: new Set(), num: new Map() });

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
  for (let q = p; q >= 0; q--) {
    const score = (edge(q) ? 2 : 0) + (edge(q + len) ? 1 : 0);
    if (score > bestScore) { best = q; bestScore = score; }
    if (q === 0 || str[q - 1] !== str[q - 1 + len]) break;
  }
  return best;
}

/** Character-level edit for one changed line: common prefix/suffix, then delete + insert. */
function lineEdit(cur: string, goal: string, line: number, out: Annotations) {
  let p = 0;
  while (p < cur.length && p < goal.length && cur[p] === goal[p]) p++;
  let s = 0;
  while (s < cur.length - p && s < goal.length - p && cur[cur.length - 1 - s] === goal[goal.length - 1 - s]) s++;
  // A replacement inside a word reads better as the whole word: ~~usr~~ user.
  const isW = (ch: string | undefined) => !!ch && /\w/.test(ch);
  if (cur.length - s - p > 0 && goal.length - s - p > 0) {
    while (p > 0 && isW(cur[p - 1])) p--;
    while (s > 0 && isW(cur[cur.length - s]) && isW(goal[goal.length - s])) s--;
  }
  // A pure deletion or insertion can sit anywhere along a repeated run ("the the tests"
  // loses "he t" as readily as "the "): slide it to word boundaries, as a person reads it.
  if (cur.length - s - p === 0 || goal.length - s - p === 0) {
    const str = cur.length > goal.length ? cur : goal;
    const q = slide(str, p, Math.abs(cur.length - goal.length));
    s += p - q;
    p = q;
  }
  const delEnd = cur.length - s - 1;
  const insText = goal.slice(p, goal.length - s);
  if (delEnd >= p) push(out.del, line, [p, delEnd] as [number, number]);
  if (insText) push(out.ins, line, { col: p, text: insText });
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
  let hunks = 0, noisy = false;
  let ci = 0, gi = 0;
  const flush = (cEnd: number, gEnd: number) => {
    const cs = cur.slice(ci, cEnd), gs = goal.slice(gi, gEnd);
    if (!cs.length && !gs.length) return;
    hunks++;
    const paired = Math.min(cs.length, gs.length);
    for (let k = 0; k < paired; k++) {
      const a = cs[k], b = gs[k];
      if (a.trim() === b.trim()) noisy = true; // indentation-only change
      lineEdit(a, b, ci + k, out);
    }
    for (let k = paired; k < cs.length; k++) out.delLines.add(ci + k);
    if (gs.length > paired) out.newLines.set(ci + paired - 1, gs.slice(paired));
  };
  for (const [a, b] of pairs) {
    flush(a, b);
    ci = a + 1;
    gi = b + 1;
  }
  flush(cur.length, goal.length);
  const tags = [...out.ins.values()].flat();
  const longTag = tags.some(t => t.text.length > 40) || [...out.newLines.values()].some(ls => ls.length > 3 || ls.some(l => l.length > 50));
  const spans = [...out.del.values()].flat().length + tags.length + out.delLines.size + out.newLines.size;
  if (!opts.force && (noisy || longTag || hunks > 4 || spans > 6)) return { mode: 'pane' };
  return { mode: 'inline', ann: out };
}
