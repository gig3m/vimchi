// A shorter way to the same edit, found by trying it. The idiom table knows named rewrites
// (cw for x…i, a count for a key run); this catches the rest: `f)lD` was `$x`, `llldw` was `de`,
// `jjjA;<Esc>` from the wrong line was `GA;<Esc>`, a change typed again was `j.`. From where the learner's motions began, find the
// cheapest way (up to two motions) to each nearby spot, then try every edit from each spot, typed
// text included, built only from keys they've been taught. The shortest that leaves the same text
// wins.

import type { Vim } from '../vim/editor';
import { type Session, createVim } from '../lessons/runtime';
import type { Segment } from './segment';
import { type Key, parseKeys } from '../vim/keys';
import type { Pos } from '../vim/types';
import { align } from '../lessons/goalDiff';

type Cmd = { keys: string; uses: string[]; pen?: number };
/** What the learner typed, and a ranking penalty for typing only part of a word ("e" into usr reads as a trick, not a habit). */
type Text = { t: string; pen: number };

// In order of preference among equal lengths: line ends read clearest, then words, then single steps.
const MOTIONS = ['$', '0', '^', '_', 'gg', 'G', 'w', 'b', 'e', 'ge', 'W', 'B', 'E', 'gE', 'h', 'j', 'k', 'l', '{', '}', '%'];
const FINDS = ['f', 't', 'F', 'T'];
const VERTICAL = new Set(['j', 'k', 'gg', 'G', '{', '}', '_']);
/** Motions a count makes sense on, and the counts tried (once a lesson has taught counts). */
const COUNTED = ['j', 'k', 'w', 'b', 'e', 'W', 'B', 'E', 'h', 'l', '}', '{'];
const COUNTS = ['2', '3', '4', '5', '6', '7', '8', '9'];
const OBJECTS = ['iw', 'aw', 'iW', 'aW', 'i(', 'a(', 'ib', 'ab', 'i{', 'a{', 'iB', 'aB', 'i[', 'a[', 'i"', 'a"', "i'", "a'", 'i`', 'a`', 'it', 'at', 'ip', 'ap', 'is', 'as'];

/** A character as a key in Vim notation. */
const keyOf = (ch: string) => (ch === '<' ? '<lt>' : ch === '\\' ? '<Bslash>' : ch === '|' ? '<Bar>' : ch);
const typed = (t: string) => [...t].map(keyOf).join('');

/** Motions from a line: the fixed ones, then a find for each character on it. */
function motions(line: string): Cmd[] {
  const out: Cmd[] = MOTIONS.map(m => ({ keys: m, uses: [m] }));
  const chars = [...new Set(line.replace(/\s/g, ''))];
  for (const f of FINDS) for (const ch of chars) out.push({ keys: f + keyOf(ch), uses: [f] });
  return out;
}

/** Edits from a spot on `line`. `texts`: what the learner typed, for the forms that type. */
function edits(line: string, texts: Text[]): Cmd[] {
  const ms = motions(line);
  // Order breaks ties: whole lines by count read best (3dd over d2j), a word by motion (dw over 6x).
  const out: Cmd[] = ['x', 'X', 'D', 'dd', 'J', 'gJ', 'p', 'P', '~'].map(k => ({ keys: k, uses: [k] }));
  for (const n of COUNTS) for (const k of ['dd', 'J']) out.push({ keys: n + k, uses: ['COUNT', k] });
  for (const m of ms) out.push({ keys: 'd' + m.keys, uses: ['d', ...m.uses] });
  for (const n of COUNTS) for (const k of ['x', 'X', 'D']) out.push({ keys: n + k, uses: ['COUNT', k] });
  for (const o of OBJECTS) out.push({ keys: 'd' + o, uses: ['d', o] });
  for (const n of COUNTS) for (const m of COUNTED) out.push({ keys: 'd' + n + m, uses: ['COUNT', 'd', m] });
  for (const { t, pen } of texts) {
    const body = typed(t) + '<Esc>';
    for (const k of ['i', 'a', 'I', 'A', 'o', 'O', 's', 'S', 'C', 'cc']) out.push({ keys: k + body, uses: [k], pen });
    for (const m of ms) out.push({ keys: 'c' + m.keys + body, uses: ['c', ...m.uses], pen });
    for (const o of OBJECTS) out.push({ keys: 'c' + o + body, uses: ['c', o], pen });
    for (const n of COUNTS) {
      out.push({ keys: n + 'cc' + body, uses: ['COUNT', 'cc'], pen });
      for (const m of COUNTED) out.push({ keys: 'c' + n + m + body, uses: ['COUNT', 'c', m], pen });
    }
  }
  return out;
}

