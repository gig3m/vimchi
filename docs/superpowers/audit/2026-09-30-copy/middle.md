# Copy review: Repeat, Project and Patterns bands

Reviewer: middle. Branch `copy`, 2026-09-30. Files: registers, macros, buffers-files, windows-tabs,
marks-jumps, quickfix, finding-things (Pickers), file-navigation (Explorer), command-line, substitute,
global-commands, and the `codeNavigation` section of neovim-builtins (diagnostics, definition-hover,
references, document-symbols). That is lessons 72–157 in the current `CURRICULUM.md` (the brief's
64–140 predates the renumbering).

Most edits apply one rule: **name the target by what is on screen, not by what the code means.**
Prompts like "Swap the first two helper functions", "Rename the Line type", "Open the db module this
route imports" and "Keep only the exported functions" became "Move the `function format` block below
the `function sum` block", "The list holds every whole word `Line`. Change each to Row", "Open
`'../db'`, the path on the cursor's line" and "Keep only the lines that start with `export`".
Statement-style goal prompts ("Every value is quoted.") became instructions. Where a round needs
something the learner cannot see, the prompt now says it: where the cursor or the tree is, which
window is current, what a register or the quickfix list already holds, and any regex atom the
pattern needs.

No setups, goals, solutions, chips, keyCard keys or lesson order changed. Three keyCard `sub` texts
changed (jargon, and a LazyVim fact). `npx vitest run src/lessons src/coach` (1895 passed) and
`npx tsc --noEmit -p .` are green.

## Judgment calls for the owner

1. **Rounds that need commands from later sections.** The registry test only checks solution keys
   against chips, so these pass today.
   - `paste-while-typing` R4 (lesson 79): the solution `yiw:%s/<C-r>0/amount/g<CR>` needs
     Substitute (135). *Recommend* an insert-mode round in its place, e.g. cursor on `amt`,
     `gateway.charge()` → `gateway.charge(amt, amt)` with `yiwjf(a<C-r>0, <C-r>0<Esc>`. I also changed
     the intro's example from `:%s/` + `C-r 0` to `/` + `C-r 0`, which is already taught.
   - `cmdline-word` (132): all four rounds need `:%s`, `:g` or `:s` (135, 151). I put the command's
     shape in each prompt so the rounds are solvable. *Recommend* moving the lesson into Substitute,
     right after `sub-last-search` (147), or rebuilding its rounds on `/` + `C-r C-w`,
     `:vimgrep /C-r C-w/ %` and `:e C-r C-a`, which are all taught by then.
   - `edit-every-match` (110): every round is `:cdo s//new/ | update` or `:cdo d`, before Substitute
     (135) and Ex delete (127). The intro now shows `:s/old/new/` and says what it does, R2's prompt
     says ":d deletes a line", and the practice line already explained `s//new/`. It works as it is.
     *Recommend* keeping it, or moving `:cdo`/`:bufdo` into Patterns after Substitute.
   - `every-buffer` (112): R2's solution uses the `#` delimiter (`%s#api/#api/v2/#e`). That is only
     an aside in Capture Groups (141), and the alternative, escaping `/` as `\/`, is never taught.
     *Recommend* a change with no slash in it, e.g. every `fetch(` → `http(` in both buffers, goal to match. R4 needs
     `:g/TODO/d` (Global, 151). *Recommend* `:bufdo %s/TODO/DONE/ge | update` with a matching goal.
     The intro now spells out `:bufdo %s/old/new/ge` and what `%`, `g` and `e` do.
   - `global-normal` R1 (153): `:g/console/norm gcc` uses Commenting (158, Code band). The prompt now
     says "gcc comments out a line". *Recommend* the reference `:g/console/norm I// ` (same goal text,
     since the goal is `  // console.log(...)`) and dropping the hint.
   - `grep` R4: the reference `:vimgrep /\<total\>/ %` uses Word Boundaries (139). `:vim /total/ %`
     gives the same two entries. *Recommend* that as the reference.
