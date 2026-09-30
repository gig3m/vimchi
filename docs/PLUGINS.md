# Writing plugins

A plugin is `{ name, setup(vim) }` in `src/vim/plugins/<id>.ts`, registered in
`src/vim/plugins/index.ts`. Lessons turn it on with `setup: { plugins: ['surround'] }`. Plugins
emulate the real thing's **keys and visible behaviour** faithfully enough to practise on; they don't
need every option. Follow the default keymaps of the named plugin (README defaults), and Neovim 0.11
defaults where they apply. Where the two starters map a plugin differently, follow LazyVim and name
kickstart's keys in the aside (mini.surround is on `gsa` / `gsd` / `gsr` / `gsf` / `gsF`, LazyVim's
extra; kickstart's bare `sa` / `sd` / `sr` / `sf` are prose only).

**flash is always on.** `createVim` (`src/lessons/runtime.ts`, `ALWAYS_PLUGINS`) loads it in every
lesson, Reps run, Warm-up and challenge, last, so its `s` / `S` win over any other plugin's (such as
nvim-surround's visual `S`). No other plugin may bind a key starting with `s` or `S`. Lessons that
teach flash still list it (`plugins: ['flash']`), which also keeps their rounds out of the Neovim
oracle; any other round's reference solution must not use `s` or `S` (real `nvim --clean` has no
flash, and `run.sh` would catch it).

## Registering commands

```ts
vim.defineOperator('ys', { change: true, argAfter: 'surround', run: (range, ctx) => { … } });
vim.defineMotion('s', { run: ctx => ({ pos, inclusive: true, jump: true }) });   // n, v and o modes
vim.defineAction('ds', { arg: 'char', change: true, run: ctx => { … ctx.arg … } }, ['n']);
vim.defineObject('ia', (objCtx, inner) => ({ start, end, kind: 'char' }));       // o and v modes; "i…"/"a…"
vim.map(['n'], '<leader>ff', ctx => openPicker());                                 // <leader> is Space
vim.mapLocal(buf, ['n'], 's', ctx => stageLine());                                 // buffer-local
vim.mapInsert('<C-x>', v => …);
vim.defineEx('Git', 3, args => { … args.arg, args.bang, args.range … });
```

An action that opens a modal (`vim.modal = key => …`) whose keys finish the command, like flash's
`s` + pattern + label, calls `vim.continueInModal()` before opening it and
`vim.completeModal('motion' | 'visual' | …)` on success. The whole run then reports as one
`lastCommand` of that kind when the modal closes (`other` if cancelled), so the coach weighs a jump
against plain motions instead of seeing a modal break.

- `change: true` gives undo and `.`-repeat for free (the keys are replayed).
- `argAfter: 'char'` reads one key after the motion (`ys{motion}{char}`); `'surround'` also accepts
  `t<tag>` / `<tag>` ending in `>` or `<CR>`, and `f` + name + `<CR>`. The value arrives as
  `vim.opArgument` (and in `ctx.keys` after a `\u0000`).
- Doubled operators (`yss`, `cxx`, `gcc`) work automatically: the range is `count` whole lines.
- Operators get an inclusive `Range` (`kind: 'char' | 'line' | 'block'`).
- Throw with `fail('E…: message')` to beep and abort (also stops macros).

## Editing

`vim.getText(range)`, `vim.deleteRange(range)`, `vim.insertText(pos, text)` (returns end pos),
`vim.insertLines(at, lines)`, `vim.buf.splice(start, count, lines)`, `vim.buf.setLine(n, text)`,
`vim.setCursor(pos)`, `vim.startInsert(kind, pos)`, `vim.msg(text, kind)`,
`vim.registers.get/set/yank/delete`, `vim.getRegister(name)`.
Call `vim.beginChange()` before editing from anything not flagged `change` (ex commands, modal UIs).

## UI

- **Floating windows**: push a `Float` onto `vim.floats` (title, lines, `sel` row, `prompt`,
  `preview` pane, `anchor: 'center' | 'cursor' | 'top'`, `footer`). Remove it when done.
- **Modal key handling**: set `vim.modal = key => boolean`; return true to consume a key. Used by
  pickers and menus. Clear it (`null`) when the UI closes.
- **Prompts**: `vim.openCmdline('input', initial, onSubmit, onCancel, 'New Name: ')`.
- **Plugin buffers**: `new Buffer(name, lines, { kind: 'plugin', filetype })`, `vim.addBuffer(buf)`,
  then `vim.showBuffer(vim.win, buf)` or `vim.splitWindow('row' | 'col', buf)`. Keep state in
  `buf.data`; set `buf.data.onWrite = () => …` to handle `:w` (commit messages). Filetypes with
  colours: `fugitive`, `git`, `diff`, `gitcommit`, `qf`, `markdown`, `lua`, `typescript`, …
- **Decorations**: `vim.decorators.push((buf, win) => ({ signs, virt, hl, lineBg }))` for sign
  columns (gitsigns), virtual text (diagnostics) and highlights.
- `vim.pluginData` holds global plugin state; `vim.fs` is the project's virtual file system.

## Testing

Put tests in `src/vim/plugins/__tests__/<id>.test.ts`:

```ts
const vim = new Vim({ text: 'hello world', name: 'a.ts', plugins: [surround] });
vim.feedKeys('ysiw"');
expect(vim.buf.text()).toBe('"hello" world');
```

Use the real plugin's documented examples as test cases.
