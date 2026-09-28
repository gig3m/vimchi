// gitsigns.nvim with the README's on_attach keymaps: signs from the buffer vs
// the index, ]c / [c, <leader>hs / hr (stage / reset hunk, also in visual),
// <leader>hS / hR (buffer), <leader>hp (preview), <leader>hb (blame line), ih,
// and :Gitsigns {stage_hunk,reset_hunk,preview_hunk,blame_line,next_hunk,prev_hunk}.

import type { Buffer } from '../buffer';
import type { Decoration, Float, Plugin, Vim } from '../editor';
import { fail, pos } from '../types';
import { refreshStatus } from './fugitive';
import { type Hunk, NOT_COMMITTED, addHunkNav, applyHunks, blame, bufLines, diffLines, fromLines, gitState, toLines } from './git-model';

const GREEN = '#50fa7b', CHANGE = '#ffb86c', RED = '#ff5555';

/** Hunks of the buffer against the index (null if the file isn't tracked). */
export function bufferHunks(vim: Vim, buf: Buffer): Hunk[] | null {
  if (buf.kind !== 'file') return null;
  const g = gitState(vim);
  if (!(buf.name in g.index)) return null;
  return diffLines(toLines(g.index[buf.name]), bufLines(buf.lines));
}

const isDelete = (h: Hunk) => h.bCount === 0;
/** The line a hunk's sign sits on (and where ]c lands). */
export const hunkLine = (h: Hunk) => (isDelete(h) ? Math.max(0, h.bStart - 1) : h.bStart);
const hunkEnd = (h: Hunk) => (isDelete(h) ? hunkLine(h) : h.bStart + h.bCount - 1);

function signs(hs: Hunk[]): Map<number, { text: string; color: string }> {
  const out = new Map<number, { text: string; color: string }>();
  for (const h of hs) {
    if (isDelete(h)) out.set(hunkLine(h), { text: h.bStart === 0 ? '‾' : '_', color: RED });
    else if (h.aCount === 0) for (let k = 0; k < h.bCount; k++) out.set(h.bStart + k, { text: '┃', color: GREEN });
    else {
      for (let k = 0; k < h.bCount; k++) out.set(h.bStart + k, { text: '┃', color: CHANGE });
      if (h.aCount > h.bCount) out.set(h.bStart + h.bCount - 1, { text: '~', color: CHANGE });
    }
  }
  return out;
}

function hunkAt(vim: Vim, line = vim.cursor.line): Hunk | null {
  return bufferHunks(vim, vim.buf)?.find(h => line >= hunkLine(h) && line <= hunkEnd(h)) ?? null;
}

function hunksIn(vim: Vim, first: number, last: number): Hunk[] {
  return (bufferHunks(vim, vim.buf) ?? []).filter(h => hunkLine(h) <= last && hunkEnd(h) >= first);
}

function stage(vim: Vim, hs: Hunk[]) {
  if (!hs.length) return;
  const g = gitState(vim);
  g.index[vim.buf.name] = fromLines(applyHunks(toLines(g.index[vim.buf.name]), hs));
  refreshStatus(vim);
}

function reset(vim: Vim, hs: Hunk[]) {
  if (!hs.length) return;
  vim.beginChange();
  for (const h of [...hs].sort((a, b) => b.bStart - a.bStart)) {
    if (vim.buf.lines.length === 1 && vim.buf.lines[0] === '' && h.bCount === 0) vim.buf.splice(0, 1, h.a);
    else vim.buf.splice(h.bStart, h.bCount, h.a);
  }
  const l = Math.min(hs[0].bStart, vim.buf.lineCount - 1);
  vim.buf.recordChange(pos(l, 0));
  vim.setCursor(pos(l, 0));
}

/** A float that goes away on the next key (which still runs), like gitsigns' preview. */
function popup(vim: Vim, f: Float) {
  vim.floats = vim.floats.filter(x => x.id !== f.id);
  vim.floats.push(f);
  vim.modal = () => {
    vim.floats = vim.floats.filter(x => x.id !== f.id);
    vim.modal = null;
    return false;
  };
}

