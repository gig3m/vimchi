import { Code } from '../../components/Code';
import type { Section } from '../types';

export const configLiteracy: Section = {
  id: 'config-literacy',
  title: 'Config Literacy',
  band: 'deep',
  lessons: [
    {
      id: 'config-options',
      title: 'Options',
      chips: [':set', 'vim.opt'],
      keyCards: [
        { key: ':set', glyph: '⚙', label: 'set an option' },
        { key: ':set x?', glyph: '?', label: 'show its value' },
        { key: 'vim.opt', glyph: 'lua', label: 'the same, in Lua' },
      ],
      intro: (
        <>
          <p>
            Options change how Vim behaves. <Code>:set number</Code> turns one on, <Code>:set nonumber</Code> off,{' '}
            <Code>:set tabstop=4</Code> gives it a value and <Code>:set tabstop?</Code> shows the current one.
          </p>
          <p>
            In <Code>init.lua</Code> the same options are set with <Code>vim.opt.number = true</Code>. Try an option
            with <Code>:set</Code> first; put it in your config once you know you want it.
          </p>
        </>
      ),
      practice: total => <p>{total} questions on reading and writing options.</p>,
      aside: {
        title: 'Where was that set?',
        body: (
          <p>
            <Code>:verbose set shiftwidth?</Code> shows the value and the file and line that last changed it, which
            settles most "why is my indent 8?" mysteries.
          </p>
        ),
      },
      challenge: {
        kind: 'quiz',
        questions: [
          {
            prompt: 'Which command flips line numbers on if they are off, and off if they are on?',
            options: [':set number', ':set number!', ':set nonumber', ':set number?'],
            answer: 1,
            explain: 'A trailing ! toggles a boolean option. :set invnumber does the same.',
          },
          {
            prompt: 'How do you check what shiftwidth is set to right now?',
            options: [':set shiftwidth', ':set shiftwidth?', ':get shiftwidth', ':echo shiftwidth'],
            answer: 1,
            explain: 'For a number option :set shiftwidth shows it too, but for a boolean it would switch it on. The ? always just shows.',
          },
          {
            prompt: 'What is the Lua equivalent of :set expandtab shiftwidth=2?',
            options: [
              'vim.opt.expandtab = true; vim.opt.shiftwidth = 2',
              "vim.set('expandtab shiftwidth=2')",
              'vim.expandtab = true; vim.shiftwidth = 2',
              "vim.opt('expandtab', 'shiftwidth=2')",
            ],
            answer: 0,
            explain: 'Each option is a field on vim.opt. Booleans take true or false.',
          },
          {
            prompt: 'What does this line do?',
            code: "vim.opt.wildignore:append({ '*/node_modules/*' })",
            options: [
              'Replaces wildignore with node_modules',
              'Adds a pattern to the existing wildignore list',
              'Deletes node_modules from disk',
              'Only works in Vimscript',
            ],
            answer: 1,
            explain: 'List options have :append, :prepend and :remove, like :set wildignore+=… in Vimscript.',
          },
          {
            prompt: 'You want wrapping in one window only, leaving the others alone. Which command?',
            options: [':set wrap', ':setlocal wrap', ':setglobal wrap', ':set wrap!'],
            answer: 1,
            explain: ':setlocal changes the current window or buffer. In Lua it is vim.opt_local.wrap = true.',
          },
          {
            prompt: 'Which option makes y and p use the system clipboard by default?',
            options: ["clipboard = 'unnamedplus'", "register = '+'", 'paste = true', "yank = 'system'"],
            answer: 0,
            explain: "With clipboard=unnamedplus the unnamed register is the + register, so yy lands in the OS clipboard.",
          },
        ],
      },
    },
    {
      id: 'config-mappings',
      title: 'Mappings',
      chips: ['vim.keymap.set'],
      keyCards: [{ key: 'keymap.set', glyph: 'a→b', label: 'map keys', sub: '(mode, lhs, rhs, opts)' }],
      intro: (
        <>
          <p>
            <Code>vim.keymap.set(mode, lhs, rhs, opts)</Code> makes a mapping: in <Code>mode</Code>, typing{' '}
            <Code>lhs</Code> does <Code>rhs</Code>. The right side can be keys, a <Code>&lt;cmd&gt;…&lt;CR&gt;</Code>{' '}
            command or a Lua function.
          </p>
          <p>
            Most of any config is mappings. Read them and you know what a config's keys do, and where to change them.
          </p>
        </>
      ),
      practice: total => <p>{total} questions on reading mappings.</p>,
      aside: {
        title: 'What is mapped?',
        body: (
          <p>
            <Code>:map &lt;leader&gt;</Code> lists your leader mappings, and <Code>:verbose nmap gd</Code> shows what{' '}
            <Code>gd</Code> does and which file set it.
          </p>
        ),
      },
      challenge: {
        kind: 'quiz',
        questions: [
          {
            prompt: 'In which mode does this mapping apply?',
            code: "vim.keymap.set('x', '<leader>p', '\"_dP')",
            options: ['Normal', 'Visual (and not select)', 'Insert', 'Every mode'],
            answer: 1,
            explain: "'x' is visual mode only. 'v' would also include select mode; 'n' is normal, 'i' insert.",
          },
          {
            prompt: 'What does this do?',
            code: "vim.keymap.set('n', '<Esc>', '<cmd>nohlsearch<CR>')",
            options: [
              'Disables Escape in normal mode',
              'Pressing Escape in normal mode clears the search highlight',
              'Opens the command line with nohlsearch typed in',
              'Turns off hlsearch permanently',
            ],
            answer: 1,
            explain: '<cmd>…<CR> runs the command directly, without leaving the mode or showing the command line.',
          },
          {
            prompt: 'These two lines swap ; and :. Why does pressing ; not bounce back and forth forever?',
            code: "vim.keymap.set('n', ';', ':')\nvim.keymap.set('n', ':', ';')",
            options: [
              'It does; the config is broken',
              'vim.keymap.set is non-recursive: the right side uses the built-in keys',
              'Vim ignores the second mapping',
              'Mappings never apply to punctuation',
            ],
            answer: 1,
            explain: 'vim.keymap.set works like noremap unless you pass { remap = true }. With remap on, these two would loop.',
          },
          {
            prompt: 'What is desc for here?',
            code: "vim.keymap.set('n', '<leader>ff', builtin.find_files, {\n  desc = 'Find files',\n})",
            options: [
              'It is shown as a message when the mapping runs',
              'It labels the mapping in :map, which-key and pickers',
              'It sets the picker title',
              'Nothing; Neovim ignores it',
            ],
            answer: 1,
            explain: 'desc is documentation. Tools like which-key and :Telescope keymaps show it.',
          },
          {
            prompt: 'Which mapping only exists in the current buffer?',
            options: [
              "vim.keymap.set('n', 'q', '<cmd>close<CR>', { buffer = true })",
              "vim.keymap.set('n', 'q', '<cmd>close<CR>', { silent = true })",
              "vim.keymap.set('n', 'q', '<cmd>close<CR>', { local = true })",
              "vim.keymap.set('b', 'q', '<cmd>close<CR>')",
            ],
            answer: 0,
            explain: 'buffer = true (or a buffer number) makes it buffer-local. Plugins use this for their own windows.',
          },
          {
            prompt: 'How do you apply one mapping to both normal and visual mode?',
            options: [
              "vim.keymap.set('nv', 'H', '^')",
              "vim.keymap.set({ 'n', 'x' }, 'H', '^')",
              "vim.keymap.set('n|x', 'H', '^')",
              "vim.keymap.set('all', 'H', '^')",
            ],
            answer: 1,
            explain: 'The mode argument can be a list of mode letters.',
          },
        ],
      },
    },
    {
      id: 'config-leader',
      title: 'The Leader Key',
      chips: ['<leader>'],
      keyCards: [{ key: 'leader', glyph: '␣', label: 'your prefix key', sub: 'often Space' }],
      intro: (
        <>
          <p>
            <Code>&lt;leader&gt;</Code> in a mapping stands for a key you choose. Set <Code>vim.g.mapleader = ' '</Code>{' '}
            and <Code>&lt;leader&gt;ff</Code> means Space, f, f.
          </p>
          <p>
            Vim's own commands use almost every key. The leader gives your mappings a prefix of their own, so they don't
            clash with built-ins.
          </p>
        </>
      ),
      practice: total => <p>{total} questions on the leader key.</p>,
      aside: {
        title: 'Take your time',
        body: (
          <p>
            After the leader, Vim waits <Code>timeoutlen</Code> milliseconds (1000 by default) for the rest of the
            mapping. Plugins like which-key show what can come next while it waits.
          </p>
        ),
      },
      challenge: {
        kind: 'quiz',
        questions: [
          {
            prompt: 'With this config, what do you type to trigger <leader>w?',
            code: "vim.g.mapleader = ' '\nvim.keymap.set('n', '<leader>w', '<cmd>write<CR>')",
            options: ['\\ then w', 'Space then w', 'Ctrl-w', 'Space and w together'],
            answer: 1,
            explain: 'The leader is typed first, then the rest of the mapping, like any key sequence.',
          },
          {
            prompt: 'What is the leader if your config never sets it?',
            options: ['Space', 'Backslash', 'Comma', 'There is none'],
            answer: 1,
            explain: 'The default leader is \\. Most configs change it, usually to Space.',
          },
          {
            prompt: 'Why is this order a problem?',
            code: "vim.keymap.set('n', '<leader>e', vim.cmd.Explore)\nvim.g.mapleader = ' '",
            options: [
              'It is fine; the order does not matter',
              'The mapping was made with the old leader (\\), so Space e does nothing',
              'vim.g.mapleader must be a number',
              'Space cannot be a leader',
            ],
            answer: 1,
            explain: '<leader> is replaced when the mapping is defined. Set mapleader first, before plugins load too.',
          },
          {
            prompt: 'What is <localleader> for?',
            options: [
              'Mappings that only apply to certain file types or buffers',
              'The leader key in insert mode',
              'A second leader for the current window',
              'Mappings that are only active in splits',
            ],
            answer: 0,
            explain: 'Set with vim.g.maplocalleader. Filetype plugins (Markdown, LaTeX, REPLs) put their mappings under it.',
          },
          {
            prompt: 'Space is your leader. What does Space do on its own in normal mode, before you remap it?',
            options: ['Nothing', 'Moves the cursor right, like l', 'Scrolls down a page', 'Enters insert mode'],
            answer: 1,
            explain: 'Space is a synonym for l, which is why it makes a good leader: nobody misses it.',
          },
        ],
      },
    },
    {
      id: 'config-init-lua',
      title: 'Reading init.lua',
      chips: ['init.lua'],
      keyCards: [
        { key: 'init.lua', glyph: 'lua', label: 'your config', sub: '~/.config/nvim/' },
        { key: 'require', glyph: '⇢', label: 'load a module', sub: 'from lua/' },
      ],
      intro: (
        <>
          <p>
            Neovim runs <Code>~/.config/nvim/init.lua</Code> at startup. It's plain Lua: options, mappings,
            autocommands and <Code>require()</Code> calls that load the rest of the config from the <Code>lua/</Code>{' '}
            folder.
          </p>
          <p>
            You don't need to write Lua to read it. Knowing the handful of shapes that appear in every config lets you
            borrow from other people's configs and fix your own.
          </p>
        </>
      ),
      practice: total => <p>{total} snippets from real configs. What does each one do?</p>,
      aside: {
        title: 'Try a line without restarting',
        body: (
          <p>
            <Code>:lua vim.opt.cursorline = true</Code> runs one line of Lua. <Code>:source %</Code> reruns the file
            you're editing.
          </p>
        ),
      },
      challenge: {
        kind: 'quiz',
        questions: [
          {
            prompt: 'Which file does this load?',
            code: "require('config.keymaps')",
            options: [
              '~/.config/nvim/config.keymaps.lua',
              '~/.config/nvim/lua/config/keymaps.lua',
              '~/.config/nvim/keymaps.lua',
              'A plugin called config.keymaps',
            ],
            answer: 1,
            explain: 'require looks under lua/ and turns dots into folders.',
          },
          {
            prompt: 'What does this do?',
            code: "vim.api.nvim_create_autocmd('TextYankPost', {\n  callback = function()\n    vim.hl.on_yank()\n  end,\n})",
            options: [
              'Yanks text whenever a file is saved',
              'Briefly highlights the text you just yanked',
              'Copies every yank to the clipboard',
              'Disables yanking in some buffers',
            ],
            answer: 1,
            explain: 'An autocommand runs a function on an event. TextYankPost fires after every yank.',
          },
          {
            prompt: 'What kind of thing is this?',
            code: "return {\n  'nvim-telescope/telescope.nvim',\n  dependencies = { 'nvim-lua/plenary.nvim' },\n  keys = {\n    { '<leader>ff', '<cmd>Telescope find_files<CR>' },\n  },\n}",
            options: [
              'A lazy.nvim plugin spec',
              'A list of options',
              'A Telescope picker',
              'An LSP server config',
            ],
            answer: 0,
            explain: 'A table naming a GitHub repo, its dependencies and the keys that load it is how lazy.nvim describes a plugin.',
          },
          {
            prompt: 'What is the difference between these two lines?',
            code: 'vim.o.number = true\nvim.opt.number = true',
            options: [
              'vim.o is for Vim, vim.opt for Neovim',
              'For a simple option like this, none: both set number',
              'vim.o only sets it for this buffer',
              'vim.opt is deprecated',
            ],
            answer: 1,
            explain: 'vim.o takes plain values. vim.opt adds helpers like :append for list and map options.',
          },
          {
            prompt: 'What does this line do?',
            code: "vim.keymap.set('n', '<leader>e', vim.diagnostic.open_float)",
            options: [
              'Runs open_float once at startup',
              'Space e opens the diagnostic under the cursor in a float',
              'Shows an error when you press Space e',
              'Opens the file explorer',
            ],
            answer: 1,
            explain: 'The right side is a Lua function, called each time the keys are pressed. No parentheses, so it is not called yet.',
          },
          {
            prompt: 'Neovim 0.11 lets you set up a language server like this. What does it do?',
            code: "vim.lsp.enable('lua_ls')",
            options: [
              'Installs lua_ls',
              'Starts lua_ls for matching files, using its config from lsp/lua_ls.lua',
              'Enables Lua syntax highlighting',
              'Turns on LSP logging',
            ],
            answer: 1,
            explain: 'vim.lsp.enable starts the server when a matching file opens. You still install the server yourself (or with mason.nvim).',
          },
        ],
      },
    },
  ],
};
