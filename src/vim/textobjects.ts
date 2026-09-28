// Built-in text objects. Each returns an inclusive Range or null.

import { findClose, findOpen, sentenceStarts, unmatchedOpen } from './motions';
import { BLANK, charClass, isBlank } from './text';
import { type Pos, type Range, cmpPos, pos } from './types';

type Lines = readonly string[];

export type ObjectCtx = {
  lines: Lines;
  cur: Pos;
  count: number;
  /** Current visual selection, if any, so repeated objects can grow it. */
  visual: { start: Pos; end: Pos } | null;
};

export type TextObject = (ctx: ObjectCtx, inner: boolean) => Range | null;

// ---- words ---------------------------------------------------------------------

function word(big: boolean): TextObject {
  return ({ lines, cur, count, visual }, inner) => {
    const t = lines[cur.line];
    if (t.length === 0) return inner ? { start: cur, end: cur, kind: 'char' } : null;
    const cls = (c: number) => (c < 0 || c >= t.length ? -1 : charClass(t[c], big));
    const runEnd = (c: number) => { const k = cls(c); while (c + 1 < t.length && cls(c + 1) === k) c++; return c; };
    const runStart = (c: number) => { const k = cls(c); while (c > 0 && cls(c - 1) === k) c--; return c; };

    let startCol = visual && cmpPos(visual.start, visual.end) !== 0 ? visual.start.col : runStart(Math.min(cur.col, t.length - 1));
    let endCol = visual && cmpPos(visual.start, visual.end) !== 0 ? visual.end.col : startCol - 1;
    const growing = !!visual && cmpPos(visual.start, visual.end) !== 0;

    for (let n = 0; n < count; n++) {
      const from = growing || n > 0 ? endCol + 1 : startCol;
      if (from >= t.length) {
        if (n === 0) return null;
        break;
      }
      if (inner) {
        endCol = runEnd(from);
      } else {
        const onBlank = cls(from) === BLANK;
        if (onBlank) {
          // Blank then word.
          let e = runEnd(from);
          if (e + 1 < t.length) e = runEnd(e + 1);
          endCol = e;
        } else {
          let e = runEnd(from);
          if (e + 1 < t.length && cls(e + 1) === BLANK) e = runEnd(e + 1);
          else if (n === 0 && !growing) {
            // No trailing blank: take leading blank instead.
            let s = startCol;
            while (s > 0 && isBlank(t[s - 1])) s--;
            if (s > 0 || isBlank(t[0])) startCol = s;
          }
          endCol = e;
        }
      }
    }
    return { start: pos(cur.line, startCol), end: pos(cur.line, endCol), kind: 'char' };
  };
}

// ---- sentences & paragraphs ------------------------------------------------------

const sentence: TextObject = ({ lines, cur, count }, inner) => {
  const starts = sentenceStarts(lines).filter(p => lines[p.line] !== '');
  let idx = -1;
  for (let i = 0; i < starts.length; i++) if (cmpPos(starts[i], cur) <= 0) idx = i;
  if (idx < 0) return null;
  const endOf = (i: number): Pos => {
    const nextStart = starts[i + 1];
    let e: Pos;
    if (nextStart && nextStart.line === starts[i].line) e = pos(nextStart.line, nextStart.col - 1);
    else e = pos(starts[i].line, lines[starts[i].line].length - 1);
    // If the next sentence starts on a later line, end at the end of the paragraph text.
    if (nextStart && nextStart.line > starts[i].line) {
      let l = starts[i].line;
      while (l + 1 < nextStart.line && lines[l + 1] !== '') l++;
      e = pos(l, lines[l].length - 1);
    }
    return e;
  };
  const start = starts[idx];
  let end = endOf(Math.min(starts.length - 1, idx + count - 1));
  if (inner) {
    // Trim trailing blanks.
    while (end.col > 0 && isBlank(lines[end.line][end.col])) end = pos(end.line, end.col - 1);
  }
  return { start, end, kind: 'char' };
};

