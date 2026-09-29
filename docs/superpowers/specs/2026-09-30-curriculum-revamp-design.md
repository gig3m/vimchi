# Curriculum revamp — the new-to-Vim pathway to power user

Status: approved design, 2026-09-30. Implementation plan: see `docs/superpowers/plans/`.

## Purpose

Re-sequence and prune the curriculum so it follows the pathway the field agrees on, and so
every plugin lesson teaches keys a newcomer actually has. Today the Core band matches
vim-hero lesson for lesson (validated), but the later bands follow the 2015 tpope canon and
one YouTuber's taste, and the project-navigation skills that separate a power user from a
competent one sit late and are keyed to plugins the starter configs don't ship.

Success: a learner who walks the sidebar top to bottom follows the consensus order
(survive → grammar → repeat → project → patterns → code), never meets a key that kickstart
or LazyVim would not give them, and each band ends in a challenge that mixes that band's
skills. The Coach's vocabulary gate follows the new order automatically.

## Evidence (2026-09-29/30 survey)

Interactive tutors (vim-hero, Vimified, VimVenture, Vim Adventures), the books (Practical
Vim, Learn Vim the Smart Way), Primeagen's Vim Fundamentals and the config-building series
(typecraft, TJ DeVries' Advent of Neovim, chris@machine, Josean), and the two starter configs
(kickstart.nvim, LazyVim). Findings that drive the design:

- The first four acts (modes/motions, operators + objects, vertical + search, visual) are
  taught in the same order by every tutor. Core stays.
- Practical Vim opens with `.`; the tutors bury it. Keep `.` where First Operators has it
  (right after the grammar) and give it the band name.
- Primeagen's power-user material is project navigation: alternate file, jumplist, marks,
  quickfix and `:cdo`, pickers. The books agree (Practical Vim "Files"/"Getting Around
  Faster", Learn-Vim ch. 2–3). It moves up to third.
- Every educator and both starters share: Telescope-style pickers, treesitter, LSP with the
  `gd gr* K [d ]d` maps, completion + snippets, format/lint, gitsigns, an explorer, which-key,
  comments, autopairs. Explorer choice varies (neo-tree, nvim-tree, oil, netrw); oil has two
  serious endorsers (Primeagen, TJ). Harpoon and fugitive have one.
- **Rule for what stays:** a lesson stays if its keys are in the shared kickstart/LazyVim
  bindings, or at least two of the surveyed sources teach it.

## Decisions (owner, 2026-09-30)

- Reset the curriculum around six bands: **Core, Repeat, Project, Patterns, Code, Challenges**.
- Cut the single-source material (below). Engine emulations that no lesson uses are deleted,
  not kept.
- Plugin lessons teach a capability with the shared kickstart/LazyVim binding as the key shown;
  where the starters differ (Telescope vs snacks, oil vs neo-tree), the demonstrated one is
  named and the other goes in the aside.
- Config literacy is out of scope for a drill tutor; the last lesson links to kickstart.

## The bands

Section ids are kept where the section survives, so runs, seeds and coach `sections` lists
keep working. Order within a band is the order listed.

### Core (unchanged)

`getting-around`, `small-edits`, `next-steps`, `insert-like-a-pro`, `essential-motions`,
`screen-movement`, `basic-operators`, `text-objects`, `visual-mode`, `search`, `indent-case`.
No lesson changes.

### Repeat (band id `repeat`)

- `registers` — drop `clipboard-register` (quiz) and `viewing-registers` (quiz); `"+` and
  `:reg` become asides of `unnamed-register` and `named-registers`. 9 lessons.
- `macros` — unchanged (7 incl. boss).

### Project (band id `project`)

- `buffers-files` — unchanged (7). `cycling-buffers` aside adds LazyVim's `<S-h>`/`<S-l>`.
- `windows-tabs` — unchanged (6). `moving-between-windows` aside adds `<C-h/j/k/l>` as the
  universal remap both starters set.
- `marks-jumps` — unchanged (8). Moved here from Deep Water: `jump-list` and `back-to-edit`
  are project navigation, not an advanced topic.
- `quickfix` — drop `argument-list`. 6 lessons; `edit-every-match` (`:cdo`) stays as the
  centrepiece.
- `finding-things` → retitled **Pickers**, re-keyed to the shared bindings:
  - `picker-files` "Find Files" `<leader>sf` (kickstart) with `<leader><space>` (LazyVim) in
    the aside; `<C-n>`/`<C-p>` move, `<CR>` opens, `<C-v>` splits.
  - `picker-grep` "Live Grep" `<leader>sg` (`<leader>/` in LazyVim); the aside shows the
    multi-grep idiom (pattern, then `  ` + a glob).
  - `picker-word` "Word Under Cursor" `<leader>sw` — new lesson, replaces the buffers picker
    as the third (buffers picker becomes an aside of `buffer-list`).
  - `picker-quickfix` "Send to Quickfix" `<C-q>` — unchanged.
  The Telescope emulation stays as the engine; only the trigger keys and titles change.
- `file-navigation` → retitled **Explorer**: `oil-open-directory`, `oil-edit-directory` stay;
  `harpoon-add`, `harpoon-jump` are cut. `oil-open-directory`'s aside names neo-tree
  (`<leader>e`) as LazyVim's default and says the editing idea is the same.

### Patterns (band id `patterns`)

- `command-line` — drop `command-line-mode` and `save-and-quit` (quiz); their content moves
  into `jump-to-line`'s intro. 9 lessons.
- `substitute` — unchanged (16 incl. boss) plus one new lesson at the end:
  `project-replace` "Project Replace" — a `sim` of a grug-far-style panel: `<leader>sr` opens
  it with the word under the cursor, type the replacement, `<CR>` applies across files;
  graded on the resulting files. Aside: this is what `:cdo s//` did before.
- `global-commands` — unchanged (7).

### Code (band id `code`)

- `neovim-builtins` — drop `terminal-mode` (quiz). 7 lessons.
- `more-text-objects` — unchanged (5); intro names mini.ai and treesitter-textobjects as the
  providers in both starters.
- `jumping` — unchanged (3, flash).
- `surround` — unchanged (6); intro names nvim-surround (shown) and mini.surround
  (LazyVim extra, `gsa gsd gsr`) in the aside.
- `insert-power` → keep `insert-delete-word`, `insert-one-command`; cut
  `insert-word-completion`, `insert-line-completion`, `insert-file-completion` (the `C-x`
  family, which every starter replaces), `insert-digraphs`, `insert-literal`,
  `inspect-character`. Add two lessons:
  - `completion-menu` "Completion Menu" — a `sim`/`rounds` hybrid using the existing
    insert-mode completion model with blink/cmp keys: menu opens as you type, `<C-n>`/`<C-p>`
    move, `<C-y>` accepts (`<CR>` in the aside), `<C-e>` dismisses, `<C-space>` opens docs.
  - `snippets` "Snippets" — expand a snippet with `<C-y>`, jump fields with `<Tab>`/`<S-Tab>`.
  4 lessons.
- `git` → keep `gitsigns-hunks`, `gitsigns-stage-hunk` (re-keyed: `]h [h` / `<leader>ghs
  <leader>ghr` shown, kickstart's `]c [c` / `<leader>hs` in the aside); cut the five
  fugitive lessons. Add `git-lazygit` "Lazygit" — a `sim`: `<leader>gg` opens a floating client whose
  status view lists the changed files, `q` closes it; graded on having opened and closed it. 3 lessons.
- `diffs` — cut (3 lessons; the merge-conflict flow is fugitive's).
- `folds` — cut (4 lessons; single source).
- `config-literacy` — cut (4 quiz lessons). `neovim-builtins`' last lesson gains an aside
  pointing at kickstart.nvim as the place to read next.

### Challenges (band id `challenges`, unchanged mechanics)

Ladder re-keyed to the bands; each generated challenge lists its `sections`:

| # | id | after band | mutations |
|---|----|-----------|-----------|
| 1 | `challenge-fix-the-file` | Core (motions) | existing |
| 2 | `challenge-operators` | Core (operators) | existing |
| 3 | `challenge-objects-visual` | Core (end) | planned per the challenges spec |
| 4 | `challenge-registers-macros` | Repeat | planned |
| 5 | `challenge-rename-replace` | Patterns | planned |

Project and Code bands end in their existing `sim` bosses; generated challenges cannot
express multi-file work and are out of scope there.

### Removed, with their engine code

Lessons (30): `clipboard-register`, `viewing-registers`, `argument-list`,
`command-line-mode`, `save-and-quit`, `terminal-mode`, `harpoon-add`, `harpoon-jump`,
`exchange`, `replace-with-register`, `case-coercion`, `smart-substitute`, the five
`fugitive-*`, `diff-mode`, `diff-obtain-put`, `diff-merge-conflicts`, the four folds lessons,
`insert-word-completion`, `insert-line-completion`, `insert-file-completion`,
`insert-digraphs`, `insert-literal`, `inspect-character`, the four `config-*`.

Sections removed: `operator-plugins`, `diffs`, `folds`, `config-literacy`.

Engine modules removed with them: `src/vim/plugins/{exchange,replace-with-register,abolish,
harpoon,fugitive,diff}.ts` and their tests. `git-model.ts` stays (gitsigns uses it). The
engine's own fold, digraph and `C-x` completion support stays (it is Vim, and the lessons
test replays no longer need it, but the engine tests still cover it).

Net: 204 − 30 cut + 5 added (`picker-word`, `project-replace`, `completion-menu`,
`snippets`, `git-lazygit`) = 179 lessons.

README Credits loses the abolish.vim line when `abolish.ts` goes (it was the only translated
code); the plugin list in Credits is regenerated from what remains.

## Sidebar and copy

- `BANDS` becomes Core, Repeat, Project, Patterns, Code, Challenges. `Section.band` union
  changes to `'core' | 'repeat' | 'project' | 'patterns' | 'code' | 'challenges'`.
- The eyebrow numbering (`numberOf`) continues to count non-boss lessons in `ORDER`, so
  numbers shift; nothing depends on the old numbers except `CURRICULUM.md`, which is
  regenerated.
- `CURRICULUM.md` gets a "Pathway" preamble (the six acts, one line each, with the survey
  sources) and its tables regenerated from the registry by a script (`scripts/curriculum.ts`
  → stdout) so it cannot drift again.

## Coach interactions

- `taughtBy` walks `ORDER`; the new order means picker and LSP keys are "taught" earlier
  than before and folds/digraphs never. `COUNTS_TAUGHT_FROM = 'words'` unchanged.
- Challenge `sections` lists are re-checked against surviving section ids (test).
- The reference audit (`every reference playthrough yields zero critiques`) re-runs over the
  new registry; new lessons' references must pass it.

## Progress data

Runs are stored by lesson id. Runs for cut lessons stay in storage and are ignored by the
sidebar (they match no lesson). Completion counts use `COUNTED`, which shrinks; a learner who
had finished 40 of 204 now sees 40 of 179 minus any cut ones. No migration.

## Testing

- `lessons.test.ts` already validates every surviving lesson's shape and reference; the new
  `sim` lessons get the same treatment as existing sims (setup → keys → goal check).
- New: a registry test that the band order equals the spec's list, that no section id from
  the removed list exists, and that each challenge's `sections` exist.
- `curriculum.ts` output equals the committed `CURRICULUM.md` tables (a drift test).
- Coach audit stays green.

## Out of scope

Config drills; a per-user "profile" switch (kickstart vs LazyVim keys) beyond asides; new
generated challenges 3–5 (their own plan); a snacks.picker emulation (Telescope's serves both
under the shared keys).
