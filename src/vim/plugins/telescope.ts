// telescope.nvim with the README's keymaps: <leader>ff find_files,
// <leader>fg live_grep, <leader>fb buffers (and :Telescope {picker}). A
// centered float with a prompt, results (fzy-style fuzzy match, best first,
// ties alphabetical) and a preview. The prompt starts in insert mode:
// typing filters, <C-n>/<C-p> (<Down>/<Up>, <C-j>/<C-k>) move, <CR> opens,
// <C-x>/<C-v>/<C-t> open in a split/vsplit/tab, <C-q> sends every result to
// the quickfix list and opens it, <Esc> goes to normal mode (j/k, <CR>,
// gg/G, dd deletes a buffer, <Esc> or q closes).

import { Buffer } from '../buffer';
import type { Float, Plugin, Vim } from '../editor';
import type { Key } from '../keys';
import type { QfItem, Window } from '../layout';
import { pos } from '../types';

// ---- fzy scoring ---------------------------------------------------------------------------------

const GAP_LEADING = -0.005, GAP_TRAILING = -0.005, GAP_INNER = -0.01;
const MATCH_CONSECUTIVE = 1.0, MATCH_SLASH = 0.9, MATCH_WORD = 0.8, MATCH_CAPITAL = 0.7, MATCH_DOT = 0.6;

function bonus(prev: string, ch: string): number {
  if (prev === '/') return MATCH_SLASH;
  if (prev === '-' || prev === '_' || prev === ' ') return MATCH_WORD;
  if (prev === '.') return MATCH_DOT;
  if (/[a-z]/.test(prev) && /[A-Z]/.test(ch)) return MATCH_CAPITAL;
  return 0;
}

/** fzy's score of `needle` in `hay`, or null if it doesn't match. Smart case. */
export function fzy(needle: string, hay: string): number | null {
  if (!needle) return 0;
  const ci = needle === needle.toLowerCase();
  const n = ci ? needle.toLowerCase() : needle, h = ci ? hay.toLowerCase() : hay;
  let k = 0;
  for (let i = 0; i < h.length && k < n.length; i++) if (h[i] === n[k]) k++;
  if (k < n.length) return null;
  if (n.length === h.length) return Infinity;
  const N = n.length, M = h.length;
  const bonuses = [...hay].map((c, i) => bonus(i ? hay[i - 1] : '/', c));
  let Dprev: number[] = [], Mprev: number[] = [];
  for (let i = 0; i < N; i++) {
    const D: number[] = new Array(M).fill(-Infinity), Mx: number[] = new Array(M).fill(-Infinity);
    let prevScore = -Infinity;
    const gap = i === N - 1 ? GAP_TRAILING : GAP_INNER;
    for (let j = 0; j < M; j++) {
      if (n[i] === h[j]) {
        let score = -Infinity;
        if (i === 0) score = j * GAP_LEADING + bonuses[j];
        else if (j > 0) score = Math.max(Mprev[j - 1] + bonuses[j], Dprev[j - 1] + MATCH_CONSECUTIVE);
        D[j] = score;
        Mx[j] = prevScore = Math.max(score, prevScore + gap);
      } else {
        D[j] = -Infinity;
        Mx[j] = prevScore = prevScore + gap;
      }
    }
    Dprev = D;
    Mprev = Mx;
  }
  return Mprev[M - 1];
}

// ---- pickers ---------------------------------------------------------------------------------------------

type Entry = { display: string; ordinal: string; path: string; line?: number; col?: number; text?: string; buf?: Buffer };

type Picker = {
  title: string;
  /** Static entries (fuzzy filtered) or a finder run on every prompt change (live_grep). */
  entries?: Entry[];
  find?: (prompt: string) => Entry[];
  prompt: string;
  cursor: number;
  results: Entry[];
  sel: number;
  mode: 'insert' | 'normal';
  pendingG: boolean;
  pendingD?: boolean;
  origin: Window;
  float: Float;
};

function filter(p: Picker) {
  if (p.find) p.results = p.find(p.prompt);
  else if (!p.prompt) p.results = p.entries!.slice();
  else {
    p.results = p.entries!
      .map(e => ({ e, s: fzy(p.prompt, e.ordinal) }))
      .filter((x): x is { e: Entry; s: number } => x.s !== null)
      .sort((a, b) => b.s - a.s || (a.e.ordinal < b.e.ordinal ? -1 : a.e.ordinal > b.e.ordinal ? 1 : 0))
      .map(x => x.e);
  }
  p.sel = Math.min(p.sel, Math.max(0, p.results.length - 1));
}

const ROWS = 10, PREVIEW_ROWS = 14;

function fileLines(vim: Vim, e: Entry): string[] {
  const b = e.buf ?? vim.findBuffer(e.path);
  if (b) return b.lines;
  return (vim.fs.read(e.path) ?? '').replace(/\n$/, '').split('\n');
}

