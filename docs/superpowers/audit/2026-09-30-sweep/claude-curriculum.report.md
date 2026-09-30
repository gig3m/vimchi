# Front 1: Curriculum coverage (Claude)

Reviewer: Claude (Opus 5.5), 2026-09-29. Front 1 only. Read-only; nothing tracked was changed.

Scope: all 180 lessons (174 counted) in `src/lessons/sections/*.tsx`, in the order set by
`src/lessons/index.ts`, checked against `CURRICULUM.md` and
`docs/superpowers/specs/2026-09-30-curriculum-revamp-design.md`.

Evidence lives in `claude-curriculum-data/`:
- `lessons.txt` / `lessons-short.txt`: every lesson's chips, cards, intro, practice, aside and round
  solutions, rendered from the live registry. `dump.test.tsx.txt` produces them; rename it to `.tsx`
  to re-run it. It is parked so that the full suite does not pick it up.
- `chips.py` → `chips-check.out.txt`: chips checked against the round solutions.
- `nvim-defaults-check.lua` → `.out.txt`: Neovim 0.12.5 run as `--clean --headless`, used to check
  the claims the copy makes about defaults.

I read the copy of every lesson (not a sample). I compared the pathway with my own knowledge of
vimtutor, Practical Vim (21 chapters), Learn Vim the Smart Way, vim-hero, Primeagen's Vim
Fundamentals and the default keymaps in kickstart.nvim and LazyVim. I did not fetch the web.
Starter-config claims marked "(verify)" are from memory and should be checked against current HEAD.

---

## Ranked findings

### F1. Saving and quitting are never taught, yet four lessons require them. HIGH

- `:w`, `:q`, `:wq`, `:q!` and `ZZ` appear only as one clause in lesson 115's intro, "`:w` / `:q` /
  `ZZ` save and quit" (`command-line.tsx:121`).
- The spec cut the quiz that covered them (`save-and-quit`).
- vimtutor teaches `:q!` in lesson 1.2 and `:wq` in 1.6. Every source agrees this is the first thing
  a newcomer needs, often before anything else ("how do I exit Vim").
- Rounds already require the keys before lesson 115:
  - `:e src/routes/tags.ts<CR>:w<CR>` (`buffers-files.tsx:179`, lesson 82)
  - `cwtime<Esc>:w<CR>y` and five more rounds (`file-navigation.tsx:126…`, lesson 114)
  - `vip:w retry.ts<CR>` (`command-line.tsx:404`, lesson 117)
  - `:wa` (`neovim-builtins.tsx:613`, lesson 151)
- **Fix shape:** add a rounds lesson, "Save & Quit" (`:w` `:wq` `:q!`), in *Next Steps* right after
  lesson 05 Insert Mode.
  - Goals can use `files` for `:w`.
  - For `:q` / `:q!`, use a `check` on a quit flag the engine sets. If none exists, add a
    `sim`-style `quitRequested`.
  - The aside covers `ZZ`/`ZQ` and `:wa`/`:qa`.
  - Keep lesson 115's clause as a reminder.

### F2. Reference solutions use keys the lesson has not taught, which makes par unfair. HIGH

Par is the length of the reference solution (`types.ts` `Round.solution`). When the solution uses
a key the learner has not met, they cannot reach par with what they know, and the Coach may still
suggest the key.

| Lesson | Uses | Taught at | Where |
|---|---|---|---|
| 05 Insert Mode | `f` in 4 of 5 rounds (`jfHflal`, `jf;i)`, `2jfia!`, `kf,a `) | 07 Find Character | `next-steps.tsx:71,101,122,131` |
| 26 Intro to Operators | `P` ("put it before getPosts with P") | 32 Copy/Paste Lines | `basic-operators.tsx:166` |
| 74 Paste While Typing | `:%s/<C-r>0/amount/g` | 124/125 Substitute | `registers.tsx:1063` |
| 81 Macros over Lines | `:norm`, `:%`, `'<,'>` ranges | 116, 117, 120 | `macros.tsx:639,651` |
| 85 Alternate File | `gf<C-^>` | 87 Go to File | `buffers-files.tsx:384` |
| 142 Global Normal | `:g/console/norm gcc` | 147 Commenting (Code band) | `global-commands.tsx:333` |

