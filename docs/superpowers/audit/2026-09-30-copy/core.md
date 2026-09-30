# Copy review: Core band (2026-09-30)

Scope: `getting-around`, `small-edits`, `next-steps`, `insert-like-a-pro`, `essential-motions`,
`screen-movement`, `basic-operators`, `text-objects`, `visual-mode`, `search`, `indent-case`
(lessons 01–71 plus the two bosses). Only copy was changed: no setup, goal, solution, chip,
keyCard key or order. `npx vitest run src/lessons src/coach` and `npx tsc --noEmit -p .` are green.

The main pattern fixed: prompts that named the target by what the code *means* ("the constructor",
"the fallback port", "the if block", "Class names start with a capital", "Title-case the heading")
or described the end state as a riddle ('"default " is gone.', 'verbose is "no".'). They now say
what to do, with the target quoted as it appears on screen. Paths below are
`src/lessons/sections/<file>`, with line numbers after the edit.

Notation: named keys in these files now follow the chip style (`esc`, `enter`, `C-[`). Elsewhere in
the repo you'll find `Enter` (command-line, quickfix, surround, buffers-files), `Esc`/`BS`
(finding-things) and `Ctrl-w` (windows-tabs). These are left for their owners.

## Getting Around

- **move**: clean.
- **words**: clean.

## Small Edits

- **x**: clean.
- **r**: clean.
- **undo-redo**: edited.
  - small-edits.tsx:246 'Undo the whole line that was typed in.' → quotes the line (`vim.opt.mouse = ""`).
  - :257 'Undo both renames.' → '… on the const line.'
- **undo-in-time**: edited.
  - :379 'C-r would redo the deleted line…' was ambiguous (redo *which* thing). It now says C-r would delete the "const sum" line again, and to bring back the "* 1.2" version.
