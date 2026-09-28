// ReplaceWithRegister (inkarkat/vim-ReplaceWithRegister):
//   ["x]gr{motion}  replace the text with register x (default ")     ["x]grr  the whole line
//   {Visual}["x]gr  replace the selection
// The replaced text is dropped, so the register survives for the next gr. Enabling the plugin
// takes over Neovim 0.11's gr prefix (grn, grr, gra, gri are LSP maps there).

import type { Plugin } from '../editor';
import { type Range, fail, pos } from '../types';

export const replaceWithRegister: Plugin = {
  name: 'replace-with-register',
  setup: vim => {
    const run = (r: Range, c: { reg: string | null }) => {
      const reg = vim.getRegister(c.reg);
      if (!reg.text) fail(`E353: Nothing in register ${c.reg ?? '"'}`);
      const L = vim.lines;
      if (r.kind === 'line') {
        const lines = reg.text.replace(/\n$/, '').split('\n');
        vim.buf.splice(r.start.line, r.end.line - r.start.line + 1, lines);
        vim.buf.recordChange(pos(r.start.line, 0));
        const t = vim.line(r.start.line);
        vim.setCursor(pos(r.start.line, t.length - t.trimStart().length));
        return;
      }
      if (r.kind === 'block') {
        const c1 = Math.min(r.start.col, r.end.col), c2 = Math.max(r.start.col, r.end.col);
        const parts = reg.text.replace(/\n$/, '').split('\n');
        for (let l = r.start.line; l <= r.end.line; l++) {
          const t = vim.line(l);
          vim.buf.setLine(l, t.slice(0, c1) + (parts[Math.min(l - r.start.line, parts.length - 1)]) + t.slice(r.toEol ? t.length : c2 + 1));
        }
        vim.buf.recordChange(pos(r.start.line, c1));
        vim.setCursor(pos(r.start.line, c1));
        return;
      }
      // Characterwise: a linewise register goes in without its trailing newline.
      const text = reg.kind === 'line' ? reg.text.replace(/\n$/, '') : reg.text;
      const endLen = L[r.end.line].length;
      const after = L[r.end.line].slice(Math.min(endLen, r.end.col + 1));
      const joined = L[r.start.line].slice(0, r.start.col) + text + after;
      const joinNext = r.end.col >= endLen && r.end.line < L.length - 1;
      vim.buf.splice(r.start.line, r.end.line - r.start.line + 1 + (joinNext ? 1 : 0), (joinNext ? joined + L[r.end.line + 1] : joined).split('\n'));
      vim.buf.recordChange(r.start);
      vim.setCursor(r.start);
    };
    vim.defineOperator('gr', { change: true, run }, ['n', 'v']);
  },
};
