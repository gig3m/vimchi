# Copy review: Code band, challenges, coaching surfaces

Reviewer: code band. Branch `copy`, 2026-09-30. Scope: `neovim-builtins.tsx` (not `codeNavigation`),
`more-text-objects.tsx`, `jumping.tsx`, `surround.tsx`, `insert-power.tsx`, `git.tsx`, `challenges.tsx`,
the copy in `src/coach/patterns.ts`, `Results.tsx`, `BetterWays.tsx`, `WarmUp.tsx` and `Checklist.tsx`.

Standard applied: every prompt names its target by what is on screen (text you can see, a sign, a fold
line, a field), never by what the code means ("the callback", "the ternary", "the retry loop"). Claims
were checked against `nvim --clean` 0.12.5, kickstart's current `init.lua` (fetched; it now uses
`vim.pack`) and the installed LazyVim (June 2026) plus snacks/blink sources.

Rounds, setups, goals, solutions, chips and keyCard keys are unchanged. `vitest src/lessons src/coach
src/components` (1909 passed) and `tsc --noEmit` are green.

## Neovim Built-ins

**commenting** — edited
- neovim-builtins.tsx:204 "Comment out the debug log." → "Comment out the console.log line."
- :213 "Turn off the whole block of options." → "Comment out the three lines below the blank one."
- :225 "Bring the commented-out retry loop back." → "Uncomment the three commented-out lines." (assumed you
  could read a for loop)
- :262 "Comment out the three export lines." → "Comment out the cursor line and the two below it." (the
  file has four export lines, so the old prompt was ambiguous)
- `gc` text object / `gcgc` aside verified against Neovim 0.12 (`o_gc`).

**lsp-rename** — edited
- :294 intro: "symbol" is now glossed: "(a variable, function or type name)".
- `New Name: ` prompt verified in 0.12's `lsp/buf.lua`.

**code-actions** — edited; one owner call
- :480 "Convert the concatenation to a template string." → 'Open the code actions and pick "Convert to
  template string".' (names the menu entry, not the concept)
- :498 "req is unused. Keep the parameter but prefix it…" → "Jump back to the hint on req, then pick the
  second action, which adds an underscore." (the diagnostic is on the line above the cursor; the old
  prompt never said so)
- :515 "res is a Promise. Let the server add the missing await." → "Jump to the error on json and apply
  the fix that adds await."
- Owner: the intro says "Pick one … with j/k and enter, or its number", and round 5's reference is
  `gra1` with no Enter. That is the tutor's menu. Stock Neovim's `vim.ui.select` is `inputlist()`: type
  the number, then Enter; j/k do nothing. Recommend the aside say "In stock Neovim you type the number
  and press Enter", or the sim require `<CR>` after a digit.

**format-file** — edited
- :584 aside rewritten. kickstart's `format_on_save` has an empty `enabled_filetypes` table, so out of
  the box it formats nothing on save. The old "So mostly you meet it through :w" read as true for both
  starters. Also dropped the repeat of `Space cf` (the key card already carries it).
- Verified: kickstart `<leader>f` works in n and v; LazyVim `<leader>cf` works in n and v.

## More Text Objects

**next-last-objects** — edited; one owner call
- Intro: dropped "and treesitter-textobjects", which kickstart doesn't ship. Now "with the mini.ai
  plugin".
- Prompts: "Change "parse" to "render"." / "Change both toBe(1) to toBe(0)." / "Change [j] to [k] on both
  lines." / 'Empty the parentheses around "cached".' (were "Pass render to then()", "Both expected
  values are 0", "index the column with k", "Empty the first condition").
- Aside rewritten, title "kickstart's keys". **Accuracy finding:** kickstart now sets mini.ai
  `around_next = 'aa', inside_next = 'ii'`, because Neovim 0.12 maps `in`/`an` for treesitter selection.
  So `cin(` is `cii(` there. Verified headless with mini.ai and kickstart's options: `din(` falls
  through to Neovim's LSP/treesitter selection, and `dii(` works.