- **getting-help**: edited.
  - :460 intro used `:q` (Save & Quit, lesson 09) without a note → "(Save & Quit covers it)".
  - :473 aside `␣sh` used the leader glyph unexplained → "(Space, then sh)".
  - :508 'Follow the |scroll.txt| link to the scrolling page.' → '… link on this line.' (the cursor starts at column 0 of the link's line, as in round 3).
  - Judgment: the intro gives `:h CTRL-E for C-e` (lesson 33) as a notation example, and round 2 looks up `dd` (lesson 37). Neither needs the key to be known, so I left both.

## Next Steps

- **insert-mode**: edited.
  - next-steps.tsx:43 aside `Ctrl-[` → `C-[` (chip notation).
  - :95 'Close the call with ")".' → 'Add ")" after "greet(name".'
  - :125 'Add the space after the comma.' → '… in "[3,4]".' (two other lines have commas).
- **save-quit**: edited. :150 `Enter` → `enter`.
- **line-ends**: clean.
- **find-char**: clean.
- **change-words**: edited.
  - :354 the aside led with `dw` (lesson 35). Now: "cw stops at the end of the word, like ce… (Delete Words shows that dw takes the space too.)"

## Ways Into Insert

- **insert-line-ends**: edited. All 7 prompts relied on knowing code ("Export the function", "Comment out the option", "Make the line a second-level heading", "Return the result and end the statement"). Each now names the text and the edge, e.g. :75 'Put "export " in front of "function parseToken".' and :118 'Put "return " before "items", and ";" at the end of that line.'
- **open-lines**: edited. 5 prompts: "between the two functions" → 'after the first "}"', "the heading" → '"## Usage"', "Close the table…above the return" → 'Add a line "}" above "return M"', and so on (:192–:240).
- **blank-lines**: edited. 5 prompts (:300–:341). "Put a blank line on both sides of the rule" → '… above and below "---"'. "PEP 8 wants two blank lines…" now names the target first: 'Add two blank lines above "def circumference" (PEP 8 style).'
- **substitute** (Change in Place): edited.
  - :388 the aside said standard `s`/`S` "would work here". That is **false**: flash is on in every editor (`ALWAYS_PLUGINS`), so `s`/`S` are flash jumps in the tutor. Rewritten: "…LazyVim rebinds s and S to flash.nvim's jumps, as every lesson here does, and kickstart gives s to mini.surround."
  - 4 prompts: "strict comparison" → 'Change the "=" in "user.role = ADMIN" to "==="', "Spell out &" → 'Change "&" to "and"', "Number the list" → 'Replace the three "*" with…', "stray print should be the end of the if" → 'Replace the whole print line with "end".'
- **replace-mode**: edited. All 6 prompts now quote the old and new values ('Change "09:30" to "14:45".' instead of 'Move the meeting to 14:45.').

## Motions Worth Knowing

- **words-big**: clean. (The claim "eight words but one WORD" checks out.)
- **word-ends-backward**: edited. :125 aside used `dge` before operators → "Once you know operators, dge deletes back to it."
- **first-char**: edited. :183 aside `Enter` → `enter`, and `d_`/`dd` are now flagged "(First Operators)".
- **find-backward**: clean.
- **repeat-find**: clean.
- **top-bottom**: edited. :373 "(Vim's startofline is off)" read as a claim about Vim. In Vim, `sol` is on by default. Now "(its startofline option is off)".
- **paragraphs**: clean. (The whitespace-only-line claim checks out.)
- **matching-pairs**: edited.
  - :534 intro: "the closing parenthesis of the condition" needed code knowledge → "it finds the first ( and lands on the ) that closes it."
  - :549 aside: shell pairs `if`/`fi`, not `end` → "in Lua (fi in shell)". I checked matchit: Neovim 0.12 loads it by default, and `ftplugin/{lua,sh}.vim` set `b:match_words`.
- **search-forward**, **search-backward**, **word-under-cursor**: clean.

## Screen Movement

- **half-pages**: edited. The 6 prompts named code constructs ("the DEFAULTS object", "the class declaration", "run()") → quoted line text: 'Scroll down to "export class Queue".' etc. (:287–:317).
- **full-pages**: clean copy, but **round 4 flagged** (below). I checked the claims in nvim 0.12.5: `C-f` keeps two lines of overlap and puts the cursor at the top, and `C-b` puts it at the bottom.
- **screen-lines**: clean. (scrolloff 0 in Neovim, and column kept, both check out.)
- **recenter**: edited. 6 prompts → quoted lines. 'Put the constructor at the bottom, to see the fields above it' → 'Put the "constructor(" line at the bottom of the screen.' (:498–:528).
- **scroll-by-line**: edited. 6 prompts. "the return line of next()" → '"return i === -1"'. "the class's closing }" (needed brace matching) → 'the last line of the file, "}"' (:577–:607). Kickstart scrolloff 10 and LazyVim 4 both check out.

## First Operators

- **intro-operators**: edited. Four end-state riddles → imperatives: '"default " is gone.' → 'Delete "default ".', 'The comment is gone.' → 'Delete everything after "8080;".', etc. (:64–:126).
- **delete-words**: edited. :236 'Delete the duplicated "local".' → 'Delete the "local" just before "setup".'
- **delete-to-char**: edited. :309–:369. 'Remove the "state" label' → 'Turn console.log("state", user) into console.log(user).' The options argument, fallback port and prerelease tag rounds likewise now quote the text.
- **delete-lines**: edited. 4 prompts now quote the text or line (:412–:460). Aside "the Copy/Paste lesson" → "Copy/Paste Lines".
- **delete-multiple-lines**: edited.
  - :483 intro: "linewise motions" was undefined jargon → "j and k move by whole lines, so an operator on them takes whole lines".
  - 4 prompts: "debug lines" → "console.log lines", "commented-out pair" → 'the two lines that start with "--"', "the whole if block" → 'from "if (!id) {" down to the "}" under the cursor', and the draft section by its heading.
  - Judgment: the aside names `3dd` before Counts & Operators (lesson 44). It is an aside comparison, so I left it.
- **change-lines**: edited. 5 prompts (:617–:652), including 'Only the age check is left.' → 'Make the if line read "if (user.age > 17) {".'
- **copy-paste-lines**: edited. 5 prompts (:710–:753).
  - :729 **wrong target fixed**: 'Copy the header row above the data.' The goal puts `name,score` above `linus,75` only, not above the data. Now 'Copy "name,score" to just above "linus,75".' The round itself is flagged below.
- **yank-to-end**: edited. 4 prompts assumed you knew what to copy ("same picker", "same way as user") → they quote the tail to copy and the line to put it on (:820–:877).
- **join-lines**: edited. 5 prompts (:938–:982). "Put the table on one line" (Lua jargon) → 'Join the "{ noremap" line onto "local opts ="'. The two gJ rounds now say "with no space".
- **repeat-last-change**: edited. :1057 'Drop the second argument from each call.' → 'Delete "'n', " from each line.'; :1067 'Uncheck all three tasks.' → 'Change each "[x]" to "[ ]".'
- **counts-operators**: edited. :1140 "retry block" → 'the four lines from "if (!res.ok) {" to the next "}"'. :1172 'Duplicate both lines of the setting below' → 'Copy the last two lines and put the copy below them.'
- **boss-tidy-function**: edited. 5 of 6 prompts (:1266–:1380). "debug parameter", "debug lines", "the price maths", "the local total" and "stale comment" now quote the text. The rename round lists the three spots: "let total", "total +=" and "return total".

## Text Objects

- **intro-text-objects**: edited. 5 prompts (:63–:146), including 'Poll every second instead of every five.' (needed ms knowledge) → 'Change "5000" to "1000".'
- **word-objects**: edited.
  - :198 aside "dw only works from the first letter" was inaccurate (dw works mid-word; it just doesn't take the whole word) → "only takes the whole word from its first letter".
  - :251 'Delete "again" at the end of the line.' → '… from the end of the line above.' (the cursor starts one line below). Timeout and stray-async prompts now quote the text.
- **word-objects-big**: edited. 4 prompts (:382–:468). 'The return uses name instead of repeating the chain.' → 'Change "data?.user?.profile?.name" on the return line to "name".'
- **text-objects-quotes**: edited. 5 prompts (:536–:625). "DIR comes from `pwd`" → 'Replace the text between the backticks with "pwd".' 'Change the scheme from the opening quote.' → 'Change "catppuccin" to "desert". The cursor is on the opening quote.'
- **text-objects-parens**: edited. 4 prompts (:689–:769). "Both calls get the whole user", "arrow functions" and "Print the msg variable" were code-meaning prompts.
- **text-objects-brackets**: edited. 5 prompts (:834–:917). "arrays", "options", "function body", "Publish only dist" and "plugin options" → which brackets, by what they look like.
- **text-objects-tags**: edited. 5 prompts (:1002–:1087).
  - :1066 'Change the page title.' never said the new text → 'Change "Untitled" to "vimchi".'
- **sentences-paragraphs**: edited. 5 prompts (:1153–:1251). "asides", "second sentence", "draft paragraphs", "unused helper" and "keymap block" now quote the text.
- **reaching-objects**: edited. 6 prompts (:1332–:1457). 'Make comma the leader key.' needed leader knowledge → "Change the ' ' string to ','."
  - I checked the aside's reach claims in nvim 0.12.5: `di(` reaches a pair on a later line, and `di"` does not reach off the line.

## Visual Mode

- **visual-characters**: edited. 4 prompts (:61–:143). "the debug label", "trailing comment", "greet() gets only the first name" and "Cut the middle sentence" now quote the text.
- **visual-lines**: edited. 4 prompts (:198–:251). "debug lines", "hand-wrapped paragraph", "retry block" and "two old routes" → the visible lines.
- **reselect**: edited. :338 "the two calls" → "the run() and done() lines". Judgment: the intro says "shift a block twice" before `>` (lesson 65). It names an idea, not a key, so I left it.
- **visual-operators**: edited. 6 prompts (:414–:471). 'The buy event gets "order.id" as its second argument.' → 'Copy "order.id" into the gap before ")" on the buy line.'
- **visual-block**: edited. 'Uncomment both pairs of lines.' → 'Delete the "// " from the front of all four lines.'; 'Tick every box' → 'Change every "[ ]" to "[x]".'
- **block-insert-append**: edited. 5 prompts (:637–:671), e.g. 'Make the three globals local.' → 'Put "local " in front of the width, height and wrap lines.'
- **growing-selections**: edited. 4 prompts (:739–:798). The "staff instead of repeating its definition" and "Log body instead of the whole expression" rounds now quote the span to replace.

## Search

- **search-as-motion**: edited.
  - :54 aside `d/foo/e` previews an offset → marked "(Search Offsets, two lessons on)".
  - 4 prompts (:79–:123). "Drop the admin check" → 'Delete from the cursor up to the second "user" on the line.'; "type annotation" → 'delete from ":" up to " ="'; "expression" → "the text".
- **change-next-match**: edited.
  - :147 intro used `gUgn` (gU is lesson 68) → dropped; `cgn`/`dgn` remain.
  - :170 aside `:%s` → "a substitute (:%s, in the Patterns band)".
  - :200/:211 two rounds preset `search:` without saying so → 'The last search was " !important". Delete every match.' and 'The last search was "todo". Change each one to "TODO".' (This also drops the "gU comes later" note.)
- **search-offsets**: edited. :278 'Land on the shiftwidth value.' → 'Land on the "2" after "shiftwidth =".'; :288/:296 now quote the text.
- **clear-highlights**: edited. :378 "Make both keymaps visual-mode ('v')" (needed keymap knowledge) → "Change both 'n' to 'v', then clear with :noh."

## Indent & Case

- **indenting**: edited. :57 intro glosses shiftwidth as "(the indent size)". 3 prompts now name the line: 'Indent "setup(server)" two levels.' etc.
- **auto-indent**: edited. 3 prompts: "the routes object" → "the outermost { }", "the second function" → 'the "function logAll" block'.
- **toggle-case**: edited. 5 prompts (:304–:347) were rules ("Class names start with a capital", "Constants are all caps") → 'Change "userService" to "UserService".' etc. :356 the aside title "Classic Vim" was misleading (tildeop is off in both) → "The tildeop option".
- **case-operators**: edited. 4 prompts (:409–:446). "Caps Lock was on. Fix the string." → 'Flip the case of every letter in "hELLO, wORLD".'
- **formatting-text**: edited. :471 "comment leaders" (jargon) → "the comment marker at the start of each line". 'Wrap the long comment.' → '…"//" comment on the line above' (the cursor starts below it).
- **incrementing-numbers**: edited. 4 prompts (:570–:664). "Halve the timeout" and "Flip the offset to +1" now quote the values and hint that a count is needed.
- **number-sequences**: edited. 3 prompts (:719–:745) now give the target values.
- **boss-clean-config**: edited. :804 'The font is "JetBrains Mono".' → 'Change "jetbrains mono" to "JetBrains Mono".'; :810 → 'Rewrap the two "--" lines at the top.'

## Rounds flagged (need a round change, not copy)

1. **full-pages r4** ('Page back to the 2.4.0 release.'). The setup has `top(58)` and cursor 70, so `## [2.4.0]` (line 60) is already on screen at the start. The round doesn't exercise `C-b`; `10k` or `H` + `2j` gets there too. Proposed fix: start with 2.4.0 off screen, e.g. `top(66)`/cursor 70 with goal line 55 (`## [2.4.1]`), and re-derive the par solution in the engine (`<C-b>` then a short `k`).
2. **copy-paste-lines r4**. Copying a CSV header to just above the last data row is not a real edit, and the old prompt described a different result ("above the data"). The prompt now matches the goal. Proposed replacement: same file, cursor on `linus,75`, task 'Copy "ada,92" to the end of the file' (`ggjyyGp`). Or keep the header copy but put it at the bottom (`ggyyGp`) for a "repeat the header after the table" edit.

Judgment calls left as they are (recommend keeping): the aside previews in undo-redo (`g-`/`g+`, the next lesson), delete-multiple-lines (`3dd`), text-objects sentences (`gqap`), top-bottom (``` `` ```). Each reads as a preview in an aside, which the brief allows.

## Counts

- Lessons read: 73 (71 numbered + 2 bosses)
- Lessons edited: 58
- Lessons clean: 15 (move, words, x, r, line-ends, find-char, words-big, find-backward, repeat-find, paragraphs, search-forward, search-backward, word-under-cursor, full-pages, screen-lines)
- Rounds flagged for a round change: 2
