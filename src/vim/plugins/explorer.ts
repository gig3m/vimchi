// A tree explorer on the keys snacks.explorer (LazyVim, <leader>e / <leader>E) and neo-tree
// (kickstart's opt-in plugin, \) share: a sidebar on the left listing the project, one entry per
// line, directories first. In the tree: j/k move (it is a buffer, so / gg G work too), l expands a
// directory or opens a file, h collapses a directory or closes its parent, <CR> opens a file or
// toggles a directory, a adds (a trailing / makes a directory), d deletes (y confirms), r renames
// (the prompt starts with the name), q closes. Opening a file shows it in the main window and
// keeps the tree open, as snacks does. <leader>e and \ toggle the tree from any window.
//
// Left out on purpose: neo-tree's <BS> (change root to the parent), filters and hidden files,
// git status, copy/move/paste, multiple selections, splits from the tree, and the preview.

import { Buffer } from '../buffer';
import type { Decoration, Plugin, Vim } from '../editor';
import { type LayoutNode, type Tab, Window } from '../layout';
import { basename, dirname, norm } from '../fs';
import { fail, pos } from '../types';

export const EXPLORER_BUF = 'Explorer';
/** The root row's label. */
const ROOT_LABEL = '~/project';
const DIR_COLOR = '#bd93f9';
const ICON_COLOR = '#6272a4';
/** The tree takes a quarter of the screen, like snacks' fixed 40-column sidebar on a wide terminal. */
const SHARE = 1 / 4;

type Entry = { path: string; dir: boolean; depth: number };
type State = { open: Set<string>; dirs: Set<string>; entries: Entry[]; buf: Buffer | null };

function state(vim: Vim): State {
  return ((vim.pluginData.explorer as State | undefined) ??= { open: new Set(), dirs: new Set(), entries: [], buf: null });
}

const join = (dir: string, name: string) => norm(dir ? `${dir}/${name}` : name);
const ancestors = (p: string) => {
  const out: string[] = [];
  for (let d = dirname(p); d; d = dirname(d)) out.push(d);
  return out;
};

/** Children of a directory, directories first, then alphabetical; dotfiles hidden. */
function children(vim: Vim, dir: string): { name: string; dir: boolean }[] {
  const st = state(vim);
  const out = new Map<string, boolean>();
  for (const n of vim.fs.readdir(dir)) out.set(n.replace(/\/$/, ''), n.endsWith('/'));
  for (const d of st.dirs) if (dirname(d) === dir) out.set(basename(d), true);
  return [...out]
    .filter(([n]) => !n.startsWith('.'))
    .map(([name, isDir]) => ({ name, dir: isDir }))
    .sort((a, b) => (a.dir === b.dir ? a.name.localeCompare(b.name) : a.dir ? -1 : 1));
}

function isDir(vim: Vim, p: string) {
  return p === '' || vim.fs.isDir(p) || state(vim).dirs.has(p);
}

function exists(vim: Vim, p: string) {
  return vim.fs.read(p) != null || (p !== '' && isDir(vim, p));
}

/** The listing: the root, then every entry under an open directory. */
function build(vim: Vim): Entry[] {
  const st = state(vim);
  const out: Entry[] = [{ path: '', dir: true, depth: -1 }];
  const walk = (dir: string, depth: number) => {
    for (const c of children(vim, dir)) {
      const p = join(dir, c.name);
      out.push({ path: p, dir: c.dir, depth });
      if (c.dir && st.open.has(p)) walk(p, depth + 1);
    }
  };
  walk('', 0);
  return out;
}

/** Column where an entry's name starts. */
const nameCol = (e: Entry) => (e.depth < 0 ? 2 : 2 * e.depth + 2);

function lineOf(vim: Vim, e: Entry): string {
  const st = state(vim);
  if (e.depth < 0) return `▾ ${ROOT_LABEL}`;
  const icon = e.dir ? (st.open.has(e.path) ? '▾ ' : '▸ ') : '  ';
  return '  '.repeat(e.depth) + icon + basename(e.path);
}

