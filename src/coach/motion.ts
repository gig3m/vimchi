// Shorter ways to move from A to B, with the heuristics that make them good advice rather than
// merely correct. The moves here are a pure approximation of the engine; every suggestion is
// replay-verified on the real engine before it is shown (coach/index.ts).
import { step } from '../lessons/runtime';
import type { Pos } from '../vim/types';

export type Cand = { keys: string; cost: number; uses: string[]; family: 'count' | 'word' | 'find' | 'line' | 'search' | 'basic' };

type State = { pos: Pos; want: number };
type Node = { st: State; keys: string; cost: number; uses: Set<string>; family: Cand['family'] };

const key = (s: State) => `${s.pos.line}:${s.pos.col}:${s.want === Infinity ? '$' : ''}`;
const isBlank = (l: string) => l.trim() === '';
const WORD = /[A-Za-z0-9_]/;
const cls = (ch: string | undefined, big: boolean) => (ch === undefined || /\s/.test(ch) ? 0 : big || WORD.test(ch) ? 1 : 2);
const firstNonBlank = (l: string) => Math.max(0, l.search(/\S/));
const same = (a: Pos, b: Pos) => a.line === b.line && a.col === b.col;

/** One motion (with count) on plain lines. null when it would not move or Vim would error. */
function move(lines: readonly string[], st: State, m: string, count: number): State | null {
  const last = (r: number) => Math.max(0, lines[r].length - 1);
  let { pos: p, want: w } = st;
  for (let n = 0; n < count; n++) {
    const before = p;
    switch (m) {
      case 'h': case 'l': p = step(lines, m, p); w = p.col; break;
      // Word motions that wrap to another line land on whatever happens to be there: a
      // coincidence a teacher would not suggest, so the critic keeps them on one line.
      case 'w': case 'b': case 'e': case 'W': case 'B': case 'E': { const q = step(lines, m, p); if (q.line !== p.line) return null; p = q; w = p.col; break; }
      case 'j': if (p.line + 1 >= lines.length) return null; p = { line: p.line + 1, col: Math.min(w, last(p.line + 1)) }; break;
      case 'k': if (p.line === 0) return null; p = { line: p.line - 1, col: Math.min(w, last(p.line - 1)) }; break;
      case '0': p = { line: p.line, col: 0 }; w = 0; break;
      case '^': p = { line: p.line, col: firstNonBlank(lines[p.line]) }; w = p.col; break;
      case '$': p = { line: p.line, col: last(p.line) }; w = Infinity; break;
      // nostartofline (Neovim's default): a line jump keeps the wanted column, clamped like j/k.
      case 'G': p = { line: lines.length - 1, col: Math.min(w, Math.max(0, lines[lines.length - 1].length - 1)) }; break;
      case 'gg': p = { line: 0, col: Math.min(w, Math.max(0, lines[0].length - 1)) }; break;
      case '}': { let r = p.line + 1; while (r < lines.length && !isBlank(lines[r])) r++; if (r >= lines.length) { r = lines.length - 1; p = { line: r, col: last(r) }; } else p = { line: r, col: 0 }; w = p.col; break; }
      case '{': { let r = p.line - 1; while (r >= 0 && !isBlank(lines[r])) r--; p = { line: Math.max(0, r), col: 0 }; w = 0; break; }
      case 'ge': case 'gE': { // same-line only, as above
        const big = m === 'gE'; const l = lines[p.line];
        let c = p.col;
        if (cls(l[c], big) !== 0) { const k = cls(l[c], big); while (c > 0 && cls(l[c - 1], big) === k) c--; c--; }
        while (c >= 0 && cls(l[c], big) === 0) c--;
        if (c < 0) return null;
        p = { line: p.line, col: c }; w = c; break;
      }
      default: {
        // f{ch} t{ch} F{ch} T{ch}; a count here means "then ; that many more times".
        const ch = m[1], forward = m[0] === 'f' || m[0] === 't', till = m[0] === 't' || m[0] === 'T';
        const l = lines[p.line];
        let c: number;
        if (forward) { c = l.indexOf(ch, p.col + 1 + (till && n > 0 ? 1 : 0)); if (c < 0) return null; if (till) c--; }
        else { const from = p.col - 1 - (till && n > 0 ? 1 : 0); c = from >= 0 ? l.lastIndexOf(ch, from) : -1; if (c < 0) return null; if (till) c++; }
        p = { line: p.line, col: c }; w = c;
      }
    }
    if (same(before, p)) return null;
  }
  return { pos: p, want: w };
}

