// Pure cursor motions over an array of lines. Each returns the new position,
// or null when the motion fails (Vim beeps and aborts macros).

import { BLANK, CLOSERS, BRACKETS, charClass, firstNonBlank, lastCol } from './text';
import { type Pos, pos } from './types';

type Lines = readonly string[];

// ---- words -----------------------------------------------------------------

/** Step one character forward across lines. Line breaks are reported as col = length. */
function nextPos(lines: Lines, p: Pos): Pos | null {
  if (p.col < lines[p.line].length) return pos(p.line, p.col + 1);
  if (p.line + 1 < lines.length) return pos(p.line + 1, 0);
  return null;
}
function prevPos(lines: Lines, p: Pos): Pos | null {
  if (p.col > 0) return pos(p.line, Math.min(p.col - 1, lines[p.line].length));
  if (p.line > 0) return pos(p.line - 1, lines[p.line - 1].length);
  return null;
}
/** Class at a position; line breaks are blank, empty lines are their own class (3). */
function clsAt(lines: Lines, p: Pos, big: boolean) {
  const t = lines[p.line];
  if (t.length === 0) return 3;
  if (p.col >= t.length) return BLANK;
  return charClass(t[p.col], big);
}

export function wordForward(lines: Lines, p: Pos, big: boolean, stopAtEol = false): Pos | null {
  let cur: Pos | null = p;
  const start = clsAt(lines, p, big);
  // Skip the rest of the current word.
  if (start !== BLANK && start !== 3) {
    while (cur && clsAt(lines, cur, big) === start && cur.col < lines[cur.line].length) cur = nextPos(lines, cur);
  } else if (start === 3) cur = nextPos(lines, cur);
  if (!cur) return null;
  // Skip blanks; an empty line stops us.
  while (cur) {
    const c = clsAt(lines, cur, big);
    if (c === 3) return cur;
    if (c !== BLANK) return cur;
    if (stopAtEol && cur.col >= lines[cur.line].length && cur.line > p.line) return cur;
    const n = nextPos(lines, cur);
    // No next word: stop past the end of the last line (the caller clamps it).
    if (!n) return pos(cur.line, lines[cur.line].length);
    cur = n;
  }
  return null;
}

export function wordEnd(lines: Lines, p: Pos, big: boolean): Pos | null {
  let cur = nextPos(lines, p);
  while (cur && (clsAt(lines, cur, big) === BLANK || clsAt(lines, cur, big) === 3)) cur = nextPos(lines, cur);
  if (!cur) return null;
  const c = clsAt(lines, cur, big);
  for (;;) {
    const n = nextPos(lines, cur);
    if (!n || n.line !== cur.line || clsAt(lines, n, big) !== c) return cur;
    cur = n;
  }
}

export function wordBackward(lines: Lines, p: Pos, big: boolean): Pos | null {
  let cur = prevPos(lines, p);
  while (cur && clsAt(lines, cur, big) === BLANK) cur = prevPos(lines, cur);
  if (!cur) return null;
  const c = clsAt(lines, cur, big);
  if (c === 3) return cur;
  for (;;) {
    const n = prevPos(lines, cur);
    if (!n || n.line !== cur.line || clsAt(lines, n, big) !== c) return cur;
    cur = n;
  }
}

export function wordEndBackward(lines: Lines, p: Pos, big: boolean): Pos | null {
  const startCls = clsAt(lines, p, big);
  let cur: Pos | null = p;
  // Leave the current word.
  if (startCls !== BLANK && startCls !== 3) {
    while (cur && cur.line === p.line && clsAt(lines, cur, big) === startCls) cur = prevPos(lines, cur);
  } else cur = prevPos(lines, cur);
  while (cur) {
    const c = clsAt(lines, cur, big);
    if (c === 3) return cur;
    if (c !== BLANK) return pos(cur.line, Math.min(cur.col, lastCol(lines[cur.line])));
    cur = prevPos(lines, cur);
  }
  return null;
}

// ---- find char -------------------------------------------------------------

export function findChar(line: string, col: number, ch: string, forward: boolean, till: boolean, count: number, repeat = false): number | null {
  let c = col;
  for (let n = 0; n < count; n++) {
    let start = forward ? c + 1 : c - 1;
    // Repeating a till with ; must not stick next to the same character.
    if (repeat && till && n === 0) start = forward ? c + 2 : c - 2;
    let found = -1;
    if (forward) { for (let i = start; i < line.length; i++) if (line[i] === ch) { found = i; break; } }
    else { for (let i = start; i >= 0; i--) if (line[i] === ch) { found = i; break; } }
    if (found < 0) return null;
    c = found;
  }
  if (till) c += forward ? -1 : 1;
  return c;
}

// ---- brackets --------------------------------------------------------------

/** % : jump to the bracket matching the one at or after the cursor on this line. */
export function matchPair(lines: Lines, p: Pos): Pos | null {
  const t = lines[p.line];
  let col = -1;
  for (let i = p.col; i < t.length; i++) if ('(){}[]'.includes(t[i])) { col = i; break; }
  if (col < 0) return null;
  const ch = t[col];
  if (BRACKETS[ch]) return findClose(lines, pos(p.line, col), ch, BRACKETS[ch]);
  return findOpen(lines, pos(p.line, col), CLOSERS[ch], ch);
}

