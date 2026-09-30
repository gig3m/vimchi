// Surround: mini.surround's default keys (what kickstart ships; LazyVim's extra prefixes them
// with g) and nvim-surround's (the tpope lineage) on the same engine.
//   mini:  sa{motion}{char} add   sa{char} in visual   sd{char} delete   sr{old}{new} replace
//          sf{char} / sF{char} jump to the right / left delimiter
//   nvim-surround: ys{motion}{char}  yss{char}  yS / ySS  ds{char}  cs{old}{new}  S{char} (visual)
// Opening brackets add inner spaces, closing ones don't. Aliases: b=) B=} r=] a=> q=any quote
// s=any surrounding. t / T are tags (the name is typed at a prompt, ended by <CR>; a whole <tag>
// works too), f is a function call.

import type { Plugin, Vim } from '../editor';
import { findClose, findOpen, unmatchedOpen } from '../motions';
import { indentOf } from '../text';
import { type Pos, type Range, cmpPos, fail, pos } from '../types';

type Pair = { left: string; right: string };
/** A found surrounding: the left and right delimiter spans, end-exclusive. */
type Found = { l: [Pos, Pos]; r: [Pos, Pos]; kind: 'pair' | 'tag' | 'func' };

const ALIAS: Record<string, string> = { b: ')', B: '}', r: ']', a: '>' };
const OPEN: Record<string, string> = { '(': ')', '[': ']', '{': '}', '<': '>' };
const CLOSE: Record<string, string> = { ')': '(', ']': '[', '}': '{', '>': '<' };
const QUOTES = ['"', "'", '`'];

/** Strip the key-notation wrapper from a typed name: "tdiv<CR>" → "div", "<em>" → "em". */
function typedName(s: string) {
  return s.replace(/<CR>$/, '').replace(/^</, '').replace(/>$/, '').trim();
}

function tagPair(input: string): Pair {
  const name = typedName(input);
  if (!name) fail();
  const el = name.split(/\s+/)[0];
  return { left: `<${name}>`, right: `</${el}>` };
}

/** The delimiters to add for a key typed after ys / S / cs{old}. */
export function addPair(arg: string): Pair {
  if (!arg || arg === '<Esc>') fail();
  if (arg.length > 1 && (arg[0] === 't' || arg[0] === 'T' || arg[0] === '<')) return tagPair(arg[0] === '<' ? arg : arg.slice(1));
  if (arg.length > 1 && arg[0] === 'f') {
    const name = typedName(arg.slice(1));
    if (!name) fail();
    return { left: `${name}(`, right: ')' };
  }
  if (arg.length > 1) fail();
  const ch = ALIAS[arg] ?? arg;
  if (ch in OPEN) return { left: ch + ' ', right: ' ' + OPEN[ch] };
  if (ch in CLOSE) return { left: CLOSE[ch], right: ch };
  return { left: ch, right: ch };
}

// ---- finding surroundings ------------------------------------------------------------------

const span = (line: number, a: number, b: number): [Pos, Pos] => [pos(line, a), pos(line, b)];

function findBracket(lines: readonly string[], cur: Pos, key: string): Found | null {
  const close = key in OPEN ? OPEN[key] : key;
  const open = CLOSE[close];
  const here = lines[cur.line][cur.col];
  let o: Pos | null = here === open ? cur : here === close ? findOpen(lines, cur, open, close) : unmatchedOpen(lines, cur, open, close);
  if (!o) {
    // Not inside a pair: the next one on the line.
    const i = lines[cur.line].indexOf(open, cur.col);
    if (i < 0) return null;
    o = pos(cur.line, i);
  }
  const c = findClose(lines, o, open, close);
  if (!c) return null;
  const spaced = key in OPEN;
  const lt = lines[o.line], rt = lines[c.line];
  const lEnd = o.col + 1 + (spaced && lt[o.col + 1] === ' ' ? 1 : 0);
  const rStart = c.col - (spaced && rt[c.col - 1] === ' ' && (c.line !== o.line || c.col - 1 >= lEnd) ? 1 : 0);
  return { l: span(o.line, o.col, lEnd), r: span(c.line, rStart, c.col + 1), kind: 'pair' };
}

