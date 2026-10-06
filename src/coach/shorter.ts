// A shorter way to the same edit, found by trying it. The idiom table knows named rewrites
// (cw for x…i, a count for a key run); this catches the rest of the small ones: `f)lD` was
// `$x`, `llldw` was `de`. From where the learner's motions began, try a motion then an edit (or
// an edit alone) built only from keys they've been taught, shortest first, and keep the first
// that leaves the same text.

import type { Vim } from '../vim/editor';
import { type Session, createVim } from '../lessons/runtime';
import type { Segment } from './segment';
import { type Key, parseKeys } from '../vim/keys';
import type { Pos } from '../vim/types';

type Cmd = { keys: string; uses: string[] };

// In order of preference among equal lengths: line ends read clearest, then words, then single steps.
const MOTIONS = ['$', '0', '^', '_', 'gg', 'G', 'w', 'b', 'e', 'ge', 'W', 'B', 'E', 'gE', 'h', 'j', 'k', 'l', '{', '}', '%'];
const FINDS = ['f', 't', 'F', 'T'];

/** Motions from the cursor's line: the fixed ones, then a find for each character on it. */
function motions(line: string): Cmd[] {
  const out: Cmd[] = MOTIONS.map(m => ({ keys: m, uses: [m] }));
  const chars = [...new Set(line.replace(/\s/g, ''))];
  for (const f of FINDS) for (const ch of chars) out.push({ keys: f + (ch === '<' ? '<lt>' : ch === '\\' ? '<Bslash>' : ch === '|' ? '<Bar>' : ch), uses: [f] });
  return out;
}

/** Edits that don't enter Insert mode (typed text is the idiom table's job). */
function edits(ms: Cmd[]): Cmd[] {
  const out: Cmd[] = ['x', 'X', 'D', 'dd', 'J', 'gJ', 'p', 'P', '~'].map(k => ({ keys: k, uses: [k] }));
  for (const m of ms) out.push({ keys: 'd' + m.keys, uses: ['d', ...m.uses] });
  return out;
}

const len = (keys: string) => parseKeys(keys).length;

export type Shorter = { keys: string; length: number; used: number };

/**
 * Search from a scratch editor already at the segment's start state. `want` is the text the learner
 * ended with; `used` the keys they spent. Returns a sequence at least `minSave` keys shorter, or null.
 */
export function shorterEdit(vim: Vim, want: string, used: number, taught: Set<string>, minSave = 2): Shorter | null {
  const budget = Math.min(used - minSave, 4);
  if (budget < 1) return null;
  const lines = vim.buf.lines.slice();
  const cursor: Pos = { ...vim.cursor };
  const ok = (c: Cmd) => c.uses.every(u => taught.has(u));
  const ms = motions(lines[cursor.line] ?? '').filter(ok);
  const es = edits(motions(lines[cursor.line] ?? '')).filter(ok);
  const cands: string[] = [];
  for (const e of es) cands.push(e.keys);
  for (const m of ms) for (const e of es) cands.push(m.keys + e.keys);
  // The edit is often a line or two away: the same, after a j or k.
  const below = edits(motions(lines[cursor.line + 1] ?? '')).filter(ok), above = edits(motions(lines[cursor.line - 1] ?? '')).filter(ok);
  for (const [v, near] of [['j', below], ['k', above]] as const) {
    if (!taught.has(v)) continue;
    const vm = motions(lines[cursor.line + (v === 'j' ? 1 : -1)] ?? '').filter(ok);
    for (const e of near) cands.push(v + e.keys);
    for (const m of vm) for (const e of near) cands.push(v + m.keys + e.keys);
  }
  const sized = cands.map(k => ({ k, n: len(k) })).filter(c => c.n <= budget).sort((a, b) => a.n - b.n);
  for (const { k, n } of sized) {
    vim.buf.lines = lines.slice();
    vim.win.cursor = { ...cursor };
    vim.win.want = cursor.col;
    try {
      for (const key of parseKeys(k) as Key[]) vim.feed(key);
    } catch { /* an impossible motion: not a candidate */ }
    const hit = vim.mode === 'normal' && vim.pending.length === 0 && vim.buf.text() === want;
    if (vim.mode !== 'normal' || vim.pending.length) vim.feed('<Esc>');
    if (hit) return { keys: k, length: n, used };
  }
  return null;
}

/**
 * For a just-closed edit segment (with the motion run right before it, if any): rebuild the editor
 * as it was when those keys began, and look for a shorter route to the same text.
 */
export function shorterSegment(session: Session, segs: Segment[], i: number, taught: Set<string>): Shorter | null {
  const seg = segs[i];
  if (seg.kind !== 'edit' || seg.command === 'insert' || seg.command === 'visual') return null;
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
  const vim = createVim(session.setupFor(seg.unit));
  for (let k = start; k < from; k++) vim.feed(log[k].key);
  if (vim.mode !== 'normal') return null;
  const lines = vim.buf.lines.slice(), cursor = { ...vim.cursor };
  for (let k = from; k <= seg.logEnd; k++) vim.feed(log[k].key);
  const want = vim.buf.text();
  // The replay must agree with what's on screen, or the suggestion would be for some other text.
  if (seg.logEnd === log.length - 1 && want !== session.vim?.buf.text()) return null;
  vim.buf.lines = lines;
  vim.win.cursor = cursor;
  return shorterEdit(vim, want, seg.logEnd - from + 1, taught);
}
