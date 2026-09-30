// A language-server stand-in with Neovim 0.11's default LSP keys.
//
// Lessons supply the "server" data in setup.init:
//   vim.pluginData.lsp = {
//     diagnostics: [{ file, line, col, message, severity }],
//     hover: { NAME: 'text' },
//     actions: [{ title, apply(vim) }],
//   }
//
// Keys: [d ]d [D ]D (diagnostics), <C-w>d (diagnostic float), K (hover),
// gd and <C-]> (definition), grr (references → quickfix), gri
// (implementations), grn (rename), gra (code actions), gO (document symbols → location list).
// Definitions and references are found textually across the project's files
// and open buffers.

import { Buffer } from '../buffer';
import type { Decoration, Float, Plugin, Vim } from '../editor';
import type { Key } from '../keys';
import type { QfItem } from '../layout';
import { type Pos, fail, pos } from '../types';

export type Severity = 'error' | 'warn' | 'info' | 'hint';
export type Diagnostic = { file: string; line: number; col: number; message: string; severity?: Severity; source?: string };
export type CodeAction = {
  title: string;
  apply: (vim: Vim) => void;
  /** Only offer the action when the cursor is on this line (0-based). */
  line?: number;
  /** Only offer the action in this file. */
  file?: string;
};
export type LspData = { diagnostics?: Diagnostic[]; hover?: Record<string, string>; actions?: CodeAction[] };

const COLORS: Record<Severity, string> = { error: '#ff5555', warn: '#f1fa8c', info: '#8be9fd', hint: '#6272a4' };
const SIGNS: Record<Severity, string> = { error: 'E', warn: 'W', info: 'I', hint: 'H' };
const BG: Record<Severity, string> = { error: 'rgba(255,85,85,.14)', warn: 'rgba(241,250,140,.12)', info: 'rgba(139,233,253,.12)', hint: 'rgba(98,114,164,.18)' };
const RANK: Record<Severity, number> = { error: 0, warn: 1, info: 2, hint: 3 };
const FLOAT_ID = 'lsp';

const data = (vim: Vim): LspData => (vim.pluginData.lsp as LspData | undefined) ?? {};
const sev = (d: Diagnostic): Severity => d.severity ?? 'error';
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** Whole-word regex for an identifier ($ counts as part of a JS identifier). */
const wordRe = (name: string, flags = 'g') => new RegExp(`(?<![\\w$])${escapeRe(name)}(?![\\w$])`, flags);

/** Diagnostics in a buffer, sorted by position. */
function diagsIn(vim: Vim, name: string) {
  return (data(vim).diagnostics ?? [])
    .filter(d => d.file === name)
    .sort((a, b) => a.line - b.line || a.col - b.col);
}

