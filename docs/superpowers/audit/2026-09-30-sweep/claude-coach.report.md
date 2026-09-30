# Coach audit (front 4: coaching) — 2026-09-30

Reviewer: Claude (Opus 5.5). Read-only. Scope: `src/coach/*`, `Practice.tsx` (`liveCoach`),
`BetterWays.tsx` / `Results.tsx`, spec `docs/superpowers/specs/2026-09-29-coach-design.md`.

**Method.** Three scratch vitest harnesses fed novice key sequences through the real `Session`.
They covered **about 60 scenarios across 31 lessons**, plus 6 generated-challenge runs (2 challenges ×
3 seeds, played by a novice who uses `j`/`k` + `0` + `l`-spam). Each scenario ran `coach()` for
the post-run report. The harness also copied `Practice.liveCoach` line for line to record every
live hint and the key it fired on. A fourth pass checked the reference-line gate and the
"never undercut" sets for every coachable round. Raw data, harnesses and scenario files are in
`claude-coach/` next to this report (`sweep*.txt`, `generated.txt`, `refgate.txt`,
`drilled.txt`, `sc*.json`, `harness-*.test.ts.txt`). The temporary test files were removed from
`src/`.

**Verdict.** The engine underneath is sound: replay verification, state-needs tracking and
the vocabulary gate work, and no suggestion I saw would produce a different result. As a
*teacher*, though, it has three problems:
1. **Live hints are noise.** They fire on every key during a motion or `x` run.
2. **The post-run report is silent in whole sections** because "never undercut" is applied too
   broadly, and it hides the reference in 36% of rounds.
3. **When it does speak, it offers the arithmetic answer instead of the idiom.** It says `16x`
   where it should say `dt)`, `rX` where it should say `~`, `3jEj3j3j` where it should say
   `/catch`, and it explains every motion with "Fewer keys to the same spot."

---

## Findings (ranked by effect on the learner)

### F1. Live hints fire on every key of a run, with a different suggestion each time — CRITICAL

**Where:** `Practice.tsx:108-109`. When the last key leaves Vim settled (`settled`), the
candidate list takes in `last-2..last`, and that includes the motion run the learner is
**still typing**. Each new key extends the run, so `c.logEnd` grows and the
`nudgedEnd` guard (`:116`) never suppresses anything.

Repro (`sweep.txt`, lesson `find-char` r0, keys `l`×25, reference `f(`): 22 different hints in
22 keys: `e`, `wh`, `w`, `wl`, `fd`, `fe`, `ee`, `t=`, `ww`, `tc`, `fc`, `w9l`, `ta`, `fa`, `wft`,
`tO`, `fO`, `fOl`, `t49h`, `t(h`, `t(`, `f(`. The same happens with `x`: in `delete-lines` r1,
`kf/h` + `x`×27 flashes "3x does that in 2" 22 times and "de does that in 2" 4 times, each
labelled for the last three x's only. The learner ends up typing 27 x's, and the hint never
says `D`.

Volume in generated runs (`generated.txt`): 49 hints / 98 keys, 175 / 235, 86 / 140, 63 / 114,
206 / 275, 126 / 178. That comes to roughly one hint every 1.3 keys.

**Fix:** only critique segments that are **closed**. That means `segs[last]` never counts
unless `closing` is true, and a motion run counts as closed only when a non-motion command
starts or the round ends. Show at most one hint per segment, and none mid-run. Also add a rate
limit, for example one hint per round, or one per 8 s.

### F2. "Never undercut" is section-wide and matches raw keys, which silences whole sections — HIGH

**Where:** `index.ts:62-63,90`. The drilled set is the tokenized chips of **every lesson in the
section**. The segment's **raw keys** are then tested against it, including `f`/`t` target
characters and typed search text.

`drilled.txt` lists the keys that switch the motion critic off for any run containing them:

| section | motion keys that silence a run | argument chars that silence a run |
|---|---|---|
| next-steps | `w f t $` | `a i c` |
| essential-motions | `W B E F T ; , ^ G gg % { }` | `, ;` |
| **basic-operators (First Operators, 12 lessons)** | **`j k w f t`** | `d c p y .` |
| visual-mode | `$` | `o d c y` |
| search | `/ n N *` | `d c .` |
| windows-tabs | `h j k l` | `o c` |
| marks-jumps, command-line, substitute, global-commands | `, $ % / t n` (various) | `' . s ( ) i` |

