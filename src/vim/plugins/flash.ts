// flash.nvim (folke/flash.nvim), LazyVim's keymaps:
//   s  jump: type a few characters; every match in the window gets a label; type a label to jump.
//      Works in normal, visual and operator-pending mode (d s…, y s…).
//   S  treesitter: labels the syntax nodes around the cursor; picking one selects it.
// Labels go to the nearest matches first and skip letters that would continue the search, so
// typing more of the pattern never jumps by accident. <CR> jumps to the first match, <Esc> quits.

import type { Decoration, MotionResult, Plugin, Vim } from '../editor';
import type { Key } from '../keys';
import { findClose } from '../motions';
import { firstNonBlank } from '../text';
import { type Pos, cmpPos, pos } from '../types';

export const LABELS = 'asdfghjklqwertyuiopzxcvbnm';

type Match = { start: Pos; end: Pos; label?: string };
type Node = { start: Pos; end: Pos; label?: string };
type State = {
  kind: 'jump' | 'treesitter';
  pattern: string;
  matches: Match[];
  nodes: Node[];
  typed: Key[];
  finish: (p: Pos, end?: Pos) => void;
};

const C = { bg: '#282a36', fg: '#f8f8f2', comment: '#6272a4', label: '#ff79c6', match: '#8be9fd' };

/** Buffer lines on screen in the current window. */
function screenLines(vim: Vim): number[] {
  const rows = vim.visibleLines();
  const top = Math.max(0, rows.indexOf(vim.win.top));
  return rows.slice(top, top + vim.win.height);
}

/** Matches of `pattern` on screen, nearest first, labelled. Exported for tests and lessons. */
export function flashMatches(vim: Vim, pattern: string): Match[] {
  if (!pattern) return [];
  const ic = !!vim.options.ignorecase && !(vim.options.smartcase && /[A-Z]/.test(pattern));
  const norm = (s: string) => (ic ? s.toLowerCase() : s);
  const p = norm(pattern);
  const cur = vim.cursor;
  const out: Match[] = [];
  const next = new Set<string>();
  for (const l of screenLines(vim)) {
    const t = norm(vim.line(l));
    for (let i = t.indexOf(p); i >= 0; i = t.indexOf(p, i + 1)) {
      const after = vim.line(l)[i + p.length];
      if (after) next.add(after.toLowerCase());
      if (l === cur.line && i === cur.col) continue;
      out.push({ start: pos(l, i), end: pos(l, i + p.length - 1) });
    }
  }
  // Nearest first: same line, then fewer lines away, then fewer columns; ties go forward.
  const key = (m: Match) => [Math.abs(m.start.line - cur.line), Math.abs(m.start.col - cur.col), cmpPos(m.start, cur) > 0 ? 0 : 1];
  out.sort((a, b) => {
    const [x, y] = [key(a), key(b)];
    return x[0] - y[0] || x[1] - y[1] || x[2] - y[2];
  });
  const labels = [...LABELS].filter(c => !next.has(c));
  out.forEach((m, i) => { m.label = labels[i]; });
  return out;
}

// ---- treesitter-ish nodes -----------------------------------------------------------------------

