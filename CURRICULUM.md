# vimchi — Curriculum

A browser Vim tutor, inspired by vim-hero's short-lesson format: many small lessons, each teaching 1–4 keys, grouped into short named sections. It goes further than vim-hero into registers, macros, ex, regex, windows, and the Neovim plugins people actually run.

## Lesson shape

Every lesson matches the live app:

1. **Intro**: two short paragraphs on the idea.
2. **Key cards**: one card per key, with a glyph and a label.
3. **Practice**: exactly one challenge.
4. **Results**: time, personal best, score, and Speed / Accuracy / Correct rings.
5. **Aside**: one short `#` note (a tip, a gotcha, or a Vim-vs-Neovim difference).

Sections may end with an optional **★ Boss**: a realistic multi-step edit with a par. Bosses don't count toward completion.

### Challenge types

| Type | Goal | Status |
|---|---|---|
| `target` | reach randomly placed boxes | live |
| `word` | reach boxes on word starts/ends | live |
| `fix` | delete marked stray characters | live |
| `replace` | replace marked wrong characters | live |
| `transform` | make the buffer match a shown target text (diff highlighted) | new, covers most editing lessons |
| `quiz` | type the keys for a described action; no buffer | new, for keys the browser can't capture and for config |
| `sim` | simulated UI (splits, quickfix, pickers, git status); graded on end state | new, for window and plugin lessons |
| `generated` | fix a seeded, mutated corpus file; live checklist | live, Challenges band |

Chips use Vim notation: `C-d` = Ctrl-d, `␣` = Space, `<leader>` = Space by default.

---

## Core

### Getting Around
| # | Lesson | Keys | Challenge |
|---|---|---|---|
| 01 | Four Keys to Move | `h` `j` `k` `l` | target |
| 02 | Hopping by Word | `w` `e` `b` | word |

### Small Edits
| # | Lesson | Keys | Challenge |
|---|---|---|---|
| 03 | Deleting Characters | `x` `u` | fix |
| 04 | Replacing Characters | `r` | replace |

### Next Steps
| # | Lesson | Keys | Challenge |
|---|---|---|---|
| 05 | Insert Mode | `i` `a` `esc` | transform |
| 06 | Line Ends | `0` `$` | target |
| 07 | Find Character | `f` `t` | target |
| 08 | Change Words | `c` `w` | transform |

### Ways Into Insert
| # | Lesson | Keys | Challenge |
|---|---|---|---|
| 09 | Insert at Line Ends | `I` `A` | transform |
| 10 | Opening New Lines | `o` `O` | transform |
| 11 | Substitute | `s` `S` | transform |
| 12 | Replace Mode | `R` | replace |
| 13 | Undo & Redo | `u` `C-r` | transform |

### Motions Worth Knowing
| # | Lesson | Keys | Challenge |
|---|---|---|---|
| 14 | Moving by WORDs | `W` `E` `B` | word |
| 15 | Word Ends Backward | `ge` `gE` | word |
| 16 | First Character | `^` `_` | target |
| 17 | Find Backward | `F` `T` | target |
| 18 | Repeat Find | `;` `,` | target |
| 19 | Top & Bottom | `gg` `G` | target |
| 20 | Paragraphs | `{` `}` | target |
| 21 | Matching Pairs | `%` | target |

### Screen Movement
| # | Lesson | Keys | Challenge |
|---|---|---|---|
| 22 | Half Pages | `C-d` `C-u` | target |
| 23 | Full Pages | `C-f` `C-b` | target |
| 24 | Screen Lines | `H` `M` `L` | target |
| 25 | Recenter | `zz` `zt` `zb` | target |

### First Operators
| # | Lesson | Keys | Challenge |
|---|---|---|---|
| 26 | Intro to Operators | `operators` | transform |
| 27 | Delete Words | `d` `w` | transform |
| 28 | Delete to Character | `d` `t` `f` | transform |
| 29 | Delete Lines | `dd` `D` | transform |
| 30 | Delete Multiple Lines | `d` `j` `k` | transform |
| 31 | Change Lines | `cc` `C` | transform |
| 32 | Copy/Paste Lines | `y` `p` `P` | transform |
| 33 | Yank to End | `Y` | transform |
| 34 | Join Lines | `J` `gJ` | transform |
| 35 | Repeat Last Change | `.` | transform |
| 36 | Counts & Operators | `3dw` `d3w` | transform |
| ★ | Boss: Tidy a Function | | transform |