function preview(vim: Vim) {
  const hs = bufferHunks(vim, vim.buf) ?? [];
  const h = hunkAt(vim);
  if (!h) return;
  popup(vim, {
    id: 'gitsigns-preview',
    title: `Hunk ${hs.findIndex(x => x.bStart === h.bStart) + 1} of ${hs.length}`,
    anchor: 'cursor',
    lines: [...h.a.map(t => ({ text: '-' + t, color: RED })), ...h.b.map(t => ({ text: '+' + t, color: GREEN }))],
  });
}

function blameLine(vim: Vim) {
  const who = blame(vim, vim.buf.name, vim.buf.lines)[vim.cursor.line];
  if (!who) return;
  const lines = who === NOT_COMMITTED
    ? [{ text: 'Not Committed Yet' }]
    : [{ text: `${who.hash} ${who.author} (${who.date})`, color: '#f1fa8c' }, { text: '' }, ...who.message.split('\n').map(text => ({ text }))];
  popup(vim, { id: 'gitsigns-blame', anchor: 'cursor', lines });
}

export const gitsigns: Plugin = {
  name: 'gitsigns',
  setup: vim => {
    vim.decorators.push((buf): Decoration | null => {
      const hs = bufferHunks(vim, buf);
      return hs && hs.length ? { signs: signs(hs) } : null;
    });

    addHunkNav(vim, 'gitsigns', (dir, count) => {
      const hs = bufferHunks(vim, vim.buf);
      if (!hs) return undefined;
      if (!hs.length) {
        vim.msg('No hunks');
        return null;
      }
      const lines = [...new Set(hs.map(hunkLine))].sort((a, b) => a - b);
      let l = vim.cursor.line;
      for (let n = 0; n < count; n++) {
        const next = dir > 0 ? lines.find(x => x > l) : [...lines].reverse().find(x => x < l);
        // Wraps around the file ('wrapscan').
        l = next ?? (dir > 0 ? lines[0] : lines[lines.length - 1]);
      }
      return { line: l, col: 0 };
    });

    const range = (): [number, number] => {
      const [s, e] = vim.visualBounds();
      vim.exitVisual();
      return [s.line, e.line];
    };
    vim.map(['n'], '<leader>hs', () => {
      const h = hunkAt(vim);
      if (h) stage(vim, [h]);
    });
    vim.map(['v'], '<leader>hs', () => stage(vim, hunksIn(vim, ...range())));
    vim.map(['n'], '<leader>hr', () => {
      const h = hunkAt(vim);
      if (h) reset(vim, [h]);
    }, { change: true });
    vim.map(['v'], '<leader>hr', () => reset(vim, hunksIn(vim, ...range())), { change: true });
    vim.map(['n'], '<leader>hS', () => stage(vim, bufferHunks(vim, vim.buf) ?? []));
    vim.map(['n'], '<leader>hR', () => reset(vim, bufferHunks(vim, vim.buf) ?? []), { change: true });
    vim.map(['n'], '<leader>hp', () => preview(vim));
    vim.map(['n'], '<leader>hb', () => blameLine(vim));
    vim.defineObject('ih', ctx => {
      const h = hunkAt(vim, ctx.cur.line);
      if (!h || isDelete(h)) return null;
      return { start: pos(h.bStart, 0), end: pos(h.bStart + h.bCount - 1, 0), kind: 'line' };
    });

    vim.defineEx('Gitsigns', 5, a => {
      const run: Record<string, () => void> = {
        stage_hunk: () => { const h = hunkAt(vim); if (h) stage(vim, [h]); },
        reset_hunk: () => { const h = hunkAt(vim); if (h) reset(vim, [h]); },
        stage_buffer: () => stage(vim, bufferHunks(vim, vim.buf) ?? []),
        reset_buffer: () => reset(vim, bufferHunks(vim, vim.buf) ?? []),
        preview_hunk: () => preview(vim),
        blame_line: () => blameLine(vim),
        next_hunk: () => vim.runKeys([']', 'c']),
        prev_hunk: () => vim.runKeys(['[', 'c']),
        nav_hunk: () => vim.runKeys([a.arg.includes('prev') ? '[' : ']', 'c']),
      };
      const fn = run[a.arg.split(/\s+/)[0]];
      if (!fn) fail(`gitsigns: unknown command ${a.arg}`);
      fn();
    });
  },
};
