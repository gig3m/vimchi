// harpoon (harpoon2) with the README's keymaps: <leader>a adds the current
// file, <C-e> toggles the quick menu (an editable float: dd, p, reorder, then
// q / <Esc> saves; <CR> opens; <C-v> / <C-x> / <C-t> open in splits / a tab),
// and <leader>1..4 jump to entries (the README uses <C-h/t/n/s>). Each entry
// remembers the cursor position it was left at.

import { Buffer } from '../buffer';
import type { Float, Plugin, Vim } from '../editor';
import { Window } from '../layout';
import { pos } from '../types';

type Item = { value: string; row: number; col: number };
type State = { list: Item[]; menu: { win: Window; prev: Window; float: Float } | null };

function state(vim: Vim): State {
  const raw = (vim.pluginData.harpoon ??= { list: [] }) as { list: (Item | string)[]; menu?: State['menu'] };
  raw.list = raw.list.map(i => (typeof i === 'string' ? { value: i, row: 0, col: 0 } : i));
  raw.menu ??= null;
  return raw as State;
}

/** The harpooned file paths, in order (lessons check this). */
export const harpoonList = (vim: Vim) => state(vim).list.map(i => i.value);

function remember(vim: Vim) {
  const it = state(vim).list.find(i => i.value === vim.buf.name);
  if (it) {
    it.row = vim.cursor.line;
    it.col = vim.cursor.col;
  }
}

function select(vim: Vim, idx: number, how: 'edit' | 'split' | 'vsplit' | 'tab' = 'edit') {
  const it = state(vim).list[idx];
  if (!it) return;
  if (vim.fs.read(it.value) == null && !vim.findBuffer(it.value)) {
    vim.msg(`harpoon: ${it.value} does not exist`, 'error');
    return;
  }
  remember(vim);
  if (how === 'split') vim.splitWindow('col');
  if (how === 'vsplit') vim.splitWindow('row');
  if (how === 'tab') vim.newTab();
  vim.edit(it.value);
  vim.setCursor(pos(Math.min(it.row, vim.buf.lineCount - 1), it.col));
}

function closeMenu(vim: Vim) {
  const st = state(vim);
  const m = st.menu;
  if (!m) return;
  if (vim.mode === 'insert' || vim.mode === 'replace') vim.leaveInsert();
  const old = new Map(st.list.map(i => [i.value, i]));
  st.list = m.win.buf.lines.map(l => l.trim()).filter(Boolean).map(v => old.get(v) ?? { value: v, row: 0, col: 0 });
  vim.floats = vim.floats.filter(f => f !== m.float);
  st.menu = null;
  const wins = vim.tab.windows();
  vim.tab.cur = wins.includes(m.prev) ? m.prev : wins[0];
}

function openMenu(vim: Vim) {
  const st = state(vim);
  remember(vim);
  const buf = new Buffer('harpoon menu', st.list.map(i => i.value), { kind: 'plugin', filetype: 'harpoon' });
  buf.listed = false;
  buf.modified = false;
  buf.data.onWrite = () => { buf.modified = false; };
  const win = new Window(buf);
  win.height = 8;
  win.width = 60;
  const cur = st.list.findIndex(i => i.value === vim.buf.name);
  win.cursor = pos(Math.max(0, cur), 0);
  const float: Float = { id: 'harpoon', title: 'Harpoon', anchor: 'center', width: 60, lines: [], win };
  st.menu = { win, prev: vim.win, float };
  vim.floats.push(float);
  vim.tab.prev = vim.win;
  vim.tab.cur = win;
  const L = (lhs: string, fn: () => void) => vim.mapLocal(buf, ['n'], lhs, () => fn());
  L('q', () => closeMenu(vim));
  L('<Esc>', () => closeMenu(vim));
  L('<C-e>', () => closeMenu(vim));
  L('<C-c>', () => closeMenu(vim));
  L('<C-w>', () => closeMenu(vim));
  const open = (how: 'edit' | 'split' | 'vsplit' | 'tab') => () => {
    const value = vim.line().trim();
    closeMenu(vim);
    const idx = state(vim).list.findIndex(i => i.value === value);
    if (idx >= 0) select(vim, idx, how);
  };
  L('<CR>', open('edit'));
  L('<C-v>', open('vsplit'));
  L('<C-x>', open('split'));
  L('<C-t>', open('tab'));
}

export const harpoon: Plugin = {
  name: 'harpoon',
  setup: vim => {
    vim.map(['n'], '<leader>a', () => {
      const st = state(vim);
      const b = vim.buf;
      if (b.kind !== 'file' || b.name === '[No Name]' || st.list.some(i => i.value === b.name)) return;
      st.list.push({ value: b.name, row: vim.cursor.line, col: vim.cursor.col });
    });
    vim.map(['n'], '<C-e>', () => (state(vim).menu ? closeMenu(vim) : openMenu(vim)));
    for (let n = 1; n <= 4; n++) vim.map(['n'], `<leader>${n}`, () => select(vim, n - 1));
  },
};