/** Syntax-node-like ranges around the cursor, smallest first (a stand-in for treesitter). */
export function flashNodes(vim: Vim): Node[] {
  const L = vim.lines;
  const cur = vim.cursor;
  const t = L[cur.line];
  const out: Node[] = [];
  const add = (start: Pos, end: Pos) => {
    if (cmpPos(start, end) > 0 || cmpPos(start, cur) > 0 || cmpPos(cur, end) > 0) return;
    if (!out.some(n => cmpPos(n.start, start) === 0 && cmpPos(n.end, end) === 0)) out.push({ start, end });
  };
  // Identifier under the cursor.
  if (/[\w$]/.test(t[cur.col] ?? '')) {
    let s = cur.col, e = cur.col;
    while (s > 0 && /[\w$]/.test(t[s - 1])) s--;
    while (e + 1 < t.length && /[\w$]/.test(t[e + 1])) e++;
    add(pos(cur.line, s), pos(cur.line, e));
  }
  // String around the cursor.
  for (const q of ['"', "'", '`']) {
    const idx: number[] = [];
    for (let i = 0; i < t.length; i++) if (t[i] === q && t[i - 1] !== '\\') idx.push(i);
    for (let k = 0; k + 1 < idx.length; k += 2) if (idx[k] <= cur.col && cur.col <= idx[k + 1]) add(pos(cur.line, idx[k]), pos(cur.line, idx[k + 1]));
  }
  // The statement on the cursor line.
  const fnb = firstNonBlank(t);
  if (t.trim()) add(pos(cur.line, fnb), pos(cur.line, t.trimEnd().length - 1));
  // Enclosing brackets, calls and blocks.
  const pairs: [Pos, Pos][] = [];
  for (const [o, c] of [['(', ')'], ['[', ']'], ['{', '}']]) {
    for (let l = 0; l < L.length; l++) {
      for (let i = 0; i < L[l].length; i++) {
        if (L[l][i] !== o) continue;
        const end = findClose(L, pos(l, i), o, c);
        if (end && cmpPos(pos(l, i), cur) <= 0 && cmpPos(cur, end) <= 0) pairs.push([pos(l, i), end]);
      }
    }
  }
  // Identifier followed by a call: name(args).
  const word = out[0];
  if (word && t[word.end.col + 1] === '(') {
    const c = findClose(L, pos(cur.line, word.end.col + 1), '(', ')');
    if (c) add(word.start, c);
  }
  for (const [o, c] of pairs) {
    // The argument (or element, or property) around the cursor.
    const cs: { ch: string; p: Pos }[] = [];
    for (let l = o.line; l <= c.line; l++) {
      for (let i = l === o.line ? o.col + 1 : 0; i < (l === c.line ? c.col : L[l].length + 1); i++) cs.push({ ch: L[l][i] ?? '\n', p: pos(l, i) });
    }
    let depth = 0, from = 0, quote = '';
    const segs: [number, number][] = [];
    cs.forEach((x, k) => {
      if (quote) { if (x.ch === quote) quote = ''; return; }
      if (`"'\``.includes(x.ch)) quote = x.ch;
      else if ('([{'.includes(x.ch)) depth++;
      else if (')]}'.includes(x.ch)) depth--;
      else if (x.ch === ',' && depth === 0) { segs.push([from, k - 1]); from = k + 1; }
    });
    segs.push([from, cs.length - 1]);
    // Braces are only a list (object literal) when they hold commas; otherwise they're a block.
    if (L[o.line][o.col] === '{' && segs.length < 2) segs.length = 0;
    for (let [a, b] of segs) {
      while (a <= b && /\s/.test(cs[a].ch)) a++;
      while (b >= a && /\s/.test(cs[b].ch)) b--;
      if (a <= b) add(cs[a].p, cs[b].p);
    }
    add(o, c);
    const before = L[o.line].slice(0, o.col);
    const call = /[\w$.]+$/.exec(before);
    if (call) add(pos(o.line, call.index), c);
    if (L[o.line][o.col] === '{' || L[o.line][o.col] === '[') {
      // A block or literal ending a line: the whole construct from the start of that line.
      const s = pos(o.line, firstNonBlank(L[o.line]));
      let e = c;
      if (L[c.line][c.col + 1] === ';' || L[c.line][c.col + 1] === ',' || L[c.line][c.col + 1] === ')') e = pos(c.line, c.col + (L[c.line][c.col + 1] === ')' ? 0 : 1));
      add(s, e);
    }
  }
  const size = (n: Node) => (n.end.line - n.start.line) * 1000 + (n.end.col - n.start.col);
  out.sort((a, b) => size(a) - size(b));
  // Keep a chain of nested nodes.
  const chain: Node[] = [];
  for (const n of out) {
    const last = chain[chain.length - 1];
    if (!last || (cmpPos(n.start, last.start) <= 0 && cmpPos(last.end, n.end) <= 0)) chain.push(n);
  }
  chain.forEach((n, i) => { n.label = LABELS[i]; });
  return chain.filter(n => n.label);
}

// ---- UI --------------------------------------------------------------------------------------------