const SINGLES = ['h', 'j', 'k', 'l', 'w', 'b', 'e', 'W', 'B', 'E', '0', '^', '$', 'ge', 'gE'];
const WORDS = new Set(['w', 'b', 'e', 'W', 'B', 'E', 'ge', 'gE']);
const LINE = new Set(['0', '^', '$']);
const isFind = (m: string) => m.length === 2 && /^[ftFT]/.test(m);
/** f{ch} costs 2; each `;` after it costs 1; a count prefix costs 1; gg/ge/gE cost 2. */
const keyCost = (m: string, count: number) => (isFind(m) ? 2 + (count - 1) : (count > 1 ? 1 : 0) + (m.length === 2 ? 2 : 1));

/** A good alternative is short; searching deeper only finds long routes nobody would suggest. */
export const MAX_SEARCH_COST = 10;

export type MotionOpts = { relativenumber?: boolean; prefer?: Set<string> };

/** The keyword under or after the cursor on its line, as Vim's * sees it. */
function wordUnder(l: string, col: number): { text: string; col: number } | null {
  for (const m of l.matchAll(/[A-Za-z0-9_]+/g)) if (m.index! + m[0].length > col) return { text: m[0], col: m.index! };
  return null;
}
/** First whole-word match of `word` after/before `from` WITHOUT wrapping: a match reached by
 * wrapping past the end is still valid Vim, but the other direction is the advice to give. */
function wholeWordMatch(lines: readonly string[], from: Pos, word: string, dir: 1 | -1): Pos | null {
  const re = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g');
  for (let r = from.line; r >= 0 && r < lines.length; r += dir) {
    const hits = [...lines[r].matchAll(re)].map(m => m.index!);
    const ok = hits.filter(c => (r === from.line ? (dir === 1 ? c > from.col : c < from.col) : true));
    if (ok.length) return { line: r, col: dir === 1 ? ok[0] : ok[ok.length - 1] };
  }
  return null;
}

