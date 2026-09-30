import { Code } from './Code';

type Sim = { name: string; plugin: string; url: string; keys: string; use: string };

/** The plugin simulations the engine ships, with the real projects they stand in for. */
export const SIMULATIONS: Sim[] = [
  { name: 'surround', plugin: 'mini.surround', url: 'https://github.com/echasnovski/mini.surround', keys: 'sa sd sr sf', use: 'add, change, delete and find quotes, brackets and tags' },
  { name: 'mini-ai', plugin: 'mini.ai', url: 'https://github.com/echasnovski/mini.ai', keys: 'if af ic ac ii ai ia aa', use: 'function, class, indent and argument text objects' },
  { name: 'flash', plugin: 'flash.nvim', url: 'https://github.com/folke/flash.nvim', keys: 's S', use: 'label jumps and treesitter selection' },
  { name: 'lsp', plugin: "Neovim's built-in LSP client", url: 'https://neovim.io/doc/user/lsp.html', keys: 'gd K grr grn gra [d gO', use: 'definitions, hover, references, rename, code actions, diagnostics, symbols' },
  { name: 'telescope', plugin: 'telescope.nvim', url: 'https://github.com/nvim-telescope/telescope.nvim', keys: '␣sf ␣sg ␣sw ␣sh ␣sk ␣␣ ␣/', use: 'the pickers (LazyVim ships snacks.picker on the same keys)' },
  { name: 'which-key', plugin: 'which-key.nvim', url: 'https://github.com/folke/which-key.nvim', keys: '␣', use: 'discovering keys from the popup' },
  { name: 'oil', plugin: 'oil.nvim', url: 'https://github.com/stevearc/oil.nvim', keys: '- CR dd cw :w', use: 'editing the file tree as a buffer' },
  { name: 'gitsigns', plugin: 'gitsigns.nvim', url: 'https://github.com/lewis6991/gitsigns.nvim', keys: ']h [h ␣ghs ␣ghr', use: 'moving between hunks, staging and resetting them' },
  { name: 'lazygit', plugin: 'lazygit', url: 'https://github.com/jesseduffield/lazygit', keys: '␣gg', use: 'committing from inside Neovim' },
  { name: 'grugfar', plugin: 'grug-far.nvim', url: 'https://github.com/MagicDuck/grug-far.nvim', keys: '␣sr', use: 'find and replace across a project' },
  { name: 'snippets', plugin: 'LuaSnip', url: 'https://github.com/L3MON4D3/LuaSnip', keys: 'Tab S-Tab', use: 'expanding a snippet and moving between its fields' },
  { name: 'conform', plugin: 'conform.nvim', url: 'https://github.com/stevearc/conform.nvim', keys: '␣f ␣cf', use: 'formatting a file or a range' },
];

const STARTERS = [
  { name: 'LazyVim', url: 'https://www.lazyvim.org/keymaps' },
  { name: 'kickstart.nvim', url: 'https://github.com/nvim-lua/kickstart.nvim' },
];

export function About() {
  return (
    <div className="about">
      <h1 className="prof-name">About vimchi</h1>
      <p className="prof-sub">A browser tutor for the Neovim you will actually run.</p>
      <p>
        Every key here behaves the way it does in a stock <a href="https://neovim.io" target="_blank" rel="noopener noreferrer">Neovim</a>:
        the editor is a purpose-built engine, and every practice round is replayed in real Neovim to
        check the text, the cursor and the registers agree. Where the two differ, the engine is wrong
        and gets fixed.
      </p>
      <h2>Two starters, one keymap</h2>
      <p>
        Beyond the built-ins, the lessons follow the two mainstream starter configs,{' '}
        {STARTERS.map((s, i) => (
          <span key={s.name}>
            <a href={s.url} target="_blank" rel="noopener noreferrer">{s.name}</a>{i === 0 ? ' and ' : '. '}
          </span>
        ))}
        A key is taught only when both would give it to you, or when the lesson can name what the other
        one binds instead. Where they collide (<Code>Space Space</Code> is files in one and buffers in the
        other), the aside says so.
      </p>
      <h2>The plugins the lessons stand in for</h2>
      <p>
        The engine simulates the visible behaviour of these projects, just enough to practise their keys.
        None of their code runs here; install the real thing and the muscle memory carries over.
      </p>
      <table className="about-table">
        <thead>
          <tr><th>Plugin</th><th>Keys</th><th>Used for</th></tr>
        </thead>
        <tbody>
          {SIMULATIONS.map(s => (
            <tr key={s.name}>
              <td><a href={s.url} target="_blank" rel="noopener noreferrer">{s.plugin}</a></td>
              <td className="about-keys">{s.keys.split(' ').map(k => <Code key={k}>{k}</Code>)}</td>
              <td>{s.use}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h2>Thanks</h2>
      <p>
        To the authors of those plugins, to the LazyVim and kickstart maintainers, and to the Neovim
        team. vimchi is made by <a href="https://buymeacoffee.com/kylearrington" target="_blank" rel="noopener noreferrer">Kyle Arrington</a>.
      </p>
    </div>
  );
}