function treeWin(vim: Vim, tab: Tab = vim.tab): Window | undefined {
  const buf = state(vim).buf;
  return buf ? tab.windows().find(w => w.buf === buf) : undefined;
}

/** The entry under the tree's cursor. */
function current(vim: Vim, win = treeWin(vim)): Entry | undefined {
  if (!win) return undefined;
  return state(vim).entries[win.cursor.line];
}

/** Re-list the tree and put the cursor on `focus` (a path) if it is shown, else keep its line. */
function render(vim: Vim, focus?: string) {
  const st = state(vim);
  const buf = st.buf;
  if (!buf) return;
  const win = treeWin(vim);
  const keep = focus ?? (win ? st.entries[win.cursor.line]?.path : undefined);
  st.entries = build(vim);
  buf.lines = st.entries.map(e => lineOf(vim, e));
  buf.modified = false;
  if (!win) return;
  let l = keep != null ? st.entries.findIndex(e => e.path === keep) : -1;
  if (l < 0) l = Math.min(win.cursor.line, st.entries.length - 1);
  win.cursor = pos(l, nameCol(st.entries[l]));
  win.want = win.cursor.col;
}

/** Expand every directory above `p` so it is listed. */
function reveal(vim: Vim, p: string) {
  for (const d of ancestors(p)) state(vim).open.add(d);
}

function makeBuffer(vim: Vim): Buffer {
  const st = state(vim);
  if (st.buf) return st.buf;
  const buf = new Buffer(EXPLORER_BUF, '', { kind: 'plugin', filetype: 'explorer' });
  buf.listed = false;
  buf.modifiable = false;
  vim.addBuffer(buf);
  st.buf = buf;
  const L = (lhs: string, fn: () => void) => vim.mapLocal(buf, ['n'], lhs, () => fn());
  L('l', () => expandOrOpen(vim));
  L('h', () => collapse(vim));
  L('<CR>', () => confirm(vim));
  L('a', () => add(vim));
  L('d', () => del(vim));
  L('r', () => rename(vim));
  L('q', () => close(vim));
  L('\\', () => close(vim));
  L('g?', () => vim.msg('l/CR open  h close  a add  d delete  r rename  q close', 'info'));
  return buf;
}

/** Keep the sidebar at its share of the width after splits re-balance the layout. */
function fitSidebar(vim: Vim) {
  const win = treeWin(vim);
  const root = vim.tab.root;
  if (!win || root.type !== 'row') return;
  const leaf = root.children.find(c => c.type === 'leaf' && c.win === win);
  if (!leaf) return;
  const rest = root.children.filter(c => c !== leaf).reduce((a, c) => a + c.size, 0);
  leaf.size = (rest * SHARE) / (1 - SHARE);
}

/** Open the tree on the far left (or focus it), revealing the current file. */
export function openExplorer(vim: Vim) {
  const from = vim.buf;
  const buf = makeBuffer(vim);
  let win = treeWin(vim);
  if (!win) {
    win = new Window(buf);
    win.opts = { number: false, relativenumber: false };
    const tab = vim.tab;
    const leaf: LayoutNode = { type: 'leaf', win, size: 1 };
    if (tab.root.type === 'row') tab.root.children.unshift(leaf);
    else {
      const old = tab.root;
      old.size = 1;
      tab.root = { type: 'row', children: [leaf, old], size: 1 };
    }
  }
  vim.focusWindow(win);
  fitSidebar(vim);
  const file = from !== buf && from.kind === 'file' && exists(vim, from.name) ? from.name : undefined;
  if (file) reveal(vim, file);
  render(vim, file ?? current(vim, win)?.path);
  if (!file && win.cursor.line === 0 && state(vim).entries.length > 1) render(vim, state(vim).entries[1].path);
}

export function closeExplorer(vim: Vim) {
  const win = treeWin(vim);
  if (!win) return;
  vim.closeWindow(win);
}

function close(vim: Vim) {
  closeExplorer(vim);
}

/** <leader>e: open the tree, or close it when it is open. */
function toggle(vim: Vim) {
  if (treeWin(vim)) closeExplorer(vim);
  else openExplorer(vim);
}