const paragraph: TextObject = ({ lines, cur, count }, inner) => {
  const blank = (l: number) => lines[l] !== undefined && lines[l].trim() === '';
  let s = cur.line;
  const kind = blank(s);
  while (s > 0 && blank(s - 1) === kind) s--;
  let e = cur.line;
  for (let n = 0; n < count; n++) {
    if (n > 0) {
      if (e + 1 >= lines.length) return null;
      e++;
    }
    const k = blank(e);
    while (e + 1 < lines.length && blank(e + 1) === k) e++;
    if (!inner && !(n === 0 && kind)) {
      // ap: include the following blank lines (or preceding ones at end of file).
      if (e + 1 < lines.length && blank(e + 1)) {
        while (e + 1 < lines.length && blank(e + 1)) e++;
      } else if (n === count - 1) {
        while (s > 0 && blank(s - 1)) s--;
      }
    }
  }
  return { start: pos(s, 0), end: pos(e, 0), kind: 'line' };
};

// ---- brackets --------------------------------------------------------------------

function bracket(open: string, close: string): TextObject {
  return ({ lines, cur, count, visual }, inner) => {
    let from = cur;
    // Cursor on a bracket counts as inside it.
    let o: Pos | null = null;
    const here = lines[cur.line][cur.col];
    for (let n = 0; n < count; n++) {
      if (n === 0 && here === open) o = cur;
      else if (n === 0 && here === close) o = findOpen(lines, cur, open, close);
      else o = unmatchedOpen(lines, from, open, close);
      // Neovim: outside any block, i( / a( reach forward to the next opening bracket.
      if (!o && n === 0 && count === 1 && (!visual || cmpPos(visual.start, visual.end) === 0)) {
        for (let l = cur.line; l < lines.length && !o; l++) {
          const k = lines[l].indexOf(open, l === cur.line ? cur.col + 1 : 0);
          if (k >= 0) o = pos(l, k);
        }
      }
      if (!o) return null;
      from = o;
    }
    if (!o) return null;
    let c = findClose(lines, o, open, close);
    if (!c) return null;
    let r = objFromPair(lines, o, c, inner);
    // Growing a visual selection: step outwards until the object is bigger than the selection.
    const covers = (x: Range) => {
      const xe = x.kind === 'line' ? pos(x.end.line, Infinity) : x.end;
      return cmpPos(x.start, visual!.start) <= 0 && cmpPos(xe, visual!.end) >= 0 && !(cmpPos(x.start, visual!.start) === 0 && cmpPos(x.end, visual!.end) === 0);
    };
    while (visual && r && !covers(r)) {
      const o2 = unmatchedOpen(lines, o, open, close);
      if (!o2) return null;
      o = o2;
      c = findClose(lines, o2, open, close);
      if (!c) return null;
      r = objFromPair(lines, o2, c, inner);
    }
    return r;
  };
}

function objFromPair(lines: Lines, o: Pos, c: Pos, inner: boolean): Range | null {
  if (!inner) return { start: o, end: c, kind: 'char' };
  // Opening bracket last on its line and closing first non-blank: linewise inner.
  const openAtEol = o.col === lines[o.line].length - 1;
  const closeFirst = lines[c.line].slice(0, c.col).trim() === '';
  if (openAtEol && closeFirst && c.line - o.line >= 2) {
    return { start: pos(o.line + 1, 0), end: pos(c.line - 1, 0), kind: 'line' };
  }
  let start = pos(o.line, o.col + 1);
  if (openAtEol) start = pos(o.line + 1, 0);
  let end = pos(c.line, c.col - 1);
  if (closeFirst && c.line > o.line) end = pos(c.line - 1, lines[c.line - 1].length - 1);
  if (cmpPos(start, end) > 0) return { start, end: pos(start.line, start.col - 1), kind: 'char' }; // empty
  return { start, end, kind: 'char' };
}

// ---- quotes ----------------------------------------------------------------------

