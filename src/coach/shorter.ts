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
import { sectionOf } from '../lessons';

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
const keyOf = (ch: string) => (ch === '<' ? '<lt>' : ch === '\\' ? '<Bslash>' : ch === '|' ? '<Bar>' : ch === '\t' ? '<Tab>' : ch);
const typed = (t: string) => [...t].map(keyOf).join('');

/** Motions from a line: the fixed ones, then a find for each character on it. */
function motions(line: string): Cmd[] {
  const out: Cmd[] = MOTIONS.map(m => ({ keys: m, uses: [m] }));
  const chars = [...new Set(line.replace(/\s/g, ''))];
  for (const f of FINDS) for (const ch of chars) out.push({ keys: f + keyOf(ch), uses: [f] });
  return out;
}

const CASE_OPS = ['gU', 'gu', 'g~', '>', '<'];
const DOUBLED: Record<string, string> = { gU: 'gUU', gu: 'guu', 'g~': 'g~~', '>': '>>', '<': '<<' };

/** Escapes for a `:s` pattern and replacement (magic, `/` as the separator). */
const escPat = (t: string) => t.replace(/[\\/.*[\]^$~]/g, m => '\\' + m);
const escRep = (t: string) => t.replace(/[\\/&~]/g, m => '\\' + m);
const count = (n: number) => (n > 1 ? String(n) : '');

/**
 * Edits that change several lines the same way (the same text removed and/or added on each):
 * `:s` over the range or the file, and a block insert, append or delete.
 */
function sameChangeEdits(same: Same | null): Cmd[] {
  if (!same) return [];
  const { old, neu, lines, col, eol } = same;
  const out: Cmd[] = [];
  const first = lines[0] + 1, last = lines[lines.length - 1] + 1;
  const sub = `s/${escPat(old)}/${escRep(neu)}/`;
  if (old) {
    out.push({ keys: `:%${sub}g<CR>`, uses: [':s'] }, { keys: `:%${sub}<CR>`, uses: [':s'] });
    out.push({ keys: lines.length === 1 ? `:${sub}<CR>` : `:${first},${last}${sub}<CR>`, uses: [':s'] });
  }
  const contiguous = lines.every((l, i) => i === 0 || l === lines[i - 1] + 1);
  if (contiguous && col !== null) {
    const down = lines.length - 1;
    const block = `<C-v>${down ? count(down) + 'j' : ''}`;
    const uses = ['<C-v>', ...(down > 1 ? ['COUNT'] : []), ...(down ? ['j'] : [])];
    if (!old && neu) {
      out.push({ keys: `${block}I${typed(neu)}<Esc>`, uses: [...uses, 'I'] });
      if (eol) out.push({ keys: `${block}$A${typed(neu)}<Esc>`, uses: [...uses, '$', 'A'] });
    }
    if (old && !neu) out.push({ keys: `${block}${old.length > 1 ? count(old.length - 1) + 'l' : ''}d`, uses: [...uses, 'd', ...(old.length > 1 ? ['l', ...(old.length > 2 ? ['COUNT'] : [])] : [])] });
  }
  return out;
}