/** Every project file with its current text: open buffers win over the disk copy. */
function projectFiles(vim: Vim): { name: string; lines: string[]; buf?: Buffer }[] {
  const out = new Map<string, { name: string; lines: string[]; buf?: Buffer }>();
  for (const f of vim.fs.list()) out.set(f, { name: f, lines: (vim.fs.read(f) ?? '').replace(/\n$/, '').split('\n') });
  for (const b of vim.buffers) if (b.kind === 'file' && !b.data.isDir) out.set(b.name, { name: b.name, lines: b.lines, buf: b });
  return [...out.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/** Identifier under or after the cursor. */
function cword(vim: Vim): string {
  const t = vim.line();
  let c = vim.cursor.col;
  const isW = (ch: string | undefined) => !!ch && /[\w$]/.test(ch);
  while (c < t.length && !isW(t[c])) c++;
  if (c >= t.length) fail('E348: No string under cursor');
  let s = c;
  while (s > 0 && isW(t[s - 1])) s--;
  let e = c;
  while (e < t.length && isW(t[e])) e++;
  return t.slice(s, e);
}

type Loc = { file: string; pos: Pos; text: string };

const DEF_PATTERNS = (n: string) => [
  `\\b(?:async\\s+)?function\\s*\\*?\\s+(${n})\\b`,
  `\\bfunction\\s+[\\w.:]+[.:](${n})\\b`,
  `\\b(?:const|let|var)\\s+(${n})\\b`,
  `\\blocal\\s+(${n})\\b`,
  `\\b(?:class|interface|type|enum)\\s+(${n})\\b`,
  `\\b(?:def|func|fn)\\s+(${n})\\b`,
  `\\bexport\\s+(?:default\\s+)?(${n})\\b`,
  `^\\s*(?:(?:public|private|protected|static|async|readonly)\\s+)*(${n})\\s*(?:<[^>]*>)?\\([^)]*\\)\\s*(?::[^{;]+)?\\{`,
];

function search(vim: Vim, patterns: string[]): Loc[] {
  const res = patterns.map(p => new RegExp(p, 'd'));
  const out: Loc[] = [];
  for (const f of projectFiles(vim)) {
    f.lines.forEach((t, l) => {
      for (const re of res) {
        const m = re.exec(t) as (RegExpExecArray & { indices?: [number, number][] }) | null;
        if (m?.indices?.[1]) {
          out.push({ file: f.name, pos: pos(l, m.indices[1][0]), text: t.trim() });
          break;
        }
      }
    });
  }
  return out;
}

function definitions(vim: Vim, name: string): Loc[] {
  const hits = search(vim, DEF_PATTERNS(escapeRe(name)));
  // The current file's definition first, like a server resolving scope.
  return [...hits.filter(h => h.file === vim.buf.name), ...hits.filter(h => h.file !== vim.buf.name)];
}

function implementations(vim: Vim, name: string): Loc[] {
  const n = escapeRe(name);
  const hits = search(vim, [
    `\\bclass\\s+(\\w+)[^{]*\\b(?:implements|extends)\\s+(?:[\\w$]+\\s*,\\s*)*${n}\\b`,
    `^\\s*(?:(?:public|private|protected|static|async|override)\\s+)*(${n})\\s*\\([^)]*\\)\\s*(?::[^{;]+)?\\{`,
  ]);
  return hits.length ? hits : definitions(vim, name);
}

function references(vim: Vim, name: string): Loc[] {
  const out: Loc[] = [];
  for (const f of projectFiles(vim)) {
    f.lines.forEach((t, l) => {
      for (const m of t.matchAll(wordRe(name))) out.push({ file: f.name, pos: pos(l, m.index!), text: t.trim() });
    });
  }
  return out;
}

function jumpTo(vim: Vim, loc: Loc) {
  vim.pushJump();
  if (loc.file !== vim.buf.name) vim.edit(loc.file);
  vim.setCursor(loc.pos);
  vim.openFoldsAt(loc.pos.line);
}

function toQuickfix(vim: Vim, locs: Loc[], title: string) {
  const items: QfItem[] = locs.map(l => ({ file: l.file, line: l.pos.line, col: l.pos.col, text: l.text }));
  vim.quickfix = { items, idx: 0, title };
  vim.ex('copen');
}

// ---- document symbols (gO) ------------------------------------------------------------------------------

/**
 * The symbols a server reports for a buffer, flattened in document order the way Neovim's
 * symbols_to_items does: each at its name (the selectionRange), text "[Kind] name". TypeScript:
 * classes, interfaces, enums, functions at any depth, methods and properties of classes and
 * interfaces, top-level const/let/var. Lua: functions and top-level locals.
 */
export function documentSymbols(buf: Buffer): QfItem[] {
  const out: QfItem[] = [];
  const add = (line: number, name: string, kind: string, from = 0) =>
    out.push({ file: buf.name, line, col: buf.line(line).indexOf(name, from), text: `[${kind}] ${name}` });
  if (/\.lua$/.test(buf.name)) {
    buf.lines.forEach((t, l) => {
      let m: RegExpExecArray | null;
      if ((m = /^\s*(?:local\s+)?function\s+([\w.:]+)/.exec(t))) add(l, m[1], 'Function');
      else if ((m = /^local\s+(\w+)\s*=/.exec(t))) add(l, m[1], 'Variable');
    });
    return out;
  }
  let depth = 0;
  /** Depth of the body of each open class / interface. */
  const containers: { depth: number; kind: 'class' | 'interface' }[] = [];
  buf.lines.forEach((t, l) => {
    const inBody = containers.length && containers[containers.length - 1].depth === depth ? containers[containers.length - 1].kind : null;
    let m: RegExpExecArray | null;
    let opens: 'class' | 'interface' | null = null;
    if ((m = /^\s*(?:export\s+)?(?:default\s+)?(?:abstract\s+)?class\s+(\w+)/.exec(t))) { add(l, m[1], 'Class', t.indexOf('class')); opens = 'class'; }
    else if ((m = /^\s*(?:export\s+)?interface\s+(\w+)/.exec(t))) { add(l, m[1], 'Interface', t.indexOf('interface')); opens = 'interface'; }
    else if ((m = /^\s*(?:export\s+)?(?:const\s+)?enum\s+(\w+)/.exec(t))) add(l, m[1], 'Enum', t.indexOf('enum'));
    else if ((m = /^\s*(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s*\*?\s*(\w+)/.exec(t))) add(l, m[1], 'Function', t.indexOf('function'));
    else if (depth === 0 && (m = /^(?:export\s+)?(const|let|var)\s+(\w+)/.exec(t))) add(l, m[2], m[1] === 'const' ? 'Constant' : 'Variable', m[0].length - m[2].length);
    else if (inBody && (m = /^\s*(?:(?:public|private|protected|static|readonly|async|override|get|set)\s+)*(\w+)\s*(\??)\s*(\(|:|=|<)/.exec(t))) {
      const name = m[1];
      if (!/^(if|for|while|switch|return|catch)$/.test(name)) {
        const kind = name === 'constructor' ? 'Constructor' : m[3] === '(' || m[3] === '<' ? 'Method' : 'Property';
        add(l, name, kind);
      }
    }
    const code = t.replace(/(["'`])(?:\\.|(?!\1).)*\1/g, '""').replace(/\/\/.*$/, '');
    for (const ch of code) {
      if (ch === '{') {
        depth++;
        if (opens) { containers.push({ depth, kind: opens }); opens = null; }
      } else if (ch === '}') {
        if (containers.length && containers[containers.length - 1].depth === depth) containers.pop();
        depth = Math.max(0, depth - 1);
      }
    }
  });
  return out;
}

/** gO: the document's symbols in the location list, opened (vim.lsp.buf.document_symbol()). */
function documentSymbol(vim: Vim) {
  const items = documentSymbols(vim.buf);
  if (!items.length) return vim.msg('No document symbols found');
  vim.win.loclist = { items, idx: 0 };
  vim.ex('lopen');
}

// ---- floats ------------------------------------------------------------------------------------------------

function closeFloat(vim: Vim) {
  vim.floats = vim.floats.filter(f => f.id !== FLOAT_ID);
  vim.modal = null;
}

/** A float at the cursor that closes on the next key (which still runs, like CursorMoved closing a hover). */
function showInfoFloat(vim: Vim, lines: Float['lines'], title?: string) {
  closeFloat(vim);
  const width = Math.min(60, Math.max(12, ...lines.map(l => l.text.length + 2)));
  vim.floats.push({ id: FLOAT_ID, title, lines, anchor: 'cursor', width });
  vim.modal = key => {
    closeFloat(vim);
    return key === '<Esc>';
  };
}

// ---- rename ---------------------------------------------------------------------------------------------------

function rename(vim: Vim, from: string, to: string) {
  if (!to || to === from) return;
  if (!/^[A-Za-z_$][\w$]*$/.test(to)) fail(`E5108: invalid name: ${to}`);
  const re = wordRe(from);
  const has = wordRe(from, '');
  const replace = (t: string) => t.replace(re, to);
  // Keep the cursor on the same identifier.
  const cur = vim.cursor;
  const before = vim.line().slice(0, cur.col);
  const shift = (before.match(re)?.length ?? 0) * (to.length - from.length);
  vim.beginChange();
  let files = 0;
  for (const f of projectFiles(vim)) {
    if (!f.lines.some(t => has.test(t))) continue;
    files++;
    let buf = f.buf;
    if (!buf) {
      // Like Neovim, edits to unopened files load them into (listed, modified) buffers.
      buf = new Buffer(f.name, f.lines);
      vim.addBuffer(buf);
    } else if (buf !== vim.buf) buf.snapshot(pos(0, 0));
    buf.lines.forEach((t, i) => {
      const n = replace(t);
      if (n !== t) buf.setLine(i, n);
    });
    if (buf === vim.buf) buf.recordChange({ ...cur });
  }
  vim.setCursor(pos(cur.line, Math.max(0, cur.col + shift)));
  if (files > 1) vim.msg(`Renamed ${from} to ${to} in ${files} files`);
}

// ---- code actions -----------------------------------------------------------------------------------------------

function codeActions(vim: Vim) {
  const acts = (data(vim).actions ?? []).filter(a => (a.line == null || a.line === vim.cursor.line) && (a.file == null || a.file === vim.buf.name));
  if (!acts.length) {
    vim.msg('No code actions available');
    return;
  }
  const f: Float = {
    id: FLOAT_ID, title: 'Code actions', anchor: 'cursor', sel: 0,
    lines: acts.map((a, i) => ({ text: `${i + 1}. ${a.title}` })),
    width: Math.min(60, Math.max(20, ...acts.map(a => a.title.length + 5))),
  };
  closeFloat(vim);
  vim.floats.push(f);
  const choose = (i: number) => {
    closeFloat(vim);
    vim.beginChange();
    acts[i].apply(vim);
  };
  vim.modal = (key: Key) => {
    if (key === 'j' || key === '<C-n>' || key === '<Down>') f.sel = Math.min(acts.length - 1, f.sel! + 1);
    else if (key === 'k' || key === '<C-p>' || key === '<Up>') f.sel = Math.max(0, f.sel! - 1);
    else if (key === '<CR>') choose(f.sel!);
    else if (/^[1-9]$/.test(key) && +key <= acts.length) choose(+key - 1);
    else if (key === '<Esc>' || key === 'q') closeFloat(vim);
    return true;
  };
}

// ---- plugin -------------------------------------------------------------------------------------------------------------

export const lsp: Plugin = {
  name: 'lsp',
  setup(vim) {
    // Diagnostic jumps (wrap around the buffer, like vim.diagnostic.jump).
    const diagJump = (dir: 1 | -1, edge?: 'first' | 'last') => ({ count }: { count: number }) => {
      const ds = diagsIn(vim, vim.buf.name);
      if (!ds.length) return null;
      if (edge) {
        const d = edge === 'first' ? ds[0] : ds[ds.length - 1];
        return { pos: pos(d.line, d.col), jump: true, openFold: true };
      }
      let p = vim.cursor;
      let hit: Diagnostic | undefined;
      for (let n = 0; n < count; n++) {
        const after = (d: Diagnostic) => d.line > p.line || (d.line === p.line && d.col > p.col);
        const before = (d: Diagnostic) => d.line < p.line || (d.line === p.line && d.col < p.col);
        hit = dir === 1 ? ds.find(after) ?? ds[0] : [...ds].reverse().find(before) ?? ds[ds.length - 1];
        p = pos(hit.line, hit.col);
      }
      return { pos: p, jump: true, openFold: true };
    };
    vim.defineMotion(']d', { run: diagJump(1) });
    vim.defineMotion('[d', { run: diagJump(-1) });
    vim.defineMotion(']D', { run: diagJump(1, 'last') });
    vim.defineMotion('[D', { run: diagJump(-1, 'first') });

    const diagFloat = () => {
      const ds = diagsIn(vim, vim.buf.name).filter(d => d.line === vim.cursor.line);
      if (!ds.length) return;
      showInfoFloat(vim, ds.map(d => ({ text: d.message + (d.source ? ` ${d.source}` : ''), color: COLORS[sev(d)] })), 'Diagnostics');
    };
    vim.defineAction('<C-w>d', { run: diagFloat });
    vim.defineAction('<C-w><C-d>', { run: diagFloat });

    vim.defineAction('K', {
      run: () => {
        const name = cword(vim);
        const text = data(vim).hover?.[name];
        if (text == null) return vim.msg('No information available');
        showInfoFloat(vim, text.split('\n').map(t => ({ text: t })));
      },
    });

    const gotoDef = () => {
      const name = cword(vim);
      const [d] = definitions(vim, name);
      if (!d) return vim.msg('No locations found');
      jumpTo(vim, d);
    };
    vim.defineAction('gd', { run: gotoDef });
    vim.defineAction('<C-]>', { run: gotoDef });

    vim.defineAction('grr', {
      run: () => {
        const name = cword(vim);
        toQuickfix(vim, references(vim, name), `References to ${name}`);
      },
    });

    vim.defineAction('gri', {
      run: () => {
        const name = cword(vim);
        const locs = implementations(vim, name);
        if (!locs.length) return vim.msg('No locations found');
        if (locs.length === 1) return jumpTo(vim, locs[0]);
        toQuickfix(vim, locs, `Implementations of ${name}`);
      },
    });

    vim.defineAction('grn', {
      run: () => {
        const name = cword(vim);
        vim.openCmdline('input', name, text => rename(vim, name, text.trim()), undefined, 'New Name: ');
      },
    });

    vim.defineAction('gra', { run: () => codeActions(vim) }, ['n', 'v']);

    vim.defineAction('gO', { run: () => documentSymbol(vim) });

    vim.decorators.push((buf): Decoration | null => {
      const ds = diagsIn(vim, buf.name);
      if (!ds.length) return null;
      const signs = new Map<number, { text: string; color: string }>();
      const virt = new Map<number, { text: string; color: string }>();
      const hl: NonNullable<Decoration['hl']> = [];
      for (const d of [...ds].sort((a, b) => RANK[sev(a)] - RANK[sev(b)])) {
        const s = sev(d);
        if (!signs.has(d.line)) signs.set(d.line, { text: SIGNS[s], color: COLORS[s] });
        if (!virt.has(d.line)) virt.set(d.line, { text: `■ ${d.message}`, color: COLORS[s] });
        const t = buf.line(d.line);
        const m = /^[\w$]+/.exec(t.slice(d.col));
        hl.push({ line: d.line, start: d.col, end: d.col + Math.max(1, m?.[0].length ?? 1), color: COLORS[s], bg: BG[s] });
      }
      return { signs, virt, hl };
    });
  },
};