**Fix shape:**
- 05: rewrite the four solutions with `w`/`e`/`l`, or swap lesson 07 ahead of 05. 07 uses no insert
  mode, so swapping it is safe.
- 26: change the round to `yw` + `p`.
- 74: use `:s` and name it in the prompt as "a preview of Substitute", or swap to a `/`-search
  round with `C-r 0`.
- 81: move it to the end of Command Line as "Macros over a Range", or fold it into lesson 120
  (see F5).
- 85: replace `gf` with `:e` in that round.
- 142: use `I// ` instead of `gcc`.
- Add a test that walks `ORDER` and fails when a solution uses a key whose first-teaching lesson
  comes later. `taughtBy` in the Coach already has the map this needs.

### F3. The Code band contradicts the spec's rule that learners never meet a key a starter would not give them. MED-HIGH

The spec's success criterion reads: "never meets a key that kickstart or LazyVim would not give
them." These lessons break it:

- **Surround (lessons 162–167, six lessons) teaches nvim-surround's `ys`/`cs`/`ds`, which neither
  starter ships.**
  - kickstart enables `mini.surround` with `sa`/`sd`/`sr` by default.
  - LazyVim has surround only as an extra, `gsa`/`gsd`/`gsr`.
  - The intro (`surround.tsx:18`) presents nvim-surround as if it were a given. The aside
    (`surround.tsx:48-49`) names mini.surround but never says that kickstart ships it.
  - A kickstart learner who types `ysiw"` gets nothing.
- **Function Motions `]m`/`[m`** (`more-text-objects.tsx:428`): neither starter maps treesitter
  `]m`. LazyVim's treesitter-textobjects moves are `]f`/`[f` (function), `]c` (class) and `]a`
  (verify). The aside's claim that nvim-treesitter-textobjects makes `]m` work "in every language"
  holds only with custom config.
- **Explorer `-`** (oil.nvim) is in neither starter. The spec accepted this on endorsements, so it
  is fine, but the criterion should say so.
- **Lazygit `␣gg`, flash `s`/`S`, gitsigns `]h`/`␣ghs`** are LazyVim-only; kickstart's gitsigns
  keymaps are in an optional module. The copy mostly says this already.

**Fix shape:** pick one of two options and write it into the spec.
- (a) Keep `ys`/`cs`/`ds`, the most-taught lineage (tpope, Practical Vim readers, most YouTube).
  Amend the criterion to "or taught by ≥2 sources", and state at the top of the Surround intro:
  "neither starter ships this; kickstart's mini.surround uses `sa`/`sd`/`sr`."
- (b) Re-key the section to mini.surround.

Either way, re-key Function Motions to `]f`/`[f`, with built-in `]m` in the aside.

### F4. The same key means different things in the two starters, and the copy never reconciles it. MED

- **`␣␣`**:
  - Lesson 109 teaches LazyVim `Space Space` = find files (`finding-things.tsx` intro).
  - Lesson 111's aside (`finding-things.tsx:310`) says kickstart `Space Space` = buffers. Both are
    true, but nothing says they collide.
  - Lesson 83's aside (`buffers-files.tsx:222`) gives "`Space fb` (LazyVim `Space ,`)" and leaves
    out kickstart's `Space Space` altogether.
  - `Space fb` is LazyVim's own binding; kickstart has no `fb` (verify).
- **`␣sr`**: lesson 139 teaches LazyVim grug-far. In kickstart, `Space sr` is Telescope "search
  resume", so pressing it does something unrelated. The aside (`substitute.tsx:1448`) says only
  "kickstart does not [ship it]".
- **`S`**: lesson 161 teaches flash treesitter `S` (LazyVim maps it in n/x/o). Lesson 166's aside
  (`surround.tsx:394`) says "In normal mode `S` still clears the line", which is false in the setup
  lesson 161 just taught. Visual `S` in LazyVim is flash as well, not surround.
