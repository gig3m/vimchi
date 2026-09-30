// grug-far.nvim, reduced to its outcome: <leader>sr, a search word (the keyword under the cursor
// by default), a replacement, and a whole-word replace across the project with a summary.
import type { Float, Plugin, Vim } from '../editor';

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function replaceEverywhere(vim: Vim, word: string, repl: string) {
  const re = new RegExp(`\\b${escapeRe(word)}\\b`, 'g');
  let n = 0, files = 0;
  for (const path of vim.fs.list()) {
    // An open buffer is the truth for its file (it may hold unsaved edits); the disk copy otherwise.
    const buf = vim.findBuffer(path);
    const text = buf ? buf.lines.join('\n') + '\n' : vim.fs.read(path);
    if (text == null) continue;
    const count = (text.match(re) ?? []).length;
    if (!count) continue;
    n += count; files++;
    const next = text.replace(re, repl);
    if (buf) {
      if (buf === vim.buf) vim.beginChange();
      else buf.snapshot({ line: 0, col: 0 });
      buf.lines = next.replace(/\n$/, '').split('\n');
    }
    vim.fs.write(path, next);
  }
  const float: Float = {
    id: 'grug-far', title: 'grug-far', anchor: 'center', width: 60,
    lines: [{ text: ` ${word} → ${repl}` }, { text: ` ${n} replacements in ${files} files`, color: '#50fa7b' }],
    footer: 'q: close',
  };
  vim.floats.push(float);
  vim.modal = key => {
    if (['q', '<CR>', '<Esc>', '<C-c>'].includes(key)) { vim.floats = vim.floats.filter(f => f !== float); vim.modal = null; }
    return true;
  };
}

function askReplacement(vim: Vim, word: string) {
  vim.openCmdline('input', '', repl => { if (repl !== '') replaceEverywhere(vim, word, repl); }, undefined, `Replace "${word}" across the project with: `);
}

export const grugfar: Plugin = {
  name: 'grugfar',
  setup: vim => {
    vim.map(['n'], '<leader>sr', () => {
      const l = vim.line();
      const m = [...l.matchAll(/[A-Za-z0-9_]+/g)].find(x => x.index! <= vim.cursor.col && vim.cursor.col < x.index! + x[0].length);
      if (m) askReplacement(vim, m[0]);
      else vim.openCmdline('input', '', word => { if (word) askReplacement(vim, word); }, undefined, 'Search: ');
    });
  },
};
