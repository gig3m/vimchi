// Diff mode: :diffsplit / :diffthis / :diffoff, DiffAdd/DiffChange/DiffText
// highlighting with filler lines, ]c / [c, do / dp, :diffget / :diffput, and
// merge conflicts (:diffget //2 takes ours, //3 theirs, for the conflict under
// the cursor, as in fugitive's :Gdiffsplit! 3-way view).

import type { Buffer } from '../buffer';
import type { Decoration, Plugin, Vim } from '../editor';
import type { Window } from '../layout';
import { fail, pos } from '../types';
import { type Hunk, addHunkNav, diffLines } from './git-model';

const BG = { add: 'rgba(80,250,123,.14)', change: 'rgba(189,147,249,.14)', text: 'rgba(189,147,249,.38)', filler: 'rgba(255,85,85,.08)' };

export const inDiff = (w: Window) => !!w.opts.diff;

/** Other diff windows in the current tab showing a different buffer. */
function partners(vim: Vim, win: Window): Window[] {
  return vim.tab.windows().filter(w => w !== win && inDiff(w) && w.buf !== win.buf);
}

/** Hunks from `other` to `me` (a = other, b = me). */
const hunksVs = (me: Buffer, other: Buffer) => diffLines(other.lines, me.lines);

/** Turn diff mode on or off for a window (installs the plugin's hooks on first use). */
export function setDiff(vim: Vim, win: Window, on: boolean) {
  install(vim);
  if (on) {
    win.opts.diff = true;
    win.opts.scrollbind = true;
  } else {
    delete win.opts.diff;
    delete win.opts.scrollbind;
  }
}

// ---- conflicts ------------------------------------------------------------------------------------

export type Conflict = { start: number; mid: number; base: number | null; end: number };

const OURS = /^<{7}(\s|$)/, BASE = /^\|{7}(\s|$)/, MID = /^={7}$/, THEIRS = /^>{7}(\s|$)/;

export function conflictAt(lines: string[], line: number): Conflict | null {
  let s = line;
  while (s >= 0 && !OURS.test(lines[s])) {
    if (THEIRS.test(lines[s]) && s !== line) return null;
    s--;
  }
  if (s < 0) return null;
  let base: number | null = null, mid = -1, e = s + 1;
  for (; e < lines.length; e++) {
    if (BASE.test(lines[e]) && mid < 0) base = e;
    else if (MID.test(lines[e])) mid = e;
    else if (THEIRS.test(lines[e])) break;
    else if (OURS.test(lines[e])) return null;
  }
  if (e >= lines.length || mid < 0 || line > e) return null;
  return { start: s, mid, base, end: e };
}

/** Lines of one side of a conflict: 2 = ours, 3 = theirs. */
export function conflictSide(lines: string[], c: Conflict, side: 2 | 3): string[] {
  return side === 2 ? lines.slice(c.start + 1, c.base ?? c.mid) : lines.slice(c.mid + 1, c.end);
}

/** The whole file with every conflict resolved to one side (fugitive's //2 and //3 buffers). */
export function resolveAll(lines: string[], side: 2 | 3): string[] {
  const out: string[] = [];
  for (let l = 0; l < lines.length; l++) {
    const c = OURS.test(lines[l]) ? conflictAt(lines, l) : null;
    if (!c) { out.push(lines[l]); continue; }
    out.push(...conflictSide(lines, c, side));
    l = c.end;
  }
  return out;
}

function takeSide(vim: Vim, side: 2 | 3): boolean {
  const c = conflictAt(vim.buf.lines, vim.cursor.line);
  if (!c) return false;
  vim.beginChange();
  vim.buf.splice(c.start, c.end - c.start + 1, conflictSide(vim.buf.lines, c, side));
  vim.buf.recordChange(pos(c.start, 0));
  vim.setCursor(pos(Math.min(c.start, vim.buf.lineCount - 1), 0));
  return true;
}

// ---- obtain / put ---------------------------------------------------------------------------------------

function onePartner(vim: Vim, spec?: string): Window {
  if (!inDiff(vim.win)) fail('E99: Current buffer is not in diff mode');
  let ps = partners(vim, vim.win);
  if (spec) {
    const n = /^\d+$/.test(spec) ? vim.buffers[+spec - 1] : null;
    ps = ps.filter(w => w.buf === n || w.buf.name.includes(spec));
    if (!ps.length) fail(`E94: No matching buffer for ${spec}`);
  }
  if (!ps.length) fail('E100: No other buffer in diff mode');
  if (ps.length > 1) fail("E101: More than two buffers in diff mode, don't know which one to use");
  return ps[0];
}

function hunksIn(me: Buffer, other: Buffer, first: number, last: number): Hunk[] {
  return hunksVs(me, other).filter(h => {
    if (h.bCount === 0) {
      const at = Math.min(h.bStart, me.lineCount - 1);
      return at >= first && at <= last;
    }
    return h.bStart <= last && h.bStart + h.bCount - 1 >= first;
  });
}

/** do / :diffget: make lines of this buffer match the other one. */
function obtain(vim: Vim, other: Window, first: number, last: number) {
  const me = vim.buf;
  const hs = hunksIn(me, other.buf, first, last);
  if (!hs.length) return;
  vim.beginChange();
  for (const h of [...hs].reverse()) me.splice(h.bStart, h.bCount, h.a);
  vim.setCursor(pos(Math.min(hs[0].bStart, me.lineCount - 1), 0));
}