function draw(vim: Vim, p: Picker) {
  const f = p.float;
  const first = Math.max(0, Math.min(p.sel - ROWS + 1, p.results.length - ROWS));
  const top = Math.min(first, p.sel);
  f.lines = p.results.slice(top, top + ROWS).map(e => ({ text: e.display }));
  f.sel = p.results.length ? p.sel - top : undefined;
  f.prompt = { label: p.mode === 'insert' ? '> ' : '  ', text: p.prompt, cursor: p.cursor };
  f.footer = `${p.results.length ? p.sel + 1 : 0} / ${p.find ? p.results.length : p.entries!.length}`;
  const e = p.results[p.sel];
  if (!e) {
    f.preview = { title: 'Preview', lines: [] };
    return;
  }
  const lines = fileLines(vim, e);
  const at = e.line ?? 0;
  const start = Math.max(0, Math.min(at - 4, lines.length - PREVIEW_ROWS));
  f.preview = {
    title: e.path,
    lines: lines.slice(start, start + PREVIEW_ROWS),
    highlight: e.line != null ? at - start : undefined,
  };
}

function close(vim: Vim, p: Picker) {
  vim.floats = vim.floats.filter(f => f !== p.float);
  vim.modal = null;
  if (vim.tab.windows().includes(p.origin)) vim.focusWindow(p.origin);
}

function open(vim: Vim, p: Picker, how: 'edit' | 'split' | 'vsplit' | 'tab') {
  const e = p.results[p.sel];
  close(vim, p);
  if (!e) return;
  vim.pushJump();
  if (how === 'split') vim.splitWindow('col');
  if (how === 'vsplit') vim.splitWindow('row');
  if (how === 'tab') vim.newTab();
  if (e.buf) vim.showBuffer(vim.win, e.buf);
  else vim.edit(e.path);
  if (e.line != null) vim.setCursor(pos(Math.min(e.line, vim.buf.lineCount - 1), e.col ?? 0));
}

function toQuickfix(vim: Vim, p: Picker) {
  close(vim, p);
  if (!p.results.length) return;
  const items: QfItem[] = p.results.map(e => ({ file: e.path, line: e.line ?? 0, col: e.col ?? 0, text: e.text ?? e.path }));
  vim.quickfix = { items, idx: 0, title: `${p.title} (${p.prompt})` };
  vim.ex('copen');
  vim.emit('quickfix');
}

function deleteBuffer(vim: Vim, p: Picker) {
  const e = p.results[p.sel];
  if (!e?.buf) return;
  const b = e.buf;
  const shown = vim.tab.windows().filter(w => w.buf === b);
  const other = vim.buffers.find(x => x !== b && x.listed && x.kind === 'file');
  if (shown.length && !other) return;
  for (const w of shown) vim.showBuffer(w, other!);
  b.listed = false;
  vim.buffers = vim.buffers.filter(x => x !== b);
  p.entries = p.entries!.filter(x => x.buf !== b);
  filter(p);
}

function move(p: Picker, d: number) {
  if (!p.results.length) return;
  p.sel = Math.max(0, Math.min(p.results.length - 1, p.sel + d));
}

function handleKey(vim: Vim, p: Picker, key: Key): void {
  const common: Record<string, () => void> = {
    '<CR>': () => open(vim, p, 'edit'),
    '<C-x>': () => open(vim, p, 'split'),
    '<C-v>': () => open(vim, p, 'vsplit'),
    '<C-t>': () => open(vim, p, 'tab'),
    '<C-q>': () => toQuickfix(vim, p),
    '<C-n>': () => move(p, 1), '<Down>': () => move(p, 1), '<C-j>': () => move(p, 1),
    '<C-p>': () => move(p, -1), '<Up>': () => move(p, -1), '<C-k>': () => move(p, -1),
    '<C-c>': () => close(vim, p),
  };
  if (common[key]) return common[key]();
  if (p.mode === 'insert') {
    const t = p.prompt, c = p.cursor;
    if (key === '<Esc>') {
      p.mode = 'normal';
      p.cursor = Math.max(0, c - 1);
      return;
    }
    if (key === '<BS>' || key === '<C-h>') {
      if (c > 0) { p.prompt = t.slice(0, c - 1) + t.slice(c); p.cursor--; }
    } else if (key === '<C-w>') {
      const m = /(\w+\s*|[^\w\s]+\s*|\s+)$/.exec(t.slice(0, c));
      const n = m ? m[0].length : 0;
      p.prompt = t.slice(0, c - n) + t.slice(c);
      p.cursor -= n;
    } else if (key === '<C-u>') {
      p.prompt = t.slice(c);
      p.cursor = 0;
    } else if (key === '<A-d>') {
      return deleteBuffer(vim, p);
    } else if (key.length === 1) {
      p.prompt = t.slice(0, c) + key + t.slice(c);
      p.cursor++;
    } else return;
    p.sel = 0;
    filter(p);
    return;
  }
  // normal mode
  if (p.pendingG) {
    p.pendingG = false;
    if (key === 'g') p.sel = 0;
    return;
  }
  if (p.pendingD) {
    p.pendingD = false;
    if (key === 'd') deleteBuffer(vim, p);
    return;
  }
  switch (key) {
    case 'j': return move(p, 1);
    case 'k': return move(p, -1);
    case 'G': p.sel = Math.max(0, p.results.length - 1); return;
    case 'g': p.pendingG = true; return;
    case 'd': p.pendingD = true; return;
    case 'H': p.sel = 0; return;
    case 'L': p.sel = Math.max(0, Math.min(p.results.length, ROWS) - 1); return;
    case 'i': p.mode = 'insert'; return;
    case 'a': p.mode = 'insert'; p.cursor = Math.min(p.prompt.length, p.cursor + 1); return;
    case 'A': p.mode = 'insert'; p.cursor = p.prompt.length; return;
    case 'I': p.mode = 'insert'; p.cursor = 0; return;
    case '<Esc>':
    case 'q': return close(vim, p);
  }
}