function quote(q: string): TextObject {
  return ({ lines, cur }, inner) => {
    const t = lines[cur.line];
    const idx: number[] = [];
    for (let i = 0; i < t.length; i++) if (t[i] === q && (i === 0 || t[i - 1] !== '\\')) idx.push(i);
    let a = -1, b = -1;
    const c = cur.col;
    // On a quote: pair up quotes from the start of the line.
    if (idx.includes(c)) {
      for (let i = 0; i + 1 < idx.length; i += 2) {
        if (idx[i] <= c && c <= idx[i + 1]) { a = idx[i]; b = idx[i + 1]; break; }
      }
      if (a < 0) return null;
    } else {
      // Like Vim: the quotes either side of the cursor, else the first string after it.
      let k = -1;
      for (let i = 0; i < idx.length && idx[i] < c; i++) k = i;
      if (k < 0) k = idx.findIndex(i => i > c);
      if (k < 0 || k + 1 >= idx.length) return null;
      a = idx[k];
      b = idx[k + 1];
    }
    if (inner) {
      if (b === a + 1) return { start: pos(cur.line, a + 1), end: pos(cur.line, a), kind: 'char' };
      return { start: pos(cur.line, a + 1), end: pos(cur.line, b - 1), kind: 'char' };
    }
    let s = a, e = b;
    if (e + 1 < t.length && isBlank(t[e + 1])) { while (e + 1 < t.length && isBlank(t[e + 1])) e++; }
    else while (s > 0 && isBlank(t[s - 1])) s--;
    return { start: pos(cur.line, s), end: pos(cur.line, e), kind: 'char' };
  };
}

// ---- tags --------------------------------------------------------------------------

type Tag = { name: string; open: boolean; start: Pos; end: Pos };

function scanTags(lines: Lines): Tag[] {
  const tags: Tag[] = [];
  const re = /<(\/?)([A-Za-z][\w:.-]*)((?:[^>"']|"[^"]*"|'[^']*')*?)(\/?)>/g;
  lines.forEach((t, l) => {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(t))) {
      if (m[4] === '/') continue; // self-closing
      tags.push({ name: m[2], open: m[1] !== '/', start: pos(l, m.index), end: pos(l, m.index + m[0].length - 1) });
    }
  });
  return tags;
}

const tag: TextObject = ({ lines, cur, count, visual }, inner) => {
  const tags = scanTags(lines);
  // Build matched pairs with a stack.
  const pairs: { o: Tag; c: Tag }[] = [];
  const stack: Tag[] = [];
  for (const t of tags) {
    if (t.open) stack.push(t);
    else {
      for (let k = stack.length - 1; k >= 0; k--) {
        if (stack[k].name === t.name) {
          pairs.push({ o: stack[k], c: t });
          stack.length = k;
          break;
        }
      }
    }
  }
  const contains = (p: { o: Tag; c: Tag }, x: Pos) => cmpPos(p.o.start, x) <= 0 && cmpPos(x, p.c.end) <= 0;
  let around = pairs.filter(p => contains(p, cur)).sort((a, b) => cmpPos(b.o.start, a.o.start));
  if (!around.length) {
    // Seek forward on the line.
    const next = pairs.filter(p => p.o.start.line === cur.line && p.o.start.col > cur.col).sort((a, b) => cmpPos(a.o.start, b.o.start));
    if (!next.length) return null;
    around = [next[0]];
  }
  let idx = Math.min(count - 1, around.length - 1);
  const mk = (p: { o: Tag; c: Tag }): Range => inner
    ? { start: pos(p.o.end.line, p.o.end.col + 1), end: p.c.start.col > 0 ? pos(p.c.start.line, p.c.start.col - 1) : pos(p.c.start.line - 1, Math.max(0, lines[p.c.start.line - 1].length - 1)), kind: 'char' }
    : { start: p.o.start, end: p.c.end, kind: 'char' };
  let r = mk(around[idx]);
  if (visual && cmpPos(visual.start, r.start) === 0 && cmpPos(visual.end, r.end) === 0 && around[idx + 1]) r = mk(around[++idx]);
  return r;
};

export const TEXT_OBJECTS: Record<string, TextObject> = {
  w: word(false), W: word(true), s: sentence, p: paragraph,
  '(': bracket('(', ')'), ')': bracket('(', ')'), b: bracket('(', ')'),
  '[': bracket('[', ']'), ']': bracket('[', ']'),
  '{': bracket('{', '}'), '}': bracket('{', '}'), B: bracket('{', '}'),
  '<': bracket('<', '>'), '>': bracket('<', '>'),
  '"': quote('"'), "'": quote("'"), '`': quote('`'),
  t: tag,
};
