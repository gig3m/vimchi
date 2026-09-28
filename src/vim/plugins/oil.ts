// oil.nvim: `-` opens the parent directory as a buffer you edit like text.
// Every entry line starts with a hidden id ("/001 name"), so on :w the plugin
// can tell renames (same id, new name), deletions (id gone), copies (id seen
// twice) and creations (no id). A confirm float lists the changes: y applies
// them to vim.fs, n cancels. Buffer keys follow oil's defaults.

import { Buffer } from '../buffer';
import type { Decoration, Plugin, Vim } from '../editor';
import { basename, dirname, norm } from '../fs';
import { fail, pos } from '../types';

type Entry = { path: string; dir: boolean };
type OilState = { next: number; ids: Map<string, number>; entries: Map<number, Entry>; dirs: Set<string>; hidden: boolean };

const PREFIX = /^\/(\d{3,}) /;
const DIR_COLOR = '#bd93f9';

export const oilName = (dir: string) => `oil:///${dir ? dir + '/' : ''}`;
const join = (dir: string, name: string) => norm(dir ? `${dir}/${name}` : name);

function state(vim: Vim): OilState {
  return ((vim.pluginData.oil as OilState | undefined) ??= { next: 1, ids: new Map(), entries: new Map(), dirs: new Set(), hidden: false });
}

function idFor(st: OilState, e: Entry): number {
  const key = e.path + (e.dir ? '/' : '');
  let id = st.ids.get(key);
  if (id == null) {
    id = st.next++;
    st.ids.set(key, id);
  }
  st.entries.set(id, e);
  return id;
}

function listDir(vim: Vim, dir: string): string[] {
  const st = state(vim);
  const names = new Set(vim.fs.readdir(dir));
  for (const d of st.dirs) if (dirname(d) === dir) names.add(basename(d) + '/');
  return [...names]
    .filter(n => st.hidden || !n.startsWith('.'))
    .sort((a, b) => (a.endsWith('/') === b.endsWith('/') ? a.localeCompare(b) : a.endsWith('/') ? -1 : 1));
}

function render(vim: Vim, buf: Buffer) {
  const st = state(vim);
  const dir = buf.data.oilDir as string;
  const ids: number[] = [];
  const lines = listDir(vim, dir).map(n => {
    const isDir = n.endsWith('/');
    const id = idFor(st, { path: join(dir, n.replace(/\/$/, '')), dir: isDir });
    ids.push(id);
    return `/${String(id).padStart(3, '0')} ${n}`;
  });
  buf.lines = lines.length ? lines : [''];
  buf.data.orig = ids;
  buf.modified = false;
}

const nameCol = (line: string) => PREFIX.exec(line)?.[0].length ?? 0;

function parse(line: string): { id: number | null; name: string } {
  const m = PREFIX.exec(line);
  if (m) return { id: +m[1], name: line.slice(m[0].length).trim() };
  return { id: null, name: line.trim() };
}

/** Show a directory in the current window, with the cursor on `focus` (a name) if given. */
export function openDir(vim: Vim, dir: string, focus?: string) {
  dir = norm(dir);
  const name = oilName(dir);
  let buf = vim.findBuffer(name);
  if (!buf) {
    buf = new Buffer(name, '', { kind: 'plugin', filetype: 'oil' });
    buf.data.oilDir = dir;
    buf.listed = false;
    vim.addBuffer(buf);
    bufferMaps(vim, buf);
    buf.data.onWrite = () => save(vim);
  }
  if (!buf.modified) render(vim, buf);
  vim.showBuffer(vim.win, buf);
  const l = focus ? Math.max(0, buf.lines.findIndex(t => parse(t).name.replace(/\/$/, '') === focus)) : 0;
  vim.setCursor(pos(l, nameCol(buf.line(l))));
}

function parentOf(vim: Vim): { dir: string; focus: string } | null {
  const buf = vim.buf;
  if (typeof buf.data.oilDir === 'string') {
    const d = buf.data.oilDir;
    if (!d) return null;
    return { dir: dirname(d), focus: basename(d) };
  }
  if (buf.kind !== 'file' || buf.name === '[No Name]') return { dir: '', focus: '' };
  return { dir: dirname(buf.name), focus: basename(buf.name) };
}