/** Shorter ways from `from` to `to`, cost < maxCost, unverified, best first. */
export function betterMotions(lines: readonly string[], from: Pos, want: number, to: Pos, maxCost: number, taught: Set<string>, opts: MotionOpts = {}): Cand[] {
  maxCost = Math.min(maxCost, MAX_SEARCH_COST + 1);
  if (same(from, to) || maxCost <= 1) return [];
  const allow = (t: string) => taught.has(t);
  const counts = taught.has('COUNT');
  const start: Node = { st: { pos: from, want }, keys: '', cost: 0, uses: new Set(), family: 'basic' };
  const best = new Map<string, number>([[key(start.st), 0]]);
  // Costs are small integers: a bucket per cost is a queue that pops in order without sorting.
  const buckets: Node[][] = Array.from({ length: maxCost + 1 }, () => []);
  buckets[0].push(start);
  const found: Cand[] = [];
  // G / gg are line jumps: never for a target on the line you are already on.
  const targetLast = to.line === lines.length - 1 && to.line !== from.line, targetFirst = to.line === 0 && to.line !== from.line, targetBlank = isBlank(lines[to.line]);

  const expand = (n: Node, m: string, count: number, family: Cand['family'], uses: string[]) => {
    if (!uses.every(allow)) return;
    const cost = n.cost + keyCost(m, count);
    if (cost >= maxCost) return;
    const st = move(lines, n.st, m, count);
    if (!st) return;
    const k = key(st);
    const prev = best.get(k) ?? Infinity;
    const hit = same(st.pos, to);
    // A cheaper route to a state wins; equal-cost routes to the TARGET are all kept so ties can be
    // ranked by family (0 before b, Fc before 6h) rather than by expansion order. A dearer route
    // to the target that uses a preferred key (the current lesson's own) is kept too, so the coach
    // can reinforce the lesson instead of only naming the cheapest way.
    const preferred = hit && !!opts.prefer && uses.some(u => opts.prefer!.has(u));
    if (!preferred && (prev < cost || (prev === cost && !hit))) return;
    if (cost <= prev) best.set(k, cost);
    const typed = isFind(m) ? m + ';'.repeat(count - 1) : (count > 1 ? String(count) : '') + m;
    const node: Node = { st, keys: n.keys + typed, cost, uses: new Set([...n.uses, ...uses]), family: n.keys ? n.family : family };
    if (hit) found.push({ keys: node.keys, cost, uses: [...node.uses], family: node.family });
    else buckets[cost].push(node);
  };

  for (let c = 0; c < maxCost; c++) for (let bi = 0; bi < buckets[c].length; bi++) {
    const n = buckets[c][bi];
    if ((best.get(key(n.st)) ?? Infinity) < n.cost) continue; // superseded by a cheaper route
    if (n.cost + 1 >= maxCost) continue;
    for (const m of SINGLES) {
      const family: Cand['family'] = WORDS.has(m) ? 'word' : LINE.has(m) ? 'line' : 'basic';
      expand(n, m, 1, family, [m]);
      if (counts) {
        // A count on j/k beyond 3 is only fair advice when relative numbers show it on screen.
        const max = 'hl'.includes(m) ? 9 : 'jk'.includes(m) ? (opts.relativenumber ? 9 : 3) : WORDS.has(m) && m.length === 1 ? 3 : 1;
        for (let c = 2; c <= max; c++) expand(n, m, c, 'count', [m, 'COUNT']);
      }
    }
    // * and # : the word under the cursor must be the target word, and the first match must be the target.
    const wu = wordUnder(lines[n.st.pos.line], n.st.pos.col);
    if (wu) for (const [k, dir] of [['*', 1], ['#', -1]] as const) {
      if (!allow(k)) continue;
      const hit = wholeWordMatch(lines, n.st.pos, wu.text, dir);
      if (hit && same(hit, to) && n.cost + 1 < maxCost) {
        const node: Node = { st: { pos: hit, want: hit.col }, keys: n.keys + k, cost: n.cost + 1, uses: new Set([...n.uses, k]), family: n.keys ? n.family : 'search' };
        if ((best.get(key(node.st)) ?? Infinity) >= node.cost) { best.set(key(node.st), node.cost); found.push({ keys: node.keys, cost: node.cost, uses: [...node.uses], family: node.family }); }
      }
    }
    if (targetLast) expand(n, 'G', 1, 'line', ['G']);
    if (targetFirst) expand(n, 'gg', 1, 'line', ['gg']);
    if (targetBlank) { expand(n, '}', 1, 'line', ['}']); expand(n, '{', 1, 'line', ['{']); }
    // f/t stay on their line, so they only help once on the target line. `;` repeats the same find.
    if (n.st.pos.line === to.line) {
      const seen = new Set<string>();
      for (const ch of lines[to.line]) {
        if (ch === ' ' || seen.has(ch)) continue;
        seen.add(ch);
        for (const f of ['f', 't', 'F', 'T']) for (let r = 1; r <= 4; r++) expand(n, f + ch, r, 'find', r > 1 ? [f, ';'] : [f]);
      }
    }
  }
  // /prefix<CR>: the shortest prefix of the identifier at `to` whose first match after `from` is `to`.
  const word = /^[A-Za-z_][A-Za-z0-9_]*/.exec(lines[to.line].slice(to.col))?.[0];
  if (word && allow('/')) {
    for (let len = 1; len <= word.length; len++) {
      const pre = word.slice(0, len);
      const first = firstMatch(lines, from, pre);
      if (first && same(first, to)) { const cost = 2 + len; if (cost < maxCost) found.push({ keys: `/${pre}<CR>`, cost, uses: ['/'], family: 'search' }); break; }
    }
  }
  // Ties: what an experienced user reaches for first. Line motions, then word motions, then
  // f/t, then counts, then plain hjkl and search.
  const FAMILY: Record<Cand['family'], number> = { line: 0, word: 1, find: 2, count: 3, basic: 4, search: 5 };
  const distinct = (c: Cand) => new Set(c.keys.replace(/[0-9]/g, '').replace(/<CR>/, '')).size;
  // Among finds: f/F before t/T, and a target character that occurs once on the line before one that repeats.
  const rank = (c: Cand) => c.cost * 1000 + FAMILY[c.family] * 100 + distinct(c) * 10
    + (c.family === 'find' && /^[tT]/.test(c.keys) ? 2 : 0)
    + (c.family === 'find' && lines[to.line].split(c.keys[1] ?? '\0').length > 2 ? 1 : 0);
  found.sort((a, b) => rank(a) - rank(b));
  const uniq = new Map<string, Cand>();
  for (const c of found) if (!uniq.has(c.keys)) uniq.set(c.keys, c);
  return [...uniq.values()];
}

function firstMatch(lines: readonly string[], from: Pos, pat: string): Pos | null {
  const n = lines.length;
  for (let d = 0; d <= n; d++) {
    const r = (from.line + d) % n;
    const c = lines[r].indexOf(pat, d === 0 ? from.col + 1 : 0);
    if (c >= 0 && !(d === n && c > from.col)) return { line: r, col: c };
  }
  return null;
}