/** kickstart's \ (Neotree reveal): from a file, open or focus the tree on that file; in the tree, close it. */
function neotree(vim: Vim) {
  if (vim.buf === state(vim).buf) closeExplorer(vim);
  else openExplorer(vim);
}

/** The window files open in: the last one used, else any other, else a new one right of the tree. */
function mainWin(vim: Vim): Window {
  const tree = treeWin(vim)!;
  const wins = vim.tab.windows().filter(w => w !== tree);
  const prev = vim.tab.prev;
  if (prev && wins.includes(prev)) return prev;
  if (wins.length) return wins[0];
  const blank = vim.addBuffer(new Buffer('[No Name]', ''));
  return vim.splitWindow('row', blank);
}

function openFile(vim: Vim, path: string) {
  const w = mainWin(vim);
  vim.focusWindow(w);
  vim.pushJump();
  vim.edit(path);
}

function toggleDir(vim: Vim, e: Entry) {
  const st = state(vim);
  if (st.open.has(e.path)) st.open.delete(e.path);
  else st.open.add(e.path);
  render(vim, e.path);
}

function expandOrOpen(vim: Vim) {
  const e = current(vim);
  if (!e) return;
  if (!e.dir) return openFile(vim, e.path);
  if (e.depth < 0) return;
  state(vim).open.add(e.path);
  render(vim, e.path);
}

function confirm(vim: Vim) {
  const e = current(vim);
  if (!e) return;
  if (!e.dir) return openFile(vim, e.path);
  if (e.depth >= 0) toggleDir(vim, e);
}

/** h: close an open directory; on a file or a closed directory, close the parent and move to it. */
function collapse(vim: Vim) {
  const st = state(vim);
  const e = current(vim);
  if (!e || e.depth < 0) return;
  if (e.dir && st.open.has(e.path)) {
    st.open.delete(e.path);
    return render(vim, e.path);
  }
  const parent = dirname(e.path);
  if (parent) st.open.delete(parent);
  render(vim, parent);
}

/** The directory an action applies to: the entry itself if a directory, else its parent. */
const dirOf = (e: Entry) => (e.dir ? e.path : dirname(e.path));

function add(vim: Vim) {
  const e = current(vim);
  if (!e) return;
  const dir = dirOf(e);
  vim.openCmdline('input', '', text => {
    const name = text.trim();
    if (!name) return;
    const path = join(dir, name);
    if (!path) return;
    if (exists(vim, path)) {
      vim.msg(`${path} already exists`, 'warn');
      return;
    }
    if (name.endsWith('/')) {
      state(vim).dirs.add(path);
      for (const d of ancestors(path)) if (!isDir(vim, d)) state(vim).dirs.add(d);
    } else vim.fs.write(path, '');
    reveal(vim, path);
    render(vim, path);
    vim.emit('write');
  }, undefined, 'Add a new file or directory (directories end with a "/"): ');
}

/** Buffers showing `path` (or a file under it) are wiped, their windows shown something else. */
function dropBuffers(vim: Vim, path: string) {
  const hit = (b: Buffer) => b.kind === 'file' && (b.name === path || b.name.startsWith(path + '/'));
  const gone = vim.buffers.filter(hit);
  if (!gone.length) return;
  for (const tab of vim.tabs) {
    for (const w of tab.windows()) {
      if (!hit(w.buf)) continue;
      const alt = w.alt && !hit(w.alt) && w.alt.kind === 'file' ? w.alt : vim.buffers.find(b => b.listed && b.kind === 'file' && !hit(b));
      vim.showBuffer(w, alt ?? vim.addBuffer(new Buffer('[No Name]', '')));
      if (w.alt && hit(w.alt)) w.alt = null;
    }
  }
  vim.buffers = vim.buffers.filter(b => !hit(b));
}