### Text Objects
| # | Lesson | Keys | Challenge |
|---|---|---|---|
| 37 | Intro to Text Objects | `i` `a` | transform |
| 38 | Word Objects | `iw` `aw` | transform |
| 39 | WORD Objects | `iW` `aW` | transform |
| 40 | Quotes | `i"` `i'` `` i` `` | transform |
| 41 | Parentheses | `i(` `a(` `ib` | transform |
| 42 | Brackets & Braces | `i[` `i{` `iB` | transform |
| 43 | Tags | `it` `at` | transform |
| 44 | Sentences & Paragraphs | `is` `ip` | transform |
| 45 | Reaching Objects | `ci"` from outside | transform |

### Visual Mode
| # | Lesson | Keys | Challenge |
|---|---|---|---|
| 46 | Visual Characters | `v` `o` | transform |
| 47 | Visual Lines | `V` | transform |
| 48 | Reselect | `gv` | transform |
| 49 | Visual Operators | `d` `c` `y` | transform |
| 50 | Visual Block | `C-v` | transform |
| 51 | Block Insert & Append | `I` `A` `$A` | transform |
| 52 | Growing Selections | `v` `a(` `a(` | transform |

### Search
| # | Lesson | Keys | Challenge |
|---|---|---|---|
| 53 | Search Forward | `/` `n` `N` | target |
| 54 | Search Backward | `?` | target |
| 55 | Word Under Cursor | `*` `#` | target |
| 56 | Search as a Motion | `d/` `c/` | transform |
| 57 | Change Next Match | `gn` `cgn` `.` | transform |
| 58 | Search Offsets | `/e` `/+1` | target |
| 59 | Clear Highlights | `:noh` `C-l` | quiz |

### Indent & Case
| # | Lesson | Keys | Challenge |
|---|---|---|---|
| 60 | Indenting | `>>` `<<` `>` | transform |
| 61 | Auto-Indent | `=` `==` | transform |
| 62 | Toggle Case | `~` | replace |
| 63 | Case Operators | `gu` `gU` `g~` | transform |
| 64 | Formatting Text | `gq` `gw` | transform |
| 65 | Incrementing Numbers | `C-a` `C-x` | transform |
| 66 | Number Sequences | `g C-a` | transform |
| ★ | Boss: Clean Up a Config File | | transform |

---

## Deep Water

### Registers
| # | Lesson | Keys | Challenge |
|---|---|---|---|
| 67 | The Unnamed Register | `""` | transform |
| 68 | The Yank Register | `"0` | transform |
| 69 | Named Registers | `"a` `"b` | transform |
| 70 | Appending to Registers | `"A` | transform |
| 71 | Delete History | `"1` `"-` | transform |
| 72 | The Black Hole | `"_` | transform |
| 73 | System Clipboard | `"+` | quiz |
| 74 | Read-Only Registers | `".` `"%` `":` | transform |
| 75 | Paste While Typing | `C-r` | transform |
| 76 | Expression Register | `C-r` `=` | transform |
| 77 | Viewing Registers | `:reg` | quiz |

### Marks & Jumps
| # | Lesson | Keys | Challenge |
|---|---|---|---|
| 78 | Setting Marks | `m` `'` `` ` `` | target |
| 79 | Operating to Marks | `d'a` `` y`a `` | transform |
| 80 | File Marks | `mA` | sim |
| 81 | Back to Your Edit | `` `. `` `gi` | transform |
| 82 | Edges of a Change | `` `[ `` `` `] `` | target |
| 83 | Previous Position | ` `` ` `''` | target |
| 84 | Jump List | `C-o` `C-i` | target |
| 85 | Change List | `g;` `g,` | target |

### Macros
| # | Lesson | Keys | Challenge |
|---|---|---|---|
| 86 | Recording a Macro | `q` `@` | transform |
| 87 | Replaying | `@@` `5@a` | transform |
| 88 | Robust Macros | `macros` | transform |
| 89 | Recursive Macros | `qaq` `@a` | transform |
| 90 | Editing a Macro | `"ap` `"ay$` | transform |
| 91 | Macros over Lines | `:norm @a` | transform |
| ★ | Boss: CSV to Object Literal | | transform |

### Command Line
| # | Lesson | Keys | Challenge |
|---|---|---|---|
| 92 | Command-Line Mode | `:` | quiz |
| 93 | Save & Quit | `:w` `:q` `ZZ` | quiz |
| 94 | Jump to Line | `:42` | target |
| 95 | Ranges | `%` `.` `$` | transform |
| 96 | Visual Ranges | `'<,'>` | transform |
| 97 | Delete & Yank Lines | `:d` `:y` | transform |
| 98 | Move & Copy Lines | `:m` `:t` | transform |
| 99 | Normal over a Range | `:norm` | transform |
| 100 | Repeat a Command | `@:` | transform |
| 101 | Insert Word Under Cursor | `C-r C-w` | transform |
| 102 | Command Window | `q:` | transform |

### Global Commands
| # | Lesson | Keys | Challenge |
|---|---|---|---|
| 103 | Delete Matching Lines | `:g` `/d` | transform |
| 104 | Keep Matching Lines | `:v` | transform |
| 105 | Global Normal | `:g` `norm` | transform |
| 106 | Reverse Lines | `:g/^/m0` | transform |
| 107 | Sorting | `:sort` | transform |
| 108 | Unique Sort | `:sort u` | transform |
| 109 | Shell Filters | `!` `:%!` | transform |

### Substitute
| # | Lesson | Keys | Challenge |
|---|---|---|---|
| 110 | Substitute | `:s` | transform |
| 111 | Whole File | `%s` `/g` | transform |
| 112 | Confirm Each | `/c` | transform |
| 113 | Ignoring Case | `/i` `\c` | transform |
| 114 | Word Boundaries | `\<` `\>` | transform |
| 115 | Very Magic | `\v` | transform |
| 116 | Capture Groups | `()` `\1` | transform |
| 117 | The Whole Match | `&` | transform |
| 118 | Case in Replacements | `\u` `\U` `\E` | transform |
| 119 | Line Breaks | `\r` `\n` | transform |
| 120 | Trimming a Match | `\zs` `\ze` | transform |
| 121 | Lazy Matches | `\{-}` | transform |
| 122 | Reuse the Last Search | `:s//` | transform |
| 123 | Repeat Substitute | `&` `g&` | transform |
| 124 | Expressions | `\=` | transform |
| ★ | Boss: Rename & Reformat in Three Commands | | transform |

### Buffers & Files
| # | Lesson | Keys | Challenge |
|---|---|---|---|
| 125 | Opening Files | `:e` | sim |
| 126 | Buffer List | `:ls` `:b` | sim |
| 127 | Cycling Buffers | `[b` `]b` | sim |
| 128 | Alternate File | `C-^` | sim |
| 129 | Closing Buffers | `:bd` | sim |
| 130 | Go to File | `gf` | sim |
| 131 | Finding Files | `:find` | sim |

### Windows & Tabs
| # | Lesson | Keys | Challenge |
|---|---|---|---|
| 132 | Splitting | `:sp` `:vs` | sim |
| 133 | Moving Between Windows | `C-w` `h` `j` `k` `l` | sim |
| 134 | Closing Windows | `C-w c` `C-w o` | sim |
| 135 | Resizing | `C-w =` `_` `\|` | sim |
| 136 | Rearranging | `C-w H` `J` `K` `L` | sim |
| 137 | Tab Pages | `:tabnew` `gt` `gT` | sim |

### Quickfix & Multi-File
| # | Lesson | Keys | Challenge |
|---|---|---|---|
| 138 | Grep | `:grep` `:vimgrep` | sim |
| 139 | Quickfix List | `:copen` | sim |
| 140 | Walking Results | `[q` `]q` | sim |
| 141 | Edit Every Match | `:cdo` | sim |
| 142 | Location List | `:lopen` `[l` `]l` | sim |
| 143 | Argument List | `:args` `:argdo` | sim |
| 144 | Every Buffer | `:bufdo` | sim |

### Folds
| # | Lesson | Keys | Challenge |
|---|---|---|---|
| 145 | Creating Folds | `zf` | target |
| 146 | Opening & Closing | `zo` `zc` `za` | target |
| 147 | All Folds | `zR` `zM` | target |
| 148 | Moving by Folds | `zj` `zk` | target |

### Insert Mode Power
| # | Lesson | Keys | Challenge |
|---|---|---|---|
| 149 | Deleting While Typing | `C-w` `C-u` | quiz |
| 150 | One Normal Command | `C-o` | transform |
| 151 | Word Completion | `C-n` `C-p` | quiz |
| 152 | Line Completion | `C-x C-l` | transform |
| 153 | File Completion | `C-x C-f` | transform |
| 154 | Digraphs | `C-k` | transform |
| 155 | Literal Characters | `C-v` | transform |
| 156 | Inspecting a Character | `ga` | quiz |

### Neovim Built-ins
| # | Lesson | Keys | Challenge |
|---|---|---|---|
| 157 | Commenting | `gcc` `gc` | transform |
| 158 | Diagnostics | `[d` `]d` | target |
| 159 | Definitions & Hover | `gd` `K` | sim |
| 160 | References | `grr` `gri` | sim |
| 161 | Rename | `grn` | transform |
| 162 | Code Actions | `gra` | sim |
| 163 | Blank Lines | `[␣` `]␣` | transform |
| 164 | Terminal Mode | `:term` `C-\ C-n` | quiz |

### Config Literacy (optional, quiz only)
| # | Lesson | Keys | Challenge |
|---|---|---|---|
| 165 | Options | `:set` | quiz |
| 166 | Mappings | `vim.keymap.set` | quiz |
| 167 | The Leader Key | `<leader>` | quiz |
| 168 | Reading init.lua | `init.lua` | quiz |

---

## Plugins

We teach one standard plugin for each slot (see Decisions). A lesson's aside names the alternatives.

### Surround (nvim-surround)
| # | Lesson | Keys | Challenge |
|---|---|---|---|
| 169 | Add Surroundings | `ys` | transform |
| 170 | Change Surroundings | `cs` | transform |
| 171 | Delete Surroundings | `ds` | transform |
| 172 | Surround a Line | `yss` | transform |
| 173 | Surround a Selection | `S` | transform |
| 174 | Surround with Tags | `cst` | transform |

### More Text Objects (mini.ai, treesitter-textobjects)
| # | Lesson | Keys | Challenge |
|---|---|---|---|
| 175 | Next & Last Objects | `in(` `il"` | transform |
| 176 | Arguments | `ia` `aa` | transform |
| 177 | Indent Objects | `ii` `ai` | transform |
| 178 | Functions & Classes | `if` `ic` | transform |
| 179 | Function Motions | `]m` `[m` | target |

### Operator Plugins
| # | Lesson | Keys | Challenge |
|---|---|---|---|
| 180 | Exchange | `cx` `cxx` | transform |
| 181 | Replace with Register | `gr` | transform |
| 182 | Case Coercion (abolish) | `crs` `crc` `cr-` | transform |
| 183 | Smart Substitute (abolish) | `:S` | transform |

### Jumping (flash.nvim)
| # | Lesson | Keys | Challenge |
|---|---|---|---|
| 184 | Label Jumps | `s` | target |
| 185 | Jumps as Motions | `d` `s` | transform |
| 186 | Treesitter Select | `S` | transform |

### Finding Things (Telescope)
| # | Lesson | Keys | Challenge |
|---|---|---|---|
| 187 | Find Files | `<leader>ff` | sim |
| 188 | Live Grep | `<leader>fg` | sim |
| 189 | Buffers Picker | `<leader>fb` | sim |
| 190 | Send to Quickfix | `C-q` | sim |

### File Navigation (oil.nvim, harpoon)
| # | Lesson | Keys | Challenge |
|---|---|---|---|
| 191 | Open the Directory | `-` | sim |
| 192 | Edit a Directory | `dd` `cw` `:w` | sim |
| 193 | Harpoon a File | `<leader>a` | sim |
| 194 | Jump to a Mark | `C-e` `1`–`4` | sim |

### Git (fugitive, gitsigns)
| # | Lesson | Keys | Challenge |
|---|---|---|---|
| 195 | Git Status | `:Git` | sim |
| 196 | Stage & Unstage | `s` `u` | sim |
| 197 | Inline Diff | `=` | sim |
| 198 | Committing | `cc` | sim |
| 199 | Walking Hunks | `]c` `[c` | sim |
| 200 | Stage a Hunk | `<leader>hs` `<leader>hr` | sim |
| 201 | Blame | `:Git blame` | sim |

### Diffs & Merges
| # | Lesson | Keys | Challenge |
|---|---|---|---|
| 202 | Diff Mode | `:diffsplit` | sim |
| 203 | Obtain & Put | `do` `dp` | sim |
| 204 | Merge Conflicts | `:diffget //2` `//3` | sim |

---

## Challenges

Combined-skill sessions on a generated file (`src/challenges/`). Each names the sections it
draws on; none count toward completion. A run is `generate(challenge, seed)`; `#<id>?seed=N`
replays one. Corpus files are attributed excerpts from MIT/BSD repos (see README Credits).

| # | Lesson | Skills | Mutations |
|---|--------|--------|-----------|
| 1 | Fix the File | Getting Around, Small Edits, Next Steps, Motions, Search | dropped/extra/wrong char, wrong literal, wrong short identifier |
| 2 | Operators | + First Operators | + stray line, stray word, wrong word, missing near-duplicate line, line to remove |
| 3–5 | (planned) text objects & visual; rename & replace; registers & macros | | |

## Coach

After a rounds lesson or a challenge run, "Better ways" lists up to five places where a
shorter sequence would have done the same edit, derived from the learner's own keys
(`src/coach/`): motion runs are searched for shorter routes (counts on hjkl, f/t/;, 0/^/$,
word motions, /search) and edits are matched against a rule library (`3x`, `r`, `A`, `I`,
`ddp`, `.`, `cw`, `o`). Suggestions use only keys taught at or before the lesson (counts from
`words`), must save ≥ 2 keys (or 1.5× on runs of 4+), never replace a key the lesson's section
drills, and are replay-verified on the engine including any register / find / search state a
later key reads. "Live hints" (sidebar footer, off by default) shows one such line under the
editor as you type. Every reference solution yields zero critiques (tested).

## Decisions

1. **Neovim first.** Defaults follow current Neovim: `Y` = `y$`, `hlsearch`/`incsearch` on, `C-l` also clears the highlight, `gc` commenting is built in, and 0.11's `[b ]b [q ]q [d ]d [␣ ]␣` and `grn gra grr gri` maps are built in. Differences in classic Vim go in asides.
2. **No locking.** Every lesson is open from the start. Sidebar order is only a suggestion.
3. **Config Literacy: undecided.** Drafted as optional and quiz-only. Can be cut without affecting anything else.
4. **Plugin variants: deferred.** One standard plugin per slot for now, with alternatives named in the aside. Letting users pick their variant may come later.

## Engine constraints

- **Keys the browser keeps.** A normal tab can't reliably capture `C-w`, `C-n`, `C-t` and `C-q`. The lessons that need them (window moves, insert-mode `C-w`/`C-n`, Telescope `C-q`) are `quiz` for now. They can switch to live challenges if we ship an installed-app (PWA) or fullscreen mode, or remap the keys inside the app.
- **Regex.** The Substitute and Global sections need a layer that translates Vim regex to JavaScript: magic levels, `\v`, `\< \>`, `\zs \ze`, `\{-}`, `\=`. Drills stay within what that layer supports.
- **Engine growth.** The custom engine in `src/engine` handles normal-mode motions, `x`, `r` and `u` today. Next it needs, in order: insert mode, operators with motions, text objects, visual mode, the command line, registers, and multi-window rendering for `sim`.

## Size

| Band | Sections | Lessons |
|---|---|---|
| Core | 11 | 66 |
| Deep Water | 13 | 102 |
| Plugins | 8 | 36 |
| **Total** | **32** | **204** |