/** The text the learner typed, as best the before/after lines tell: a changed span, or a new line. */
function typedTexts(before: string[], after: string[]): Text[] {
  if (after.length === before.length) {
    const changed = after.flatMap((t, i) => (t === before[i] ? [] : [i]));
    if (changed.length !== 1) return [];
    const b = before[changed[0]], a = after[changed[0]];
    let p = 0;
    while (p < b.length && p < a.length && b[p] === a[p]) p++;
    let s = 0;
    while (s < b.length - p && s < a.length - p && b[b.length - 1 - s] === a[a.length - 1 - s]) s++;
    const mid = a.slice(p, a.length - s);
    // Whole words read as typed: "user" for usr→user, not just the "e".
    const whole = a.slice(a.slice(0, p).search(/\w*$/), a.length - s + (/^\w*/.exec(a.slice(a.length - s))?.[0].length ?? 0));
    const w = /\w/;
    const partial = (w.test(a[p - 1] ?? '') && w.test(mid[0] ?? '')) || (w.test(a[a.length - s] ?? '') && w.test(mid[mid.length - 1] ?? ''));
    const out = new Map<string, number>();
    for (const [t, pen] of [[whole, 0], [a.trim(), 0], [a.slice(p), 0], [mid, partial ? 3 : 0]] as const) if (t && !out.has(t)) out.set(t, pen);
    return [...out].map(([t, pen]) => ({ t, pen }));
  }
  if (after.length < before.length) {
    // Several lines became one (cj, 2cc…): the line that isn't one of the old ones is what was typed.
    const kept = new Set(align(after, before).map(([i]) => i));
    const fresh = after.filter((_, i) => !kept.has(i));
    return fresh.length === 1 ? [...new Set([fresh[0].trim(), fresh[0]].filter(t => t))].map(t => ({ t, pen: 0 })) : [];
  }
  if (after.length === before.length + 1) {
    const kept = new Set(align(after, before).map(([i]) => i));
    const added = after.findIndex((_, i) => !kept.has(i));
    return added < 0 ? [] : [...new Set([after[added].trim(), after[added]].filter(t => t))].map(t => ({ t, pen: 0 }));
  }
  return [];
}

const len = (keys: string) => parseKeys(keys).length;

export type Shorter = { keys: string; length: number; used: number };

/**
 * Search from a scratch editor already at the segment's start state. `want` is the text the learner
 * ended with; `used` the keys they spent. Returns a sequence at least `minSave` keys shorter, or
 * null. Stops after `ms` milliseconds with the best found so far.
 */
