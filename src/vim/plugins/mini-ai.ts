// mini.ai (echasnovski/mini.nvim), with the extra objects LazyVim configures for it:
//   a/i + ( ) [ ] { } < > b  " ' ` q  t  a (argument)  — search "cover or next"
//   an / in / al / il        — the next / last object of that kind (in( il" an{ …)
//   ii / ai                  — indent scope (mini.indentscope); ai adds the header line and the
//                              closing line (}, end) when there is one
//   if / af, ic / ac         — function and class, standing in for treesitter-textobjects
//   ]f [f ]F [F              — to the start / end of the next / previous function (LazyVim's
//                              treesitter-textobjects keys; ]m stays Vim's own)

import type { MotionCtx, MotionResult, Plugin, Vim } from '../editor';
import { findClose } from '../motions';
import { indentOf } from '../text';
import type { ObjectCtx } from '../textobjects';
import { type Pos, type Range, cmpPos, pos } from '../types';

type Lines = readonly string[];
/** A candidate object: its "a" range and its "i" range (null when there's no inner part). */
export type Region = { a: Range; i: Range | null };

const ch = (start: Pos, end: Pos): Range => ({ start, end, kind: 'char' });
const empty = (at: Pos): Range => ({ start: at, end: pos(at.line, at.col - 1), kind: 'char' });

// ---- position helpers ---------------------------------------------------------------------------

/** The characters strictly between a and b as [char, pos] with "\n" at line ends. */
function between(lines: Lines, a: Pos, b: Pos): { c: string; p: Pos }[] {
  const out: { c: string; p: Pos }[] = [];
  for (let l = a.line; l <= b.line; l++) {
    const t = lines[l];
    const from = l === a.line ? a.col + 1 : 0;
    const to = l === b.line ? b.col : t.length + 1;
    for (let c = from; c < to; c++) out.push({ c: c < t.length ? t[c] : '\n', p: pos(l, c) });
  }
  return out;
}

const isWs = (c: string) => c === ' ' || c === '\t' || c === '\n';

/** Region inside a pair of delimiters; `trim` drops inner edge whitespace (mini.ai's "(" vs ")"). */
function innerOf(lines: Lines, o: Pos, c: Pos, trim: boolean): Range {
  const cs = between(lines, o, c);
  if (!trim) {
    // Delimiters on their own lines: the lines between, as in Vim.
    const openAtEol = o.col === lines[o.line].length - 1;
    const closeFirst = lines[c.line].slice(0, c.col).trim() === '';
    if (openAtEol && closeFirst && c.line - o.line >= 2) return { start: pos(o.line + 1, 0), end: pos(c.line - 1, 0), kind: 'line' };
    if (!cs.length) return empty(pos(o.line, o.col + 1));
    let s = 0, e = cs.length - 1;
    if (openAtEol) s = cs.findIndex(x => x.p.line > o.line);
    if (closeFirst && c.line > o.line) { while (e > s && cs[e].p.line === c.line) e--; if (cs[e].c === '\n' && e > s) e--; }
    return s < 0 || s > e ? empty(pos(o.line, o.col + 1)) : ch(cs[s].p, cs[e].p);
  }
  let s = 0, e = cs.length - 1;
  while (s <= e && isWs(cs[s].c)) s++;
  while (e >= s && isWs(cs[e].c)) e--;
  if (s > e) return empty(cs.length ? cs[0].p : pos(o.line, o.col + 1));
  return ch(cs[s].p, cs[e].p);
}

// ---- finders --------------------------------------------------------------------------------------

function bracketPairs(lines: Lines, open: string, close: string): [Pos, Pos][] {
  const out: [Pos, Pos][] = [];
  const stack: Pos[] = [];
  lines.forEach((t, l) => {
    for (let c = 0; c < t.length; c++) {
      if (t[c] === open) stack.push(pos(l, c));
      else if (t[c] === close && stack.length) out.push([stack.pop()!, pos(l, c)]);
    }
  });
  return out;
}

const brackets = (open: string, close: string, trim: boolean) => (lines: Lines): Region[] =>
  bracketPairs(lines, open, close).map(([o, c]) => ({ a: ch(o, c), i: innerOf(lines, o, c, trim) }));

