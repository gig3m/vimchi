// Shorter ways to move from A to B, with the heuristics that make them good advice rather than
// merely correct. The moves here are a pure approximation of the engine; every suggestion is
// replay-verified on the real engine before it is shown (coach/index.ts).
import { step } from '../lessons/runtime';
import type { Pos } from '../vim/types';

/** `moves`: commands in the route (a `;` chain or a run of <C-d> is one). */
export type Cand = { keys: string; cost: number; uses: string[]; family: 'count' | 'word' | 'find' | 'line' | 'search' | 'basic'; moves?: number };

export type State = { pos: Pos; want: number };

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

/** Horizontal moves: the second leg of a canonical route, on the target line. */
const HORIZ = ['h', 'l', 'w', 'b', 'e', 'W', 'B', 'E', '0', '^', '$', 'ge', 'gE'];
const WORDS = new Set(['w', 'b', 'e', 'W', 'B', 'E', 'ge', 'gE']);
const LINE = new Set(['0', '^', '$']);
const isFind = (m: string) => m.length === 2 && /^[ftFT]/.test(m);
/** f{ch} costs 2; each `;` after it costs 1; a count prefix costs its digits; gg/ge/gE cost 2. */
const keyCost = (m: string, count: number) => (isFind(m) ? 2 + (count - 1) : (count > 1 ? String(count).length : 0) + (m.length === 2 ? 2 : 1));
/** At most this many horizontal commands after the vertical leg (`0f(`, `$b`): more is a walk, not a route. */
const MAX_HORIZ = 2;

/** A good alternative is short; searching deeper only finds long routes nobody would suggest. */
export const MAX_SEARCH_COST = 10;

/** Runs keys on the real engine from the segment's start (no `from`) or from a position on the same
 * buffer: for moves that depend on the screen or engine state (<C-d>, H/M/L, n, %). */
export type Oracle = (keys: string, from?: State) => State | null;
export type MotionOpts = { relativenumber?: boolean; prefer?: Set<string>; oracle?: Oracle };

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

/**
 * Shorter ways from `from` to `to`, cost < maxCost, unverified, best first. Routes are canonical:
 * at most one vertical leg (Nj, NG, gg/G, {/}, <C-d>, H/M/L, or a jump: * # n % /search) that
 * reaches the target line, then at most two horizontal moves on that line (0 ^ $ f t w b e, `;`).
 * Interleaved routes (`2wjl`, `3jEj3j`) are search artefacts no teacher would give.
 */
