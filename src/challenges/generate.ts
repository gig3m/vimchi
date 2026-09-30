// Turns a GeneratedChallenge + seed into a concrete session. Pure and deterministic.
import { align } from '../lessons/goalDiff';
import { shortestPath } from '../lessons/runtime';
import type { GeneratedChallenge } from '../lessons/types';
import { parseKeys } from '../vim/keys';
import type { Pos } from '../vim/types';
import { KINDS } from './mutations';
import { type Mutation, type Site, applyMutation } from './mutations/types';
import { type Rng, mulberry32, pick, randInt, shuffle } from './rng';

export type ChecklistItem = {
  kind: string;
  text: string;
  /** Contiguous goal (original) line range this item owns, inclusive. */
  goal: [number, number];
  /** Where the reference fix starts, in the START text. */
  fixAt: Pos;
  /**
   * Reference keys for the fix (motion excluded), in checklist order: a repeated edit after
   * the first of its group is `.`, so replay the items in order.
   */
  fixKeys: string;
  /** Items sharing a group are the same edit on different lines (the par repeats it with `.`). */
  group?: number;
  /** The fix acts on lines inserted this many lines BELOW the item's first goal line (a stray line or block). */
  below?: number;
  /** An Ex fix (`:%s`, `:g`) that runs from wherever the cursor is: the par spends no motion on it and the cursor stays put. */
  anywhere?: boolean;
};

export type Generated = {
  seed: number;
  file: string;
  start: string[];
  goal: string[];
  items: ChecklistItem[];
  parKeys: number;
  parMs: number;
};

export const MOTION_MS = 250;
export const MAX_MOTION_KEYS = 8;
const PATH_KEYS = 'hjklwbeWBE0$';

/**
 * Lines a mutation touches in the original (for the one-line-gap rule). A stray line sits
 * between site.line and site.line + 1; it belongs to site.line's tick window only, so the
 * next item may start at site.line + 2 like after any one-line item.
 */
const touched = (m: Mutation): [number, number] =>
  // A line to delete, or a missing line: the line above it is where the fix happens.
  m.kind === 'line-to-remove' || m.lines.length < (m.span ?? 1) ? [m.site.line - 1, m.site.line + (m.span ?? 1) - 1]
  : [m.site.line, m.site.line + (m.span ?? 1) - 1];

type Unit = { muts: Mutation[]; span: [number, number]; group?: number };

/** Chance that a pick of a repeatable kind becomes a group of 2–3 identical edits. */
export const REPEAT_P = 0.5;
/** Largest line distance between neighbouring members of a repeated group. */
const REPEAT_REACH = 8;
/** Time allowance for a `.` that repeats the previous fix, ms. */
export const DOT_MS = 500;

/** A kind id, drawn in proportion to its weight (plain `pick` when every weight is 1, so old runs keep their seeds). */
function pickWeighted(rng: Rng, ids: string[]): string {
  if (ids.every(id => (KINDS[id].weight ?? 1) === 1)) return pick(rng, ids);
  const total = ids.reduce((a, id) => a + (KINDS[id].weight ?? 1), 0);
  let r = rng() * total;
  for (const id of ids) { r -= KINDS[id].weight ?? 1; if (r < 0) return id; }
  return ids[ids.length - 1];
}

/**
 * A multi-line mutation can leave lines the line diff pairs with look-alikes elsewhere (`end`,
 * `return nil`, a blank line), which would show the item done at the start or charge damage
 * outside it. On its own in the file, it must diff as exactly its own lines.
 */
function clean(orig: readonly string[], m: Mutation): boolean {
  const span = m.span ?? 1;
  if (span <= 1) return true;
  const start = applyMutation(orig, m);
  const item = { goal: [m.site.line, m.site.line + span - 1] } as ChecklistItem;
  return collateral([item], start, orig) === 0 && !itemDone(item, start, orig);
}