- Owner: the chips `in(` are LazyVim-only, which is fine per rule 5 as long as the aside names the
  alternative (it now does).

**argument-objects** — edited; owner call
- Prompts: "Delete the email argument on both lines." / "Delete the url argument inside fetch( )." /
  'Replace "a + b" with "sum".' / "Delete extra from the log and send lines." / 'Replace "60 * 1000"
  with 0.'
- Aside: replaced the targets.vim/`i,` line. **Accuracy finding:** in kickstart `aa` is mini.ai's
  "around next" prefix, so `daa` waits for another key and never deletes an argument (verified
  headless: `daa` left the line unchanged). `ia` works in both.
- Owner: `aa` is not a shared key. Keep it as LazyVim's and rely on the aside (current state), or teach
  `ia` alone.

**indent-objects** — edited; owner call
- Prompts: "Replace the lines under each def with pass." / 'Delete both "if DEBUG:" blocks.' / 'Delete
  the whole if block, from "if" to "end".' / 'Replace the two lines under "except OSError:" with
  raise.' / 'Delete the indented lines under "- Setup" and "- Usage".'
- Aside: **was wrong.** LazyVim's mini.ai config has no `i` object. `ii`/`ai` come from snacks.nvim's
  scope module (`snacks.scope`, enabled in LazyVim's ui.lua). Also added that kickstart has none (its
  `ii` is "inside next").
- Owner: this lesson is LazyVim-only. The rule-5 bar (shared key, or taught by two sources) should be
  checked.

**function-class-objects** — edited
- Intro defines treesitter ("the parser behind Neovim's syntax colours").
- Prompts: "Delete the debug() and dump() blocks." / "Delete the LegacyStore class." / "Replace
  everything inside the class with: n = 0;" / "Make a second copy of add() and its body." / "Copy the
  body of onOpen() over the body of onSave()." / "Delete the function inside forEach( ), leaving
  items.forEach();" (was "The callback is gone.").
- Aside: added that in kickstart mini.ai's own `f` is a function *call* and there is no `c`.

**function-motions** — edited; owner call
- Aside rewritten. **Accuracy finding:** LazyVim maps the treesitter moves to `]f`/`[f` (`]F`/`[F`
  for ends), not `]m` (plugins/treesitter.lua:149). In LazyVim `]m` is Vim's Java-only built-in.
  kickstart has no textobjects plugin.
- Owner: the chips `]m`/`[m` match neither starter. Recommend re-keying the lesson to `]f`/`[f` (a chip,
  solution and keymap change, so not done here), or cutting it.

**toggle-folds** — edited
- Prompts: "Open the retryDelay fold and change 250 to 500." / "Open the cancelOrder fold and the fold
  inside it, then delete "already "." / "Close every fold, then open only listOrders…" (was "Fold
  everything", which is ambiguous) / "Close the retryDelay fold."
- Aside verified: LazyVim sets `foldexpr` to treesitter with `foldlevel=99`.

## Jumping

**flash-jump** — clean. Aside matches the flash and kickstart rulings.

**flash-motions** — edited
- Prompts: `Delete "role: 'admin', " backwards from email.` / "Delete .filter(u => u.active), backwards
  from .map." / 'Change everything between "label = " and the final ";" to noun.' (was "Replace the
  whole ternary").

**flash-treesitter** — edited
- Intro: defines node ("Treesitter reads code as nested pieces called nodes").
- Aside: "nvim-treesitter's incremental selection" → "Incremental selection (built into Neovim 0.12)".
  nvim-treesitter's main branch dropped it; 0.12 maps `an`/`in`/`]n` in visual mode.
- Prompts: "Empty the parentheses of sum()." / 'Replace "() => refresh(true)" with reload.' / 'Replace
  "{ count: 3, delay: 500 }" with false.' / "Delete the three lines of the if block."

## Surround