Repros (`sweep3.txt`, `sweep.txt`, `sweep2.txt`):
- `delete-lines` r1, `kllllllllllllllllhD`: silent, because `k` is "drilled" by `dk`. The same
  holds for every `j`/`k` run in all 12 First Operators lessons.
- `delete-lines` r1, `kwwwwwwhD` and `kfrfefafsfshD`: silent (`w` from `dw`, `f` from `df`).
- `find-char` r0, `wwww` where `f(` is the answer: silent, because `w` is drilled by the *next*
  lesson, `change-words`. The lesson that teaches `f` never tells a `w`-spammer to use `f`.
- `repeat-find` r0, `f,f,f,f,` where `f,;;;` is the answer: silent, because the find *target*
  `,` matches the drilled `,` token. This is the one mistake the `;` lesson exists to fix.

**Fix:** drilled = the **current lesson's** chips only. Compare *command* tokens, meaning
`seg.commands[].keys[0..]` with arguments stripped, never raw keys. Also narrow the rule: block
a suggestion only when it **removes** a drilled command the learner used. For example,
`f,;;;` → `4f,` would still be blocked in `repeat-find`. `hhhh` → `4h` in the `F`/`T` lesson
should not be.

### F3. The reference line is hidden in 254 of 705 coachable rounds (36%) by a tokenizer bug — HIGH

**Where:** `index.ts:135`. `solutionKeys(sol).flatMap(k => tokenize(k))` treats every inserted
character, every `f`/`t` target and all cmdline text as a command key that must have been taught
(`vocab.ts:37`). The spec says "inserted text and arguments exempt."

From `refgate.txt`, the tokens that most often block a reference: `<CR>` 60, `g` 43, `n` 32,
`(` 32, `'` 29, `m` 27, `)` 22, `+` 19. Examples:
- `find-char` r0 `f(`: hidden because `(` is "untaught". The same applies to all 6 rounds of
  the `f`/`t` lesson.
- `change-words` r0 `cwuser<Esc>`: hidden because `s` is "untaught".
- `insert-line-ends` r0 `A;<Esc>`: hidden because `;` is "untaught".
- Every `/word<CR>` reference in Search: hidden because `<CR>` comes from the file-navigation
  chip, much later.

When a reference is hidden, the learner sees only "par 2 keys, you used 4". For many rounds
(for example `word-under-cursor` `/retries<CR>` → `*`, and `indenting` `I  <Esc>` → `>>`) the
reference line is the **only** thing the report says.

A legitimate case to keep: all 5 `insert-mode` references use `f` before `f` is taught. That is
a front-1 issue, and the gate is correct to hide them.

**Fix:** tokenize by replaying the solution through the engine's `lastCommand` stream (the
logger already does this) and gate only the command keys.

### F4. The rule library gives the count answer, not the idiom the lesson teaches — HIGH

This table lists what an expert would say against what the coach says. Keys are from the
sweep files.