export function betterMotions(lines: readonly string[], from: Pos, want: number, to: Pos, maxCost: number, taught: Set<string>, opts: MotionOpts = {}): Cand[] {
  maxCost = Math.min(maxCost, MAX_SEARCH_COST + 1);
  if (same(from, to) || maxCost <= 1) return [];
  const allow = (t: string) => taught.has(t);
  const counts = taught.has('COUNT');
  const oracle = opts.oracle;
  const start: State = { pos: from, want };
  const found: Cand[] = [];
  type Leg = { st: State; keys: string; cost: number; uses: string[]; family: Cand['family']; moves: number };
  const legs: Leg[] = [];
  if (from.line === to.line) legs.push({ st: start, keys: '', cost: 0, uses: [], family: 'basic', moves: 0 });
  const leg = (st: State | null, keys: string, cost: number, uses: string[], family: Cand['family']) => {
    if (!st || cost >= maxCost || !uses.every(allow)) return;
    if (same(st.pos, to)) found.push({ keys, cost, uses, family, moves: 1 });
    else if (st.pos.line === to.line) legs.push({ st, keys, cost, uses, family, moves: 1 });
  };

  // ---- vertical leg: one command (or a short run of the same paging key) onto the target line
  const dl = to.line - from.line;
  if (dl !== 0) {
    const m = dl > 0 ? 'j' : 'k', n = Math.abs(dl);
    // A count on j/k beyond 3 is only fair advice when relative numbers show it on screen.
    if (n === 1) leg(move(lines, start, m, 1), m, 1, [m], 'basic');
    else if (counts && n <= (opts.relativenumber ? 99 : 3)) leg(move(lines, start, m, n), `${n}${m}`, String(n).length + 1, [m, 'COUNT'], 'count');
    // Line jumps keep the wanted column (nostartofline, Neovim's default).
    const jump = (l: number): State => ({ pos: { line: l, col: Math.min(want, Math.max(0, lines[l].length - 1)) }, want });
    // Jumps are for far lines: within three, j/k is the advice (G one line above the last is a coincidence).
    const far = n > 3;
    if (far && to.line === lines.length - 1) leg(oracle ? oracle('G') : jump(to.line), 'G', 1, ['G'], 'line');
    else if (far && to.line === 0) leg(oracle ? oracle('gg') : jump(0), 'gg', 2, ['gg'], 'line');
    else if (far && counts) { const k = `${to.line + 1}G`; leg(oracle ? oracle(k) : jump(to.line), k, k.length, ['G', 'COUNT'], 'line'); }
    // { and } are for blank lines; landing on text because the file has none is a coincidence.
    if (isBlank(lines[to.line])) for (const p of ['}', '{']) for (let r = 1; r <= 3; r++) leg(move(lines, start, p, r), p.repeat(r), r, [p], 'line');
    if (oracle && far) {
      for (const p of ['<C-d>', '<C-u>']) for (let r = 1; r <= 3; r++) leg(oracle(p.repeat(r)), p.repeat(r), r, [p], 'line');
      for (const p of ['H', 'M', 'L']) leg(oracle(p), p, 1, [p], 'line');
    }
  }
  // ---- jumps: land anywhere; on the target line a horizontal leg may follow
  const wu = wordUnder(lines[from.line], from.col);
  if (wu) for (const [k, dir] of [['*', 1], ['#', -1]] as const) {
    const hit = wholeWordMatch(lines, from, wu.text, dir);
    if (hit) leg({ pos: hit, want: hit.col }, k, 1, [k], 'search');
  }
  if (oracle) {
    for (const k of ['n', 'N']) for (let r = 1; r <= 3; r++) leg(oracle(k.repeat(r)), k.repeat(r), r, [k], 'search');
    leg(oracle('%'), '%', 1, ['%'], 'line');
  }

  // ---- horizontal leg on the target line
  for (const lg of legs) {
    const best = new Map<string, number>([[key(lg.st), lg.cost]]);
    let frontier: Leg[] = [lg];
    for (let depth = 0; depth < MAX_HORIZ && frontier.length; depth++) {
      const next: Leg[] = [];
      const expand = (n: Leg, m: string, count: number, family: Cand['family'], uses: string[], st?: State | null) => {
        const cost = n.cost + keyCost(m, count);
        if (cost >= maxCost || !uses.every(allow)) return;
        st = st === undefined ? move(lines, n.st, m, count) : st;
        if (!st || st.pos.line !== to.line) return;
        const typed = isFind(m) ? m + ';'.repeat(count - 1) : (count > 1 ? String(count) : '') + m;
        const node: Leg = { st, keys: n.keys + typed, cost, uses: [...new Set([...n.uses, ...uses])], family: n.keys ? n.family : family, moves: n.moves + 1 };
        if (same(st.pos, to)) { found.push({ keys: node.keys, cost, uses: node.uses, family: node.family, moves: node.moves }); return; }
        const k = key(st);
        if ((best.get(k) ?? Infinity) <= cost) return;
        best.set(k, cost);
        next.push(node);
      };
      for (const n of frontier) {
        // A second horizontal move follows one real move (`0f(`, `$b`, `f{w`, `2eh`), never a
        // `;` chain: `fu;e` is fiddling.
        if (depth > 0 && n.keys.endsWith(';')) continue;
        for (const m of HORIZ) {
          // h/l after a vertical leg is the interleaving the canonical shape forbids (`2wjl`).
          if ((m === 'h' || m === 'l') && n.keys && depth === 0) continue;
          const family: Cand['family'] = WORDS.has(m) ? 'word' : LINE.has(m) ? 'line' : 'basic';
          expand(n, m, 1, family, [m]);
          if (counts) {
            const max = 'hl'.includes(m) ? (depth ? 1 : 9) : WORDS.has(m) && m.length === 1 ? 3 : 1;
            for (let c = 2; c <= max; c++) expand(n, m, c, 'count', [m, 'COUNT']);
          }
        }
        // f/t stay on their line. `;` repeats the same find.
        const seen = new Set<string>();
        for (const ch of lines[to.line]) {
          if (ch === ' ' || seen.has(ch)) continue;
          seen.add(ch);
          for (const f of ['f', 't', 'F', 'T']) for (let r = 1; r <= 4; r++) expand(n, f + ch, r, 'find', r > 1 ? [f, ';'] : [f]);
        }
        if (oracle && allow('%')) expand(n, '%', 1, 'line', ['%'], oracle('%', n.st));
      }
      frontier = next;
    }
  }
  // /prefix<CR>: the shortest prefix of the identifier at `to` whose first match after `from` is `to`.
  const word = /^[A-Za-z_][A-Za-z0-9_]*/.exec(lines[to.line].slice(to.col))?.[0];
  if (word && allow('/')) {
    for (let len = 1; len <= word.length; len++) {
      const pre = word.slice(0, len);
      const first = firstMatch(lines, from, pre);
      if (first && same(first, to)) { const cost = 2 + len; if (cost < maxCost) found.push({ keys: `/${pre}<CR>`, cost, uses: ['/'], family: 'search', moves: 1 }); break; }
    }
  }
  // Ties: fewer commands, then what an experienced user reaches for first. Line motions, then word motions, then
  // f/t, then counts, then plain hjkl and search. A search to a target on the line you are on
  // ranks below every f/t route whatever it costs: f/t is the tool for what you can see.
  const FAMILY: Record<Cand['family'], number> = { line: 0, word: 1, find: 2, count: 3, basic: 4, search: 5 };
  const distinct = (c: Cand) => new Set(c.keys.replace(/[0-9]/g, '').replace(/<CR>/, '')).size;
  const sameLineSearch = (c: Cand) => from.line === to.line && c.uses.some(u => u === '/' || u === '?' || u === 'n' || u === 'N');
  // Among finds: f/F before t/T, and a target character that occurs once on the line before one that repeats.
  // Then one command before two (`6h` before `bl`).
  const rank = (c: Cand) => (sameLineSearch(c) ? 1e6 : 0) + c.cost * 1000 + (c.moves ?? 1) * 500 + FAMILY[c.family] * 100 + distinct(c) * 10
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
