# Independent second opinion: practice volume and exercise fidelity

Scope: fronts 2 and 3 only. Snapshot measured on 2026-09-29 local time, in the requested 2026-09-30 sweep directory. No application changes, commits, containers, or deployment.

The complaint is supported for several edit lessons: Opening New Lines spends 102 of 114 reference keys typing buffer text; Substitute (`s`/`S`) spends 113 of 131. However, a single “typed text” ranking mostly identifies Ex lessons, where command syntax is the intended skill. Keep these two problems separate when choosing fixes.

## Measurement and limits

The registry contains 180 lessons: 174 `rounds`, two generated, and one each target/word/fix/replace. There is no separate `sim` kind in `src/lessons/types.ts:54`. Walked `ORDER` derived from `SECTIONS` (`src/lessons/index.ts:34` onward); merged each base/round setup through `createVim`, parsed notation with `solutionKeys`, inspected the engine mode **before every key**, then fed it to the actual engine. All 846 round solutions reached their goals; none started solved.

Artifacts:

- [Raw tables](codex-fidelity.data.md): every lesson in curriculum order and ranked order.
- [Executable audit](codex-fidelity.test.ts): `npx vitest run docs/superpowers/audit/2026-09-30-sweep/codex-fidelity.test.ts`.
- [Per-key trace](codex-fidelity.trace.json): lesson, round, prompt, solution, pre-key mode and classification for every key.

There are two explicit interpretations of the requested classification:

1. Strict mode membership: **4,486 / 7,580 = 59.2%** of solution keys occur while in insert/replace/cmdline mode. This includes Esc, Enter and control keys. Each trace records `modeCategory`, and the tables expose the count.
2. Printable typing within those modes: **4,020 / 7,580 = 53.0%**; **1,406 buffer characters (18.5%)** and **2,614 cmdline characters (34.5%)**. Tables use this as typed-text share and average typed chars/round; remaining keys are commands. This is a mode-based input proxy, not an assertion that every printable key inserts a character: register selectors after Ctrl-r and completion choices can be printable controls. Normal-mode `r` replacements and `f` arguments remain command keys under the requested mode rule. Expanded macro, dot, register or completion output is not counted as manually typed text. Tab/newline insertion is represented in the strict mode count, not printable characters.

These are reference-solution measurements, not observed learner behavior, lower bounds on necessary typing, or proofs of fluency. Cursor carry is disabled by using independent setups, matching the canonical validator (`src/lessons/__tests__/lessons.test.ts:55`). User sessions may carry the cursor and alter motion work (`src/lessons/runtime.ts:261`). Proposed examples below are redesign specifications, not newly implemented/replayed rounds.

## Findings ranked by learner effect

### 1. High: fixed introductions are doing the job of a practice curriculum

Across 174 round lessons: 8 have 3 rounds, 48 have 4, 81 have 5, 34 have 6, and 3 have 7. Median is 5; 137/174 (78.7%) have at most 5. The validator even imposes 3–10 (`src/lessons/__tests__/lessons.test.ts:47`). These are reasonable introductions, but do not establish fluent selection and execution on unfamiliar text. A multi-key or multi-command lesson can provide only one example per variant; snippets supplies three rounds for expansion, navigation and editing (`src/lessons/sections/insert-power.tsx:322`).

Judgment for **every measured lesson**: its round count is sufficient as a short worked introduction, insufficient evidence of fluency. This is a curriculum judgment based on the finite examples and absence of unseen transfer checks, not an empirically validated minimum repetition count. Even seven rounds do not prove retention. Zero typing share also does not prove meaningful practice: it can be five isolated presses.

Existing extra practice has a narrow reach: `src/challenges/index.ts:6` defines only two generated sets, each with 8–12 mutations. The second adds stray words/lines, wrong words and duplicate lines, but does not explicitly drill text-object boundary selection, visual selections, macro construction, quickfix, registers, or Ex patterns. Their `skills` are documentation, per `src/lessons/types.ts:97`; do not assume those tags enforce execution of a command.

Concrete extension:

- Retain 4–6 instructional rounds; add an optional focused generator immediately after the lesson. Start with 12–20 varied attempts per skill as a product experiment, not a universal fluency threshold.
- Rotate cursor location, boundary type, count, forward/backward direction and distractors. Keep replacement strings 0–3 characters in motion/operator drills. Require the final cursor or unchanged context where it disambiguates the intended boundary.
- Add mixed 8–12-task sets at section ends. Include choice between `dw`/`de`/`diw`, `C`/`cc`, inner/around objects, and dot versus new edits. Unseen setups should be the normal practice mode; same-seed replay remains useful for speed.
- Add skill-level review due dates, initially 1/3/7/14 days; adapt after observed errors. Current persisted `Run` stores lesson/time/keys/score but no due date or per-skill mastery (`src/state/store.ts:7`). This recommendation applies to the inspected local practice/progress path, not an assertion about every possible external schedule.
- Offer 60–90-second timed repetitions only after accurate completion on unseen tasks. Track clean task rate and excess command keys separately from text-entry speed. Pilot a criterion such as two unseen clean sets plus a later review before labeling a skill fluent.