| lesson / round | learner typed | coach says | expert says | class |
|---|---|---|---|---|
| delete-to-char r1 | `kf,` `x`×16 | `16x` | `dt)` | UNHELPFUL |
| delete-lines r1 | `kf/h` `x`×27 | `27x` | `D` | UNHELPFUL |
| delete-words r1 | `jjwww` `x`×7 | `7x` | `dw` | UNHELPFUL |
| counts-operators r0 | `kw` `x`×14 | `14x` | `d2w` | UNHELPFUL |
| text-objects-quotes r3 | `jjf"l` `x`×14 | `14x` | `di"` | UNHELPFUL |
| change-words r3 | `www` `x`×9 `iloadOrders<Esc>` | `9x` | `cw…` | UNHELPFUL |
| boss-tidy r0 | `wxxxxiorderTotal<Esc>` | `de` | `cw…` | UNHELPFUL (stops halfway) |
| substitute r0 | `xi===<Esc>` | silent | `s===<Esc>` | SILENT |
| change-lines r1 | `jj^Creturn sum;<Esc>` / `jj^Da…` | silent | `cc…` | SILENT |
| counts-operators r0/r3 | `kwdwdw`, `jjfvdwdwdw` | silent | `d2w`, `d3w` | SILENT |
| repeat-last-change r2 | `ddjdd` | silent (saves 1) | `ddj.` | SILENT (defensible) |
| word-objects r0 | `jfLbcworders<Esc>` | silent | `ciw…` (works from any column) | SILENT |
| word-objects r0 | `jfLbdeiorders<Esc>` | `cw…` | `ciw…` | UNHELPFUL |
| word-objects r1 | `jjfybdw` | silent | `daw` | SILENT |
| open-lines r1 | `0i## This week<CR><Esc>` | silent | `O…` | SILENT |
| insert-line-ends r2 | `0lli-- <Esc>` | silent | `I-- <Esc>` | SILENT (`I-at-bol` only matches a literal `^`, `rules.ts:75`) |
| toggle-case r0 | `kkwxiF<Esc>` | `rF` | `~` | WRONG for the lesson (`~` is taught and 1 key) |
| case-operators r0 | `~~~~~` | silent | `gUiw` | SILENT |
| indenting r0 | `I  <Esc>` | silent (reference only) | `>>` | SILENT |
| word-under-cursor r0 | `/retries<CR>` | silent (reference only) | `*` | SILENT |
| visual-characters r0 | `vlllllllld` | silent (reference only) | `vf d` / `df ` | SILENT (visual never critiqued) |
| join-lines r0 | `jjA <Esc>jd$kp` | silent | `jjJ` | SILENT |

The root cause is the size of the rule set. It has 9 rules (`rules.ts:31-133`), and each
matches one literal shape. `count-x` runs first and consumes the x-run, so no later rule can
say "that was a `d{motion}`". The fix is below (P2): a general "edit-equivalence" search that
replays the learner's net edit and searches taught operator × motion/text-object pairs, instead
of one hand-written rule per idiom.

### F5. Motion suggestions are search artefacts, not advice — HIGH

`motion.ts` is a uniform-cost search over mixed moves, so it returns any shortest path,
including routes no teacher would give:
- `insert-mode` r0 `jlllllllllllllllll` → **`2wjl`** / **`2wlj`** (word-hop along line 0, then
  drop down).
- `search-forward` r0 `jjjjjjjjjjw` → **`3jEj3j3j`**.
- `half-pages` r0 `j`×12 → **`3j3j3j3j`**. Counts on `j` are capped at 3 without
  `relativenumber` (`motion.ts:134`), so any long vertical move becomes a chain. The reference
  there is `<C-d><C-d>`, and `<C-d>` is not in the vocabulary.
- Generated run, seed 2: `$2j4h3j`, `jEjl`, `2j3jh2j`. Seed 3: `2j3j3j3jFx`.
- `word-under-cursor` r0 `jjjwwwwww` → `3jf;` (reads as "3j, f, then `;`").
- `top-bottom` r2, 24×`j` to "line 25": silent. `NG` is never generated; `G` only when the
  target is the last line (`motion.ts:148`).
- `matching-pairs` r1, 38×`l` to the `)`: `$b`. `%` is not in the vocabulary, even in the `%`
  lesson.
- Generated runs lean on `/x<CR>`, `/q<CR>`, `/ol<CR>` (1–2 character searches for mid-word
  fragments). This is valid, but it is not what a learner in "Fix the File" is practising.

**Fix:** canonicalize routes as *vertical then horizontal*: at most one vertical leg (`Nj`,
`NG`, `gg`, `{`/`}`, `/`, `<C-d>`), then at most one horizontal leg (`0 ^ $ f t w b e`, with `;`).
Reject paths that interleave the two. Add `NG`, `%`, `H/M/L`, `<C-d>/<C-u>` and `n` as
first-class moves once taught. Rank `/search` below `f`/`t` for same-line targets. Show one
suggestion, not two near-duplicates (`$2j` | `2j$`, `2jh` | `h2j`, `6h2j` | `2j6h`).

### F6. The "why" teaches nothing about the concept — MEDIUM

Every motion critique carries the same sentence, "Fewer keys to the same spot."
(`index.ts:96`, `rules.ts:20`). The spec promised one line per motion *family*: "`f` jumps to
a character on the line". Rule "why"s name the command but not the principle:
- `count-x`'s "A count repeats a command: 3x deletes three characters." is shown for `27x`.
  It teaches counting characters, which is the habit Vim users are trying to lose.
