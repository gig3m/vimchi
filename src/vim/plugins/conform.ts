// conform.nvim with kickstart's <leader>f (and LazyVim's <leader>cf): format the buffer, or the
// Visual selection, in one undo step.
//
// The formatter is a small deterministic stand-in for prettier on TypeScript, JavaScript and JSON:
//   - indentation is 2 spaces per bracket level ({ [ ( opened on one line count as one level, and a
//     line starting with closers dedents, as prettier lays out `}).format(x);`);
//   - one space on each side of `=` and the operators built on it (== === != => += <= …);
//   - no trailing whitespace, and never more than one blank line in a row.
// Strings, template literals and // comments are left alone. A range is formatted with the indent
// the code above it implies, so formatting one function lines it up with its neighbours.

import type { Plugin, Vim } from '../editor';
import { pos } from '../types';

export const FORMATS = /\.(ts|tsx|js|jsx|mjs|cjs|json|jsonc)$/;

type Seg = { code: boolean; text: string };

/** Split a line into code and non-code (string, template, comment) segments. */
function segments(line: string): Seg[] {
  const out: Seg[] = [];
  let buf = '';
  let i = 0;
  const flush = (code: boolean) => {
    if (buf) out.push({ code, text: buf });
    buf = '';
  };
  while (i < line.length) {
    const ch = line[i];
    if (ch === '/' && line[i + 1] === '/') {
      flush(true);
      out.push({ code: false, text: line.slice(i) });
      return out;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      flush(true);
      let j = i + 1;
      while (j < line.length && line[j] !== ch) j += line[j] === '\\' ? 2 : 1;
      out.push({ code: false, text: line.slice(i, j + 1) });
      i = j + 1;
      continue;
    }
    buf += ch;
    i++;
  }
  flush(true);
  return out;
}

const OPS = /\s*(===|!==|==|!=|<=|>=|=>|\+=|-=|\*=|\/=|%=|\?\?=|\|\|=|&&=|=)\s*/g;

/** One space around = and its compounds, in code only. */
function spaceOps(segs: Seg[]): string {
  return segs.map(s => (s.code ? s.text.replace(OPS, ' $1 ') : s.text)).join('');
}

/** Tracks bracket levels line by line (one level per line that leaves brackets open). */
class Levels {
  private stack: number[] = [];
  /** Indent level for a line, then account for its brackets. */
  line(segs: Seg[]): number {
    // Closers at the very start of the line (not after a string) belong to earlier lines.
    let lead = 0;
    const code = segs.filter(s => s.code).map(s => {
      if (s !== segs[0]) return s.text;
      const m = /^[\s)\]}]*/.exec(s.text)![0];
      lead = m.replace(/\s/g, '').length;
      return s.text.slice(m.length);
    }).join(' ');
    for (let n = 0; n < lead; n++) this.close();
    const level = this.stack.length;
    let opened = 0;
    for (const ch of code) {
      if ('([{'.includes(ch)) opened++;
      else if (')]}'.includes(ch)) {
        if (opened) opened--;
        else this.close();
      }
    }
    if (opened) this.stack.push(opened);
    return level;
  }
  private close() {
    if (!this.stack.length) return;
    if (--this.stack[this.stack.length - 1] === 0) this.stack.pop();
  }
}

/** The whole buffer with lines [from, to] formatted. */
export function formatLines(lines: string[], from = 0, to = lines.length - 1): string[] {
  const levels = new Levels();
  const out: string[] = [];
  lines.forEach((raw, n) => {
    const text = raw.trim();
    const segs = segments(text);
    const level = levels.line(segs);
    if (n < from || n > to) return void out.push(raw);
    if (!text) {
      // At most one blank line in a row, and none at the top of the file.
      if (!out.length || out[out.length - 1].trim() === '') return;
      return void out.push('');
    }
    // JSDoc continuation lines sit one space in, under the opening /**.
    const body = text.startsWith('*') ? ` ${text}` : spaceOps(segs).trim();
    out.push('  '.repeat(level) + body);
  });
  return out;
}

/** Format the buffer or the Visual lines; keeps the cursor's line. */
export function format(vim: Vim) {
  let from = 0, to = vim.buf.lineCount - 1;
  if (vim.visual) {
    const r = vim.visualRange();
    from = r.start.line;
    to = r.end.line;
    vim.exitVisual();
  }
  if (!FORMATS.test(vim.buf.name)) {
    vim.msg('No formatters available for buffer', 'warn');
    return;
  }
  const before = vim.lines;
  const after = formatLines(before, from, to);
  let a = 0;
  while (a < before.length && a < after.length && before[a] === after[a]) a++;
  if (a === before.length && a === after.length) return;
  let b = 0;
  while (b < before.length - a && b < after.length - a && before[before.length - 1 - b] === after[after.length - 1 - b]) b++;
  const cur = vim.cursor;
  vim.buf.splice(a, before.length - a - b, after.slice(a, after.length - b));
  vim.buf.recordChange(pos(a, 0));
  vim.setCursor(pos(Math.min(cur.line, vim.buf.lineCount - 1), cur.col));
}

export const conform: Plugin = {
  name: 'conform',
  setup(vim) {
    for (const k of ['<leader>f', '<leader>cf']) vim.map(['n', 'v'], k, () => format(vim), { change: true });
  },
};
