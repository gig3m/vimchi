// which-key.nvim: start a key sequence with the leader and a popup lists every key that can come
// next, with its description; a group (a prefix of more keys) shows as "+name". Typing the next key
// narrows the popup to that group, and finishing a mapping runs it and closes the popup. <BS> goes
// back up a level, <Esc> closes it and cancels the keys.
//
// kickstart sets `delay = 0`, so the popup is up as soon as the leader is pressed; LazyVim waits
// 200 ms. The tutor has no clock, so it always shows at once. Only keys with a description are
// listed (see keymap-descs.ts), and only keys some enabled plugin actually maps.

import type { Float, Plugin, Vim } from '../editor';
import type { Key } from '../keys';
import { descOf, groupOf, showKeys } from './keymap-descs';

const ID = 'which-key';
const GROUP_COLOR = '#bd93f9';

export type WhichKeyItem = { key: Key; text: string; group: boolean };

/** What can follow `prefix` in a mode, described: plain keys first, then groups, each sorted. */
export function whichKeyItems(vim: Vim, mode: 'n' | 'v', prefix: Key[]): WhichKeyItem[] {
  const defs = vim.definedKeys(mode).filter(k => k.length > prefix.length && prefix.every((p, i) => k[i] === p));
  const nexts = [...new Set(defs.map(d => d[prefix.length]))];
  const items: WhichKeyItem[] = [];
  for (const next of nexts) {
    const seq = [...prefix, next];
    const below = defs.filter(d => d.length > seq.length && seq.every((p, i) => d[i] === p));
    const exact = defs.some(d => d.length === seq.length && seq.every((p, i) => d[i] === p));
    const described = below.filter(d => descOf(vim, d)).length;
    if (described) items.push({ key: next, text: `+${groupOf(vim, seq) ?? `${described} keymaps`}`, group: true });
    else if (exact && descOf(vim, seq)) items.push({ key: next, text: descOf(vim, seq)!, group: false });
  }
  const rank = (s: string) => s.toLowerCase();
  return items.sort((a, b) => Number(a.group) - Number(b.group) || (rank(a.key) < rank(b.key) ? -1 : rank(a.key) > rank(b.key) ? 1 : a.key < b.key ? -1 : 1));
}

export const whichKey: Plugin = {
  name: 'which-key',
  setup(vim) {
    let float: Float | null = null;
    const hide = () => {
      if (float) vim.floats = vim.floats.filter(f => f !== float);
      float = null;
      if (vim.modal === modal) vim.modal = null;
    };
    const modal = (key: Key) => {
      if (key === '<Esc>') {
        vim.pending.length = 0;
        hide();
        return true;
      }
      if (key === '<BS>') {
        vim.pending.pop();
        return true;
      }
      // Any other key goes to the editor, which finishes or extends the sequence.
      vim.modal = null;
      return false;
    };
    vim.cursorHooks.push(() => {
      const p = vim.pending;
      const mode = vim.mode === 'normal' ? 'n' : vim.mode === 'visual' ? 'v' : null;
      const items = mode && p.length && p[0] === vim.leader && (!vim.modal || vim.modal === modal) ? whichKeyItems(vim, mode, p) : [];
      if (!items.length) return hide();
      const w = Math.max(...items.map(i => showKeys([i.key]).length));
      const lines = items.map(i => ({ text: `${showKeys([i.key]).padEnd(w)} ➜ ${i.text}`, color: i.group ? GROUP_COLOR : undefined }));
      const f: Float = {
        id: ID, title: showKeys(p), anchor: 'center', lines, footer: '<esc> close  <bs> back',
        width: Math.min(60, Math.max(28, ...lines.map(l => l.text.length + 2))),
      };
      if (float) vim.floats = vim.floats.filter(x => x !== float);
      float = f;
      vim.floats.push(f);
      vim.modal = modal;
    });
  },
};