2. **Regex atoms nobody teaches.** Substitute and Global lean on `^`, `$`, `.`, `.*`, `\s`, `\S`, `\d`,
   `\w`, `\l`, `[^,]`, `\[`, `\.` and `\{3,}` without a lesson for them. I added a short hint to every
   round that needs one ("In a pattern, ^ is the start of a line", "Write the dot as \.", "\S matches
   anything but a space or tab"), and Capture Groups' intro now defines `\d` and `\w`. *Recommend* a
   short "Pattern Atoms" lesson (chips `^` `$` `.` `\s`) at the start of Substitute, or in Search after
   27, so the hints can go.
3. **`Enter` vs `CR`.** Buffers, Command Line and Quickfix say `Enter`. Pickers, Explorer, Document
   Symbols and their keyCards say `CR`. Command Window's keyCard says `enter`. `docs/LESSONS.md` doesn't
   pick one. *Recommend* `Enter` in prose and `CR` only as a keyCard key, and adding that rule to
   LESSONS.md. Not changed.
4. **Previews in asides.** Where an aside or intro names a later key, I marked it as a preview
   instead of cutting it: `:g/TODO/y A` (Appending), `@:` (Read-Only Registers), `C-r C-w` (Paste
   While Typing), `:'a,.d` / `:'a,'bs` (Operating to Marks), `:vs #` (Alternate File) and `[d ]d`
   (Location List). Jump List's intro used `gd` (114) as its example; it now uses `gf` (91).
5. **Code Navigation** lessons are about code by nature (definitions, implementations, `[Method]`
   labels). I kept the words the symbol list and hover float show, and made every prompt say where
   the cursor is. Where the entry is ambiguous, the prompt picks it by file and line (e.g. "the second
   entry, line 7 of cart.ts"), so no round needs reading the TypeScript.

## Per lesson

Each edit reads `file:line: before → after` (line numbers are the current file's).


### registers

**unnamed-register**: edited

- registers.tsx:48: next lesson shows where the yank went. <Code>"+</Code> is the system clipboard; <Code>:reg</Code> lists every  → next lesson shows where the yank went.{' '} <Code>:reg</Code> lists every register; <Code>"+</Code> is the system clipboard. </p>
- registers.tsx:111: 'The tax is used before it is defined. Move its line up one.', → 'Move the "const tax" line up one, above "const total".',
- registers.tsx:120: 'Swap the first two helper functions.', → 'Move the "function format" block below the "function sum" block.',

**yank-register**: edited

- registers.tsx:182: title: 'One more idea', → title: 'Replacing many words',
- registers.tsx:195: 'Give staging the same retries line as prod.', → 'Replace the "retries: 1" line with a copy of "retries: 5".',
- registers.tsx:250: 'Match the react-dom version to react.', → 'Change "^18.3.1" to "^19.1.0", copied from the line above.',
- registers.tsx:260: 'Use the local "map" alias on both lines below it.', → 'Replace "vim.keymap.set" with "map" on the last two lines. The cursor is on "map".',
- registers.tsx:282: 'Replace both stale lines with the export line.', → 'Replace the last two lines with one copy of the first line.',

**named-registers**: edited

- registers.tsx:338: 'Yank the query line into register q.', → 'Yank the "sql =" line into register q.',
- registers.tsx:353: 'Save the URL in u and the header name in k.', → 'Yank the text inside the quotes: the postgres URL into u, "X-Api-Key" into k.',
- registers.tsx:368: 'Give the orders suite the same beforeEach and afterAll.', → 'Copy the beforeEach line above "lists orders" and the afterAll line below it.',
- registers.tsx:401: 'Register h holds the license header and s the strict pragma. Put both at the top, h first.', → 'Registers h and s each hold one line. Put both at the top of the file, h first.',

**appending-registers**: edited

- registers.tsx:454: Clear the register with <Code>qaq</Code>, then <Code>:g/TODO/y A</Code> appends every matching line in one com → A preview of Global Commands: clear the register with <Code>qaq</Code>, then{' '} <Code>:g/TODO/y A</Code> appends every matching line in on
- registers.tsx:496: 'Move both imports to the top of the file.', → 'Move both "import" lines to the top of the file.',
- registers.tsx:520: 'Register e already holds one exported name. Add the other two lines to it.', → 'Register e already holds an export line. Append the parse and validate lines to it, in that order.',
- registers.tsx:535: 'Cut the two debug lines into t and put them at the bottom.', → 'Cut the two DEBUG lines into t and put them at the bottom.',

**delete-history**: edited

- registers.tsx:612: 'Three lines were deleted. Put the first one back below the cursor.', → 'Three lines were deleted, the router.post line first. Put it back below the cursor.',
- registers.tsx:640: 'Two lines were deleted. Put back the first one, the return, below the cursor.', → 'The "return" line was deleted, then "# FIXME". Put the return line back below the cursor.',
- registers.tsx:662: 'A word was cut, then a line. Put the word back before "function".', → 'A word was cut, then a line. Put the word back before "function", where the cursor is.',
- registers.tsx:676: 'Delete the "old" line, then put the benchmark task deleted earlier back at the end.', → 'Delete the "old:" line, then put the "benchmark" line, deleted earlier, back at the end.',

**black-hole-register**: edited

- registers.tsx:730: 'Replace the two log lines with a copy of the return line.', → 'Replace the log.Println and os.Exit lines with a copy of the return line.',
- registers.tsx:756: 'Replace "ctx2" with the yanked "ctx".', → 'Replace "ctx2" with "ctx", copied from the line above. The cursor is on it.',
- registers.tsx:777: 'Swap in the yanked name for "tmp", keeping the comma.', → 'Replace "tmp" with "start_date". The cursor is on start_date.',
- registers.tsx:799: 'Replace the placeholder paragraph with the yanked intro.', → 'Replace the "Lorem ipsum" paragraph with a copy of the line the cursor is on.',

**read-only-registers**: edited

- registers.tsx:850: <Code>@:</Code> runs the <Code>{'":'}</Code> register as a command again, and <Code>@@</Code> repeats that. It → <Code>@:</Code> runs the <Code>{'":'}</Code> register as a command again, and <Code>@@</Code> repeats that: dot-repeat for Ex commands. Repe
- registers.tsx:860: 'You just renamed sum to subtotal where it is declared. The return and log() use subtotal too.', → 'You just changed "sum" to "subtotal" with cw. Do the same to "return sum", and put subtotal inside log().',
- registers.tsx:876: 'Finish the header comment with the file name.', → 'Add the file name after "// File: ".',
- registers.tsx:898: 'Paste the command you just ran into the code block.', → 'Put the command you just ran on a new line between the ``` lines, with a ":" in front.',
- registers.tsx:913: 'Name the module after its file.', → "Put the file name between the empty quotes ''.",

**paste-while-typing**: needs a round change (R4)

- registers.tsx:943: <Code>:%s/</Code> and <Code>C-r 0</Code> to search for it. → <Code>/</Code> and <Code>C-r 0</Code> searches for it.
- registers.tsx:956: On the command line, <Code>C-r C-w</Code> inserts the word under the cursor without yanking it first.{' '} <Co → On the command line, <Code>C-r C-w</Code> inserts the word under the cursor without yanking it first. The Command Line section drills it; wi
- registers.tsx:966: 'The log prints orderTotal, labelled with its name.', → "Make the log line read console.log('orderTotal', orderTotal). The cursor is on orderTotal.",
- registers.tsx:989: 'The cache key is str(order_id).', → 'Change "cache.set(order_id," to "cache.set(str(order_id),".',
- registers.tsx:1011: 'Register u holds the endpoint. url is set to it.', → 'Register u holds a URL. Put it between the empty quotes on the first line.',
- registers.tsx:1035: 'Every "amt" is "amount".', → 'Change every "amt" to "amount".',
- registers.tsx:1051: "The getter reads the 'theme' key.", → "Put 'theme', with its quotes, inside the empty get().",

**expression-register**: edited

- registers.tsx:1102: 'Fill in one day in milliseconds.', → 'Fill in one day in milliseconds: 24*60*60*1000.',
- registers.tsx:1111: 'Fill in the total.', → 'Fill in the Total row: the three costs added up.',
- registers.tsx:1121: 'Set the upload limit to 25 MB in bytes.', → 'Replace the 0 with 25 MB in bytes: 25*1024*1024.',
- registers.tsx:1130: 'Underline the 23-character heading with "=" signs.', → "Add a line of 23 '=' under the heading. repeat('=', 23) builds it.",
- registers.tsx:1140: 'Fill in the line total for 3 mugs at 4.99, to two decimals.', → 'Replace the total 0 with 3 * 4.99, to two decimals (see the aside).',

### macros

**recording-macro**: edited

- macros.tsx:55: 'Turn each line into a list item.', → 'Put "- " in front of each item line.',
- macros.tsx:64: 'End every statement with a semicolon.', → 'Add ";" to the end of every line.',
- macros.tsx:88: 'Quote each key.', → 'Put double quotes around the word before each ":".',
- macros.tsx:98: 'Every print is a debug() call.', → 'Change each "print" to "debug".',

**replaying-macros**: edited

- macros.tsx:170: 'Add a trailing comma to every row but the last.', → 'Add "," to the end of every quoted line except the last.',
- macros.tsx:182: 'Register a comments out a line and moves down. Comment out all four.', → 'Register a puts "-- " at the start of a line and moves down. Run it on four lines, from the cursor.',
- macros.tsx:209: 'Fill in seats 2 to 6 by copying the row and bumping the number.', → 'Add seats 2 to 6: copy the INSERT line and bump its first number by one each time.',
- macros.tsx:230: 'Every constant name is uppercase.', → 'Uppercase the name after each "export const".',

**robust-macros**: edited

- macros.tsx:291: 'Every value is quoted.', → 'Put double quotes around everything after each "=".',
- macros.tsx:314: 'Turn each "name url" line into a Markdown link.', → 'Rewrite each "name url" line as [name](url).',
- macros.tsx:330: 'Turn each parameter into a dict entry.', → "Turn each bare name into 'name': name, with a comma at the end.",
- macros.tsx:349: 'Change each default value to null, keeping the names.', → 'Change each value after ":" to null, keeping the commas.',

**recursive-macros**: edited

- macros.tsx:415: 'Make every line a checkbox item.', → 'Add "[ ] " after the "- " on every item line.',
- macros.tsx:444: 'Delete every debug line. The search failing ends it.', → 'Delete every console.debug line. The search failing ends the macro.',
- macros.tsx:471: 'Wrap every function name in backticks.', → 'Wrap the word before each " - " in backticks.',
- macros.tsx:499: 'Join each key with its value on the next line, with ": " between.', → 'Join the lines in pairs, with ": " between the two halves.',

**editing-macros**: edited

- macros.tsx:527: Yank with <Code>y$</Code>, not <Code>yy</Code>. A linewise yank adds a newline, and the macro would press Ente → Yank with <Code>y$</Code>, not <Code>yy</Code>. <Code>yy</Code> takes the line's newline too, and the macro would press Enter at the end.
- macros.tsx:573: 'Register c removes one character, but each comment starts with "# ". Make it 02xj, then uncomment all three.' → 'Register c removes one character, but each line starts with "# ". Make it 02xj, then run it on all three lines.',

**boss-csv-to-object**: edited

- macros.tsx:598: A CSV export pasted into a TypeScript file needs to become code. Five rows, a few fields each: exactly the kin → A CSV export pasted into a TypeScript file needs to become code. A handful of rows, a few fields each: exactly the kind of repetition a macr
- macros.tsx:627:  → "Turn each row into [id, 'name'],",
- macros.tsx:654:  → "Turn each row into ['code', price],",
- macros.tsx:673:  → 'Turn each row into name: value,',

### buffers-files

**opening-files**: clean


**buffer-list**: edited

- buffers-files.tsx:242: 'Switch to the notes routes.', → 'Switch to src/routes/notes.ts.',
- buffers-files.tsx:252: 'Back to the README.', → 'You are in index.ts. Switch back to the README.',

**cycling-buffers**: clean


**alternate-file**: edited

- buffers-files.tsx:362: <Code>C-^</Code> does, and <Code>:vs #</Code> opens it in a split. → <Code>C-^</Code> does. Once you meet splits, <Code>:vs #</Code> opens it beside you.
- buffers-files.tsx:383: 'Open the imported src/db.ts, then flip back.', → 'Open src/db.ts, then flip back.',

**closing-buffers**: edited

- buffers-files.tsx:436: "You're done with the README. Close it.", → 'Close the README, the buffer you are in.',
- buffers-files.tsx:454: "notes.ts has edits you don't want. Close it anyway.", → "You are in the README. Close notes.ts, which has edits you don't want.",

**go-to-file**: edited

- buffers-files.tsx:505: 'Open the server module.', → "Open './server', the path on the cursor's line.",
- buffers-files.tsx:510: 'Open the notes routes.', → "Open './routes/notes', the path on the cursor's line.",
- buffers-files.tsx:516: 'Open the settings file the README mentions.', → "Open src/config.ts, named on the cursor's line.",
- buffers-files.tsx:522: 'Open the db module this route imports.', → "Open '../db', the path on the cursor's line.",
- buffers-files.tsx:528: 'Follow the import from the test to the server.', → "Open '../src/server', the path on the line below the cursor.",
  - Verified the intro claim: `ft=typescript` sets `suffixesadd=.ts,.d.ts,.tsx,.js,...` (runtime ftplugin/typescript.vim).

**finding-files**: edited

- buffers-files.tsx:584: 'Open the notes test.', → 'Open notes.test.ts.',
  - Verified: Neovim's default `path` is `.,,`, as the aside says.

### windows-tabs

**splitting**: edited

- windows-tabs.tsx:182: 'Open lsp.lua above telescope.lua, on the left.', → 'You are in telescope.lua, on the left. Open lsp.lua above it.',
- windows-tabs.tsx:188: 'Split this window horizontally.', → 'Split this window in two, one above the other.',

**moving-between-windows**: edited

- windows-tabs.tsx:217: Four windows are open. Move to the one each round names. {ALT_NOTE} {total} rounds. → Four windows are open: keymaps and options on the left, lsp and init on the right. Move to the one each round names. {ALT_NOTE} {total} roun

**closing-windows**: edited

- windows-tabs.tsx:305: 'Close the window below this one.', → 'You are in keymaps.lua. Close options.lua, the window below.',
- windows-tabs.tsx:317: 'Close the window to the left.', → 'Close init.lua, the window to the left.',

**resizing-windows**: edited

- windows-tabs.tsx:348: Resize the windows the way each round asks. {ALT_NOTE} {total} rounds. → Resize the windows the way each round asks. The four-window rounds have keymaps and options on the left, lsp and init on the right. {ALT_NOT
- windows-tabs.tsx:384: 'Maximize the height of the window below.', → 'You are in keymaps.lua. Give options.lua, the window below, all the height.',

**rearranging-windows**: edited

- windows-tabs.tsx:440: 'Turn the stack into a side-by-side split, keymaps on the right.', → 'keymaps.lua is above options.lua. Move keymaps to the right, side by side.',
- windows-tabs.tsx:446: 'Put init.lua on top, full width.', → 'You are in init.lua. Put it on top, full width.',

**tab-pages**: clean


### marks-jumps

**setting-marks**: clean


**operating-to-marks**: edited

- marks-jumps.tsx:183: { key: "d'a", glyph: '⚑↕', label: 'lines to mark', sub: 'linewise' }, { key: 'y`a', glyph: '⚑↔', label: 'chars → { key: "d'a", glyph: '⚑↕', label: 'lines to mark', sub: 'whole lines' }, { key: 'y`a', glyph: '⚑↔', label: 'chars to mark', sub: 'exact spot
- marks-jumps.tsx:213: Ex commands take marks as addresses: <Code>:'a,.d</Code> is the same delete as <Code>d'a</Code>, and{' '} <Cod → Coming up in Command Line: Ex commands take marks as line numbers, so <Code>:'a,.d</Code> is the same delete as <Code>d'a</Code>, and <Code>
- marks-jumps.tsx:223: 'Delete the old implementation, from mark a down to the cursor line.', → 'Delete every line from mark a, on "// old implementation", down to the cursor line.',
- marks-jumps.tsx:242: 'Yank from mark a to the cursor and put it inside the log call.', → 'Yank from mark a to the cursor, then put it inside the empty console.log().',
- marks-jumps.tsx:291: 'Delete the legacy arguments, from mark a up to the cursor.', → 'Delete from mark a, the comma after "cols", up to the cursor.',
- marks-jumps.tsx:314: 'Copy the checklist, mark a to the cursor line, to the end of the file.', → 'Copy the lines from mark a to the cursor line to the end of the file.',

**file-marks**: clean


**back-to-edit**: edited

- marks-jumps.tsx:466: 'You left mid-line to check the import. The throw ends (res.status);', → 'You left insert mode mid-line and went to the top. Finish the line with "status);".',
- marks-jumps.tsx:494: 'The number you just typed reads 30_000.', → 'You just typed 30000 and moved away. Make it 30_000.',
- marks-jumps.tsx:546: 'You jumped to the top to check the title. The sentence ends "in your browser tab."', → 'You left insert mode mid-sentence and went to the top. Make it end "in your browser tab."',

**change-edges**: edited

- marks-jumps.tsx:630: 'You yanked the arguments of formatPrice. Jump to the end of them.', → 'You yanked the text inside formatPrice( ). Jump to the end of it.',
- marks-jumps.tsx:646: 'You replaced 5000 with an expression. Jump to its first character.', → 'You changed 5000 to "FREE_MIN * 2". Jump to its first character.',

**previous-position**: clean


**jump-list**: edited

- marks-jumps.tsx:754: Unlike <Code>``</Code>, it goes more than one step, and it crosses files: <Code>gd</Code> into a definition, t → Unlike <Code>``</Code>, it goes more than one step, and it crosses files: <Code>gf</Code> into another file, then <Code>C-o</Code> brings yo
- marks-jumps.tsx:770: <Code>3C-o</Code> goes back three jumps at once. → <Code>3 C-o</Code> goes back three jumps at once.
- marks-jumps.tsx:786: 'Go back two jumps.', → 'You searched, then pressed G. Go back two jumps.',
- marks-jumps.tsx:804: 'Go back to where the search landed.', → 'You searched for "res.json", then pressed G. Go back to where the search landed.',

**change-list**: clean


### quickfix

**grep**: edited; reference solution uses an untaught atom (R4)

- quickfix.tsx:133: quickfix list, then jumps to the first one. <Code>**</Code> reaches into subdirectories and <Code>%</Code>{' ' → quickfix list, Vim's list of places to visit, then jumps to the first one. <Code>**</Code> reaches into subdirectories and <Code>%</Code>{' 
- quickfix.tsx:172: 'Find the fetch calls in src/api only.', → 'Find every "fetch" in the files under src/api.',
- quickfix.tsx:177: 'Find the word "total" in this file only.', → 'Find "total" in this file only.',

**quickfix-list**: edited

- quickfix.tsx:229: 'Open the list and jump to the third TODO.', → 'Open the list and jump to the third entry.',
- quickfix.tsx:245: 'Go to the formatPrice call in products.ts, not its import.', → 'This list holds every formatPrice. Jump to the one on line 9 of products.ts.',

**walking-results**: edited

- quickfix.tsx:320: 'On to the next TODO.', → 'This list holds the TODOs. Go to the next one.',

**edit-every-match**: edited; rounds depend on :s/:d before their lessons (ordering call)

- quickfix.tsx:337: <Code>:s</Code> it becomes a project-wide search and replace that only touches the lines you found. → <Code>:s/old/new/</Code>, which replaces old with new on a line (the Substitute section has the details), it becomes a project-wide search a
- quickfix.tsx:366: 'formatPrice is renamed toMoney everywhere.', → 'Change every formatPrice to toMoney, and save the files.',
- quickfix.tsx:372: 'The TODOs are done. Delete each TODO line.', → 'The list holds the TODOs. Delete each TODO line (:d deletes a line) and save.',
- quickfix.tsx:378: 'Rename total to cartSum, tests included.', → 'The list holds every whole word "total". Change each to cartSum, and save.',
- quickfix.tsx:386: 'Rename the Line type to Row.', → 'The list holds every whole word "Line". Change each to Row, and save.',

**location-list**: edited

- quickfix.tsx:418: The location list for this window holds every <Code>lines.</Code> in cart.ts, the places that read the array.  → The location list for this window holds every <Code>lines.</Code> in cart.ts. Open it and walk it.{' '} {total} rounds.
- quickfix.tsx:427: and <Code>[d</Code> <Code>]d</Code> walk them directly. → and <Code>[d</Code> <Code>]d</Code>, from Code Navigation, walk them directly.
- quickfix.tsx:457: 'Build a location list of formatPrice in this file.', → 'Fill the location list with every formatPrice in this file, using :lvimgrep.',

**every-buffer**: needs a round change (R2, R4)

- quickfix.tsx:477: Use <Code>%s</Code> with the <Code>e</Code> flag so buffers without a match don't stop the run. The changes → <Code>:bufdo %s/old/new/ge</Code> replaces in every buffer: <Code>%</Code> is the whole file, <Code>g</Code>{' '} every match on a line, and
- quickfix.tsx:503: 'formatPrice (the last search) is toMoney in every open buffer.', → 'Change formatPrice, the last search, to toMoney in every open buffer.',
- quickfix.tsx:511: 'Point both API modules at /api/v2/.', → 'In both open buffers, change "/api/" to "/api/v2/".',
- quickfix.tsx:517: 'Switch the open files to euros: USD becomes EUR.', → 'Change USD to EUR in every open buffer.',

### neovim-builtins (codeNavigation only)

**diagnostics**: edited

- neovim-builtins.tsx:764: A language server reports errors and warnings as diagnostics: a letter in the sign column and the message at t → A language server reports errors and warnings as diagnostics: a letter in the sign column and, in most configs, the message at the end of th
- neovim-builtins.tsx:768: Both wrap around the file and take a count. Fix, <Code>]d</Code>, fix: no scrolling to find the next red squig → Both wrap around the file and take a count. Fix, <Code>]d</Code>, fix: no scrolling to find the next underlined mistake.
  - Accuracy: "the message at the end of the line" has not been the Neovim default since 0.11 (`vim.diagnostic.config().virtual_text` is `false` under nvim 0.12.5 --clean). It now says "in most configs"; kickstart and LazyVim both turn it on.

**definition-hover**: edited

- neovim-builtins.tsx:843: 'Jump to where formatMoney is defined.', → 'Jump to where formatMoney is defined. The cursor is on it.',
- neovim-builtins.tsx:849: 'Read the docs for formatMoney.', → "Show the docs for formatMoney, on the cursor's line.",
- neovim-builtins.tsx:855: 'Go to the TAX_RATE constant.', → 'Jump to where TAX_RATE is defined. The cursor is on it.',
- neovim-builtins.tsx:861: 'What does CartItem hold? Show its type.', → "Show the docs for CartItem, on the cursor's line.",
- neovim-builtins.tsx:867: 'Jump to the CartItem interface.', → 'Jump to where CartItem is defined. The cursor is on it.',
- neovim-builtins.tsx:873: 'What does padEnd take? Show its docs.', → 'Show the docs for padEnd. The cursor is on it.',

**references**: edited

- neovim-builtins.tsx:928: 'From receipt.ts, list the references and jump to the second: the call in lineTotal.', → 'List the references to formatMoney and jump to the second entry, line 7 of cart.ts.',
- neovim-builtins.tsx:934: 'List the classes implementing PaymentProvider and go to the second.', → 'The cursor is on PaymentProvider. List its implementations and go to the second.',
- neovim-builtins.tsx:940: 'Logger has one implementation. Go to it.', → 'The cursor is on Logger, which has one implementation. Jump to it.',
- neovim-builtins.tsx:946: 'Find the charge method implementations and go to the last.', → 'The cursor is on charge. List its implementations and go to the last.',

**document-symbols**: edited

- neovim-builtins.tsx:1059: 'Jump to the paidAt field of Invoice.', → 'Jump to the paidAt symbol.',

### finding-things (Pickers)

**discover-keys**: edited

- finding-things.tsx:192: 'Jump to the app.listen line with the key that fuzzy-searches this buffer.', → 'Jump to the "app.listen" line with the key that fuzzy-searches this buffer.',
- finding-things.tsx:198: 'Search the keymaps for "word" and run it, then open the first hit: formatCents.', → 'The cursor is on formatCents. Search the keymaps for "word", run it, and open the first hit.',
- finding-things.tsx:204: 'Search the keymaps for "grep" and use it to find where TAX_RATE is set.', → 'Search the keymaps for "grep", then use it to find "TAX_RATE =" and jump there.',

**picker-files**: edited

- finding-things.tsx:230: <Code>C-v</Code> opens the file in a vertical split and <Code>C-x</Code> in a horizontal one. Typing{' '} → <Code>C-v</Code> opens the file in a side-by-side split, like <Code>:vs</Code>, and <Code>C-x</Code> in one above the other, like <Code>:sp<
- finding-things.tsx:263: 'Open the customers route.', → 'Open src/routes/customers.ts.',
- finding-things.tsx:279: 'Open dates.ts in a vertical split.', → 'Open dates.ts in a side-by-side split.',
- finding-things.tsx:284: 'Open the logger in a horizontal split.', → 'Open src/lib/logger.ts in a split, one above the other.',

**picker-grep**: edited

- finding-things.tsx:314: Grep for the code the prompt describes and jump to it. (In the browser, <Code>Alt-n</Code> stands in for <Code → Grep for the text the prompt names and jump to it. (In the browser, <Code>Alt-n</Code> stands in for <Code>C-n</Code>.) {total} rounds.
- finding-things.tsx:332: 'Jump to where TAX_RATE is defined.', → 'Jump to the line with "TAX_RATE =".',
- finding-things.tsx:337: 'Jump to the handler for POST /invoices.', → 'Jump to the "invoices.post" line.',
- finding-things.tsx:342: 'Find where the port is read from the environment.', → 'Jump to "env.PORT".',
- finding-things.tsx:353: 'Jump to the definition of createLogger.', → 'Jump to the line with "function createLogger".',

**picker-word**: edited

- finding-things.tsx:365: { key: '␣sw', glyph: '⌕w', label: 'grep this word', sub: 'kickstart' }, → { key: '␣sw', glyph: '⌕w', label: 'grep this word', sub: 'kickstart & LazyVim' },
- finding-things.tsx:373: this file, <Code>sw</Code> lists every use in every file. → this file, <Code>Space sw</Code> lists every use in every file.
- finding-things.tsx:402: 'From the import of createLogger, jump to its definition.', → 'The cursor is on createLogger. List its uses and open the one in src/lib/logger.ts.',
- finding-things.tsx:408: 'From the import of formatCents, jump to its definition (hits list by file, so it comes first).', → 'The cursor is on formatCents. Open its use in src/lib/money.ts, the first hit.',
- finding-things.tsx:414: 'From the test, jump to the definition of addTax.', → 'The cursor is on addTax. Open its use in src/lib/money.ts.',

**picker-quickfix**: edited

- finding-things.tsx:477: 'List the console calls and jump to the last one.', → 'List every "console" and jump to the last entry.',

### file-navigation (Explorer)

**explorer-open**: edited

- file-navigation.tsx:62: 'Open dates.ts, next to this file.', → 'Open dates.ts, in the same directory as this file.',
- file-navigation.tsx:74: 'Open logger.ts, then close the tree.', → 'The tree is open on dates.ts. Open logger.ts, then close the tree.',
- file-navigation.tsx:80: 'Collapse src, then open README.md.', → 'The tree is open on invoices.ts. Collapse src, then open README.md.',

**explorer-edit**: edited

- file-navigation.tsx:139: 'dates.ts is called time.ts.', → 'Rename dates.ts to time.ts. The tree is open on it.',
- file-navigation.tsx:145: 'logger.ts is gone.', → 'Delete logger.ts. The tree is open on it.',
- file-navigation.tsx:151: 'src/lib has a new fmt.ts.', → 'Add fmt.ts to src/lib. The tree is open on money.ts.',
- file-navigation.tsx:157: 'src has a new services directory.', → 'Add a services directory to src. The tree is open on app.ts.',
- file-navigation.tsx:163: 'The routes directory is called api.', → 'Rename the routes directory to api. The tree is open on invoices.ts, inside it.',
- file-navigation.tsx:169: 'The test directory is gone.', → 'Delete the test directory.',
- file-navigation.tsx:174: 'money.ts is price.ts and dates.ts is gone.', → 'Rename money.ts to price.ts, then delete dates.ts.',

### command-line

**jump-to-line**: edited

- command-line.tsx:117: <Code>:</Code> opens the command line; <Code>esc</Code> leaves it, <Code>tab</Code> completes, and{' '} <Code> → <Code>:</Code> opens the command line, <Code>Esc</Code> leaves it and <Code>Tab</Code> completes. A bare line number jumps there: <Code>:42<
- command-line.tsx:136: <Code>42G</Code> does the same from normal mode. Both add to the jumplist, so <Code>C-o</Code> takes you back  → <Code>42G</Code> does the same from normal mode. Both add to the jump list, so <Code>C-o</Code> takes you back to where you were. Classic Vi
- command-line.tsx:148: 'The augroup is created on line 30. Go there.', → 'Go to line 30.',
- command-line.tsx:165: 'The ]q mapping is on line 25.', → 'Go to line 25.',
  - Accuracy: the intro said `:42` lands on the first non-blank. Neovim keeps the column (`nostartofline`; checked in nvim 0.12.5: `:2` from col 5 stays at col 5, which round 2's goal already expects). The intro now says "in the same column where it can", and the aside names classic Vim's first-non-blank behaviour.

**ex-ranges**: edited

- command-line.tsx:198: Most Ex commands take a range in front: <Code>:5,8d</Code> deletes lines 5 to 8. Besides numbers there are → Most commands you type after <Code>:</Code>, called Ex commands, take a range in front:{' '} <Code>:5,8d</Code> deletes lines 5 to 8. Beside
- command-line.tsx:233: 'Delete from the restart marker to the end.', → 'Delete from the "--- restart ---" line, where the cursor is, to the end.',
- command-line.tsx:256: 'These are moving into a class. Indent the whole file.', → 'Indent the whole file one level.',
- command-line.tsx:303: 'Join the query, lines 2 to 5, onto one line.', → 'Join lines 2 to 5 onto one line.',
- command-line.tsx:330: 'Delete the local overrides: this line through line 7.', → 'Delete from the cursor line, "# local overrides", through line 7.',

**visual-ranges**: edited

- command-line.tsx:377: The range is always whole lines, even from a characterwise selection. → The range is always whole lines, even from a <Code>v</Code> selection.
- command-line.tsx:383: Select the lines, press <Code>:</Code>, and finish the command. {total} rounds. → Select the lines, press <Code>:</Code>, and finish the command. <Code>{":'<,'>w name"}</Code> writes just the selected lines to a new file. 
- command-line.tsx:401: 'Write the retry function to retry.ts.', → 'Write the paragraph under the cursor, "export async function retry" to its "}", to retry.ts.',
- command-line.tsx:407: 'Write the March rows to march.csv.', → 'Write the three "2026-03" rows to march.csv.',
- command-line.tsx:424: 'You just selected the sleep helper. sleep.ts holds it.', → 'You selected the last two lines earlier. Write that selection to sleep.ts.',
- command-line.tsx:435: 'Join the paragraph into one line.', → 'Join the paragraph under the cursor into one line.',

**ex-delete-yank**: edited

- command-line.tsx:500: 'Delete the debug middleware, lines 10 to 15.', → 'Delete lines 10 to 15, the "// debug" block.',
- command-line.tsx:505: 'Yank the route imports, lines 3 and 4, into register a.', → 'Yank lines 3 and 4 into register a.',
- command-line.tsx:510: 'Delete the leftover test line at the end.', → 'Delete the last line.',
- command-line.tsx:529: 'Start a second table: copy the header from line 1 and put it below the cursor.', → 'Yank line 1 and put it below the cursor.',
- command-line.tsx:541: 'Delete line 7, the cors middleware.', → 'Delete line 7, "app.use(cors());".',

**ex-move-copy**: edited

- command-line.tsx:596: 'Move this import to the top.', → 'Move the cursor line to the top.',
- command-line.tsx:650: 'Move which-key to the top of the list, below line 1.', → 'Move the which-key line, where the cursor is, below line 1.',

**ex-normal**: edited

- command-line.tsx:740: <Code>:norm</Code> presses <Code>esc</Code> for you after each line, so <Code>:%norm I- </Code> needs no → <Code>:norm</Code> presses <Code>Esc</Code> for you after each line, so <Code>:%norm I- </Code> needs no
- command-line.tsx:770: 'Turn the paragraph into a list: prefix each line with "- ".', → 'Put "- " at the start of each line of the paragraph under the cursor.',
- command-line.tsx:780: 'Strip the timestamp from every line.', → 'Delete the time, like "09:12:01 ", from the start of every line.',
- command-line.tsx:808: 'Every field of Config is pub.', → 'Put "pub " before the text on the three indented lines. The cursor is on the first.',

**macros-over-lines**: edited

- command-line.tsx:861: 'Record a macro that drops the trailing comment, then run it on the rest.', → 'Record a macro that deletes the " // " comment on this line, then run it on the other lines.',
- command-line.tsx:870: 'Record a macro that makes a line a numbered step, then run it on the other lines.', → 'Record a macro that puts "1. " at the start of this line, then run it on the lines below.',
- command-line.tsx:882: 'Register q quotes a line and adds a comma. Select the three hosts and run it.', → 'Register q quotes a line and adds a comma. Select the three ".com" lines and run it.',
- command-line.tsx:893: 'Register a turns "key = value" into "key: value". Run it on every line; the comments have no "=" and are skip → 'Register a turns "key = value" into "key: value". Run it on every line; lines with no "=" are skipped.',

**repeat-ex**: edited

- command-line.tsx:957: 'Both console.log lines are gone.', → 'Delete both console.log lines: run :/console/d once, then repeat it.',
- command-line.tsx:981: 'The fixture row appears five times.', → 'Make line 2 appear five times in a row: :t. copies it once, then repeat.',

**cmdline-word**: needs a round change or a move (R1–R4)

- command-line.tsx:1031: Put the cursor on a name, then build the command around it without retyping (or mistyping) it:{' '} <Code>:%s/ → Put the cursor on a name, then build the command around it without retyping (or mistyping) it. The classic use is a rename with substitute, 
- command-line.tsx:1046: <Code>C-r</Code> followed by any register name pastes it: <Code>C-r "</Code> for the last yank,{' '} → <Code>C-r</Code> followed by any register name pastes it: <Code>C-r "</Code> for the last yank or delete,{' '}
- command-line.tsx:1056: 'Rename sm to sum everywhere.', → 'Change every "sm" to "sum" with :%s/sm/sum/g. The cursor is on sm.',
- command-line.tsx:1080: 'Delete every line that mentions this flag.', → 'Delete every line with the word under the cursor, using :g/word/d.',
- command-line.tsx:1098: 'Change cfg.retries to cfg.http.retries everywhere.', → 'Change every "cfg.retries" to "cfg.http.retries" with :%s/old/new/g. The cursor is on it.',
- command-line.tsx:1120: 'Rename the userName key to login.', → 'Change "userName" to "login" with :s/old/new/. The cursor is on it.',

**command-window**: edited

- command-line.tsx:1171: 'Rerun the sort from your history.', → 'Rerun the "sort n" command from your history.',
- command-line.tsx:1209: 'Rerun the :m command, four entries up.', → 'Rerun the "3m0" command, four lines up from the bottom of the history.',

**set-options**: edited

- command-line.tsx:1282: 'Turn on relativenumber, then delete updatetime and the two split lines.', → 'Turn on relativenumber, then delete the opt.updatetime line and the two opt.split lines below it.',

### substitute

**sub-basics**: edited

- substitute.tsx:23: <Code>new</Code>. The pattern is a Vim regex; the replacement is plain text. → <Code>new</Code>. The pattern works like a <Code>/</Code> search; the replacement is plain text.
- substitute.tsx:92: 'Turn debug mode off.', → 'Change DEBUG from True to False.',
- substitute.tsx:102: 'Turn the first "=" into ": " (YAML style). The one in the URL stays.', → 'Turn the first "=" on the cursor line into ": ". The one in the URL stays.',
- substitute.tsx:112: "Delete the 'debug' label from the log call.", → "Delete \"'debug', \" from the cursor line.",

**sub-whole-file**: edited

- substitute.tsx:204: 'Switch every link to https.', → 'Change every "http:" to "https:".',

**sub-confirm**: edited

- substitute.tsx:287: 'Rename the variable "item" to "product". Leave the message text alone.', → 'Change every "item" to "product", except the one inside quotes.',
- substitute.tsx:296: 'Rename master to main, except in the comment.', → 'Change every "master" to "main", except on the "#" line.',
- substitute.tsx:328: 'Tick off the first two tasks only.', → 'Change "[ ]" to "[x]" on the first two lines only. In a pattern, write "[" as "\\[".',
- substitute.tsx:337: 'Bump the package version to 1.3.0, not the dependency.', → 'Change the second "1.2.0", on the "version" line, to "1.3.0".',

**sub-ignore-case**: edited

- substitute.tsx:405: 'Spell JSON in capitals throughout.', → 'Change every "json", in any case, to "JSON".',
- substitute.tsx:414: 'Make every log level uppercase.', → 'Change every "warn", in any case, to "WARN".',
- substitute.tsx:433: 'smartcase is on. Rename the variable "user" to "account", but not the type "User".', → 'smartcase is on. Change every lowercase "user" to "account"; "User" stays.',

**sub-word-boundaries**: edited

- substitute.tsx:492: 'Rename the loop variable "i" to "idx".', → 'Change every "i" that stands alone as a word to "idx".',
- substitute.tsx:503: 'Rename "id" to "user_id".', → 'Change the word "id" to "user_id". "valid" stays.',
- substitute.tsx:512: 'Rename the local "map" to "nmap". Leave keymap and mapleader alone.', → 'Change the word "map" to "nmap". Leave keymap and mapleader alone.',
- substitute.tsx:533: 'Rename test classes ending in "Test" to end in "Spec". TestHelpers stays.', → 'Change every word ending in "Test" to end in "Spec". TestHelpers stays.',

**sub-very-magic**: edited

- substitute.tsx:560: Reach for it when a pattern has groups, alternation or counts; it removes most of the backslashes. In{' '} → Reach for it when a pattern has groups <Code>( )</Code>, either-or <Code>|</Code>, or repeats like{' '} <Code>+</Code> and <Code>{'{2,}'}</C
- substitute.tsx:585: 'Spell it "color" everywhere, with one optional "u".', → 'Change every "colour" to "color", using u? for the optional u.',
- substitute.tsx:594: 'Replace every var and let with const. Don\'t touch "variant".', → 'Change every word "var" or "let" to "const". "variant" stays.',
- substitute.tsx:603: 'Strip trailing whitespace.', → 'Delete the spaces and tabs at the end of every line. \\s is a space or tab; $ is the line end.',
- substitute.tsx:612: 'Squeeze every run of two or more spaces down to one.', → 'Replace every run of two or more spaces with one space.',

**sub-capture-groups**: edited

- substitute.tsx:638: That lets you move pieces around: swap arguments, reorder a date, turn one syntax into another. Use{' '} <Code → That lets you move pieces around: swap two values, reorder a date. Use <Code>\v</Code> so the groups are plain <Code>( )</Code>. In patterns
- substitute.tsx:675: 'Put the value second in each eq(): eq(count, 3).', → 'Swap the two values in each eq(): eq(3, count) becomes eq(count, 3).',
- substitute.tsx:684: 'Reformat the dates from 03/15 (US) to 15/03.', → 'Swap the two numbers in each date: 03/15 becomes 15/03.',
- substitute.tsx:693: 'Turn the Python 2 prints into print() calls.', → 'Wrap what follows each "print " in parentheses: print(total). .* matches the rest of a line.',

**sub-whole-match**: edited

- substitute.tsx:713: turns <Code>16</Code> into <Code>16px</Code>. → turns <Code>16</Code> into <Code>16px</Code>; <Code>\d\+</Code> is one or more digits.
- substitute.tsx:752: 'Wrap each npm command in backticks.', → 'Wrap "npm install" and "npm test" in backticks. \\w\\+ matches one word.',
- substitute.tsx:761: 'Quote every field.', → 'Put double quotes around each value between commas. [^,]\\+ matches a run of non-commas.',
- substitute.tsx:767: 'Make every TODO bold.', → 'Put ** on both sides of every TODO.',

**sub-case**: edited

- substitute.tsx:824: 'Convert snake_case names to camelCase.', → 'Remove each "_" in a name and uppercase the letter after it: first_name becomes firstName.',
- substitute.tsx:846: 'Uppercase every key.', → 'Uppercase the name before "=" on every line.',
- substitute.tsx:852: "Turn each name into a member: PENDING = 'pending',", → "Turn each indented word into a line like PENDING = 'pending',.",
- substitute.tsx:863: 'Capitalise every word of the heading.', → 'Capitalise the first letter of every word on the heading line.',

**sub-line-breaks**: edited

- substitute.tsx:921: 'Put each directory of the PATH on its own line.', → 'Split the cursor line at each ":", so each path gets its own line.',
- substitute.tsx:933: 'Join the ids into one comma-separated line. Leave the last line alone, or its newline gets a comma too.', → 'Join the four numbers into one line with ", " between them. Run it on lines 2 to 4 only.',
- substitute.tsx:939: 'Start each sentence on a new line.', → 'Break the cursor line after each ". ", one sentence per line. Write the dot as "\\.".',
- substitute.tsx:951: 'Collapse the runs of blank lines to a single blank line.', → 'Squeeze each run of blank lines down to one blank line. A run is three or more \\n in a row.',

**sub-zs-ze**: edited

- substitute.tsx:1015: 'Change the "get" prefix to "fetch", only on User functions.', → 'Change "get" to "fetch" only where "User" follows it.',
- substitute.tsx:1026: 'Extend the copyright to 2026. Leave the other years alone.', → 'Change "2019-2024" to "2019-2026". The other 2019 stays.',
- substitute.tsx:1035: 'Rename the db.get( calls to db.load(. cache.get and db.getAll stay.', → 'Change "db.get(" to "db.load(". cache.get and db.getAll stay.',

**sub-lazy**: edited

- substitute.tsx:1093: 'Strip the tags from the paragraph, keep the text.', → 'Delete every <...> tag on the cursor line, keeping the text between them.',
- substitute.tsx:1107: 'Drop the timestamp in brackets. Keep the level.', → 'Delete the first bracketed part and its space from every line, like "[2026-09-27 10:14:02] ".',
- substitute.tsx:1121: 'Turn *stars* into _underscores_.', → 'Change each *word* to _word_. In \\v, write * as \\*.',
- substitute.tsx:1130: 'Redact every quoted value on the login line.', → 'Replace the text inside every pair of quotes on the cursor line with ***.',

**sub-last-search**: edited

- substitute.tsx:1195: 'Rename the variable under the cursor to "total".', → 'Change the word under the cursor, "sum", to "total" everywhere. "summary" stays.',
- substitute.tsx:1205: 'Search for the durations like 250ms, then wrap each in backticks.', → 'Search for the numbers ending in ms (\\d\\+ms), then wrap each in backticks.',
- substitute.tsx:1217: 'The last search was /colou\\?r. Fix this line only.', → 'The last search was /colou\\?r. Change its matches to "color" on the cursor line only.',

**sub-repeat**: clean

  - Verified: Neovim maps `&` to `:&&<CR>` (`:help &-default`), as the aside says.

**sub-expressions**: edited

- substitute.tsx:1381: 'Bump the patch version by one.', → 'Add one to the last number of the version: 2.4.7 becomes 2.4.8.',
- substitute.tsx:1391: 'Double the recipe.', → 'Double every number.',
- substitute.tsx:1409: 'Pad the lone digits (the last search) to two digits.', → "The last search matches each lone digit. Put a 0 before each; '0' . submatch(0) joins them.",

**project-replace**: edited

- substitute.tsx:1444: practice: total => <p>Rename the word the prompt names everywhere in the project. {total} rounds.</p>, → practice: total => ( <p> Rename the word the prompt names everywhere in the project, then close the report with <Code>q</Code>.{' '} {total}
- substitute.tsx:1474: 'Rename total to cartTotal everywhere.', → 'The cursor is on total. Rename it to cartTotal everywhere.',

**sub-boss**: edited

- substitute.tsx:1555: '2/3: Convert every snake_case name to camelCase.', → '2/3: Remove each "_" in a name and uppercase the letter after it: retry_count becomes retryCount.',

### global-commands

**global-delete**: edited

- global-commands.tsx:42: title: 'Try it with p first', → title: 'Check before you delete',
- global-commands.tsx:83: 'Strip the comment lines from the config.', → 'Delete the lines that start with "#". In a pattern, ^ is the start of a line.',
- global-commands.tsx:102: 'Delete the blank lines.', → 'Delete the empty lines. ^$ matches a line with nothing on it.',
- global-commands.tsx:112: 'Drop the DEBUG noise from the log.', → 'Delete every DEBUG line.',
- global-commands.tsx:135: 'Delete the comment lines, including the indented one.', → 'Delete the lines that start with "--", indented or not. \\s* matches any indent.',

**global-keep**: edited

- global-commands.tsx:221: 'Keep the header and the German customers only.', → 'Keep line 1 and the lines ending in DE; delete the rest.',
- global-commands.tsx:231: 'Keep only the exported functions.', → 'Keep only the lines that start with "export".',
- global-commands.tsx:254: 'Delete every line that is empty or only whitespace.', → 'Delete every line that is empty or only spaces and tabs. \\S matches anything but a space or tab.',

**global-normal**: edited; R1 needs gcc from the Code band

- global-commands.tsx:310: 'Comment out every console.log line.', → 'Comment out every console.log line. gcc comments out a line.',
- global-commands.tsx:336: 'Tick every task assigned to @lin.', → 'Change "[ ]" to "[x]" on every line with @lin.',
- global-commands.tsx:358: 'Demote every level-2 heading to level 3.', → 'Add a "#" to the start of every line that starts with "## ".',
- global-commands.tsx:370: 'Delete the stack-trace line under each ERROR.', → 'Delete the line under each ERROR line.',

**global-move**: edited

- global-commands.tsx:442: 'Reverse the log so the newest commit is on top.', → 'Reverse the order of all the lines.',
- global-commands.tsx:452: 'Reverse the data rows, lines 2 to 5, below the header.', → 'Reverse lines 2 to 5. Line 1 stays on top.',
- global-commands.tsx:486: 'Copy every exported name to the end, to start an index.', → 'Copy every line that starts with "export" to the end of the file.',

**ex-sort**: edited

- global-commands.tsx:560: 'Sort the requirements.', → 'Sort all the lines.',
- global-commands.tsx:570: 'Sort by size, smallest first.', → 'Sort by the number at the start of each line, smallest first.',
- global-commands.tsx:580: 'Highest score first.', → 'Sort by the number at the start of each line, highest first.',
- global-commands.tsx:590: 'Sort the declarations inside the rule.', → 'Sort the lines inside the { } block.',

**sort-unique**: edited

- global-commands.tsx:625: duplicates, and <Code>:sort nu</Code> sorts numbers first. → duplicates, and <Code>:sort nu</Code> compares lines by their number.
- global-commands.tsx:649: 'Sort the mailing list and drop the duplicate addresses.', → 'Sort the lines and drop the duplicates.',
- global-commands.tsx:659: 'Deduplicate the ports numerically.', → 'Sort the numbers by value and drop the duplicates.',
- global-commands.tsx:669: 'Merge the tags, ignoring case.', → 'Sort and drop the duplicates, treating Lua and lua as the same.',
- global-commands.tsx:679: 'Clean up the build section only.', → 'Sort line 5 to the end and drop the duplicates. The lines above stay.',

**shell-filters**: edited

- global-commands.tsx:780: 'Keep only the request paths, the third field.', → "Keep only the third field of each line, like /orders. awk '{print $3}' prints it.",

## Counts

- Lessons read: 88 (including 2 bosses)
- Lessons edited: 80; clean: 8
- Rounds flagged for a change: 13 (paste-while-typing R4; cmdline-word R1–R4; edit-every-match R1–R4, ordering only; every-buffer R2, R4; global-normal R1; grep R4 solution)