const quotes = (q: string) => (lines: Lines): Region[] => {
  const out: Region[] = [];
  lines.forEach((t, l) => {
    const idx: number[] = [];
    for (let i = 0; i < t.length; i++) if (t[i] === q && (i === 0 || t[i - 1] !== '\\')) idx.push(i);
    for (let k = 0; k + 1 < idx.length; k += 2) {
      const [a, b] = [idx[k], idx[k + 1]];
      out.push({ a: ch(pos(l, a), pos(l, b)), i: b === a + 1 ? empty(pos(l, a + 1)) : ch(pos(l, a + 1), pos(l, b - 1)) });
    }
  });
  return out;
};

function tags(lines: Lines): Region[] {
  type T = { name: string; open: boolean; s: Pos; e: Pos };
  const all: T[] = [];
  const re = /<(\/?)([A-Za-z][\w:.-]*)((?:[^>"']|"[^"]*"|'[^']*')*?)(\/?)>/g;
  lines.forEach((t, l) => {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(t))) if (m[4] !== '/') all.push({ name: m[2], open: m[1] !== '/', s: pos(l, m.index), e: pos(l, m.index + m[0].length - 1) });
  });
  const out: Region[] = [];
  const stack: T[] = [];
  for (const t of all) {
    if (t.open) { stack.push(t); continue; }
    for (let k = stack.length - 1; k >= 0; k--) {
      if (stack[k].name !== t.name) continue;
      const o = stack[k];
      stack.length = k;
      out.push({ a: ch(o.s, t.e), i: innerOf(lines, o.e, t.s, false) });
      break;
    }
  }
  return out;
}

/** Function arguments (mini.ai's `a`): split the contents of (), [] and {} on top-level commas. */
function args(lines: Lines): Region[] {
  const out: Region[] = [];
  for (const [open, close] of [['(', ')'], ['[', ']'], ['{', '}']]) {
    for (const [o, c] of bracketPairs(lines, open, close)) {
      const cs = between(lines, o, c);
      const segs: [number, number][] = [];
      let depth = 0, quote = '', from = 0;
      cs.forEach((x, k) => {
        if (quote) { if (x.c === quote && cs[k - 1]?.c !== '\\') quote = ''; return; }
        if (`"'\``.includes(x.c)) quote = x.c;
        else if ('([{'.includes(x.c)) depth++;
        else if (')]}'.includes(x.c)) depth--;
        else if (x.c === ',' && depth === 0) { segs.push([from, k - 1]); from = k + 1; }
      });
      segs.push([from, cs.length - 1]);
      const inner = segs.map(([s, e]) => {
        while (s <= e && isWs(cs[s].c)) s++;
        while (e >= s && isWs(cs[e].c)) e--;
        return s <= e ? [s, e] as [number, number] : null;
      });
      const real = inner.map((r, k) => (r ? k : -1)).filter(k => k >= 0);
      real.forEach((k, n) => {
        const [s, e] = inner[k]!;
        let as = s, ae = e;
        if (real.length > 1) {
          if (n === 0) {
            // First argument: take the separator and the space after it.
            const next = inner[real[1]]!;
            ae = next[0] - 1;
          } else {
            // Others: the separator before and the space after it.
            as = segs[k][0] - 1;
          }
        }
        out.push({ a: ch(cs[as].p, cs[ae].p), i: ch(cs[s].p, cs[e].p) });
      });
    }
  }
  return out;
}

/** Indent scope (mini.indentscope): ii = the body, ai = with the border lines. */
function indentScope(lines: Lines, cur: Pos, inner: boolean): Range | null {
  const blank = (l: number) => lines[l].trim() === '';
  const ind = (l: number) => indentOf(lines[l]).length;
  const near = (l: number, d: number) => { while (l >= 0 && l < lines.length && blank(l)) l += d; return l >= 0 && l < lines.length ? ind(l) : 0; };
  const level = blank(cur.line) ? Math.max(near(cur.line, -1), near(cur.line, 1)) : ind(cur.line);
  if (level === 0) return null;
  let s = cur.line, e = cur.line;
  while (s > 0 && (blank(s - 1) || ind(s - 1) >= level)) s--;
  while (e + 1 < lines.length && (blank(e + 1) || ind(e + 1) >= level)) e++;
  while (s < e && blank(s)) s++;
  while (e > s && blank(e)) e--;
  if (!inner && s > 0) {
    // The header above, and the closing line below when there is one (}, end, ) or ]).
    s--;
    if (e + 1 < lines.length && ind(e + 1) === ind(s) && /^\s*([}\])]|end\b)/.test(lines[e + 1])) e++;
  }
  return { start: pos(s, 0), end: pos(e, 0), kind: 'line' };
}

// ---- functions & classes (a treesitter stand-in) ----------------------------------------------------