function select(vim: Vim, how: 'edit' | 'split' | 'vsplit' | 'tab') {
  const { id, name } = parse(vim.line());
  if (!name) return;
  const e = id != null ? state(vim).entries.get(id) : undefined;
  if (!e) fail('oil: please save changes before opening a new entry');
  if (e.dir) {
    if (how !== 'edit') fail('oil: cannot open a directory in a split');
    return openDir(vim, e.path);
  }
  if (how === 'split') vim.splitWindow('col');
  if (how === 'vsplit') vim.splitWindow('row');
  if (how === 'tab') vim.newTab();
  vim.edit(e.path);
}

function bufferMaps(vim: Vim, buf: Buffer) {
  const L = (lhs: string, fn: () => void) => vim.mapLocal(buf, ['n'], lhs, () => fn());
  L('<CR>', () => select(vim, 'edit'));
  L('<C-s>', () => select(vim, 'vsplit'));
  L('<C-h>', () => select(vim, 'split'));
  L('<C-t>', () => select(vim, 'tab'));
  L('-', () => {
    const p = parentOf(vim);
    if (!p) fail();
    openDir(vim, p.dir, p.focus);
  });
  L('_', () => openDir(vim, ''));
  L('<C-l>', () => { render(vim, buf); vim.clampCursor(false); });
  L('g.', () => {
    const st = state(vim);
    st.hidden = !st.hidden;
    for (const b of vim.buffers) if (typeof b.data.oilDir === 'string' && !b.modified) render(vim, b);
  });
  L('<C-c>', () => {
    const alt = vim.win.alt;
    if (alt && alt !== buf) vim.showBuffer(vim.win, alt);
  });
  L('g?', () => vim.msg('<CR> open  - parent  _ cwd  <C-s> vsplit  <C-h> split  <C-t> tab  <C-l> refresh  g. hidden  <C-c> close', 'info'));
}

// ---- saving ----------------------------------------------------------------------------------------

type Action = { type: 'CREATE' | 'DELETE' | 'MOVE' | 'COPY'; path: string; dest?: string; dir: boolean };

function plan(vim: Vim): Action[] {
  const st = state(vim);
  const bufs = vim.buffers.filter(b => typeof b.data.oilDir === 'string' && (b.modified || b === vim.buf));
  const seen = new Map<number, string[]>();
  const creates: Action[] = [];
  for (const b of bufs) {
    const dir = b.data.oilDir as string;
    for (const line of b.lines) {
      const { id, name } = parse(line);
      if (!name) continue;
      const dest = join(dir, name.replace(/\/$/, ''));
      if (id != null && st.entries.has(id)) seen.set(id, [...(seen.get(id) ?? []), dest]);
      else creates.push({ type: 'CREATE', path: dest, dir: name.endsWith('/') });
    }
  }
  const out: Action[] = [];
  for (const [id, dests] of seen) {
    const e = st.entries.get(id)!;
    const stays = dests.includes(e.path);
    dests.forEach((d, i) => {
      if (d === e.path) return;
      out.push({ type: stays || i > 0 ? 'COPY' : 'MOVE', path: e.path, dest: d, dir: e.dir });
    });
  }
  for (const b of bufs) {
    for (const id of b.data.orig as number[]) {
      if (!seen.has(id)) out.push({ type: 'DELETE', path: st.entries.get(id)!.path, dir: st.entries.get(id)!.dir });
    }
  }
  return [...out, ...creates];
}

