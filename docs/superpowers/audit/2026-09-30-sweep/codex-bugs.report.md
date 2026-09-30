# Front 5 — engine correctness audit

Scope: `src/vim/*.ts` against installed **Neovim 0.12.5**, plus a skim of `Practice.tsx`, `EditorView.tsx`, and keyboard translation. No implementation changes or commits.

## Evidence and limits

- Existing `scripts/nvimcheck/run.sh`: **387 text-goal rounds pass, 0 fail**.
- Existing `editor.test.ts` and `lastCommand.test.ts`: **305 tests pass** (306 including the scratch capture test).
- Extended differential capture: **734 cases**, comprising **248 targeted probes and 486 eligible lesson rounds**. All 387 lesson text goals still pass. Cursor-goal comparisons expose a default-option mismatch below.
- Reproduction scripts: `codex-probes.test.ts`, `codex-probes.lua`; complete inputs and outputs: `codex-probes.json`, all beside this report. Run `npx vitest run docs/superpowers/audit/2026-09-30-sweep/codex-probes.test.ts` from the repository root. This is a capture harness, not an assertion that Neovim and the engine agree. Neovim file writes are isolated under `/tmp/vimchi-codex-audit`.
- Probes use `createVim`, feed parsed keys individually, and compare with `nvim --clean --headless`. Shiftwidth 2, expandtab, tabstop 8, and autoindent are aligned. Cursor coordinates below are **zero-based**; quoted text uses `\n` for a line break. Unless stated otherwise, start in Normal mode at `(0,0)`.
- No claim of exhaustive equivalence: plugin/files/init/marks/folds/preseeded-register/search rounds are excluded from lesson replay. Viewport-dependent paging differences are **not findings**, because the headless window and tutor viewport differ. File goals and custom goal predicates were not validated by this extended comparison. A preliminary Python indentation mismatch disappeared after matching filetype/option setup order and is excluded.
- UI was inspected, not browser-tested. No separate browser-only defect is asserted here.

Findings are ordered by learner impact. “High” means a common editing/recovery operation teaches incorrect behavior; “Medium” means a narrower operation or an explicit curriculum promise is affected.

## 1. High — undo/redo loses the edit column, so correcting a mistake edits the wrong character

**Reproduce:** text `abc`, keys `lxu`. Neovim restores `abc` with cursor `(0,1)`; engine restores it at `(0,0)`. `lxu<C-r>` likewise ends at column 1 in Neovim but 0 in the engine.

**Consequence:** text `one two three four\nfive six`, keys `lxux`: expected `oe two three four\nfive six`; actual `ne two three four\nfive six`. The ordinary “undo then try again” workflow deletes a different character.

**Source:** `src/vim/buffer.ts:105` and `:115`; undo returns column 0 whenever lines differ, and redo always returns column 0.

**Fix shape:** retain sufficient change/cursor information to reproduce undo/redo cursor placement. Test follow-up edits, not only restored text. Merely restoring the pre-command cursor is insufficient for every insert operation: `aX<Esc>u` also differs in the capture.

## 2. High — counted `dw` incorrectly applies the single-line end-of-word exception across lines

**Reproduce:** text `one\ntwo\nthree`, keys `2dw` (also `d2w`). Expected `three`, unnamed register `one\ntwo\n`; actual `\nthree`, register `one\ntwo`.

A blank-line case is worse: text `abc\n\ndef`, keys `2dw`. Expected `def`; actual `\n\ndef`.

**Source:** `src/vim/editor.ts:1088`, the `w`/`W` cross-line special case, runs before the exclusive-to-linewise rule and rewinds through blank lines.

**Fix shape:** apply Vim's end-of-line exception only in the applicable word-motion circumstances, preserving the actual counted endpoint and exclusive-to-linewise conversion. Add both nonblank and blank intervening-line cases.

## 3. High — counted word text objects stop at the current line and partially delete on failure

**Reproduce:** text `one\ntwo\nthree`, keys `2diw` or `2daw`. Expected `three`; actual `\ntwo\nthree`. `3diw` should remove all three words/lines but still removes only `one`.

**Buffer-end case:** text `abc`, keys `2diw`. Neovim leaves `abc` unchanged because the object cannot satisfy the count; the engine deletes `abc`.

**Source:** `src/vim/textobjects.ts:19`, `word()`: scanning is confined to `lines[cur.line]`; reaching its end breaks the loop and returns a partial object.