/** dp / :diffput: make lines of the other buffer match this one. */
function put(vim: Vim, other: Window, first: number, last: number) {
  const hs = hunksIn(vim.buf, other.buf, first, last);
  if (!hs.length) return;
  const ob = other.buf;
  ob.snapshot(other.cursor, hs[0].aStart);
  for (const h of [...hs].reverse()) ob.splice(h.aStart, h.aCount, h.b);
  ob.recordChange(pos(hs[0].aStart, 0));
}

// ---- rendering & navigation ----------------------------------------------------------------------------

function decorate(vim: Vim, buf: Buffer, win: Window): Decoration | null {
  if (!inDiff(win) || !vim.tab.windows().includes(win)) return null;
  const ps = partners(vim, win);
  if (!ps.length) return null;
  const lineBg = new Map<number, string>();
  const hl: NonNullable<Decoration['hl']> = [];
  const virtLines = new Map<number, { text: string; color?: string; bg?: string }[]>();
  // Filler lines line up with one partner: the work-tree file if there is one (3-way), else the first.
  const fillFrom = ps.find(p => p.buf.kind === 'file') ?? ps[0];
  ps.forEach(p => {
    for (const h of hunksVs(buf, p.buf)) {
      for (let k = 0; k < h.bCount; k++) {
        const l = h.bStart + k;
        if (k < h.aCount) {
          if (!lineBg.has(l)) lineBg.set(l, BG.change);
          const a = h.a[k], b = h.b[k];
          let s = 0;
          while (s < a.length && s < b.length && a[s] === b[s]) s++;
          let e = 0;
          while (e < a.length - s && e < b.length - s && a[a.length - 1 - e] === b[b.length - 1 - e]) e++;
          if (b.length - e > s) hl.push({ line: l, start: s, end: b.length - e, color: '#f8f8f2', bg: BG.text });
        } else lineBg.set(l, BG.add);
      }
      if (p === fillFrom && h.aCount > h.bCount) {
        const at = h.bStart + h.bCount;
        virtLines.set(at, Array.from({ length: h.aCount - h.bCount }, () => ({ text: '-'.repeat(200), color: '#6272a4', bg: BG.filler })));
      }
    }
  });
  return { lineBg, hl, virtLines };
}

function navTargets(vim: Vim): number[] | undefined {
  const win = vim.win;
  if (inDiff(win) && partners(vim, win).length) {
    const set = new Set<number>();
    for (const p of partners(vim, win)) {
      for (const h of hunksVs(win.buf, p.buf)) set.add(Math.min(h.bStart, win.buf.lineCount - 1));
    }
    return [...set].sort((a, b) => a - b);
  }
  const marks = win.buf.lines.flatMap((t, i) => (OURS.test(t) ? [i] : []));
  return marks.length ? marks : undefined;
}

function install(vim: Vim) {
  if (vim.pluginData.diffInstalled) return;
  vim.pluginData.diffInstalled = true;
  vim.decorators.push((buf, win) => decorate(vim, buf, win));
  addHunkNav(vim, 'diff', (dir, count) => {
    const t = navTargets(vim);
    if (!t) return undefined;
    const cur = vim.cursor.line;
    const ahead = dir > 0 ? t.filter(l => l > cur) : t.filter(l => l < cur).reverse();
    if (!ahead.length) return null;
    return { line: ahead[Math.min(count, ahead.length) - 1], col: 0 };
  });
  const cursorLine = () => vim.cursor.line;

  vim.defineAction('do', { change: true, run: () => { const p = onePartner(vim); obtain(vim, p, cursorLine(), cursorLine()); } });
  vim.defineAction('dp', { run: () => { const p = onePartner(vim); put(vim, p, cursorLine(), cursorLine()); } });

  vim.defineEx('diffget', 5, a => {
    const spec = a.arg.trim();
    if ((spec === '//2' || spec === '//3') && takeSide(vim, spec === '//2' ? 2 : 3)) return;
    const p = onePartner(vim, spec || undefined);
    const r = a.range ?? { start: vim.cursor.line, end: vim.cursor.line };
    obtain(vim, p, r.start, r.end);
  });
  vim.defineEx('diffput', 5, a => {
    const p = onePartner(vim, a.arg.trim() || undefined);
    const r = a.range ?? { start: vim.cursor.line, end: vim.cursor.line };
    put(vim, p, r.start, r.end);
  });
  vim.defineEx('diffthis', 5, () => setDiff(vim, vim.win, true));
  vim.defineEx('diffoff', 5, a => {
    for (const w of a.bang ? vim.tab.windows() : [vim.win]) setDiff(vim, w, false);
  });
  vim.defineEx('diffupdate', 5, () => {});
  vim.defineEx('diffsplit', 5, a => {
    if (!a.arg) fail('E471: Argument required');
    const file = vim.resolveFile(a.arg) ?? a.arg;
    const vertical = !!vim.pluginData.vertical;
    setDiff(vim, vim.win, true);
    vim.splitWindow(vertical ? 'row' : 'col');
    vim.edit(file);
    setDiff(vim, vim.win, true);
  });
  // :vertical {cmd} — only :diffsplit (and fugitive's :Gdiffsplit) look at it.
  if (!vim.exCommands.has('vertical')) {
    vim.defineEx('vertical', 4, a => {
      vim.pluginData.vertical = true;
      try { vim.ex(a.arg); } finally { vim.pluginData.vertical = false; }
    });
  }
}

// ---- the plugin ------------------------------------------------------------------------------------------

export const diff: Plugin = {
  name: 'diff',
  setup: vim => {
    install(vim);
  },
};

/** For fugitive: the conflict helpers. */
export const conflicts = { takeSide };