### 2. High: several editing lessons mostly rehearse typing the replacement

Opening New Lines has only six entry/exit operations while requiring 102 literal characters; round 5 alone types `log.debug('getUser', id);` (`src/lessons/sections/insert-like-a-pro.tsx:233`). `s`/`S` round 5 types an entire mapping (`:337`), even though its distinguishing operation is `S`. Shorten the content and use the saved effort for new locations and boundary decisions.

Here are the **ten worst by buffer-typing share**, descending, with concrete low-typing redesigns. This is the actionable fidelity ranking for the owner's complaint; the exact combined ranking follows separately.

| Lesson and evidence | Buffer share; rounds; chars/round | Concrete new goal and practice shape |
|---|---|---|
| `open-lines`, insert-like-a-pro.tsx:146 | 89.5%; 6; 17.00 | In `a / b / c`, create an empty line above or below the named line, then return to normal mode on it. Alternate `o`/`O`, change starting line; occasional new line containing only `#`. Generate 16 placements. |
| `substitute`, insert-like-a-pro.tsx:249 | 86.3%; 6; 18.83 | Change `a = b` to `a == b` using a short `s` edit; replace a whole indented obsolete line with `x` using `S`. Mix `2s`, `s`, `S`, punctuation and indents over 16 trials. |
| `insert-delete-word`, insert-power.tsx:23 | 85.9%; 6; 13.17 | Initialize insert mode after `red blue`; goal `red x` via Ctrl-w plus `x`. Contrast Ctrl-u with leading indentation and Ctrl-w at punctuation. Eight short repair pairs, not entire plugin names. |
| `snippets`, insert-power.tsx:322 | 82.1%; 3; 15.33 | Expand a two-placeholder template with defaults; goal changes only one name to `x`, advances to body and exits. Alternate forward/backward placeholder traversal and default acceptance. Eight varied templates, 1–3 newly typed chars each. |
| `change-lines`, basic-operators.tsx:578 | 75.9%; 5; 16.40 | Starting midline in `  return old;`, goal `  return x` for `C`; separate goal `  x` for `cc`. Keep neighboring lines identical. Twelve varied start columns/indent levels plus mixed `C`/`cc` choice. |
| `function-class-objects`, more-text-objects.tsx:293 | 74.4%; 6; 10.17 | Nested function bodies with goal deleting one whole function (`daf`) or changing just its body to `x` (`cif`). For classes, preserve the declaration and change inner body to `x`; alternate with `dac`. Twelve cursor positions, including nested distractors. |
| `back-to-edit`, marks-jumps.tsx:427 | 67.3%; 4; 8.25 | Setup a previous insertion, move to another line, then goal adds only `!` at that insertion via `gi`. Separate cursor-only tasks for last-change marks. Twelve histories with intervening navigation; no long sentences. |
| `insert-line-ends`, insert-like-a-pro.tsx:11 | 65.9%; 6; 4.83 | Add `;` with `A`, or `#` after indentation with `I`, from randomized middle columns. Keep a few current short tasks; replace `const rows = ` with a one-character prefix. Sixteen alternating ends and first-nonblank targets. |
| `reaching-objects`, text-objects.tsx:1256 | 65.2%; 7; 8.29 | Change the contents of the next quote pair to `x` (`ci'`) from outside it; delete brace interiors (`di{`), preserving delimiters and surrounding code. Twelve pairs with whitespace/delimiter distractors and varied cursor placement. |
| `boss-csv-to-object`, macros.tsx:679 | 65.1%; 3; 49.67 | Put long wrappers in the initial buffer. Rows `a,b / c,d / e,f` become `a:b / c:d / e:f`; record a delimiter-replacement macro, replay across 5–10 rows. Add a second family requiring line movement plus quote deletion. Preserve one realistic conversion as transfer, and score setup typing separately from replay. |

For insert-control and snippet lessons, much of the relevant work is not motion/operator work. Preserve that skill rather than replacing it with deletion just to lower the percentage. For the macro boss, a one-time recorded edit amortized across many rows is legitimate; the reference trace counts manual input only, so compare chars per transformed row as a secondary metric.

### 3. Medium: the combined metric confounds command construction with irrelevant prose

The exact **ten worst by combined printable share**, tie-broken by chars/round, are below. Nine are Ex-oriented and contain zero buffer typing. Redesigning all of them into pure motion tasks would erase their learning objectives. Reduce incidental identifiers and paths; keep essential syntax construction and offer motion/operator transfer tasks alongside it.