function startPicker(vim: Vim, title: string, src: { entries?: Entry[]; find?: (prompt: string) => Entry[] }) {
  if (vim.modal) return;
  const float: Float = { id: 'telescope', title, anchor: 'center', width: 110, lines: [] };
  const p: Picker = {
    title, ...src, prompt: '', cursor: 0, results: [], sel: 0, mode: 'insert', pendingG: false, origin: vim.win, float,
  };
  filter(p);
  draw(vim, p);
  vim.floats.push(float);
  vim.pluginData.telescope = p;
  vim.modal = key => {
    handleKey(vim, p, key);
    if (vim.floats.includes(float)) draw(vim, p);
    else if (vim.pluginData.telescope === p) delete vim.pluginData.telescope;
    return true;
  };
}

export function findFiles(vim: Vim) {
  const entries = vim.fs.list().filter(f => !f.split('/').some(s => s.startsWith('.'))).map(f => ({ display: f, ordinal: f, path: f }));
  startPicker(vim, 'Find Files', { entries });
}

export function liveGrep(vim: Vim) {
  const files = vim.fs.list().filter(f => !f.split('/').some(s => s.startsWith('.')));
  startPicker(vim, 'Live Grep', {
    find: prompt => {
      if (!prompt) return [];
      let re: RegExp;
      try {
        re = new RegExp(prompt, prompt === prompt.toLowerCase() ? 'i' : '');
      } catch {
        return [];
      }
      const out: Entry[] = [];
      for (const f of files) {
        const b = vim.findBuffer(f);
        const lines = b ? b.lines : (vim.fs.read(f) ?? '').replace(/\n$/, '').split('\n');
        lines.forEach((t, l) => {
          const m = re.exec(t);
          if (!m) return;
          out.push({ display: `${f}:${l + 1}:${m.index + 1}:${t.trim()}`, ordinal: f, path: f, line: l, col: m.index, text: t.trim() });
        });
      }
      return out;
    },
  });
}

export function buffers(vim: Vim) {
  const list = vim.buffers.filter(b => b.listed && b.kind === 'file');
  const cur = vim.buf, alt = vim.win.alt;
  const entries = list.map(b => {
    const n = vim.buffers.indexOf(b) + 1;
    const flag = b === cur ? '%a' : b === alt ? '#h' : ' h';
    const line = (vim.win.lastPos.get(b.id)?.line ?? b.marks.get('"')?.line ?? 0) + 1;
    return { display: `${String(n).padStart(3)} ${flag}  ${b.name}:${b === cur ? vim.cursor.line + 1 : line}`, ordinal: b.name, path: b.name, buf: b };
  });
  startPicker(vim, 'Buffers', { entries });
}

export const telescope: Plugin = {
  name: 'telescope',
  setup: vim => {
    vim.map(['n'], '<leader>ff', () => findFiles(vim));
    vim.map(['n'], '<leader>fg', () => liveGrep(vim));
    vim.map(['n'], '<leader>fb', () => buffers(vim));
    vim.defineEx('Telescope', 3, a => {
      const pickers: Record<string, (v: Vim) => void> = { find_files: findFiles, live_grep: liveGrep, buffers };
      const fn = pickers[a.arg.trim()];
      if (!fn) {
        vim.msg(`telescope: the tutor has find_files, live_grep and buffers`, 'warn');
        return;
      }
      fn(vim);
    });
  },
};
