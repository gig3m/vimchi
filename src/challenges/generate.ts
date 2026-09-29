// Turns a GeneratedChallenge + seed into a concrete session. Pure and deterministic.
import { align } from '../lessons/goalDiff';
import { shortestPath } from '../lessons/runtime';
import type { GeneratedChallenge } from '../lessons/types';
import { parseKeys } from '../vim/keys';
import type { Pos } from '../vim/types';
import { KINDS } from './mutations';
import { type Mutation, applyMutation } from './mutations/types';
import { mulberry32, pick, randInt, shuffle } from './rng';

export type ChecklistItem = {
  kind: string;
  text: string;
  /** Contiguous goal (original) line range this item owns, inclusive. */
  goal: [number, number];
  /** Where the reference fix starts, in the START text. */
  fixAt: Pos;
  /** Reference keys for the fix (motion excluded). */
  fixKeys: string;
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

/** Lines a mutation touches in the original (for the one-line-gap rule). */
const touched = (m: Mutation): [number, number] =>
  m.kind === 'stray-line' ? [m.site.line, m.site.line + 1]
  : m.kind === 'missing-duplicate-line' || m.kind === 'line-to-remove' ? [m.site.line - 1, m.site.line]
  : [m.site.line, m.site.line];

export function generate(c: GeneratedChallenge, seed: number): Generated {
  const rng = mulberry32(seed);
  const file = pick(rng, c.corpus);
  const orig = file.lines;
  const n = randInt(rng, c.edits[0], c.edits[1]);

  const cands = shuffle(rng, c.mutations.flatMap(id => KINDS[id].sites(orig).map(site => ({ id, site }))));
  const kept: Mutation[] = [];
  const perKind = new Map<string, number>();
  for (const { id, site } of cands) {
    if (kept.length >= n) break;
    // No kind may hold more than half the items, at every prefix of the selection.
    if ((perKind.get(id) ?? 0) >= Math.ceil((kept.length + 1) / 2)) continue;
    const m = KINDS[id].apply(orig, site, rng);
    if (!m) continue;
    const [a, b] = touched(m);
    if (kept.some(k => { const [x, y] = touched(k); return a <= y + 1 && x <= b + 1; })) continue;
    kept.push(m);
    perKind.set(id, (perKind.get(id) ?? 0) + 1);
  }

  // Apply bottom-up so splices never shift a site above them.
  kept.sort((p, q) => q.site.line - p.site.line);
  let start = orig.slice(), goal = orig.slice();
  for (const m of kept) {
    if (m.kind === 'line-to-remove') goal = [...goal.slice(0, m.site.line), ...goal.slice(m.site.line + 1)];
    else start = applyMutation(start, m);
  }

  // Positions in start/goal, walking top-down with running offsets.
  kept.sort((p, q) => p.site.line - q.site.line);
  let startOff = 0, goalOff = 0;
  const items: { item: ChecklistItem; m: Mutation }[] = [];
  for (const m of kept) {
    const fixAt: Pos = { line: m.site.line + startOff + m.fixAt.dline, col: m.fixAt.col };
    let g: [number, number];
    if (m.kind === 'line-to-remove') { const l = Math.max(0, m.site.line - 1 + goalOff); g = [l, l]; goalOff--; }
    else if (m.kind === 'stray-line') { g = [m.site.line + goalOff, m.site.line + goalOff]; startOff++; }
    else if (m.kind === 'missing-duplicate-line') { g = [m.site.line + goalOff, m.site.line + goalOff]; startOff--; }
    else g = [m.site.line + goalOff, m.site.line + goalOff];
    items.push({ item: { kind: m.kind, text: m.checklist, goal: g, fixAt, fixKeys: m.fixKeys }, m });
  }
  items.sort((p, q) => p.item.fixAt.line - q.item.fixAt.line || p.item.fixAt.col - q.item.fixAt.col);

  let parKeys = 0, parMs = 0, prev: Pos = { line: 0, col: 0 };
  for (const { item, m } of items) {
    const motion = Math.min(shortestPath(start, prev, item.fixAt, PATH_KEYS, MAX_MOTION_KEYS + 1), MAX_MOTION_KEYS);
    parKeys += motion + parseKeys(item.fixKeys).length;
    parMs += motion * MOTION_MS + m.parMs;
    prev = item.fixAt;
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