- **`gd`**: `neovim-builtins.tsx:365` says "Most configs add `gd`". Current kickstart follows
  0.11's `gr*` prefix and maps **`grd`**; LazyVim uses `gd` (verify kickstart HEAD).

**Fix shape:** one sentence per aside that names both keys and the collision. Consider a single
"Two starters, two keymaps" note on the Pickers section intro.

### F5. Redundant lessons and duplicate titles. MED

- **`:norm` is taught twice.**
  - 81 "Macros over Lines" (`:norm @a`) and 120 "Normal over a Range" (`:norm`) overlap.
  - 81's aside teaches `:%norm A;`, which is 120's first round.
  - 120's round 4 (`:2,4norm @q`) *is* lesson 81.
  - Merge: keep 120 and add a "`:norm @q`" round (it has one). Turn 81 into an aside of 120, or
    move it directly after 120 as "Macros over a Range".
- **`@:` is taught twice.** It appears in 73's aside (`registers.tsx:849`) and as lesson 121.
  Acceptable, but 73's round `":p` and 121's aside cover the same ground.
- **`C-r C-w` is taught twice.** It appears in 74's aside (`registers.tsx:971`) and as lesson 122.
- **`gv` is taught twice.** It is lesson 48, then comes back as a chip on 117
  (`command-line.tsx:363`). Drop the chip on 117, since `'<,'>` is that lesson's key.
- **"S is cc" is the same aside title twice** (`insert-like-a-pro.tsx:277`,
  `basic-operators.tsx:609`), in lessons 11 and 31.
- **Forward-reaching `ci(` is explained twice**, in 45's intro and again in 154's intro
  (`more-text-objects.tsx:52`). Keep the second, since it serves as the contrast.
- **Duplicate titles in the sidebar**:
  - "Substitute" is used by 11 (`s`/`S`, `insert-like-a-pro.tsx:250`) and 124 (`:s`,
    `substitute.tsx:11`). The section itself is also called "Substitute".
  - "Word Under Cursor" is used by 55 (`*`, `search.tsx:161`) and 111 (`␣sw`,
    `finding-things.tsx:281`).
  - Rename to "Substitute Characters" for 11 and "Grep Word Under Cursor" for 111. Keep the ids,
    since runs are stored against them.
- **Blank Lines (153, `[␣`/`]␣`)** is a built-in with no plugin, but it sits in the Code band.
  Lesson 10's aside already previews it. Move it into *Ways Into Insert* after 10 (Opening New
  Lines). It also carries the "read kickstart next" pointer (`neovim-builtins.tsx:790`), which
  belongs on the last lesson of the band (174).

### F6. Sequencing within and between bands works against how people learn. MED

- **Search comes too late.**
  - `/`, `n`, `?` and `*` arrive at lessons 53–55, after operators, text objects and visual mode.
  - vimtutor teaches `/`, `?`, `n` and `%` in lesson 4 of 7. Primeagen treats `/` and `*` as
    vertical movement alongside `C-d` and `{}`.
  - Before 53, the learner crosses files with `j` counts and `}`.
  - The `challenge-fix-the-file` intro recommends `/` ("`f` and `/` beat counting columns",
    `challenges.tsx:11`), and the challenge's `sections` include `search`
    (`src/challenges/index.ts:17`). Its ladder label, though, says it follows the motion sections.
  - Move 53–55 into *Motions Worth Knowing*, or into a short "Search" section right after it
    (before Screen Movement). Keep 56–59 (`d/`, `cgn`, offsets, `:noh`) where they are, since they
    need operators.
- **LSP navigation comes too late.**
  - `gd`, `grr`, `[d` and `K` sit at 148–150, after all of Patterns (`\zs`, `\{-}`, `:sort u`,
    shell filters).
  - The spec's own evidence says power-user navigation is "project navigation", and `gd` → `C-o` is
    the most-used version of it. Lesson 101's intro already cites "`gd` into a definition".
  - Move Diagnostics, Definitions and References into Project (after Marks & Jumps). Leave rename
    and code actions in Code.