**Fix shape:** traverse line boundaries and model count exhaustion/failure explicitly for `iw`, `aw`, `iW`, and `aW`.

## 4. High — Visual `$` cannot include the newline

**Reproduce:** text `abc\ndef`, keys `v$d`. Expected `def`, unnamed register `abc\n`; actual `\ndef`, register `abc`.

With `v$y`, the buffer is unchanged in both implementations, but the engine omits the newline from the register. This escapes a text-only comparison and changes the next paste.

**Source:** `src/vim/commands.ts:69` always targets the last character for `$`; `src/vim/editor.ts:1142` (`applyMotion`) also clamps Visual positions to the last character.

**Fix shape:** allow the Visual characterwise end-of-line position and preserve its newline semantics through range extraction/deletion. Include dot-repeat at line boundaries: captured `vld2.` on `one\ntwo\nthree` leaves an extra empty line in the engine.

## 5. High — entering and leaving Insert without changing text destroys redo

**Reproduce:** text `abc`, keys `xui<Esc><C-r>`. Expected `bc`; actual `abc` because redo has been discarded.

**Source:** `src/vim/buffer.ts:85` clears `redoStack` when a snapshot is taken. `dropSnapshotIfUnchanged()` at `:92` removes the unused snapshot but does not restore redo history.

**Fix shape:** invalidate the redo branch when an actual edit is committed, or preserve/restore it around an unchanged transaction. Exercise failed and canceled changes as well as empty Insert sessions.

## 6. Medium — the taught undo tree is not implemented

**Reproduce:** text `abc\ndef`, keys `xurZg-`. Expected `bc\ndef` (the earlier edit on the abandoned branch); actual `Zbc\ndef`. `xurZg-g-` should return `abc\ndef`, but also remains `Zbc\ndef`.

**Source:** `src/vim/buffer.ts:85` implements two linear stacks and discards redo on a new edit; `src/vim/commands.ts:666` installs `u`, `<C-r>`, and `U`, but no `g-`/`g+`. The lesson explicitly promises these commands in `src/lessons/sections/insert-like-a-pro.tsx:459` (“Undo is a tree”).

**Fix shape:** implement retained history branches and chronological traversal. Until then, the aside needs an explicit scope qualification so learners are not instructed to use unavailable recovery commands in the tutor.

## 7. Medium — Visual linewise put silently ignores counts

**Reproduce:** text `one\ntwo\nthree`, keys `yyV2p`. Expected `one\none\ntwo\nthree`; actual unchanged `one\ntwo\nthree`.

`yyjV2p` should produce `one\none\none\nthree`; actual `one\none\nthree`.

**Source:** `src/vim/commands.ts:1116`, `putOver()`: line-selection and line-register branches insert a single copy; only the final characterwise branch uses `c.count`.

**Fix shape:** apply the put count across all selection/register kind combinations, including `P`, while preserving register replacement semantics.

## 8. Medium — pasting a linewise register over a Visual block splits the line incorrectly

**Reproduce:** text `one two\none two`, keys `yyj<C-v>jlp`.

- Expected: `one two\ne two\none two`.
- Actual: `one two\n\none two\ne two`.

The attempted `j` at the last buffer line is intentional; the selected block remains the first two characters of that line.

**Source:** `src/vim/commands.ts:1135` treats every non-line selection receiving a linewise register as a characterwise split. The block-selection case needs its own behavior.

**Fix shape:** distinguish block selection from character selection during put and test the full selection-kind/register-kind matrix, including at end of buffer.

## 9. Medium — assigning a named register unexpectedly changes the unnamed register

**Reproduce:** text `one\ntwo\nthree`, keys `yy:let @a = "X"<CR>p`.

- Expected: `one\none\ntwo\nthree`; unnamed register still contains `one\n`.
- Actual: `oXne\ntwo\nthree`; unnamed register has become `X`.

**Source:** `src/vim/registers.ts:40`: generic `set()` unconditionally updates `unnamedFrom` at `:52`/`:56`, conflating explicit assignment with yank/delete behavior.

**Fix shape:** separate raw register writes from operations that should update the unnamed register; preserve correct behavior for named yanks, deletes, macro recording, and uppercase appends.

## 10. Medium — line-jump cursor semantics and several reference solutions disagree with clean Neovim

This is a **default/option mismatch**, distinct from the editing defects above. Installed Neovim 0.12.5 reports `nostartofline` under `--clean`; the tutor always jumps to first nonblank and has no `startofline` default in its option model.