/** Edits from a spot on `line`. `texts`: what the learner typed, for the forms that type. */
function edits(line: string, texts: Text[], same: Same | null): Cmd[] {
  const ms = motions(line);
  // Order breaks ties: whole lines by count read best (3dd over d2j), a word by motion (dw over 6x).
  const out: Cmd[] = ['x', 'X', 'D', 'dd', 'J', 'gJ', 'p', 'P', '~'].map(k => ({ keys: k, uses: [k] }));
  for (const n of COUNTS) for (const k of ['dd', 'J']) out.push({ keys: n + k, uses: ['COUNT', k] });
  for (const m of ms) out.push({ keys: 'd' + m.keys, uses: ['d', ...m.uses] });
  for (const n of COUNTS) for (const k of ['x', 'X', 'D']) out.push({ keys: n + k, uses: ['COUNT', k] });
  for (const o of OBJECTS) out.push({ keys: 'd' + o, uses: ['d', o] });
  for (const n of COUNTS) for (const m of COUNTED) out.push({ keys: 'd' + n + m, uses: ['COUNT', 'd', m] });
  // Case and indent operators, doubled for the line, counted for lines.
  for (const op of CASE_OPS) {
    out.push({ keys: DOUBLED[op], uses: [DOUBLED[op]] });
    for (const n of COUNTS) out.push({ keys: n + DOUBLED[op], uses: ['COUNT', DOUBLED[op]] });
    // Half a key behind the doubled form, so a tie goes to j>> rather than a cryptic G>b.
    for (const m of ms) out.push({ keys: op + m.keys, uses: [op, ...m.uses], pen: 0.5 });
    for (const o of OBJECTS) out.push({ keys: op + o, uses: [op, o], pen: 0.5 });
  }
  // Moving and copying: swap two characters, move or copy a line somewhere a motion reaches.
  out.push({ keys: 'xp', uses: ['x', 'p'] }, { keys: 'ddp', uses: ['dd', 'p'] }, { keys: 'ddP', uses: ['dd', 'P'] }, { keys: 'yyp', uses: ['yy', 'p'] }, { keys: 'yyP', uses: ['yy', 'P'] });
  for (const op of ['dd', 'yy']) for (const m of [...MOTIONS, ...COUNTS.flatMap(n => [n + 'j', n + 'k'])]) for (const put of ['p', 'P']) {
    out.push({ keys: op + m + put, uses: [op, put, ...(/^\d/.test(m) ? ['COUNT', m.slice(1)] : [m])] });
  }
  out.push(...sameChangeEdits(same));
  for (const { t, pen } of texts) {
    if ([...t].length === 1) out.push({ keys: 'r' + keyOf(t), uses: ['r'], pen });
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

/** Several lines changed the same way: `old` replaced by `neu` on each (at one column, if `col`). */
type Same = { old: string; neu: string; lines: number[]; col: number | null; eol: boolean };

function sameChange(before: string[], after: string[]): Same | null {
  if (after.length !== before.length) return null;
  const lines = after.flatMap((t, i) => (t === before[i] ? [] : [i]));
  if (lines.length < 2) return null;
  let key: string | null = null, col: number | null = -1, eol = true;
  for (const i of lines) {
    const b = before[i], a = after[i];
    let p = 0;
    while (p < b.length && p < a.length && b[p] === a[p]) p++;
    let s = 0;
    while (s < b.length - p && s < a.length - p && b[b.length - 1 - s] === a[a.length - 1 - s]) s++;
    const k = JSON.stringify([b.slice(p, b.length - s), a.slice(p, a.length - s)]);
    if (key !== null && k !== key) return null;
    key = k;
    col = col === -1 ? p : col === p ? col : null;
    eol = eol && s === 0;
  }
  const [old, neu] = JSON.parse(key!) as [string, string];
  return { old, neu, lines, col: col === -1 ? null : col, eol };
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
  // Counted motions (5j, 3w): every kind as the first move, then only lines and words.
  const counted = (depth: number): Cmd[] => COUNTS.flatMap(n => (depth === 0 ? COUNTED : ['j', 'k', 'w', 'b']).map(m => ({ keys: n + m, uses: ['COUNT', m] })));
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
  for (let depth = 0; depth < 3; depth++) {
    // A third motion only while there's time left for the edits.
    if (depth === 2 && performance.now() - t0 > ms / 3) break;
    const next: typeof frontier = [];
    for (const f of frontier) for (const m of [...motions(lines[f.at.line] ?? ''), ...counted(depth)].filter(ok)) {
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
  const same = sameChange(lines, want.split('\n'));
  let best: (Shorter & { rank: number }) | null = null;
  const byCost = [...spots.values()].sort((a, b) => a.n - b.n || a.odd - b.odd);
  const cache = new Map<number, (Cmd & { n: number })[]>();
  const done = (b: typeof best) => (b ? { keys: b.keys, length: b.length, used: b.used } : null);
  const editsOn = (line: number) => {
    let es = cache.get(line);
    if (!es) cache.set(line, (es = edits(lines[line] ?? '', texts, same).filter(ok).map(e => ({ ...e, n: len(e.keys) })).sort((a, b) => a.n + (a.pen ?? 0) - b.n - (b.pen ?? 0))));
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

/**
 * The keys the search may use: the lessons' taught keys, plus `:s` once a Substitute lesson is among
 * them (a `:` alone is taught by :w, long before substitution).
 */
export function searchVocab(taught: Set<string>, lessonIds: readonly string[] = []): Set<string> {
  if (!lessonIds.some(id => { try { return sectionOf(id)?.id === 'substitute'; } catch { return false; } })) return taught;
  return new Set([...taught, ':s']);
}