- **Macros come before the Command Line.** Lesson 81 depends on Command Line material; see F2 and
  F5.
- **Undo & Redo (13) sits in "Ways Into Insert".** It is a small thing, but it is the only lesson
  there that does not enter insert mode. It fits better at the end of *Small Edits*, next to `x`
  and `u` (03).

### F7. Chips that do not match what the rounds require. MED-LOW

From `chips-check.out.txt`, after false positives from notation were removed by hand:

| Lesson | Problem | Where | Fix |
|---|---|---|---|
| 78 Robust Macros | chip is the word `macros`, not a key (notation rule in `docs/LESSONS.md`) | `macros.tsx:251` | chips `0` `f` `A` (the cards already are `0`, `f`, `j`) |
| 167 Surround with Tags | chip `yst` is ambiguous: `ys` + `t{char}` is a *till* motion, exactly what lesson 162 uses (`yst;]`). Rounds use `ysst` / `ysiwt` / `csT` | `surround.tsx:439` | chip `ysiwt` or `csT` |
| 171 Snippets | `S-tab` is a chip and a card, but none of the 3 rounds uses it | `insert-power.tsx:324` | add a round that goes back a field ("you skipped the name; go back and fill it") |
| 44 Sentences & Paragraphs | chip `ip` unused; rounds use `das` `cis` `dap` `dap` `yap` | `text-objects.tsx:1096` | add a `cip`/`yip` round, or swap the chip for `ap` only |
| 71 Delete History | chip `"1`, rounds use `"3` `"2` `"-` | registers | chip `"2` or `"1-9` (fine as it is if the chip means the family) |
| 36 Counts & Operators | chip `3dw`, but no round puts a count before operator+motion (only `4dd`, `2yy`) | basic-operators | add one `3dw`-shaped round, or chip `3dd` |
| 141 Keep Matching Lines | chip `:g!` never used | global-commands | leave it; it is an alias |

All other chips are exercised by at least one round.

### F8. Copy accuracy. LOW-MED, a few items

I read the copy of all 180 lessons. Most technical claims hold. I verified these against Neovim
0.12.5 `--clean` (`nvim-defaults-check.out.txt`):

- `scrolloff=0`, `formatoptions=tcqj`, `nrformats=bin,hex`, `path=.,,`
- `grepprg=rg --vimgrep -uu`, `cpo` contains `_` (so `cw`=`ce`)
- `&`→`:&&`, `C-l`→`nohlsearch|diffupdate`, `Y`→`y$`
- `[<Space>`, `]b`, `[q`, `]d`, `gr{n,r,i,a}`, `gcc`, `C-w d`
- insert `C-u`/`C-w` break undo, matchit loaded
- `gq` with `tw=0` wraps at 79
- `ci(`/`ci{` reach forward, even onto later lines (lessons 45 and 154 are right)

Inaccurate or misleading statements:

1. `getting-around.tsx:42`, aside "Why hjkl?": "They pull your right hand off the home row". "They"
   reads as hjkl, and the reader has to infer that it means arrow keys. → "Arrow keys pull…".
2. `file-navigation.tsx:42`: "LazyVim's default is neo-tree on `Space e`". Since LazyVim v14 the
   default is snacks.explorer, and neo-tree is an extra (verify). The key is the same.
3. `neovim-builtins.tsx:364`: "Neovim 0.11 maps `K`". `K` hover arrived in 0.10 and is set only on
   `LspAttach`; `maparg('K')` is empty without a server. 0.11/0.12 also ship `gO` (document
   symbols) and `grt`, which the lesson could mention.
4. `neovim-builtins.tsx:365`: "Most configs add `gd`". kickstart now uses `grd` (see F4).
5. `surround.tsx:394`: the claim that normal `S` still clears the line conflicts with lesson 161
   (see F4).
6. `git.tsx:188`: "Pair them with `]c`" in a lesson whose key is `]h`. `git.tsx:198`: "`Space hp`
   previews" is kickstart's key, while the lesson's main keys are LazyVim's (`Space ghp`). Use the
   LazyVim key in both places, since that is the key shown.