/** One greedy selection pass. */
function select(c: GeneratedChallenge, orig: readonly string[], n: number, rng: Rng): Unit[] {
  const repeats = c.skills.includes('repeat');
  // No kind may hold more than half the smallest run, so none holds more than half of any run.
  // Reps (`drill`) drill one skill on purpose: no cap.
  const cap = c.drill ? Infinity : Math.ceil(c.edits[0] / 2);

  // The KIND is drawn first, uniformly over the kinds that still have sites, then a site of
  // it. Drawing sites directly would weight kinds by how many sites they have (character kinds
  // have ten times the sites of line kinds).
  const pool = new Map(c.mutations.map(id => [id, shuffle(rng, KINDS[id].sites(orig))] as const));
  const units: Unit[] = [];
  const perKind = new Map<string, number>();
  let kept = 0, groups = 0;
  // Without `.` among the skills, no two fixes may be the same multi-key edit: `.` would beat
  // a par that never uses it.
  const twin = (m: Mutation) => parseKeys(m.fixKeys).length > 1 && units.some(u => u.muts.some(k => k.fixKeys === m.fixKeys));
  const clash = (a: number, b: number) => units.some(({ span: [x, y] }) => a <= y + 1 && x <= b + 1);
  // A fix that searches the whole file must not find another item's text.
  const claimed = (m: Mutation) => units.some(u => u.muts.some(k =>
    (k.claims ?? []).some(c => m.lines.join('\n').includes(c)) || (m.claims ?? []).some(c => k.lines.join('\n').includes(c))));
  while (kept < n) {
    const live = [...pool.keys()].filter(id => pool.get(id)!.length > 0 && (perKind.get(id) ?? 0) < cap);
    if (!live.length) break;
    const id = pickWeighted(rng, live);
    const kind = KINDS[id];
    const sites = pool.get(id)!;
    // Stay with the drawn kind until one of its sites fits (a kind whose sites often clash
    // would otherwise lose share to the rest); a kind that runs dry drops out of the draw.
    let site: Site | undefined, m: Mutation | null = null, t: [number, number] = [0, 0];
    // Record the draws, so a group's other members can replay them into the same edit.
    let tape: number[] = [];
    while (!m && (site = sites.pop())) {
      tape = [];
      m = kind.apply(orig, site, () => { const v = rng(); tape.push(v); return v; });
      if (m) { t = touched(m); if (clash(t[0], t[1]) || (!repeats && !c.drill && twin(m)) || claimed(m) || !clean(orig, m)) m = null; }
    }
    if (!m || !site) continue;
    if (kind.once) sites.length = 0;
    const muts = [m];
    const room = Math.min(n - kept, cap - (perKind.get(id) ?? 0));
    if (repeats && kind.repeat && room >= 2 && rng() < (kind.repeatP ?? REPEAT_P)) {
      const want = Math.min(randInt(rng, 2, 3), room);
      const spans: [number, number][] = [t];
      for (const b of shuffle(rng, sites)) {
        if (muts.length >= want) break;
        if (b.line === site.line || !kind.repeat(orig, site, b)) continue;
        let i = 0;
        const other = kind.apply(orig, b, () => (i < tape.length ? tape[i++] : rng()));
        if (!other || other.fixKeys !== m.fixKeys || other.checklist !== m.checklist) continue;
        const ot = touched(other);
        const lo = Math.min(ot[0], ...spans.map(s => s[0])), hi = Math.max(ot[1], ...spans.map(s => s[1]));
        // Members stay close and no other item may sit between them, so they are consecutive
        // in the checklist and the reference fix chains them with `.`.
        if (Math.min(...spans.map(s => Math.abs(s[0] - ot[0]))) > REPEAT_REACH) continue;
        if (spans.some(([x, y]) => ot[0] <= y + 1 && x <= ot[1] + 1) || clash(lo, hi)) continue;
        muts.push(other);
        spans.push(ot);
      }
      for (const o of muts.slice(1)) sites.splice(sites.indexOf(o.site), 1);
    }
    const span: [number, number] = [Math.min(...muts.map(x => touched(x)[0])), Math.max(...muts.map(x => touched(x)[1]))];
    units.push({ muts, span, group: muts.length > 1 ? groups++ : undefined });
    kept += muts.length;
    perKind.set(id, (perKind.get(id) ?? 0) + muts.length);
  }
  return units;
}