function apply(vim: Vim, actions: Action[]) {
  const st = state(vim);
  const order = { COPY: 0, MOVE: 1, DELETE: 2, CREATE: 3 };
  for (const a of [...actions].sort((x, y) => order[x.type] - order[y.type])) {
    if (a.type === 'COPY') {
      if (a.dir) for (const f of vim.fs.list()) { if (f.startsWith(a.path + '/')) vim.fs.write(a.dest! + f.slice(a.path.length), vim.fs.read(f)!); }
      else vim.fs.write(a.dest!, vim.fs.read(a.path) ?? '');
    } else if (a.type === 'MOVE') {
      vim.fs.rename(a.path, a.dest!);
      if (st.dirs.delete(a.path)) st.dirs.add(a.dest!);
      const key = a.path + (a.dir ? '/' : '');
      const id = st.ids.get(key);
      if (id != null) {
        st.ids.delete(key);
        st.ids.set(a.dest! + (a.dir ? '/' : ''), id);
        st.entries.set(id, { path: a.dest!, dir: a.dir });
      }
      for (const b of vim.buffers) {
        if (b.kind !== 'file') continue;
        if (b.name === a.path) b.name = a.dest!;
        else if (a.dir && b.name.startsWith(a.path + '/')) b.name = a.dest! + b.name.slice(a.path.length);
      }
    } else if (a.type === 'DELETE') {
      vim.fs.remove(a.path);
      st.dirs.delete(a.path);
    } else if (a.dir) st.dirs.add(a.path);
    else if (vim.fs.read(a.path) == null) vim.fs.write(a.path, '');
  }
  for (const b of vim.buffers) if (typeof b.data.oilDir === 'string') render(vim, b);
  vim.clampCursor(false);
  vim.setCursor(pos(vim.cursor.line, Math.max(vim.cursor.col, nameCol(vim.line()))));
  vim.emit('write');
}

function save(vim: Vim) {
  const actions = plan(vim);
  if (!actions.length) {
    for (const b of vim.buffers) if (typeof b.data.oilDir === 'string' && b.modified) render(vim, b);
    return;
  }
  const colors = { CREATE: '#50fa7b', DELETE: '#ff5555', MOVE: '#ffb86c', COPY: '#8be9fd' };
  const slash = (a: Action, p: string) => p + (a.dir ? '/' : '');
  const float = {
    id: 'oil-confirm',
    title: 'Confirm',
    anchor: 'center' as const,
    width: 56,
    lines: actions.map(a => ({
      text: ` ${a.type.padEnd(7)} ${slash(a, a.path)}${a.dest ? ' -> ' + slash(a, a.dest) : ''}`,
      color: colors[a.type],
    })),
    footer: '[Y]es  [N]o',
  };
  vim.floats.push(float);
  const close = () => {
    vim.floats = vim.floats.filter(f => f !== float);
    vim.modal = null;
  };
  vim.modal = key => {
    if (key === 'y' || key === 'Y') {
      close();
      apply(vim, actions);
    } else if (['n', 'N', 'q', '<Esc>', '<C-c>'].includes(key)) close();
    return true;
  };
}

// ---- the plugin ------------------------------------------------------------------------------------------

export const oil: Plugin = {
  name: 'oil',
  setup: vim => {
    vim.map(['n'], '-', () => {
      const p = parentOf(vim);
      if (!p) fail();
      openDir(vim, p.dir, p.focus);
    });
    vim.defineEx('Oil', 3, a => {
      const arg = a.arg.replace(/--float\s*/, '').trim();
      if (arg) return openDir(vim, arg);
      const p = parentOf(vim);
      openDir(vim, typeof vim.buf.data.oilDir === 'string' ? vim.buf.data.oilDir : p?.dir ?? '', p?.focus);
    });
    // Hide the ids and colour directories.
    vim.decorators.push((buf): Decoration | null => {
      if (typeof buf.data.oilDir !== 'string') return null;
      const conceal = new Map<number, number>();
      const hl: NonNullable<Decoration['hl']> = [];
      buf.lines.forEach((t, l) => {
        const n = nameCol(t);
        if (n) conceal.set(l, n);
        if (t.endsWith('/')) hl.push({ line: l, start: n, end: t.length, color: DIR_COLOR });
      });
      return { conceal, hl };
    });
    // Like oil's constrain_cursor: keep the cursor off the hidden id.
    vim.cursorHooks.push(() => {
      if (typeof vim.buf.data.oilDir !== 'string' || (vim.mode !== 'normal' && vim.mode !== 'insert')) return;
      const n = nameCol(vim.line());
      if (vim.cursor.col < n) {
        vim.win.cursor.col = n;
        vim.win.want = n;
      }
    });
  },
};
