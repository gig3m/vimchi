// Keymap descriptions (the `desc` a config gives vim.keymap.set), shared by which-key's popup and
// Telescope's keymaps picker. Leader keys follow kickstart.nvim's init.lua; the rest are the
// descriptions Neovim 0.11 gives its own default mappings. A key is only ever listed when some
// plugin or the engine actually defines it, so a lesson shows just the keys it can use.

import type { Vim } from '../editor';
import { type Key, parseKeys } from '../keys';

export const DESCS: Record<string, string> = {
  // kickstart: Telescope
  '<leader>sh': '[S]earch [H]elp',
  '<leader>sk': '[S]earch [K]eymaps',
  '<leader>sf': '[S]earch [F]iles',
  '<leader>sw': '[S]earch current [W]ord',
  '<leader>sg': '[S]earch by [G]rep',
  '<leader><leader>': '[ ] Find existing buffers',
  '<leader>/': '[/] Fuzzily search in current buffer',
  // kickstart: conform, gitsigns
  '<leader>f': '[F]ormat buffer',
  '<leader>hs': 'git [s]tage hunk',
  '<leader>hr': 'git [r]eset hunk',
  '<leader>hS': 'git [S]tage buffer',
  '<leader>hR': 'git [R]eset buffer',
  '<leader>hp': 'git [p]review hunk',
  '<leader>hb': 'git [b]lame line',
  // LazyVim keys the tutor's plugins also map
  '<leader>cf': 'Format',
  '<leader>gg': 'Lazygit (Root Dir)',
  '<leader>sr': 'Search and Replace',
  // Neovim 0.11 defaults
  gcc: 'Toggle comment line',
  gc: 'Toggle comment',
  grn: 'vim.lsp.buf.rename()',
  gra: 'vim.lsp.buf.code_action()',
  grr: 'vim.lsp.buf.references()',
  gri: 'vim.lsp.buf.implementation()',
  gO: 'vim.lsp.buf.document_symbol()',
  ']d': 'Jump to the next diagnostic',
  '[d': 'Jump to the previous diagnostic',
  ']q': ':cnext',
  '[q': ':cprevious',
  ']b': ':bnext',
  '[b': ':bprevious',
};

/** which-key groups (kickstart's spec). */
export const GROUPS: Record<string, string> = {
  '<leader>s': '[S]earch',
  '<leader>t': '[T]oggle',
  '<leader>h': 'Git [H]unk',
  '<leader>c': 'code',
  '<leader>g': 'git',
};

const id = (keys: Key[]) => keys.join('\x1f');

function index(vim: Vim, table: Record<string, string>) {
  const out = new Map<string, string>();
  for (const [lhs, d] of Object.entries(table)) out.set(id(parseKeys(lhs).map(k => (k === '<leader>' ? vim.leader : k))), d);
  return out;
}

/** The description of a key sequence, if it has one. */
export const descOf = (vim: Vim, keys: Key[]) => index(vim, DESCS).get(id(keys));
/** The group name of a prefix, if it has one. */
export const groupOf = (vim: Vim, keys: Key[]) => index(vim, GROUPS).get(id(keys));

/** Keys as a person reads them: the leader as <Space>. */
export const showKeys = (keys: Key[]) => keys.map(k => (k === ' ' ? '<Space>' : k)).join('');