/** Same-character pairs (quotes, *, _ …) on the cursor line, paired from the line start. */
function findQuote(lines: readonly string[], cur: Pos, q: string): Found | null {
  const t = lines[cur.line];
  const idx: number[] = [];
  for (let i = 0; i < t.length; i++) if (t[i] === q && (i === 0 || t[i - 1] !== '\\')) idx.push(i);
  let best: [number, number] | null = null;
  for (let i = 0; i + 1 < idx.length; i += 2) {
    if (idx[i] <= cur.col && cur.col <= idx[i + 1]) { best = [idx[i], idx[i + 1]]; break; }
  }
  if (!best) {
    for (let i = 0; i + 1 < idx.length; i += 2) if (idx[i] > cur.col) { best = [idx[i], idx[i + 1]]; break; }
  }
  if (!best) return null;
  return { l: span(cur.line, best[0], best[0] + 1), r: span(cur.line, best[1], best[1] + 1), kind: 'pair' };
}

type TagHit = { name: string; open: boolean; start: Pos; end: Pos };

function findTag(lines: readonly string[], cur: Pos): Found | null {
  const tags: TagHit[] = [];
  const re = /<(\/?)([A-Za-z][\w:.-]*)((?:[^>"']|"[^"]*"|'[^']*')*?)(\/?)>/g;
  lines.forEach((t, l) => {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(t))) {
      if (m[4] === '/') continue;
      tags.push({ name: m[2], open: m[1] !== '/', start: pos(l, m.index), end: pos(l, m.index + m[0].length) });
    }
  });
  const pairs: { o: TagHit; c: TagHit }[] = [];
  const stack: TagHit[] = [];
  for (const t of tags) {
    if (t.open) stack.push(t);
    else for (let k = stack.length - 1; k >= 0; k--) if (stack[k].name === t.name) { pairs.push({ o: stack[k], c: t }); stack.length = k; break; }
  }
  const covers = pairs.filter(p => cmpPos(p.o.start, cur) <= 0 && cmpPos(cur, p.c.end) < 0)
    .sort((a, b) => cmpPos(b.o.start, a.o.start));
  const p = covers[0] ?? pairs.filter(q => q.o.start.line === cur.line && q.o.start.col > cur.col).sort((a, b) => cmpPos(a.o.start, b.o.start))[0];
  if (!p) return null;
  return { l: [p.o.start, p.o.end], r: [p.c.start, p.c.end], kind: 'tag' };
}

/** A function call name(args): the innermost around the cursor, else the next on the line. */
function findCall(lines: readonly string[], cur: Pos): Found | null {
  const calls: Found[] = [];
  lines.forEach((t, l) => {
    const re = /[A-Za-z_$][\w$.:]*\(/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(t))) {
      const o = pos(l, m.index + m[0].length - 1);
      const c = findClose(lines, o, '(', ')');
      if (c) calls.push({ l: span(l, m.index, o.col + 1), r: span(c.line, c.col, c.col + 1), kind: 'func' });
    }
  });
  const covers = calls.filter(f => cmpPos(f.l[0], cur) <= 0 && cmpPos(cur, f.r[1]) < 0).sort((a, b) => cmpPos(b.l[0], a.l[0]));
  return covers[0] ?? calls.filter(f => f.l[0].line === cur.line && f.l[0].col > cur.col).sort((a, b) => cmpPos(a.l[0], b.l[0]))[0] ?? null;
}

const size = (f: Found) => (f.r[1].line - f.l[0].line) * 10000 + f.r[1].col - f.l[0].col;