function del(vim: Vim) {
  const e = current(vim);
  if (!e || e.depth < 0) return;
  vim.mode = 'confirm';
  vim.confirm = {
    prompt: `Delete ${e.path}${e.dir ? '/' : ''}? (y/n)`,
    onKey: k => {
      vim.confirm = null;
      vim.mode = 'normal';
      if (k !== 'y' && k !== 'Y') return;
      const st = state(vim);
      vim.fs.remove(e.path);
      for (const d of [...st.dirs]) if (d === e.path || d.startsWith(e.path + '/')) st.dirs.delete(d);
      for (const d of [...st.open]) if (d === e.path || d.startsWith(e.path + '/')) st.open.delete(d);
      // The parent of the last file in a directory stays listed, as on disk.
      const parent = dirname(e.path);
      if (parent && !isDir(vim, parent)) st.dirs.add(parent);
      dropBuffers(vim, e.path);
      render(vim, '\0');
      vim.emit('write');
    },
  };
}

function rename(vim: Vim) {
  const e = current(vim);
  if (!e || e.depth < 0) return;
  vim.openCmdline('input', basename(e.path), text => {
    const name = text.trim();
    if (!name || name === basename(e.path)) return;
    const to = join(dirname(e.path), name);
    if (!to) return;
    if (exists(vim, to)) {
      vim.msg(`${to} already exists`, 'warn');
      return;
    }
    const st = state(vim);
    const move = (p: string) => (p === e.path ? to : p.startsWith(e.path + '/') ? to + p.slice(e.path.length) : p);
    vim.fs.rename(e.path, to);
    st.dirs = new Set([...st.dirs].map(move));
    st.open = new Set([...st.open].map(move));
    const parent = dirname(e.path);
    if (parent && !isDir(vim, parent)) st.dirs.add(parent);
    for (const b of vim.buffers) if (b.kind === 'file') b.name = move(b.name);
    reveal(vim, to);
    render(vim, to);
    vim.emit('write');
  }, undefined, 'New Name: ');
}

// ---- the plugin ------------------------------------------------------------------------------

export const explorer: Plugin = {
  name: 'explorer',
  setup: vim => {
    vim.map(['n'], '<leader>e', () => toggle(vim));
    vim.map(['n'], '<leader>E', () => toggle(vim));
    vim.map(['n'], '\\', () => neotree(vim));
    vim.defineEx('Neotree', 3, a => (/\bclose\b/.test(a.arg) ? closeExplorer(vim) : openExplorer(vim)));
    // Directories in purple, the fold arrows dimmed.
    vim.decorators.push((buf): Decoration | null => {
      const st = state(vim);
      if (buf !== st.buf) return null;
      const hl: NonNullable<Decoration['hl']> = [];
      st.entries.forEach((e, l) => {
        const c = nameCol(e);
        if (e.dir) {
          hl.push({ line: l, start: c - 2, end: c - 1, color: ICON_COLOR });
          hl.push({ line: l, start: c, end: buf.line(l).length, color: DIR_COLOR });
        }
      });
      return { hl };
    });
    // Keep the listing in step with the project, the sidebar at its width and the cursor on the name.
    vim.cursorHooks.push(() => {
      const st = state(vim);
      if (!st.buf) return;
      const win = treeWin(vim);
      if (!win) return;
      const fresh = build(vim);
      if (fresh.length !== st.entries.length || fresh.some((e, i) => e.path !== st.entries[i].path)) render(vim);
      fitSidebar(vim);
      const e = st.entries[win.cursor.line];
      if (e && vim.mode === 'normal') {
        win.cursor.col = nameCol(e);
        win.want = win.cursor.col;
      }
    });
  },
};

/** For goals: the file shown in the window files open in (not the tree). */
export function mainFile(vim: Vim): string | null {
  const tree = state(vim).buf;
  if (vim.buf !== tree) return vim.buf.name;
  const w = vim.tab.prev && vim.tab.prev.buf !== tree ? vim.tab.prev : vim.tab.windows().find(x => x.buf !== tree);
  return w ? w.buf.name : null;
}

export const explorerOpen = (vim: Vim) => !!treeWin(vim);

/** Throws when the tree is not open (tests). */
export function treeLines(vim: Vim): string[] {
  const st = state(vim);
  if (!st.buf) fail('explorer: not open');
  return st.buf.lines;
}

/** For goals: the project has this file or directory (including directories made with a). */
export const projectHas = (vim: Vim, p: string) => exists(vim, norm(p));