**add-surroundings** — edited
- Aside: **was wrong about aliases.** mini.surround has only `b` (output `)`) and `q` (output `"`). The
  `B` = `}` and `r` = `]` aliases are nvim-surround's; the sim accepts them, but real mini.surround does
  not. Also trimmed the aside to three sentences.
- Prompts: "Put the three numbers in square brackets." / 'Wrap "silent = true" in braces, with spaces
  inside.' (was "in a table") / 'Put backticks around "npm install".'

**change-surroundings** — edited
- Intro: removed "If it isn't inside one, nvim-surround uses the next pair on the line". It named the
  wrong plugin, and mini's default `search_method = 'cover'` (which the sim's `gsr` models) never uses a
  pair ahead of the cursor.
- Prompts: "Switch 'express' to double quotes." (the unquoted `express` is on the same line) / "Swap
  the double quotes around the path for backticks." / "Change (x, y) to [x, y]." / "Swap [ ] for { },
  with spaces inside."

**delete-surroundings** — edited
- Prompts: "Remove the inner pair of parentheses." / "Remove the quotes around 8080." / "Remove the
  parentheses and the spaces inside them." / 'Remove the underscores around "really".' / "Remove String(
  ) and keep user.id."

**find-surroundings** — edited; owner call
- Prompts: "…closing parenthesis of sum(." / "…opening parenthesis of taxFor(." / "Jump to the </p>
  tag." / "Jump to the { on the first line." ("of the call" and "of the inner call" were ambiguous in
  nested calls).
- Owner: the intro says that when the cursor is outside a pair, `gsf`/`gsF` "find the next one on the
  line", and the sim implements that (`jump` has no `coverOnly`). mini.surround's default
  `search_method` is `'cover'`, and I could not confirm that find ignores it. Worth a check in real
  LazyVim. No round depends on it (every round starts inside the pair).

**surround-a-selection** — edited
- Prompts: 'Put "lo + hi" in parentheses.' / 'Put "string | null" in parentheses.' / 'Put "migration
  guide" in square brackets.' / "Wrap all three lines in braces." / "Put double quotes around $HOME/My
  Apps/."
- Note: round 5's reference `vg_gsa"` uses `g_`, which no lesson teaches. The coach's
  "(uses a key from a later lesson)" does not cover a key no lesson teaches.

**surround-with-tags** — edited
- Prompts: 'Change the outer <div> to <section>, keeping className="card".' / "Change <h2> to <h3>." /
  'Wrap "Buy milk" in <li> tags.' / 'Wrap "never" in <em> tags.'

## Insert Mode Power

**insert-delete-word** — edited
- Prompts: 'Everything before the cursor is wrong. Retype it as "return v".' / 'Both words before the
  cursor are wrong. Retype them as "local ok".' (neither old prompt said what to type).
- Verified: 0.12 `i_CTRL-U` keeps the indent, and both keys are mapped to start an undo step.

**insert-one-command** — edited
- 'Add "await " before the call.' → 'Add "await " before fetchJson.'

**completion-menu** — edited
- Practice: added "(In the browser, Alt-n stands in for C-n.)" per LESSONS.md; it was missing.
- Aside verified: LazyVim blink `preset = "enter"` + explicit `<C-y>`; kickstart preset `default`.

**snippets** — edited
- Intro: "fields" is now defined ("blanks to fill, called fields") before the key cards and prompts use
  it. **Accuracy:** "both starters wire friendly-snippets in" was wrong, because kickstart has it
  commented out. Now "LazyVim includes it; kickstart has it as a commented-out line to turn on."
- Prompts: "Expand if, then type ok in the first field and go() in the second." / "Expand log and type
  total in its field." / 'The field after "function" is empty. Go back two fields and type id.' / "The
  cursor is in the last field, inside the braces. Expand log there and type x."

## Git