export function findSurrounding(lines: readonly string[], cur: Pos, key: string): Found | null {
  const k = ALIAS[key] ?? key;
  if (k === 'q' || k === 's') {
    // Any quote (q) or any surrounding (s): the closest one around the cursor, else the next one.
    const keys = k === 'q' ? QUOTES : [')', ']', '}', '>', ...QUOTES];
    const all = keys.map(c => (c in CLOSE ? findBracket(lines, cur, c) : findQuote(lines, cur, c))).filter((f): f is Found => !!f);
    const covering = all.filter(f => cmpPos(f.l[0], cur) <= 0 && cmpPos(cur, f.r[1]) < 0).sort((a, b) => size(a) - size(b));
    return covering[0] ?? all.sort((a, b) => cmpPos(a.l[0], b.l[0]))[0] ?? null;
  }
  if (k === 't' || k === 'T') return findTag(lines, cur);
  if (k === 'f') return findCall(lines, cur);
  if (k in OPEN || k in CLOSE) return findBracket(lines, cur, k);
  if (/^[^A-Za-z0-9\s]$/.test(k)) return findQuote(lines, cur, k);
  return null;
}

// ---- editing -----------------------------------------------------------------------------------

/** Replace the end-exclusive span [a, b) with text (which may contain newlines). */
function replaceSpan(vim: Vim, a: Pos, b: Pos, text: string) {
  const L = vim.buf.lines;
  const joined = L[a.line].slice(0, a.col) + text + L[b.line].slice(b.col);
  vim.buf.splice(a.line, b.line - a.line + 1, joined.split('\n'));
  vim.buf.recordChange(a);
}

/** Reindent lines [from, to] one shiftwidth deeper than `base` (nvim-surround's indent_lines). */
function reindent(vim: Vim, from: number, to: number, base: string) {
  const sw = ' '.repeat(Number(vim.opt('shiftwidth')) || 2);
  const lines = vim.buf.lines.slice(from, to + 1);
  const min = Math.min(...lines.filter(t => t.trim()).map(t => indentOf(t).length));
  for (let l = from; l <= to; l++) {
    const t = vim.buf.line(l);
    vim.buf.setLine(l, t.trim() ? base + sw + t.slice(Number.isFinite(min) ? min : 0) : '');
  }
}

function addAround(vim: Vim, r: Range, pair: Pair, newlines: boolean) {
  const L = vim.buf.lines;
  if (r.kind === 'block') {
    const c1 = Math.min(r.start.col, r.end.col), c2 = Math.max(r.start.col, r.end.col);
    for (let l = r.start.line; l <= r.end.line; l++) {
      const t = vim.buf.line(l);
      if (c1 >= t.length) continue;
      const e = r.toEol ? t.length : Math.min(t.length, c2 + 1);
      vim.buf.setLine(l, t.slice(0, c1) + pair.left + t.slice(c1, e) + pair.right + t.slice(e));
    }
    vim.buf.recordChange(pos(r.start.line, c1));
    vim.setCursor(pos(r.start.line, c1));
    return;
  }
  if (r.kind === 'line' && newlines) {
    const base = indentOf(L[r.start.line]);
    reindent(vim, r.start.line, r.end.line, base);
    vim.buf.splice(r.end.line + 1, 0, [base + pair.right.trimStart()]);
    vim.buf.splice(r.start.line, 0, [base + pair.left.trimEnd()]);
    vim.buf.recordChange(pos(r.start.line, base.length));
    vim.setCursor(pos(r.start.line, base.length));
    return;
  }
  let start = r.start, end = r.end;
  if (r.kind === 'line') {
    // Linewise motions (yss, ysj): from the first to the last non-blank.
    start = pos(r.start.line, indentOf(L[r.start.line]).length);
    const et = L[r.end.line];
    end = pos(r.end.line, Math.max(0, et.trimEnd().length - 1));
  }
  const endLen = L[end.line].length;
  const endEx = pos(end.line, Math.min(endLen, end.col + 1));
  if (newlines) {
    const base = indentOf(L[start.line]);
    const text = vim.getText({ start, end: pos(endEx.line, endEx.col - 1), kind: 'char' }).text;
    replaceSpan(vim, start, endEx, `${pair.left.trimEnd()}\n${text}\n${base}${pair.right.trimStart()}`);
    reindent(vim, start.line + 1, start.line + 1 + text.split('\n').length - 1, base);
  } else {
    replaceSpan(vim, endEx, endEx, pair.right);
    replaceSpan(vim, start, start, pair.left);
  }
  vim.setCursor(start);
}