const NOT_FUNC = /^\s*(if|for|while|switch|catch|else|return|do|try)\b/;
const METHOD = /^\s*((?:public|private|protected|static|async|override|readonly|get|set)\s+)*[\w$]+\s*(<[^>]*>)?\s*\([^)]*\)\s*(:\s*[^{=]+)?\{\s*$/;

type Block = { start: Pos; end: Pos; body: Range | null; linewise: boolean };

/** Where the function node starts on its first line, or -1. */
function funcCol(t: string): number {
  if (NOT_FUNC.test(t)) return -1;
  const kw = /\b(async\s+)?function\b/.exec(t);
  if (kw) {
    const local = /^\s*local\s+function\b/.exec(t);
    return local ? indentOf(t).length : kw.index;
  }
  const arrow = /(async\s+)?(\([^()]*\)|[\w$]+)\s*(:\s*[^=]+)?=>\s*\{\s*$/.exec(t);
  if (arrow) return arrow.index;
  if (METHOD.test(t) && !/^\s*[\w$.]+\s*\(.*\)\s*;?\s*$/.test(t)) return indentOf(t).length;
  return -1;
}

function blocks(lines: Lines, kind: 'function' | 'class'): Block[] {
  const out: Block[] = [];
  lines.forEach((t, l) => {
    let col = -1;
    if (kind === 'class') {
      const m = /\bclass\s+[\w$]+/.exec(t);
      if (m && !NOT_FUNC.test(t)) col = m.index;
    } else col = funcCol(t);
    if (col < 0) return;
    let body: Range | null = null;
    let end: Pos | null = null;
    const brace = t.indexOf('{', col);
    if (brace >= 0) {
      const c = findClose(lines, pos(l, brace), '{', '}');
      if (!c) return;
      end = c;
      const r = innerOf(lines, pos(l, brace), c, true);
      body = r.end.col < r.start.col && r.end.line === r.start.line ? null : r;
    } else if (/\bfunction\b/.test(t) && /\)\s*$/.test(t)) {
      // Lua: up to the "end" at the same indent.
      const ind = indentOf(t);
      for (let k = l + 1; k < lines.length; k++) {
        if (indentOf(lines[k]) === ind && /^\s*end\b/.test(lines[k])) { end = pos(k, indentOf(lines[k]).length + 2); break; }
      }
      if (!end) return;
      const first = l + 1, last = end.line - 1;
      body = first <= last ? ch(pos(first, indentOf(lines[first]).length), pos(last, Math.max(0, lines[last].trimEnd().length - 1))) : null;
    } else return;
    const before = t.slice(0, col);
    const after = lines[end.line].slice(end.col + 1);
    const declPrefix = /^\s*((export\s+)?(default\s+)?(abstract\s+)?|(export\s+)?(const|let|var)\s+[\w$]+(\s*:\s*[^=]+)?\s*=\s*|local\s+[\w$]+\s*=\s*|[\w$.:[\]'"]+\s*[=:]\s*)$/;
    const linewise = declPrefix.test(before) && /^[\s;,)]*$/.test(after);
    out.push({ start: pos(l, linewise ? indentOf(t).length : col), end, body, linewise });
  });
  return out;
}

function blockObject(kind: 'function' | 'class') {
  return (ctx: ObjectCtx, inner: boolean): Range | null => {
    const bs = blocks(ctx.lines, kind);
    const contains = (b: Block, p: Pos) => b.linewise ? b.start.line <= p.line && p.line <= b.end.line : cmpPos(b.start, p) <= 0 && cmpPos(p, b.end) <= 0;
    // Innermost first.
    let pick = bs.filter(b => contains(b, ctx.cur)).sort((x, y) => cmpPos(y.start, x.start))[ctx.count - 1];
    if (!pick) pick = bs.filter(b => cmpPos(b.start, ctx.cur) > 0)[0];
    if (!pick) return null;
    if (inner) return pick.body;
    return pick.linewise ? { start: pos(pick.start.line, 0), end: pos(pick.end.line, 0), kind: 'line' } : ch(pick.start, pick.end);
  };
}

// ---- search: cover or next, next, last --------------------------------------------------------------

type Finder = (lines: Lines) => Region[];

const covers = (r: Range, p: Pos) => cmpPos(r.start, p) <= 0 && cmpPos(p, r.end) <= 0;
const within = (outer: Range, inner: { start: Pos; end: Pos }) => cmpPos(outer.start, inner.start) <= 0 && cmpPos(inner.end, outer.end) <= 0;
const sameRange = (a: Range, b: { start: Pos; end: Pos }) => cmpPos(a.start, b.start) === 0 && cmpPos(a.end, b.end) === 0;

export function select(regions: Region[], ctx: ObjectCtx, inner: boolean, how: 'cover' | 'next' | 'last'): Range | null {
  const get = (r: Region) => (inner ? r.i : r.a);
  const cur = ctx.cur;
  let list: Region[];
  if (how === 'next') list = regions.filter(r => cmpPos(r.a.start, cur) > 0).sort((x, y) => cmpPos(x.a.start, y.a.start));
  else if (how === 'last') list = regions.filter(r => cmpPos(r.a.end, cur) < 0).sort((x, y) => cmpPos(y.a.end, x.a.end));
  else {
    list = regions.filter(r => covers(r.a, cur)).sort((x, y) => cmpPos(y.a.start, x.a.start) || cmpPos(x.a.end, y.a.end));
    const v = ctx.visual;
    // A repeated object in visual mode grows the selection.
    if (v) list = list.filter(r => { const g = get(r); return g && within(g, v) && !sameRange(g, v); });
    if (!list.length && !v) list = regions.filter(r => cmpPos(r.a.start, cur) > 0).sort((x, y) => cmpPos(x.a.start, y.a.start));
  }
  const r = list[ctx.count - 1];
  return r ? get(r) : null;
}

const merge = (...fs: Finder[]): Finder => lines => fs.flatMap(f => f(lines));

const FINDERS: Record<string, Finder> = {
  '(': brackets('(', ')', true), ')': brackets('(', ')', false),
  '[': brackets('[', ']', true), ']': brackets('[', ']', false),
  '{': brackets('{', '}', true), '}': brackets('{', '}', false),
  '<': brackets('<', '>', true), '>': brackets('<', '>', false),
  b: merge(brackets('(', ')', false), brackets('[', ']', false), brackets('{', '}', false)),
  '"': quotes('"'), "'": quotes("'"), '`': quotes('`'),
  q: merge(quotes('"'), quotes("'"), quotes('`')),
  t: tags,
  a: args,
};

// ---- function motions ---------------------------------------------------------------------------------

function funcMotion(vim: Vim, dir: 1 | -1, toEnd: boolean) {
  return (c: MotionCtx): MotionResult | null => {
    const bs = blocks(vim.lines, 'function');
    const at = (b: Block) => (toEnd ? b.end : b.start);
    let p = vim.cursor;
    for (let n = 0; n < c.count; n++) {
      const cand = bs.map(at).filter(q => (dir === 1 ? cmpPos(q, p) > 0 : cmpPos(q, p) < 0)).sort((x, y) => dir * cmpPos(x, y));
      if (!cand.length) { if (n === 0) return null; break; }
      p = cand[0];
    }
    return { pos: p, jump: true, openFold: true, inclusive: toEnd };
  };
}

export const miniAi: Plugin = {
  name: 'mini-ai',
  setup: vim => {
    for (const [id, find] of Object.entries(FINDERS)) {
      const k = id === '<' ? '<lt>' : id;
      vim.defineObject(`i${k}`, ctx => select(find(ctx.lines), ctx, true, 'cover'));
      vim.defineObject(`a${k}`, ctx => select(find(ctx.lines), ctx, false, 'cover'));
      vim.defineObject(`in${k}`, ctx => select(find(ctx.lines), ctx, true, 'next'));
      vim.defineObject(`an${k}`, ctx => select(find(ctx.lines), ctx, false, 'next'));
      vim.defineObject(`il${k}`, ctx => select(find(ctx.lines), ctx, true, 'last'));
      vim.defineObject(`al${k}`, ctx => select(find(ctx.lines), ctx, false, 'last'));
    }
    vim.defineObject('ii', ctx => indentScope(ctx.lines, ctx.cur, true));
    vim.defineObject('ai', ctx => indentScope(ctx.lines, ctx.cur, false));
    const fn = blockObject('function'), cls = blockObject('class');
    vim.defineObject('if', ctx => fn(ctx, true));
    vim.defineObject('af', ctx => fn(ctx, false));
    vim.defineObject('ic', ctx => cls(ctx, true));
    vim.defineObject('ac', ctx => cls(ctx, false));
    vim.defineMotion(']f', { run: funcMotion(vim, 1, false) });
    vim.defineMotion('[f', { run: funcMotion(vim, -1, false) });
    vim.defineMotion(']F', { run: funcMotion(vim, 1, true) });
    vim.defineMotion('[F', { run: funcMotion(vim, -1, true) });
  },
};
