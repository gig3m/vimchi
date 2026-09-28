// vim-exchange (tommcdo/vim-exchange):
//   cx{motion}  mark a region (highlighted); the second cx{motion} swaps the two
//   cxx         the current line        X  in visual mode        cxc  clear the pending region
// When one region contains the other, the larger one is replaced by the smaller.

import type { Plugin, Vim } from '../editor';
import { type Pos, type Range, cmpPos, pos } from '../types';

type Region = { buf: number; range: Range; text: string };
type State = { pending: Region | null };

const state = (vim: Vim) => (vim.pluginData.exchange ??= { pending: null }) as State;

/** Normalize to an end-exclusive span; linewise regions cover whole lines. */
function spanOf(vim: Vim, r: Range): [Pos, Pos] {
  if (r.kind === 'line') return [pos(r.start.line, 0), pos(r.end.line, vim.line(r.end.line).length)];
  const len = vim.line(r.end.line).length;
  return [r.start, pos(r.end.line, Math.min(len, r.end.col + 1))];
}

function textOf(vim: Vim, [a, b]: [Pos, Pos]) {
  const L = vim.lines;
  if (a.line === b.line) return L[a.line].slice(a.col, b.col);
  return [L[a.line].slice(a.col), ...L.slice(a.line + 1, b.line), L[b.line].slice(0, b.col)].join('\n');
}

function replace(vim: Vim, [a, b]: [Pos, Pos], text: string) {
  const L = vim.lines;
  const joined = L[a.line].slice(0, a.col) + text + L[b.line].slice(b.col);
  vim.buf.splice(a.line, b.line - a.line + 1, joined.split('\n'));
  vim.buf.recordChange(a);
}

function swap(vim: Vim, first: Region, second: Range) {
  let x = spanOf(vim, first.range);
  let y = spanOf(vim, second);
  // Mixed kinds: treat both as linewise.
  if ((first.range.kind === 'line') !== (second.kind === 'line')) {
    x = [pos(x[0].line, 0), pos(x[1].line, vim.line(x[1].line).length)];
    y = [pos(y[0].line, 0), pos(y[1].line, vim.line(y[1].line).length)];
  }
  const tx = textOf(vim, x), ty = textOf(vim, y);
  const inside = (o: [Pos, Pos], i: [Pos, Pos]) => cmpPos(o[0], i[0]) <= 0 && cmpPos(i[1], o[1]) <= 0;
  if (inside(x, y) || inside(y, x)) {
    // One contains the other: the outer region becomes the inner text.
    const [outer, innerText] = inside(x, y) ? [x, ty] : [y, tx];
    replace(vim, outer, innerText);
    vim.setCursor(outer[0]);
    return;
  }
  // Replace the later region first so the earlier positions stay valid.
  const yFirst = cmpPos(y[0], x[0]) < 0;
  if (yFirst) {
    replace(vim, x, ty);
    replace(vim, y, tx);
    vim.setCursor(y[0]);
    return;
  }
  replace(vim, y, tx);
  replace(vim, x, ty);
  // The cursor lands where the second region now starts.
  const nl = ty.split('\n'), ol = tx.split('\n');
  const endCol = nl.length === 1 ? x[0].col + nl[0].length : nl[nl.length - 1].length;
  const dCol = y[0].line === x[1].line ? endCol - x[1].col : 0;
  vim.setCursor(pos(y[0].line + nl.length - ol.length, y[0].col + dCol));
}

export const exchange: Plugin = {
  name: 'exchange',
  setup: vim => {
    const op = (r: Range) => {
      const s = state(vim);
      if (s.pending && s.pending.buf === vim.buf.id) {
        const first = s.pending;
        s.pending = null;
        swap(vim, first, r);
        return;
      }
      s.pending = { buf: vim.buf.id, range: r, text: vim.getText(r).text };
      vim.setCursor(r.kind === 'line' ? pos(r.start.line, vim.cursor.col) : r.start);
    };
    vim.defineOperator('cx', { change: true, run: op }, ['n']);
    vim.defineOperator('X', { change: true, run: op }, ['v']);
    vim.defineAction('cxc', { run: () => { state(vim).pending = null; } });

    // Highlight the pending region (vim-exchange's ExchangeRegion).
    vim.decorators.push(buf => {
      const p = state(vim).pending;
      if (!p || p.buf !== buf.id) return null;
      const hl: { line: number; start: number; end: number; color: string; bg?: string }[] = [];
      const r = p.range;
      for (let l = r.start.line; l <= r.end.line; l++) {
        const t = buf.line(l);
        const s = r.kind === 'line' || l > r.start.line ? 0 : r.start.col;
        const e = r.kind === 'line' || l < r.end.line ? t.length : r.end.col + 1;
        hl.push({ line: l, start: s, end: Math.max(s + 1, e), color: '#282a36', bg: '#ffb86c' });
      }
      return { hl };
    });
  },
};