/** Remove a found surrounding (or replace it with `pair`). */
function replaceFound(vim: Vim, f: Found, pair: Pair | null) {
  const { l, r } = f;
  replaceSpan(vim, r[0], r[1], pair ? pair.right : '');
  replaceSpan(vim, l[0], l[1], pair ? pair.left : '');
  if (!pair && r[0].line !== l[0].line) {
    // A delimiter that sat on its own line leaves no blank line behind.
    for (const line of [r[0].line, l[0].line]) if (vim.buf.line(line).trim() === '' && vim.buf.lineCount > 1) vim.buf.splice(line, 1, []);
  }
  vim.setCursor(l[0]);
}

function changeTag(vim: Vim, f: Found, input: string, whole: boolean) {
  const name = typedName(input);
  if (!name) fail();
  const el = name.split(/\s+/)[0];
  const L = vim.buf.lines;
  const openText = L[f.l[0].line].slice(f.l[0].col, f.l[1].col);
  // t keeps the attributes and only renames; T replaces the whole tag.
  const attrs = whole ? name.slice(el.length) : openText.replace(/^<[^\s>]*/, '').replace(/>$/, '');
  replaceSpan(vim, f.r[0], f.r[1], `</${el}>`);
  replaceSpan(vim, f.l[0], f.l[1], `<${el}${attrs}>`);
  vim.setCursor(f.l[0]);
}

const TARGETS = ['(', ')', 'b', '{', '}', 'B', '[', ']', 'r', '<', '>', 'a', '"', "'", '`', 'q', 's', 't', 'T', 'f',
  '*', '_', '|', '/', '-', '~', '=', '+', ':', ',', '.', ';', '!', '?', '#', '%', '&', '@', '^', '$'];

export const surround: Plugin = {
  name: 'surround',
  setup: vim => {
    const add = (newlines: boolean) => (r: Range) => addAround(vim, r, addPair(vim.opArgument), newlines);
    vim.defineOperator('ys', { change: true, argAfter: 'surround', run: add(false) }, ['n']);
    vim.defineOperator('yS', { change: true, argAfter: 'surround', run: add(true) }, ['n']);
    vim.defineOperator('S', {
      change: true, argAfter: 'surround',
      run: (r, c) => addAround(vim, r, addPair(vim.opArgument), c.visual === 'V'),
    }, ['v']);

    // mini.surround: the same operations under s-prefixed keys. A lone `s` still substitutes: the
    // engine runs it when the next key is not a/d/r/f/F.
    vim.defineOperator('sa', { change: true, argAfter: 'surround', run: add(false) }, ['n']);
    vim.defineOperator('sa', {
      change: true, argAfter: 'surround',
      run: (r, c) => addAround(vim, r, addPair(vim.opArgument), c.visual === 'V'),
    }, ['v']);
    const del = {
      arg: 'char' as const, change: true,
      run: (c: { arg: string }) => {
        const f = findSurrounding(vim.lines, vim.cursor, c.arg);
        if (!f) fail();
        replaceFound(vim, f, null);
      },
    };
    vim.defineAction('ds', del);
    vim.defineAction('sd', del);
    const jump = (side: 'l' | 'r') => ({
      arg: 'char' as const,
      run: (c: { arg: string }) => {
        const f = findSurrounding(vim.lines, vim.cursor, c.arg);
        if (!f) fail();
        vim.setCursor(side === 'r' ? f.r[0] : f.l[0]);
      },
    });
    vim.defineAction('sf', jump('r'));
    vim.defineAction('sF', jump('l'));

    for (const t of TARGETS) for (const prefix of ['cs', 'sr']) {
      const tag = t === 't' || t === 'T';
      vim.defineAction(`${prefix}${t === '<' ? '<lt>' : t}`, {
        arg: tag || t === 'f' ? 'tag' : 'surround',
        change: true,
        run: c => {
          const f = findSurrounding(vim.lines, vim.cursor, t);
          if (!f) fail();
          if (tag) return changeTag(vim, f, c.arg, t === 'T');
          if (t === 'f') {
            const name = typedName(c.arg);
            if (!name) fail();
            return replaceFound(vim, f, { left: `${name}(`, right: ')' });
          }
          replaceFound(vim, f, addPair(c.arg));
        },
      });
    }
  },
};