| Rank / lesson / source | Share; rounds; avg chars | Concrete compact redesign retaining the skill |
|---|---|---|
| 1 `sub-capture-groups`, substitute.tsx:623 | 95.1%; 4; 38.75 | Use `a,b / c,d / e,f` → `b a / d c / f e`, e.g. `:%s/\v(\w),(\w)/\2 \1/`. Add cursor/visual-range selection on one block, then a separate deletion/movement task reordering those tokens. Generate delimiter/ordering variants. |
| 2 `every-buffer`, quickfix.tsx:458 | 94.2%; 4; 32.25 | Three buffers containing `x` and untouched distractor lines; goal deletes `x` lines in each with `:bufdo g/x/d` and persists changes where requested. Also navigate to and inspect a specified buffer. Practice scope and writes across 8 file sets. |
| 3 `edit-every-match`, quickfix.tsx:323 | 93.6%; 4; 29.25 | Seed quickfix locations on junk lines; goal deletes each (`:cdo d`, adding update only when disk persistence is part of the goal). Companion tasks navigate entries and use `dw`/`dd`. Vary duplicate locations and file boundaries. |
| 4 `sub-expressions`, substitute.tsx:1337 | 93.2%; 4; 27.50 | Lines `1 / 2 / 3` → `2 / 3 / 4` via `:%s/\d/\=submatch(0)+1/`. Include a visually selected subset and untouched outside rows. Separate numeric-motion transfer using Ctrl-a; do not let it replace the expression objective. |
| 5 `sub-zs-ze`, substitute.tsx:963 | 92.2%; 4; 23.75 | `ax / bx / ax` → `ay / bx / ay` via `:%s/a\zsx/y/g`; matching suffix exercise with `\ze`. Follow with selecting/changing only the same bounded token manually. Short strings with distractor prefixes expose boundary mistakes. |
| 6 `grep`, quickfix.tsx:118 | 91.7%; 4; 22.00 | Short files `a.ts`/`b.ts`, target `x`, using `:vimgrep /x/ *.ts`; then reach a specific result with quickfix navigation and delete the target word. Check list population separately from editing. Eight changing scopes. |
| 7 `sub-ignore-case`, substitute.tsx:365 | 90.5%; 4; 19.00 | `a A aa` → `x x xx` using `:%s/a/x/gi`; paired case-sensitive goal preserves `A`. Alternate flags, smartcase and embedded atoms; a manual motion/change companion edits only one occurrence. |
| 8 `sub-boss`, substitute.tsx:1488 | 89.7%; 3; 17.33 | Small text combining standalone `var`, distractor `variant`, `a_b` and short quoted tokens. Goal uses boundary rename, case conversion and quotes without long names. Keep 3 integrated tasks, add 8 unseen mixed transformations rather than repeating the same boss. |
| 9 `sub-very-magic`, substitute.tsx:545 | 89.6%; 4; 17.25 | `a b aa ab` → `x x aa ab` with `:%s/\v<(a|b)>/x/g`. Add whitespace removal and a visually restricted range. Include a transfer round deleting chosen words with operators; preserve actual regex construction in the core tasks. |
| 10 `open-lines`, insert-like-a-pro.tsx:146 | 89.5%; 6; 17.00 | Empty-line placement and one-character marker drills as above; require correct line/cursor and normal mode. |

All source paths in both tables are relative to `src/lessons/sections/`. Existing sequences are available round-by-round in the trace; new examples are proposals, not engine-validated substitutes. Percentage alone is not a priority score: the early `open-lines`/`substitute` edits deserve action before late regex lessons with naturally high syntax input.

### 4. Medium: elapsed time and par blend typing speed with command skill

Reference solution length sets round par; round time uses 1,500 ms plus 450 ms per key (`src/lessons/runtime.ts:568`). Combined score weights speed and key accuracy at 35% each (`:103`). Thus a long replacement expands both the exercise and its time budget while contributing little practice of the distinguishing operator. The current metric can show near-par completion on a prose-heavy lesson without measuring transferable operator choice.

Keep total keys for realistic task cost, but expose buffer characters, command-line characters, commands completed, and extra command keys as separate practice diagnostics. Avoid rewarding low typing mechanically: substituting a massive seeded register paste for a simple edit can lower the metric without teaching the intended skill. Evaluate operation selection on unseen tasks and verify goals preserve distractors; add execution constraints only in explicitly focused drills, keeping transfer tasks open to valid alternatives.

## Recommended implementation order and validation

1. Shorten the top buffer-heavy introductory edits, preserving a few realistic examples. Reuse the saved effort for more independent decisions. Add the low-typing `o`/`O`, `s`/`S`, `C`/`cc` and object-boundary generators first.
2. Extend generated practice beyond the current two mutation pools; add focused sets followed by mixed section sets. Distinguish first completion from demonstrated fluency and introduce due reviews.
3. Compact Ex identifiers and paths; preserve syntax, range selection, scope and persistence. Add quickfix navigation/editing follow-through and unseen regex distractors.
4. Replay every new reference with `createVim` and through `Session` with carry disabled, then validate actual carry behavior separately. Ensure no goal starts solved. For generated sets, test multiple seeds, solvability and unchanged context. Track typed share, but judge success by more skill decisions and retained accuracy on unseen tasks.

Validation performed here: the single audit test passed, checking 846 independent round start/end states and producing all requested per-lesson metrics. No full suite/typecheck was needed for this read-only analysis. No learner study was performed; proposed repetition counts, time limits and review intervals need product validation.