- Edit rules show **saves 1** (`$a;<Esc>` → `A`, `^i` → `I`, `A<CR>` → `o`, `de i` → `cw`,
  `worth()` at `index.ts:28`). Framing `A` as "saves 1 key" misses why you would use it: `A`
  works from anywhere on the line, so the motion disappears.

The live hint (`nudgeText`, `index.ts:45`) is just "`{keys}` does that in N". It carries no
why, does not say what "that" is (the hint is labelled only in the post-run panel), and shows
no link back to the lesson that teaches the key.

### F7. Live-hint display issues — MEDIUM
- **Timing.** The hint appears *after* the segment. With F1 fixed, it would arrive after the
  edit the learner has already made, which is fine for reflection. Do not show it inside a run.
- **It can mask Vim's own message.** At `Practice.tsx:232`, when `v.msg === vimMsg` (a Vim
  error or info message), `note` falls through to the nudge. `EditorView.tsx:331` then prints
  the note *instead of* `vim.message`. So "Pattern not found" or "E486" can be replaced by
  "3x does that in 2". This contradicts the spec ("yields to a Vim error"). I found this by
  reading the code, not by driving the UI.
- **4 s timeout plus replacement on every key** (`:89-95`) makes the hint flicker during typing.
- **Default off, no discovery.** The only switch is a sidebar checkbox (`Sidebar.tsx:119`).
  Fine for now; revisit once F1 is fixed.

### F8. BetterWays mis-renders insert text — MEDIUM

**Where:** `BetterWays.tsx:8`. The regex splits at the first `[iaAIoOsSC]`, `cw`, `ce` or `cc`
before an `<Esc>`, so a find argument or `cgn` gets cut in the wrong place (verified in node):
- `cgnlog<Esc>.` renders as chips `c g n l o`, text ‹g›, then `.`. This is the `dot-repeat`
  suggestion shown in `change-next-match`.
- `*cgnrows<Esc>..` renders as `* c g n r o` ‹ws›.
- `2jfia!<Esc>` renders as `2 j f i` ‹a!›, when it should be `2 j f i a` ‹!›. `jfoiX<Esc>`
  breaks the same way.

**Fix:** render from the logged command stream (`LogEntry.command.kind === 'insert'` gives the
exact text span) instead of re-parsing a string.

### F9. Generated challenges get motion-only critiques and no par — MEDIUM

In all 6 novice runs (`generated.txt`), every critique was `rule: motion`, 8–9 per run, capped
at 5 in the UI. The reference section is empty. The spec's per-item "par N keys, you used M"
(`index.ts:122` only handles `rounds`) is missing. Unit labels repeat, because attribution goes
to the nearest item, so "Edit 1" appears twice.

A learner who fixed 8 edits with 235 keys learns only "use search". They never hear "you spent
160 keys moving and 20 editing". That movement-vs-editing split is the most useful single
number here, and it answers the owner's complaint in the brief.

### F10. Coverage gaps by design — LOW to MEDIUM
- **Visual mode is never critiqued** (spec v1). Visual Mode is 7 lessons, and `v`+`l`-spam is
  the most common novice pattern there.
- **Ex/cmdline commands are breaks** (`segment.ts:63`), so Command Line, Substitute and Global
  (33 lessons, all "coachable") only ever get motion critiques. Nothing says, for example,
  "`:%s` + `n` + `.` was 3 commands; `:%s/…/g` is one", or "you used `:1,5d`; `5dd` from line 1".
- **The first four lessons are excluded** (`target`/`word`/`fix`/`replace` kinds), and that is
  where the `hjkl`/`x` habits form. Lessons 01–02 are movement drills where hints about `w`/`f`
  would undercut them, so the exclusion is right there. For `x` (03) and `r` (04), no.
- **`UNCOACHED_SECTIONS`** (`vocab.ts:83`): macros, surround, more-text-objects, jumping,
  finding-things, file-navigation, git. The plugin-driven ones are right to be excluded
  (modals, pickers). Macros is right *while recording*, but `recordingSpans` already handles
  that (`index.ts:32`). Replays (`@a` then manual `j0@a` six times, instead of `5@a` or
  `:norm`) are exactly what a macro coach should comment on. Recommendation: coach Macros
  outside recording spans, with a `count-@` rule.