const count = (u: Unit[]) => u.reduce((a, x) => a + x.muts.length, 0);
const ATTEMPTS = 8;

type Layout = { start: string[]; goal: string[]; items: { item: ChecklistItem; m: Mutation }[] };

/** The start and goal texts and the checklist (in fix order) for a set of units. */
function layout(orig: readonly string[], units: Unit[]): Layout {
  const kept_ = units.flatMap(u => u.muts.map(m => ({ m, group: u.group })));

  // Apply bottom-up so splices never shift a site above them.
  kept_.sort((p, q) => q.m.site.line - p.m.site.line);
  let start = orig.slice(), goal = orig.slice();
  for (const { m } of kept_) {
    if (m.kind === 'line-to-remove') goal = [...goal.slice(0, m.site.line), ...goal.slice(m.site.line + 1)];
    else start = applyMutation(start, m);
  }

  // Positions in start/goal, walking top-down with running offsets.
  kept_.sort((p, q) => p.m.site.line - q.m.site.line);
  let startOff = 0, goalOff = 0;
  const items: { item: ChecklistItem; m: Mutation }[] = [];
  for (const { m, group } of kept_) {
    const fixAt: Pos = { line: m.site.line + startOff + m.fixAt.dline, col: m.fixAt.col };
    const span = m.span ?? 1;
    let g: [number, number];
    if (m.kind === 'line-to-remove') { const l = Math.max(0, m.site.line - 1 + goalOff); g = [l, l]; goalOff--; }
    else {
      // The item owns its original lines (a removed line: the line above it); inserted lines
      // shift the start text below.
      g = [m.site.line + goalOff, m.site.line + goalOff + span - 1];
      startOff += m.lines.length - span;
    }
    const below = m.lines.length > span && m.kind !== 'missing-duplicate-line' ? m.fixAt.dline : 0;
    items.push({ item: { kind: m.kind, text: m.checklist, goal: g, fixAt, fixKeys: m.fixKeys, ...(group !== undefined && { group }), ...(below && { below }) }, m });
  }
  items.sort((p, q) => p.item.fixAt.line - q.item.fixAt.line || p.item.fixAt.col - q.item.fixAt.col);
  return { start, goal, items };
}

/** Nothing ticked and nothing charged before the first key. */
const sound = (l: Layout) =>
  l.items.every(({ item }) => !itemDone(item, l.start, l.goal)) && collateral(l.items.map(x => x.item), l.start, l.goal) === 0;

/**
 * Two multi-line items one line apart can still confuse the line diff together (the line between
 * them paired with a look-alike). Drop units, biggest first, until the layout is sound.
 */
function repair(orig: readonly string[], units: Unit[]): Unit[] {
  let u = units;
  while (u.length && !sound(layout(orig, u))) {
    const order = u.map((_, k) => k).sort((p, q) => (u[q].span[1] - u[q].span[0]) - (u[p].span[1] - u[p].span[0]));
    const fix = order.find(k => sound(layout(orig, u.filter((_, j) => j !== k))));
    u = u.filter((_, j) => j !== (fix ?? order[0]));
  }
  return u;
}