/** Find the closer for the opener at p (exclusive of p). */
export function findClose(lines: Lines, p: Pos, open: string, close: string): Pos | null {
  let depth = 0;
  for (let l = p.line; l < lines.length; l++) {
    const t = lines[l];
    for (let c = l === p.line ? p.col : 0; c < t.length; c++) {
      if (t[c] === open) depth++;
      else if (t[c] === close && --depth === 0) return pos(l, c);
    }
  }
  return null;
}

export function findOpen(lines: Lines, p: Pos, open: string, close: string): Pos | null {
  let depth = 0;
  for (let l = p.line; l >= 0; l--) {
    const t = lines[l];
    for (let c = l === p.line ? p.col : t.length - 1; c >= 0; c--) {
      if (t[c] === close) depth++;
      else if (t[c] === open && --depth === 0) return pos(l, c);
    }
  }
  return null;
}

/** Nearest unmatched opener before p ([( [{). */
export function unmatchedOpen(lines: Lines, p: Pos, open: string, close: string): Pos | null {
  let depth = 0;
  let cur = prevPos(lines, p);
  while (cur) {
    const ch = lines[cur.line][cur.col];
    if (ch === close) depth++;
    else if (ch === open) {
      if (depth === 0) return cur;
      depth--;
    }
    cur = prevPos(lines, cur);
  }
  return null;
}

export function unmatchedClose(lines: Lines, p: Pos, open: string, close: string): Pos | null {
  let depth = 0;
  let cur = nextPos(lines, p);
  while (cur) {
    const ch = lines[cur.line][cur.col];
    if (ch === open) depth++;
    else if (ch === close) {
      if (depth === 0) return cur;
      depth--;
    }
    cur = nextPos(lines, cur);
  }
  return null;
}

// ---- paragraphs & sentences ----------------------------------------------------

export function paragraphForward(lines: Lines, line: number, count: number): number {
  let l = line;
  for (let n = 0; n < count; n++) {
    while (l < lines.length - 1 && lines[l] === '') l++;
    while (l < lines.length - 1 && lines[l] !== '') l++;
  }
  return l;
}

export function paragraphBackward(lines: Lines, line: number, count: number): number {
  let l = line;
  for (let n = 0; n < count; n++) {
    while (l > 0 && lines[l] === '') l--;
    while (l > 0 && lines[l] !== '') l--;
  }
  return l;
}

/** Start positions of every sentence in the buffer, in order. */
export function sentenceStarts(lines: Lines): Pos[] {
  const starts: Pos[] = [];
  let expectStart = true;
  for (let l = 0; l < lines.length; l++) {
    const t = lines[l];
    if (t === '') {
      starts.push(pos(l, 0));
      expectStart = true;
      continue;
    }
    for (let c = 0; c < t.length; c++) {
      const ch = t[c];
      if (expectStart && ch !== ' ' && ch !== '\t') {
        starts.push(pos(l, c));
        expectStart = false;
      }
      if ('.!?'.includes(ch)) {
        let k = c + 1;
        while (k < t.length && `)]"'`.includes(t[k])) k++;
        if (k >= t.length || t[k] === ' ' || t[k] === '\t') {
          expectStart = true;
          c = k - 1;
        }
      }
    }
  }
  return starts;
}

export function sentenceForward(lines: Lines, p: Pos, count: number): Pos | null {
  const s = sentenceStarts(lines);
  let idx = s.findIndex(q => q.line > p.line || (q.line === p.line && q.col > p.col));
  if (idx < 0) return null;
  idx = Math.min(s.length - 1, idx + count - 1);
  return s[idx];
}

export function sentenceBackward(lines: Lines, p: Pos, count: number): Pos | null {
  const s = sentenceStarts(lines);
  let idx = -1;
  for (let i = s.length - 1; i >= 0; i--) if (s[i].line < p.line || (s[i].line === p.line && s[i].col < p.col)) { idx = i; break; }
  if (idx < 0) return pos(0, 0);
  return s[Math.max(0, idx - count + 1)];
}

// ---- function-ish motions (treesitter stand-in) ------------------------------

const FUNC_RE = /^\s*(export\s+)?(default\s+)?(async\s+)?(function\b|class\b|(const|let|var)\s+\w+\s*=\s*(async\s*)?(\([^)]*\)|\w+)\s*=>|local\s+function\b|func\b|def\b|fn\b|\w+\s*\([^)]*\)\s*\{\s*$)/;

export function functionStarts(lines: Lines): number[] {
  const out: number[] = [];
  lines.forEach((t, i) => { if (FUNC_RE.test(t) && !/^\s*(if|for|while|switch|return)\b/.test(t)) out.push(i); });
  return out;
}

export const firstNonBlankPos = (lines: Lines, line: number) => pos(line, firstNonBlank(lines[line]));