7. `finding-things.tsx:310`: "`dd` on an entry closes that buffer" is the snacks picker's
   normal-mode binding. Telescope uses `M-d` (verify).
8. `registers.tsx:720`: "Vim before 9.0 doesn't have [visual `P`]". It landed in 8.2.4242. →
   "Vim before 8.2.4242".
9. `marks-jumps.tsx:744`, card sub "same key as Tab". This holds in legacy terminals. Neovim tells
   `C-i` and `Tab` apart when the terminal reports it (kitty/CSI-u). → "often the same key as Tab".
10. `buffers-files.tsx:222`: the buffers picker is attributed to `Space fb` with no kickstart key
    (see F4).

### F9. Challenges cover only the first 36 lessons. LOW for this front, HIGH for front 2

Only `challenge-fix-the-file` and `challenge-operators` exist (`src/challenges/index.ts:17,33`).
Nothing mixes text objects, visual mode, registers, macros or substitute.

The spec says the Project and Code bands "end in their existing sim bosses". No boss exists in any
Project or Code section: the `boss: true` count is basic-operators 1, indent-case 1, macros 1,
substitute 1. The spec and the registry disagree. Either add the bosses or strike the sentence.

---

## (a) Topics missing entirely, with the band where each belongs

The table is ranked by how much a learner who wants daily use misses the topic. The Sources column
uses these abbreviations: vt = vimtutor, PV = Practical Vim, LV = Learn Vim the Smart Way,
KS = kickstart.nvim, LZ = LazyVim, Prime = Primeagen.

| Topic | Sources | Band / section |
|---|---|---|
| Save & quit (`:w :q :wq :q! ZZ`, `:wa :qa`) | vt 1.2/1.6, LV ch1, Prime | Core / Next Steps (F1) |
| Getting help (`:help`, `:h` completion, KS/LZ `␣sh`) | vt 7.1, LV ch1, Prime, KS+LZ `<leader>sh` | Core end, or first lesson of Command Line |
| Line scrolling `C-e` / `C-y` | PV tip 50 area, LV ch5, both starters use them | Core / Screen Movement |
| `:set` options: toggle `!`, query `?` (`rnu`, `wrap`, `ic`, `hls`) | vt 6.5, LV ch15 | Patterns / Command Line |
| Discovering keymaps (which-key popup on `␣`, `␣sk`) | KS + LZ both ship which-key and `<leader>sk` | Project / Pickers |
| Document symbols `gO` (0.11 built-in; LZ `␣ss`) | built-in, KS `gO`, LZ | Code / Neovim Built-ins |
| Format buffer (`␣f` KS / `␣cf` LZ, conform) | spec's own evidence: "format/lint" is shared | Code / Neovim Built-ins |
| Undo tree / time travel (`g-` `g+` `:earlier 5m`) | LV ch10, PV | Core, after Undo & Redo, or Repeat |
| Spelling (`]s` `[s` `z=` `zg`) | PV ch20, LV; LZ turns on spell for markdown/gitcommit | Code |
| Folds (`za` `zR` `zM`) | LV ch17; LZ enables treesitter folds (`foldexpr`) | Code. The spec cut folds as "single source", but by its own ≥2-sources rule they qualify |
| Terminal mode (`:term`, `C-\ C-n`; KS `<Esc><Esc>`) | LV, KS maps it, LZ `C-/` | Project (was cut as a quiz; a rounds `sim` would do) |
| Display-line motions `gj`/`gk` (wrapped prose) | PV tip 50 | Core / Screen Movement aside |

Coverage that is already good: operators, counts, text objects, visual/block, search offsets,
`cgn`, registers (every family), macros (including recursive and editing),
marks/jumplist/changelist, quickfix + `:cdo`, `:g`/`:v`/`:sort`/filters, substitute in depth, LSP
gr* maps. Against PV/LV this is complete apart from the rows above and the deliberate cuts (arglist,
ctags, `:make`).

## (b) Redundant lessons