function decorate(vim: Vim, s: State): Decoration {
  const hl: NonNullable<Decoration['hl']> = [];
  // Backdrop.
  for (const l of screenLines(vim)) hl.push({ line: l, start: 0, end: vim.line(l).length, color: C.comment });
  const taken = new Set<string>();
  const label = (p: Pos, text: string) => {
    const k = `${p.line}:${p.col}`;
    if (taken.has(k) || p.col < 0 || p.col >= vim.line(p.line).length) return false;
    taken.add(k);
    hl.push({ line: p.line, start: p.col, end: p.col + 1, color: C.bg, bg: C.label, text });
    return true;
  };
  if (s.kind === 'jump') {
    for (const m of s.matches) hl.push({ line: m.start.line, start: m.start.col, end: m.end.col + 1, color: C.match, bg: 'rgba(139,233,253,.14)' });
    for (const m of s.matches) {
      if (!m.label) continue;
      // Label just after the match (flash's default), or on its last character at the line end.
      if (!label(pos(m.end.line, m.end.col + 1), m.label)) label(m.end, m.label);
    }
  } else {
    // Inline labels at both ends of each node (flash's treesitter style): outer labels outside inner ones.
    for (const n of [...s.nodes].reverse()) hl.push({ line: n.start.line, start: n.start.col, end: n.start.col, color: C.bg, bg: C.label, text: n.label!, inline: true });
    for (const n of s.nodes) hl.push({ line: n.end.line, start: n.end.col + 1, end: n.end.col + 1, color: C.bg, bg: C.label, text: n.label!, inline: true });
  }
  return { hl };
}

function start(vim: Vim, kind: State['kind'], finish: State['finish'], cancel: () => void): State {
  const s: State = { kind, pattern: '', matches: [], nodes: [], typed: [], finish };
  vim.pluginData.flash = s;
  const close = () => {
    vim.pluginData.flash = null;
    vim.modal = null;
    if (vim.message?.text.startsWith('⚡')) vim.message = null;
  };
  if (kind === 'treesitter') {
    s.nodes = flashNodes(vim);
    if (!s.nodes.length) { close(); cancel(); return s; }
  }
  vim.msg('⚡');
  vim.modal = key => {
    if (key === '<Esc>' || key === '<C-c>') { close(); cancel(); return true; }
    s.typed.push(key);
    if (kind === 'treesitter') {
      const n = s.nodes.find(x => x.label === key) ?? (key === '<CR>' ? s.nodes[0] : undefined);
      close();
      if (n) finish(n.start, n.end);
      else cancel();
      return true;
    }
    if (key === '<CR>') {
      const m = s.matches[0];
      close();
      if (m) finish(m.start); else cancel();
      return true;
    }
    if (key === '<BS>') {
      s.pattern = s.pattern.slice(0, -1);
      s.matches = flashMatches(vim, s.pattern);
      vim.msg('⚡' + s.pattern);
      return true;
    }
    const hit = s.pattern ? s.matches.find(m => m.label === key) : undefined;
    if (hit) { close(); finish(hit.start); return true; }
    if ([...key].length !== 1) return true;
    s.pattern += key;
    s.matches = flashMatches(vim, s.pattern);
    if (!s.matches.length) { close(); cancel(); return true; }
    vim.msg('⚡' + s.pattern);
    return true;
  };
  return s;
}

export const flash: Plugin = {
  name: 'flash',
  setup: vim => {
    vim.decorators.push(buf => {
      const s = vim.pluginData.flash as State | null | undefined;
      return s && buf === vim.buf ? decorate(vim, s) : null;
    });

    // Operator-pending: d s…, c s…, y s… (inclusive when jumping forward).
    vim.defineMotion('s', {
      run: () => null,
      pick: (done, cancel) => {
        const from = { ...vim.cursor };
        const s = start(vim, 'jump', p => {
          const res: MotionResult = { pos: p, inclusive: cmpPos(p, from) > 0, jump: true };
          done(res, s.typed);
        }, cancel);
      },
    });
    // Normal and visual: jump.
    vim.defineAction('s', {
      run: () => {
        start(vim, 'jump', p => {
          if (!vim.visual) vim.pushJump();
          vim.applyMotion({ pos: p });
        }, () => {});
      },
    }, ['n', 'v']);
    // Treesitter selection.
    vim.defineAction('S', {
      run: () => {
        start(vim, 'treesitter', (a, b) => {
          if (vim.visual) vim.exitVisual();
          vim.setCursor(a);
          vim.enterVisual('v');
          vim.win.cursor = { ...b! };
          vim.win.want = b!.col;
        }, () => {});
      },
    }, ['n', 'v']);
  },
};