- **Idioms with no rule:** `ciw`/`caw`/`daw`/`di"`/`ci(` (all text objects), counts on
  operators (`d2w`, `c3w`, `2dd` from `dd.`), `dt`/`df` from x-runs, `D`/`C` from x-runs to the
  end of the line, `s`/`S`/`cc`, `x`→`~` (case lessons), `J`, `>>`/`<<` instead of `I  <Esc>`,
  `ddp`/`yyp` variants beyond `ddjP`, `xp`, `;` after repeated `fX` (blocked by F2 in its own
  lesson), `*`/`#` instead of `/word<CR>` (only generated when the whole route is a single `*`),
  `%`, `gv`, `o` in visual, `.` after `n`, `n.` vs `cgn`, `NG`/`gg`, `<C-d>`, and "use `u`
  instead of fixing forward".

### F11. No memory across runs — MEDIUM (design gap)

The spec says "Nothing new is stored on the server." Each run's report is independent, so the
coach cannot say "third run in a row you reached for `x`×N at an end of line — that's `D`".
Streaks and recurring patterns are the strongest coaching signal, and today they are thrown
away when the results screen closes.

---

## What the coach should become

### P1. Live hint: rare, closed, conceptual
1. **Fire only on closed segments.** Close them on: an edit command completing, a motion run
   followed by a non-motion command, or the round ending. Never fire on a run that is still
   growing.
2. **Budget.** At most 1 hint per round. In generated challenges, at most 1 per 3 items.
   Suppress a pattern already hinted this session unless it recurs 3+ times.
3. **Text format:** `name — what it does — keys`, for example:
   - "**Delete to a character**: `dt)` deletes up to the `)`, 3 keys instead of 16."
   - "**Append at end**: `A` works from anywhere on the line."

   One line. The pattern name is a link target (see P4).
4. **Never mask Vim's message.** Nudge priority goes below `vim.message`. The hint can wait for
   the next key.
5. **Opt-out, not opt-in**, once F1 is fixed. Keep the sidebar toggle.

### P2. Post-run "Better ways": from shortest keys to the right idiom
1. **Edit-equivalence search.** Replace the literal rules with one generic mechanism. For each
   edit window (a run of edits with only motions between, bounded by a break):
   - Compute the net change: the buffer diff from `stateBefore(start)` to the end state, plus
     the final cursor and mode.
   - Search a small, taught grammar: `[count] operator (motion | text-object)`, `[count] x/X/~`,
     `r/s/S/C/D/cc/J/>>/<<`, then `insert-text <Esc>`, plus `.` / `n.` / `;` repeats. Score it
     by a **style cost**, not raw keys: text object < `t`/`f` motion < word motion < count;
     `Nx` with N > 3 is penalized; mixed vertical/horizontal routes are penalized.
   - Replay-verify with the existing `sameOutcome` and `stateNeeds`. Keep that code, it is the
     best part of the module.

   This covers `16x` → `dt)`, `x`×27 → `D`, `xi===` → `s===`, `^C` → `cc`, `dwdw` → `d2w`,
   `bcw` → `ciw`, `~~~~~` → `gUiw`, and `I  <Esc>` → `>>` with no per-idiom code. The 9
   hand rules become regression tests.
2. **Prefer the current lesson's key.** Among equally good answers, rank the one using this
   lesson's chips first (`~` in toggle-case, `di"` in quotes, `*` in word-under-cursor). This
   turns "never undercut" into "always reinforce".
3. **Motion critic:** make the F5 canonical route shape and vocabulary change. Show one
   suggestion.
4. **Why = concept + lesson link.** Each suggestion carries a `pattern` id, and the pattern id
   maps to a name, a one-line principle and the lesson that teaches it. Examples:

   | pattern | principle | taught in |
   |---|---|---|
   | `find-char` | jump to a character you can see | 07 Find Character |
   | `op-to-char` | delete up to a character, don't count | 28 Delete to Character |
   | `text-object` | edit the thing, not the characters | 38 Word Objects |
   | `dot` | make one change, repeat it | 35 Repeat Last Change |
   | `count-op` | say how many once | 36 Counts & Operators |
   | `line-end-insert` | `A`/`I` carry their own motion | 09 Insert at Line Ends |
   | `jump-line` | `NG` for far lines | 19 Top & Bottom |
   | `search-jump` | `/` or `*` for a word you can see | 53/55 |

   Render a "Review: Delete to Character →" link that opens the lesson.