export function shorterEdit(vim: Vim, want: string, used: number, taught: Set<string>, minSave = 2, ms = 40): Shorter | null {
  const limit = used - minSave;
  if (limit < 1) return null;
  const t0 = performance.now();
  const lines = vim.buf.lines.slice();
  const start: Pos = { ...vim.cursor };
  const ok = (c: Cmd) => c.uses.every(u => taught.has(u));
  // Counted motions (5j, 3w) only as the first move: as a second they multiply the search for little.
  const counted = (): Cmd[] => COUNTS.flatMap(n => COUNTED.map(m => ({ keys: n + m, uses: ['COUNT', m] })));
  const reset = (at: Pos) => {
    if (vim.mode !== 'normal' || vim.pending.length) vim.feed('<Esc>');
    vim.buf.lines = lines.slice();
    vim.win.cursor = { ...at };
    vim.win.want = at.col;
  };
  const run = (keys: string) => {
    try { for (const k of parseKeys(keys) as Key[]) vim.feed(k); } catch { /* not a candidate */ }
  };

  // Cheapest motion keys to each reachable spot, up to two motions.
  // `odd` counts motions that leave the line without being vertical ones (e wrapping onto the next
  // line): a tie goes to the route a person would take, j$ over $E.
  const spots = new Map<string, { at: Pos; keys: string; n: number; odd: number }>([[`${start.line}:${start.col}`, { at: start, keys: '', n: 0, odd: 0 }]]);
  let frontier = [...spots.values()];
  for (let depth = 0; depth < 2; depth++) {
    const next: typeof frontier = [];
    for (const f of frontier) for (const m of [...motions(lines[f.at.line] ?? ''), ...(depth === 0 ? counted() : [])].filter(ok)) {
      const n = f.n + len(m.keys);
      if (n >= limit) continue;
      reset(f.at);
      run(m.keys);
      if (vim.mode !== 'normal' || vim.pending.length) continue;
      const at = { ...vim.cursor }, k = `${at.line}:${at.col}`;
      const odd = f.odd + (at.line !== f.at.line && !VERTICAL.has(m.keys) ? 1 : 0);
      const had = spots.get(k);
      if (had && (had.n < n || (had.n === n && had.odd <= odd))) continue;
      const spot = { at, keys: f.keys + m.keys, n, odd };
      spots.set(k, spot);
      next.push(spot);
    }
    frontier = next;
  }

  const texts = typedTexts(lines, want.split('\n'));
  let best: (Shorter & { rank: number }) | null = null;
  const byCost = [...spots.values()].sort((a, b) => a.n - b.n || a.odd - b.odd);
  const cache = new Map<number, (Cmd & { n: number })[]>();
  const done = (b: typeof best) => (b ? { keys: b.keys, length: b.length, used: b.used } : null);
  const editsOn = (line: number) => {
    let es = cache.get(line);
    if (!es) cache.set(line, (es = edits(lines[line] ?? '', texts).filter(ok).map(e => ({ ...e, n: len(e.keys) })).sort((a, b) => a.n + (a.pen ?? 0) - b.n - (b.pen ?? 0))));
    return es;
  };
  // `.` first: the scratch editor replayed the learner's earlier edits, so it repeats their last
  // change, but only until a candidate below makes a change of its own.
  if (taught.has('.')) for (const spot of byCost) {
    if (spot.n + 1 > limit) break;
    reset(spot.at);
    run('.');
    if (vim.mode === 'normal' && vim.pending.length === 0 && vim.buf.text() === want) {
      best = { keys: spot.keys + '.', length: spot.n + 1, used, rank: spot.n + 1 };
      break;
    }
  }
  for (const spot of byCost) {
    for (const e of editsOn(spot.at.line)) {
      const n = spot.n + e.n, rank = n + (e.pen ?? 0);
      if (n > limit) continue;
      if (best && rank >= best.rank) break;
      if (performance.now() - t0 > ms) return done(best);
      reset(spot.at);
      run(e.keys);
      if (vim.mode === 'normal' && vim.pending.length === 0 && vim.buf.text() === want) {
        best = { keys: spot.keys + e.keys, length: n, used, rank };
        break;
      }
    }
  }
  reset(start);
  return done(best);
}

/**
 * For a just-closed edit segment (with the motion run right before it, if any): rebuild the editor
 * as it was when those keys began, and look for a shorter route to the same text.
 */
export function shorterSegment(session: Session, segs: Segment[], i: number, taught: Set<string>): Shorter | null {
  const seg = segs[i];
  if (seg.kind !== 'edit') return null;
  // Back over the motions that led here, failed ones included (`l` at the end of a line beeps but
  // was still spent getting there).
  let from = seg.logStart;
  for (let j = i - 1; j >= 0; j--) {
    const p = segs[j];
    if (p.logEnd !== from - 1 || !(p.kind === 'motion' || (p.kind === 'break' && p.reason === 'error'))) break;
    from = p.logStart;
  }
  const log = session.log();
  // A round's editor starts fresh at its setup; a generated challenge is one editor from the start.
  const start = session.challenge.kind === 'rounds' ? session.unitStart(seg.unit) : 0;
  // Two replays: one stops where the segment began (its `.` still repeats the change before it),
  // the other runs through the segment for the text it left.
  const replay = (to: number) => {
    const v = createVim(session.setupFor(seg.unit));
    for (let k = start; k < to; k++) v.feed(log[k].key);
    return v;
  };
  const vim = replay(from);
  if (vim.mode !== 'normal') return null;
  const want = replay(seg.logEnd + 1).buf.text();
  // The replay must agree with what's on screen, or the suggestion would be for some other text.
  if (seg.logEnd === log.length - 1 && want !== session.vim?.buf.text()) return null;
  return shorterEdit(vim, want, seg.logEnd - from + 1, taught);
}