**Minimal reproduce:** text `abcdef\n  ghijkl`, cursor `(0,3)`, keys `G` or `:2<CR>`. Expected `(1,3)`; actual `(1,2)`. `gg` from the same setup stays at column 3 in Neovim but moves to column 0 in the tutor.

**Actual lesson references that pass the engine but miss their cursor goals in clean Neovim:**

| Lesson round | Reference keys | Engine/goal cursor | Neovim cursor |
| --- | --- | --- | --- |
| `top-bottom#2` | `gg` | `(0,0)` | `(0,5)` |
| `top-bottom#5` | `30gg` | `(29,1)` | `(29,0)` |
| `top-bottom#6` | `10G` | `(9,0)` | `(9,2)` |
| `jump-to-line#1` | `:35<CR>` | `(34,4)` | `(34,0)` |
| `jump-to-line#2` | `:14<CR>` | `(13,0)` | `(13,4)` |
| `jump-to-line#4` | `:43<CR>` | `(42,4)` | `(42,0)` |

**Source:** `src/vim/commands.ts:82`, `src/vim/ex.ts:109`, `src/vim/types.ts:50`; lesson definitions in `src/lessons/sections/essential-motions.tsx:416` and `src/lessons/sections/command-line.tsx:110`.

**Fix shape:** choose and document the intended configuration, implement `startofline`, and either make the lesson setup explicit or use cursor solutions/goals compatible with clean Neovim. Do not label all Vim configurations wrong: enabling `startofline` makes first-nonblank behavior intentional.

## 11. Medium — Up in a search prompt ignores the typed history prefix

**Reproduce:** text `one two\none two`, keys `/one<CR>/two<CR>/o<Up><CR>`.

Expected final cursor `(0,0)`: `/o<Up>` recalls `one`. Actual `(0,4)`: it recalls `two` despite the `o` prefix.

**Source:** `src/vim/editor.ts:1711` uses `cl.text.slice(0, 0)` when the cursor is at the end, so the most common case filters history by an empty string. The same history traversal is used for Ex commands.

**Fix shape:** retain the prefix present when history browsing starts and match against it while moving through history, without replacing it with the recalled entry.

## 12. Medium — normal-mode replacement mishandles special characters

**Reproduce A:** text `  abc`, keys `r<Tab>` with shiftwidth 2 and expandtab enabled. Expected `   abc`, cursor `(0,1)`; actual literal `<Tab> abc`, cursor `(0,0)`.

**Reproduce B:** same text, keys `r<CR>`. Expected `\nabc`; actual `\n abc`.

**Source:** `src/vim/commands.ts:541`: ordinary replacement repeats `c.arg` verbatim, including named-key notation; the CR branch directly slices the remaining text without the applicable whitespace handling.

**Fix shape:** decode accepted replacement keys and implement Tab/newline behavior with the relevant options. Keep printable replacement, rejected arguments, and literal insertion distinct.

## 13. Medium — `J` deletes pre-existing trailing whitespace

**Reproduce:** text `one  \n two`, keys `J`. Expected `one  two`, cursor `(0,5)`; actual `one two`, cursor `(0,3)`.

**Source:** `src/vim/commands.ts:569` strips all trailing whitespace before choosing the join separator.

**Fix shape:** preserve the existing separator whitespace and add a separator only when Neovim would. Include assertions for cursor position as well as the resulting line.

## 14. Medium — Insert-mode `<C-g>u` does not split the undo block

**Reproduce:** text `  abc`, keys `iX<C-g>uY<Esc>u`. Expected `X  abc`; actual `  abc`.

**Source:** `src/vim/editor.ts:1277` (`insertKey`) and `:1299` dispatch do not implement the Insert `<C-g>` prefix/undo break. Insert pending-key types at `:129` omit it too.

**Fix shape:** implement an Insert undo boundary without leaving Insert mode; the next `u` must undo only the text entered after that boundary. Include dot-repeat coverage after the split.

## Follow-up verification priorities

1. Fix recovery cursor/history behavior and multiline range construction first; these make ordinary follow-up edits diverge even when a one-step text assertion passes.
2. Extend the permanent Neovim harness to check cursor, register text/type, and representative follow-up commands, with fresh option/history state and isolated filesystem writes.
3. Keep the 387 passing text solutions as a regression baseline. They do not establish cursor/register correctness, and the six line-jump cursor references above need a deliberate configuration decision.