5. **Summary line before the list:** "You used 235 keys: 172 moving, 38 typing text, 25
   editing. Par 64." This split tells the learner what kind of waste they have. It also answers
   the brief's "typing long strings more than practicing the motions" for the learner, not just
   the author.
6. **Fix F3 (gate) and F8 (rendering)** so the reference comparison is actually visible.
7. **Generated challenges:** give each item a line, "Edit 3: par 6, you 31 (motion 27)",
   worst 3 first.

### P3. Data to store per user (server `Run` + local cache)

Store small, derived facts, never raw key logs:

```ts
type CoachEvent = {                 // one per critique, appended to the run
  pattern: string;                  // 'op-to-char', 'find-char', 'text-object', ...
  lesson: string; unit: number;
  you: number; better: number;      // key counts
  used: string;                     // learner's form, bucketed: 'x-run', 'l-run', 'retype', ...
  at: number;
};
type CoachProfile = {               // per user, updated server-side on each run
  patterns: Record<string, {
    seen: number; lastSeen: number;          // times the waste pattern occurred
    fixedStreak: number;                      // consecutive runs with the pattern absent where applicable
    firstSeenLesson: string;
  }>;
  keyMix: { moving: number; typing: number; editing: number; runs: number }; // rolling 20 runs
  hintsShown: Record<string, number>;         // for the live budget and "don't repeat yourself"
};
```

This enables:
- **Recurrence callouts:** "4th run in a row: `x`-runs to end of line → `D`."
- **Mastery ticks:** "`dt` used correctly 5 runs straight — pattern retired." Stop hinting it.
- **Spaced review input** for front 2: patterns with high `seen` and low `fixedStreak` choose
  which generated drills to serve next (for example a "Fix the File" seed weighted toward
  `op-to-char` sites).
- **A Coach page in Profile:** top 3 recurring wastes, each with its lesson link, and the
  moving/typing/editing trend.

Privacy: patterns and counts only. No buffer text or keys leave the browser.

### P4. Order of work (smallest first, biggest learner effect)
1. **F1:** stop per-key live hints. This is about 5 lines in `Practice.tsx`.
2. **F2:** drilled = the lesson's chips, compared against command tokens. Then **F3:** gate
   only command keys. Both are small and restore a large share of the report.
3. **F8:** render from the command stream.
4. **F6:** motion-family whys and lesson links (pattern table).
5. **P2.1:** the edit-equivalence search, which retires F4 row by row.
6. **F5:** canonical motion routes, `NG`, `%`, `<C-d>`.
7. **P2.5:** the key-mix summary, and per-item par for generated challenges (F9).
8. **P3:** the CoachProfile, recurrence callouts and the Profile page.
9. **F10:** visual-mode and ex-command critics, and Macros outside recording.

---

## Appendix: scenario index (all in `claude-coach/sweep*.txt`)

Lessons exercised: insert-mode, line-ends, find-char, change-words, insert-line-ends,
open-lines, substitute, delete-words, delete-to-char, delete-lines, change-lines,
copy-paste-lines, repeat-last-change, counts-operators, word-objects, text-objects-quotes,
visual-characters, search-forward, word-under-cursor, top-bottom, matching-pairs, toggle-case,
indenting, case-operators, half-pages, join-lines, unnamed-register, repeat-find,
change-next-match, boss-tidy-function, plus both generated challenges (3 seeds each).

What worked as designed: `A;<Esc>jA;<Esc>…` → `.`; `cgnlog<Esc>`×3 → `.`; `dd`×4 → `4dd`;
`$a;` → `A`; `A<CR>` → `o`; `l`-spam → `$`; 29×`j` → `G`; 25×`l` → `f(`. No suggestion failed
replay, and none used an untaught key. The engine is trustworthy. What needs work is the
teaching layer on top of it.