**gitsigns-hunks** — edited
- Intro: defines the sign column ("the strip left of the line numbers") and **hunk** ("Each run of
  changed lines is a hunk"). "Hunk" was used undefined in the lesson title, cards and prompts.
- kickstart `]c`/`[c`, `<leader>hs/hr` and LazyVim `]h`, `<leader>ghs/ghr/ghp` verified.

**gitsigns-stage-hunk** — edited; minor owner call
- Intro: "putting back what the index has" → "its lines go back to the last staged or committed
  version" (index was undefined).
- Prompts: "Stage the hunk the cursor is in." (was "the argparse setup in main()") / "Bring back the
  deleted line: reset the hunk marked with a red _." (**the old prompt named `sys.stdout.flush()`, a
  line that is not on screen**) / 'Reset the hunk that adds the print("DEBUG", …) line.'
- Owner: "its sign disappears" on stage. Current gitsigns shows staged hunks with dimmer staged signs
  (`signs_staged_enable` defaults to true). Fine for the sim; consider "its sign fades".

**git-lazygit** — edited
- Intro: "the starters hand you lazygit" → "LazyVim hands you lazygit" (the aside says kickstart doesn't).

## Challenges

- **challenge-registers-macros** — edited. The intro used `+`, which no lesson teaches, in
  `qa … + q`. It now glosses it: "where + moves to the first character of the next line". Owner: the
  macro mutation's par (`registers.ts:161`) is built on `+`. Consider teaching `+` somewhere (Motions
  Worth Knowing, next to `^`/`_`) or building par on `j0`/`j^`.
- challenge-fix-the-file, challenge-operators, challenge-objects-visual, challenge-rename-replace —
  clean. Every key they name is taught before the band they cover.

## Coaching surfaces

**patterns.ts** — edited (principles only; ids, names and lessons unchanged)
- bracket-object: "between the brackets" → "between the parentheses" (it's `i(`)
- tag-object: "it is everything inside the tag pair" (reads as the pronoun) → "it (inner tag) is
  everything between the opening and closing tag"
- line-end-insert: "carry their own motion" (jargon) → "jump to the end or start of the line and start
  typing, from anywhere on it"
- jump-line: "NG (or gg/G)…" → "42G goes straight to line 42; gg and G to the top and bottom"
- paragraph: "jump over blocks to the blank line" → "jump to the blank line before or after a block"
- half-page: `<C-d>` → `C-d` (chip notation, as elsewhere in the copy)
- case-op: "gU/gu" → "gU and gu"
- The other names and principles read clearly to a beginner.

**BetterWays.tsx** — edited
- Reference item line "par X, you Y" → "par X, you used Y", matching the round line below it.
- Owner: "saves 3" would be clearer as "saves 3 keys". That needs a plural, which is logic, so I left it.
  Suggestions always save ≥ 2, so a bare "keys" would do.

**Results.tsx** — edited
- "+2.1s off your best" ("off" can read as faster) → "2.1s behind your best".
- The other labels (Par, Personal best, Score, Speed/Accuracy/Clean rings, Repeat/Reps/Next/Your
  stats/New file, Again/Same file/Back to lesson) are clean.

**WarmUp.tsx** — edited
- "the ones you found slow or keyed long" → "the ones that were slow or took extra keys"
- "each edit is one a lesson above taught" → "each edit comes from one of the lessons above"
- "Nothing due: your most recent lessons" → "Nothing due yet: these are your most recent lessons"

**Checklist.tsx** — clean ("Edits", "n / m").

## Counts

- Lessons read: 31 (26 Code-band lessons, excluding codeNavigation, plus the 5 challenge intros)
- Lessons edited: 26 (25 of the 26 Code-band lessons, all but flash-jump, plus
  challenge-registers-macros)
- Component/coach files edited: 4 of 5 (Checklist clean)
- Rounds flagged for an owner change: 0 rounds need a setup/goal change to be solvable (every one
  now points at visible text). Structural flags (chips/keys, not rounds): function-motions `]m` vs
  LazyVim `]f`; `aa`, `ii` and `in(` as LazyVim-only keys; code-actions menu vs stock `inputlist`;
  `+` in the macro par; `g_` in surround-a-selection round 5.