See F5: `:norm` ×2 (81/120), `@:` ×2 (73/121), `C-r C-w` ×2 (74/122), `gv` ×2 (48/117), "S is cc"
×2, the forward-reaching `ci(` explanation ×2, and duplicate titles ("Substitute", "Word Under
Cursor").

## (c) Mis-sequencing

See F2 for keys used before they are taught (six lessons, table with file:line) and F6 for band
order (search late, LSP navigation late, macros before the command line, undo in the wrong
section).

## (d) Intro and aside accuracy

See F8. I read all 180 lessons, which is well above the 25-lesson sample. There are ten
inaccurate or misleading statements with file:line; everything else I checked is correct for
Neovim 0.12.

## (e) Chips vs rounds

See F7: seven mismatches. The real problems are `macros` (not a key), the ambiguous `yst`, the
unexercised `S-tab`, and the unused `ip`.

---

## Next 10 lessons to add

Each entry gives the placement, then the keys, then the challenge shape.

1. **Save & Quit**, `:w` `:wq` `:q!`
   - Placement: Core / Next Steps, after 05.
   - Rounds: write a file (goal `files`); discard changes with `:q!` (`check` on a quit flag).
     Aside: `ZZ`, `ZQ`, `:wa`, `:qa`.
2. **Getting Help**, `:h` `C-]` `C-o`
   - Placement: Core, after Undo & Redo (13), or the first lesson of Command Line.
   - `sim`: `:h dw` opens a help buffer; follow a `|tag|` with `C-]`, then come back with `C-o`.
     Aside: `␣sh` in both starters.
3. **Search Forward/Backward/`*`**, moved rather than new
   - Placement: Core / Motions Worth Knowing, after 21.
   - This takes lessons 53–55 out of Search. The rest of Search stays after Visual Mode.
4. **Scroll by Line**, `C-e` `C-y`
   - Placement: Core / Screen Movement, after 23.
   - Rounds with a cursor-stays goal and a viewport `check`, same shape as Recenter.
5. **Undo in Time**, `g-` `g+` `:earlier`
   - Placement: Core, right after 13 (or Repeat, before Registers).
   - Rounds: recover a branch that plain `u`/`C-r` cannot reach.
6. **Options**, `:set x!` `:set x?`
   - Placement: Patterns / Command Line, after 115.
   - Rounds: turn on `relativenumber` to read a `d{n}j` count; toggle `wrap`; set `ic` for a search.
     Goal `check` on the options.
7. **Discover Keys**, `␣` (wait), `␣sk`
   - Placement: Project / Pickers, first lesson.
   - `sim`: the which-key popup lists the `s` group; find "search help" by name. Shared by both
     starters.
8. **Document Symbols**, `gO`
   - Placement: Code / Neovim Built-ins, after 150 References.
   - Built-in since 0.11: the location list of symbols, then `CR`. Aside: LazyVim `␣ss`, kickstart
     `gO` with Telescope.
9. **Format the File**, `␣f` (kickstart), with LazyVim `␣cf` in the aside
   - Placement: Code / Neovim Built-ins, after 152 Code Actions.
   - `sim` of conform on a ragged buffer, graded on the formatted text. Aside: format-on-save, and
     how this differs from `=` (lesson 61).
10. **Folds**, `za` `zR` `zM`
    - Placement: Code, new "Folds" section of one lesson, or as the last lesson of More Text
      Objects.
    - The engine still supports folds (spec: "the engine's own fold … support stays") and `Setup`
      has `folds`, so this is cheap. It meets the ≥2-sources rule (LV ch17 + LazyVim's default
      treesitter folding).

Honourable mentions: Terminal Mode (`:term`, `C-\ C-n`); Spelling (`]s` `z=`); `gj`/`gk`. Add
these if the Code band grows.

## Suggested order of work

1. F1 and F2 (small edits, large effect on the first hour of use).
2. The registry test for keys used before they are taught (F2).
3. F7 chip fixes and F8 copy fixes, one line each.
4. F4 collision asides and the F3 spec amendment.
5. F6 moves: Search forward, LSP navigation into Project, and Blank Lines into Core.
6. New lessons 2, 4, 6–10.