export function generate(c: GeneratedChallenge, seed: number): Generated {
  const rng = mulberry32(seed);
  const file = pick(rng, c.corpus);
  const orig = file.lines;
  const n = randInt(rng, c.edits[0], c.edits[1]);
  // A pass can pack the file badly (a short file fills up with two-line gaps); retry a few
  // times from the same stream, keeping the first sound pass that reaches the minimum.
  let units: Unit[] = [];
  for (let attempt = 0; attempt < ATTEMPTS && count(units) < c.edits[0]; attempt++) {
    let u = select(c, orig, n, rng);
    if (!sound(layout(orig, u))) u = repair(orig, u);
    if (count(u) > count(units)) units = u;
  }
  const { start, goal, items } = layout(orig, units);

  // A fix identical to the one before it (a repeated group's later members, or a chance twin)
  // is `.` in the par: one key, and these edits are single changes that `.` replays whole.
  let parKeys = 0, parMs = 0, prev: Pos = { line: 0, col: 0 };
  const repeats = c.skills.includes('repeat');
  let last: ChecklistItem | null = null, lastKeys = '';
  // The body of macro `a` as recorded by an earlier fix, if any.
  let recorded: string | null = null;
  for (const { item, m } of items) {
    // Only a single-change fix replays whole with `.`; a yank-then-put (missing-duplicate-line) would replay the put alone.
    const dot = repeats && last !== null && lastKeys === item.fixKeys && parseKeys(item.fixKeys).length > 1 && item.kind !== 'missing-duplicate-line' && !m.multi;
    lastKeys = item.fixKeys;
    if (dot) item.fixKeys = '.';
    let ms = dot ? Math.min(DOT_MS, m.parMs) : m.parMs;
    if (m.macro && item.fixKeys.startsWith('qa')) {
      // The same macro is already in register a: run it over these lines instead of recording it again.
      if (recorded === m.macro.body) { item.fixKeys = `${m.macro.runs}@a`; ms = Math.min(ms, 1000); }
      else recorded = m.macro.body;
    }
    if (m.anywhere) item.anywhere = true;
    const motion = m.anywhere ? 0 : Math.min(shortestPath(start, prev, item.fixAt, PATH_KEYS, MAX_MOTION_KEYS + 1), MAX_MOTION_KEYS);
    parKeys += motion + parseKeys(item.fixKeys).length;
    parMs += motion * MOTION_MS + ms;
    if (!m.anywhere) prev = item.fixAt;
    last = item;
  }
  return { seed, file: file.name, start, goal, items: items.map(i => i.item), parKeys, parMs };
}

const window = (item: ChecklistItem, goalLen: number): [number, number] => [Math.max(0, item.goal[0] - 1), Math.min(goalLen - 1, item.goal[1] + 1)];

/** True when the item's goal window (its lines plus one neighbour each side) is exactly aligned in `cur`. */
export function itemDone(item: ChecklistItem, cur: readonly string[], goal: readonly string[]): boolean {
  const map = new Map(align(cur, goal).map(([c, g]) => [g, c] as const));
  const [lo, hi] = window(item, goal.length);
  for (let g = lo; g <= hi; g++) if (!map.has(g)) return false;
  return map.get(hi)! - map.get(lo)! === hi - lo;
}

/**
 * Count of diff hunks outside every item's own lines (the spec's "region", narrower than the
 * ±1 tick window). A hunk is one gap between consecutive aligned line pairs (a replacement,
 * insertion or deletion counts once). It is inside when some item's lines cover the goal lines
 * it spans, or, for a pure insertion, when either bounding line belongs to an item.
 */
export function collateral(items: ChecklistItem[], cur: readonly string[], goal: readonly string[]): number {
  const pairs = align(cur, goal);
  const regions = items.map(it => it.goal);
  const inside = (gPrev: number, gNext: number) =>
    regions.some(([lo, hi]) => (gNext - gPrev > 1 ? lo <= gPrev + 1 && gNext - 1 <= hi : (gPrev >= lo && gPrev <= hi) || (gNext >= lo && gNext <= hi)));
  let hunks = 0, cPrev = -1, gPrev = -1;
  for (const [c, g] of [...pairs, [cur.length, goal.length] as [number, number]]) {
    if (c - cPrev > 1 || g - gPrev > 1) { if (!inside(gPrev, g)) hunks++; }
    cPrev = c; gPrev = g;
  }
  return hunks;
}
