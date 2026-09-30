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

type Field = { line: number; col: number; text: string; placeholder: boolean };
/** `session` is the insert session the snippet was expanded in; leaving insert mode ends it. */
type Active = { fields: Field[]; idx: number; session: unknown };

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
      fields[Number(m[1]) - 1] = { line: line0 + i, col: text.length, text: m[2], placeholder: true };
      text += m[2];
      rest = rest.slice(m.index + m[0].length);
    }
    return text + rest;
  });
  out[out.length - 1] += cur.slice(startCol);
  vim.buf.lines = [...vim.buf.lines.slice(0, line0), ...out, ...vim.buf.lines.slice(line0 + 1)];
  return { fields, idx: -1, session: vim.insert };
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
  f.placeholder = false;
}

/** Enter a field: drop its placeholder (what the learner typed stays) and put the cursor at its end. */
function enter(vim: Vim, a: Active, idx: number) {
  const f = a.fields[idx];
  if (!f) return;
  if (f.placeholder) {
    const l = vim.line(f.line);
    vim.buf.setLine(f.line, l.slice(0, f.col) + l.slice(f.col + f.text.length));
    shift(a, idx, -f.text.length);
    f.text = '';
    f.placeholder = false;
  }
  a.idx = idx;
  const col = f.col + f.text.length;
  vim.win.cursor = { line: f.line, col };
  vim.win.want = col;
}

export const snippets: Plugin = {
  name: 'snippets',
  setup: vim => {
    let active: Active | null = null;
    /** The snippet only lives inside the insert session that expanded it. */
    const current = () => (active && active.session === vim.insert ? active : (active = null));
    vim.mapInsert('<Tab>', () => {
      current();
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
      return false; // no snippet: the engine's own <Tab>
    });
    vim.mapInsert('<S-Tab>', () => {
      if (!current() || !active || active.idx <= 0) return;
      leave(vim, active);
      enter(vim, active, active.idx - 1);
    });
  },
};
