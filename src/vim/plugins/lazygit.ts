// lazygit as LazyVim opens it: <leader>gg floats the status view; q closes. The tutor shows the
// changed files from the git model and teaches the open/close habit, not lazygit's own keys.
import type { Float, Plugin, Vim } from '../editor';
import { status } from './git-model';

type State = { opened: number; closed: number };
const state = (vim: Vim): State => (vim.pluginData.lazygit ??= { opened: 0, closed: 0 }) as State;

function open(vim: Vim) {
  if (vim.modal) return;
  const st = status(vim);
  const row = (code: string, path: string, color: string) => ({ text: ` ${code} ${path}`, color });
  const lines = [
    { text: ' Files', color: '#bd93f9' },
    ...st.staged.map(c => row('A ', c.path, '#50fa7b')),
    ...st.unstaged.map(c => row(' M', c.path, '#ffb86c')),
    ...st.untracked.map(c => row('??', c.path, '#8be9fd')),
    ...(st.staged.length + st.unstaged.length + st.untracked.length === 0 ? [{ text: ' (clean)' }] : []),
  ];
  const float: Float = { id: 'lazygit', title: 'lazygit', anchor: 'center', width: 72, lines, footer: 'q: quit   ?: keybindings' };
  vim.floats.push(float);
  state(vim).opened++;
  vim.modal = key => {
    if (key === 'q' || key === '<Esc>' || key === '<C-c>') {
      vim.floats = vim.floats.filter(f => f !== float);
      vim.modal = null;
      state(vim).closed++;
    }
    return true;
  };
}

export const lazygit: Plugin = { name: 'lazygit', setup: vim => { vim.map(['n'], '<leader>gg', () => open(vim)); } };
