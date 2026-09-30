// A LuaSnip/blink-style snippet flow: Tab expands a trigger word or jumps to the next field,
// S-Tab jumps back. Fields are `${n:placeholder}`; entering a field removes whatever is in it
// (its placeholder, or what was typed there before) and leaves the cursor there in insert mode.
// Small on purpose: the habit is the lesson.
import type { Plugin, Vim } from '../editor';

const SNIPPETS: Record<string, string> = {
  fn: 'function ${1:name}(${2:params}) {\n  ${3:body}\n}',
  for: 'for (const ${1:item} of ${2:items}) {\n  ${3:body}\n}',
  if: 'if (${1:cond}) {\n  ${2:body}\n}',
  log: 'console.log(${1:value});',
};

type Field = { line: number; col: number; text: string };
type Active = { fields: Field[]; idx: number };

/** Replace the trigger (already removed) at `startCol` with the template; returns its fields. */
function expand(vim: Vim, trigger: string, startCol: number): Active {
  const line0 = vim.cursor.line;
  const cur = vim.line();
  const indent = /^\s*/.exec(cur)![0];
  const fields: Field[] = [];
  const tpl = SNIPPETS[trigger].split('\n');
  const out = tpl.map((raw, i) => {
    let text = i === 0 ? cur.slice(0, startCol) : indent;
    let rest = raw;
    let m: RegExpExecArray | null;
    while ((m = /\$\{(\d+):([^}]*)\}/.exec(rest))) {
      text += rest.slice(0, m.index);
      fields[Number(m[1]) - 1] = { line: line0 + i, col: text.length, text: m[2] };
      text += m[2];
      rest = rest.slice(m.index + m[0].length);
    }
    return text + rest;
  });
  out[out.length - 1] += cur.slice(startCol);
  vim.buf.lines = [...vim.buf.lines.slice(0, line0), ...out, ...vim.buf.lines.slice(line0 + 1)];
  return { fields, idx: -1 };
}

/** Move later fields on the same line by `delta` columns. */
function shift(a: Active, from: number, delta: number) {
  const f = a.fields[from];
  for (const g of a.fields.slice(from + 1)) if (g.line === f.line) g.col += delta;
}

/** Record what was typed into the current field and keep later columns right. */
function leave(vim: Vim, a: Active) {
  const f = a.fields[a.idx];
  if (!f) return;
  const c = vim.cursor;
  const typed = c.line === f.line && c.col >= f.col ? vim.line(f.line).slice(f.col, c.col) : f.text;
  shift(a, a.idx, typed.length - f.text.length);
  f.text = typed;
}

/** Enter a field: clear its contents and put the cursor there. */
function enter(vim: Vim, a: Active, idx: number) {
  const f = a.fields[idx];
  if (!f) return;
  const l = vim.line(f.line);
  vim.buf.setLine(f.line, l.slice(0, f.col) + l.slice(f.col + f.text.length));
  shift(a, idx, -f.text.length);
  f.text = '';
  a.idx = idx;
  vim.win.cursor = { line: f.line, col: f.col };
  vim.win.want = f.col;
}

export const snippets: Plugin = {
  name: 'snippets',
  setup: vim => {
    let active: Active | null = null;
    vim.mapInsert('<Tab>', () => {
      const l = vim.line(), c = vim.cursor.col;
      const m = /([A-Za-z]+)$/.exec(l.slice(0, c));
      const canExpand = !active || active.idx >= active.fields.length - 1;
      if (m && SNIPPETS[m[1]] && canExpand) {
        const startCol = c - m[1].length;
        vim.buf.setLine(vim.cursor.line, l.slice(0, startCol) + l.slice(c));
        vim.win.cursor = { line: vim.cursor.line, col: startCol };
        active = expand(vim, m[1], startCol);
        enter(vim, active, 0);
        return;
      }
      if (active && active.idx < active.fields.length - 1) {
        leave(vim, active);
        enter(vim, active, active.idx + 1);
        return;
      }
      vim.typeText('\t');
    });
    vim.mapInsert('<S-Tab>', () => {
      if (!active || active.idx <= 0) return;
      leave(vim, active);
      enter(vim, active, active.idx - 1);
    });
  },
};
