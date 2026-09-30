# vimchi full sweep — synthesis (2026-09-30)

Six independent read-only reviews, run in parallel: four Claude (Opus) reviewers and two Codex
reviewers, one front or two each. Their reports and evidence sit beside this file:

| front | report | evidence |
|---|---|---|
| 1 Curriculum coverage | `claude-curriculum.report.md` | `claude-curriculum-data/` |
| 2+3 Volume & fidelity | `claude-fidelity.report.md`, `codex-fidelity.report.md` | `claude-fidelity.data.md`, `codex-fidelity.data.md`, replay scripts |
| 4 Coaching | `claude-coach.report.md` | `claude-coach/` (60 novice scenarios, 31 lessons) |
| 5 Bugs (app) | `claude-bugs.report.md` | `claude-bugs/` (12 headless playthroughs, BFS over rounds) |
| 5 Bugs (engine vs Neovim) | `codex-bugs.report.md` | `codex-probes.*` (734 differential cases vs nvim 0.12.5) |

Where two reviewers measured the same thing they agree to the percent (typed-text share 18.5% vs
18.6%; same top-10 typing lessons; same `insert-mode`-uses-`f` finding; same `startofline` mismatch),
which is the best evidence the numbers are real.

## The five questions, answered

**1. Does the curriculum cover the needed material?** Mostly yes; the gaps are at the two ends.
Against vimtutor, Practical Vim, Learn Vim the Smart Way, vim-hero, Primeagen and both starter
configs, operators, objects, visual, search, registers, macros, marks/jumps, quickfix, `:g`,
substitute and the LSP maps are complete. Missing entirely: **save & quit** (four lessons already
require `:w` before anything teaches it), `:help`, `C-e`/`C-y`, `:set`, which-key discovery, `gO`,
format, undo tree, folds, spelling. Six lessons use a key before it is taught (`f` in lesson 05 is
the one every learner hits). Search (53–55) and LSP navigation (148–150) arrive too late. `:norm`,
`@:`, `C-r C-w` and `gv` are each taught twice. Ten copy statements are wrong for current Neovim or
the starters. The Code band breaks the revamp spec's own rule twice: surround `ys/cs/ds` is in
neither starter, and `]m` is not mapped by either.

**2. Does the practice volume build the skill?** No. Every lesson is a worked introduction, not
practice: median 5 fixed rounds, and in 90 of 132 lessons the named key runs about once per round.
"Repeat" replays the same five buffers, so a second pass rehearses answers. `.` is taught at lesson
34 and then used by 9 of the following 143 lessons' references, because every round has one edit
site. Nothing brings an old key back later. The generated challenges have the right key mix but the
wrong edit mix: "Operators" yields about 1.9 operator edits per run because the generator weights by
site, not by kind, and it runs 8–12 edits where the spec says 10–14.

**3. Do the exercises exercise the skill?** In the motion sections, yes (0% typing). In the lessons
where the key enters insert mode, no: Core-band references are **35% literal text**, and the
worst lessons are transcription drills (Opening New Lines 102 of 114 keys typed, Substitute `s`/`S`
113 of 131, Insert Delete Word 86%, Change Lines 76%). Because par is the reference length and
accuracy is par/keys, a typo in the prose costs as much as a wrong motion: the learner is graded on
typing. The Ex-heavy lessons (Patterns band, 81% command-line typing) are a different case: the
syntax is the skill there, but identifiers and paths are longer than the concept needs.

**4. Does the app coach the learner?** The engine under the coach is sound (every suggestion
replay-verified, none used an untaught key), but as a teacher it fails three ways. Live hints fire on
nearly every key of a run you are still typing (22 different hints in 25 `l` presses; ~1 hint per 1.3
keys in generated runs) and can replace Vim's own error message. The post-run report is silent in
whole sections because "never undercut" matches raw keys against every chip in the section (all
`j`/`k`/`w`/`f` runs in the 12 First Operators lessons are never critiqued), and a tokenizer bug hides
the reference line in 36% of rounds. When it speaks it gives the arithmetic answer, not the idiom:
`16x` where `dt)` is the lesson, `27x` instead of `D`, `rF` instead of `~`, `3jEj3j3j` instead of
`/catch`, and every motion "why" is the same sentence. Visual mode and Ex commands are never
coached. Nothing is remembered across runs.

**5. Are there bugs?** Yes, and some matter. One Critical: on non-US keyboards (Windows AltGr, Mac
Option) `@ { } [ ] ~ | \` arrive as Alt chords, so German/French/Nordic users cannot run macros or
use bracket motions. Important: a signed-in user's run is lost for good on any failed save (no
retry, 401/429 unhandled); on the tailnet instance every client shares one rate-limit bucket (proxy
trust unset) and the first-hop `X-Forwarded-For` rule is spoofable behind nginx; the replace lesson
counts `u` as a second mistake right after telling the learner to press `u`; 30 cursor rounds and 10
edit rounds have a strictly shorter route that skips the taught key (`b` for `ge`, `M` for
`?try<CR>`, `ll~` for a 16-key `:s` rename); generated challenges clip at ~54 columns under the
checklist at 1400px; a seed link is ignored after "New file". Engine vs Neovim: 14 divergences with
repros, led by undo/redo losing the cursor column (so "undo then retry" edits the wrong character),
counted `dw`/`diw` across lines, visual `$` dropping the newline, an empty insert destroying redo,
`g-`/`g+` promised by a lesson but unimplemented, and `G`/`gg` jumping to first non-blank
(Vim's `startofline`) where Neovim keeps the column, which makes six reference cursor goals wrong in
real Neovim.

## Status

- 2026-09-30: P0 (items 1–7) and both owner decisions shipped on branch `p0` and merged; a fresh Opus review of the branch found no Critical items, and its six Important findings were fixed before the merge (re-feed via handleKey, layout-aware Alt rule, mini.surround fidelity: `srtt`, charwise `V`, cover-only search, `b` any bracket; outbox keyed by account; `nostartofline` for linewise operators and page scrolls; the `gv` round judged by `"0`).

## Ranked work list

Ordered by learner effect per unit of work. Effort: S = under an hour, M = a session, L = days.

### P0 — first-hour experience and data loss

1. **Keyboard: AltGr/Option characters** (S). `keys.ts`: pass through when `AltGraph` is held or
   `e.key` is not the unshifted key for `e.code`; build the Alt stand-ins from `e.code`. Unit tests
   for the DE/FR/Mac rows. Fixes the Mac stand-in copy too.
2. **Durable run saves** (M). localStorage outbox, POST, drop on 204, flush on load/online; 401 →
   guest mode with a message; 429 → honour `Retry-After`. Server dedup already makes resends safe.
3. **Save & Quit lesson + key-before-taught test** (S+S). Add "Save & Quit" after Insert Mode;
   rewrite lesson 05's four `f` solutions with `w`/`e`/`l` (or move Find Character ahead of it);
   fix the other five (26 `P`, 74 `:%s`, 81 `:norm`, 85 `gf`, 142 `gcc`). Add a registry test that
   walks ORDER and fails when a reference uses a command first taught later (`taughtBy` has the map).
4. **Live hints: closed segments only, one per round** (S). About five lines in `Practice.tsx`;
   never mask `vim.message`. Then flip the default to on.
5. **Coach gates** (S). Drilled set = the current lesson's chips, compared against command tokens
   not raw keys; reference-line gate tokenizes via the engine's command stream. Together these
   restore the report in whole sections and in 36% of rounds.
6. **Replace/fix lessons score `u` as a mistake** (S). Skip scoring when the last command is undo.
7. **Rate limiter behind proxies** (S). Set `VIMCHI_TRUST_PROXY=1` in the tailnet compose; take
   the last `X-Forwarded-For` hop (Caddy on the droplet already strips client-supplied XFF, nginx
   appends). Update the test.

### P1 — make the exercises exercise the skill

8. **Typed-text budget, enforced** (M). Add the sweep's classifier to `lessons.test.ts`: at most 6
   literal characters per round in Core and Code, opt-out per lesson with a cap of 8. Rewrite the
   ~37 lessons over 25% typed using the four levers (deletion goals, ≤6-char replacements,
   buffer-sourced text via `y`/`p`/`C-r`, multi-site rounds). Both fidelity reports supply
   engine-replayed redesigns for the 10 worst lessons; use them as-is.
9. **Multi-site rounds from lesson 34 on** (M). Two or three instances per round so the key runs
   2–3 times with navigation between, and `.` is the par solution wherever it applies. Triples reps
   at zero typing cost.
10. **Compact the Ex lessons** (S). Preload patterns with `setup.search` + `:%s//new/gc`, 3–6
    character identifiers, short paths. Keep the syntax.
11. **Shortest-route guard** (S). Turn the bugs reviewer's BFS into a test with an allowlist; fix the
    30 + 10 rounds by moving targets off screen edges, lengthening one-char words, choosing
    non-case renames.
12. **Generated challenge mix** (S). Pick the mutation kind first, then a site; honour 10–14 edits;
    emit repeated edits so `*`/`cgn`/`.` are par. Also fix the checklist layout clipping code at
    desktop widths.

### P2 — practice volume and coaching that teaches

13. **Per-lesson "Reps"** (L). After the authored rounds, 10–15 generated mini-rounds of that
    lesson's edit on corpus files with random sites, reusing the challenge generator with skill-keyed
    mutations (`wrong-string-contents` → `ci"`, `stray-arg` → `daa`, `extra-block` → `dap`,
    `indent-off` → `>ip`, `stray-line`×3 → `dd` then `.`). This is the main volume lever.
14. **Spaced mixed review** (M). An 8–10 item warm-up drawn from Reps generators of lessons finished
    ~1/3/7/21 days ago, weighted to low accuracy. `runs(lesson, at, speed, acc)` already holds what a
    scheduler needs; no schema change.
15. **Coach: idiom search instead of nine hand rules** (L). One generic edit-equivalence search over
    the taught grammar (`[count] op (motion|object)`, `x/~/r/s/S/C/D/cc/J/>>`, `.`/`n.`/`;`),
    scored by style not raw keys, replay-verified with the existing `sameOutcome`. Prefer the
    current lesson's key among ties. Retires the whole "arithmetic answer" table.
16. **Coach: why + link + summary** (M). Pattern table (name, principle, lesson that teaches it) so
    each suggestion links back; canonical vertical-then-horizontal motion routes with `NG`, `%`,
    `C-d`; a "keys spent moving / typing / editing vs par" line, and per-item par in challenges.
17. **Coach memory** (M). Small per-user profile (pattern counts, fixed streaks, key mix), recurrence
    callouts, mastery retirement, and the same data feeding review selection. Patterns and counts
    only, never keys or text.
18. **Challenges 3–5** as band capstones once 12 is done.

### P3 — engine fidelity vs Neovim (fix in this order; each has a repro in `codex-bugs.report.md`)

19. Undo/redo cursor column; empty insert wipes redo; `<C-g>u`.
20. Counted `dw`/`diw`/`daw` across lines; Visual `$` newline; `V2p` counts; block-put of linewise.
21. `:let @a` touching the unnamed register; search-history prefix on `<Up>`; `r<Tab>`/`r<CR>`;
    `J` and pre-existing trailing space.
22. **Decide `startofline`.** Neovim defaults to off (keep column); the engine and six cursor goals
    assume on. Either implement the option and default it Neovim's way (then fix `top-bottom`
    r2/r5/r6 and `jump-to-line` r1/r2/r4), or document that the tutor deliberately uses Vim's
    default. The reviewers disagree on which; my recommendation is Neovim's default, since the copy
    everywhere says "Neovim first".
23. `g-`/`g+`: implement, or scope the "Undo is a tree" aside until it exists.
24. Extend `scripts/nvimcheck` to compare cursor, register text/type and a follow-up command, not
    only the final text (387 text goals pass today; that is the regression baseline, not proof).

### P4 — curriculum shape and copy

25. Move Search forward (into Motions Worth Knowing), LSP navigation into Project, Blank Lines into
    Core; merge the two `:norm` lessons; drop duplicate chips/titles; the ten copy fixes (file:line
    in `claude-curriculum.report.md` F8); the seven chip mismatches (F7).
26. Reconcile the two starters in asides where the same key differs (`␣␣`, `␣sr`, `S`, `gd`/`grd`),
    and decide surround: keep `ys/cs/ds` and amend the spec rule, or re-key to mini.surround.
27. New lessons, in this order: Save & Quit (P0), Getting Help, Scroll by Line, Undo in Time,
    Options, Discover Keys (which-key), Document Symbols, Format, Folds.
28. Remaining minors from `claude-bugs.report.md` M1–M15 (hint tags over the row above, Tab on
    Results, stale advance timer, sign-in return without hash, `#profile`, guest import chunking,
    24h run limit, tab rendering width, mobile keyboard).

## Owner decisions (2026-09-30)

- `startofline`: follow Neovim's default (`nostartofline`). The engine gets the option, default off; the six cursor goals move.
- Surround: re-key the section to mini.surround (`sa` / `sd` / `sr`, kickstart's default), LazyVim's `gsa` / `gsd` / `gsr` in the aside. nvim-surround's `ys` / `cs` / `ds` become the aside's "other lineage".

## Where the reviewers disagreed, and the ruling

- **`startofline`:** Codex calls the engine wrong; the Claude bugs reviewer lists it as a mismatch
  and notes the lesson goals depend on it. Ruling: follow Neovim (item 22), because the product
  promise is Neovim defaults.
- **Surround keys:** the curriculum reviewer calls `ys/cs/ds` a spec violation; the spec's own
  survey chose it for lineage. Ruling: owner decision (item 26); the copy must at least say
  kickstart ships mini.surround.
- **Typed-share metric:** Codex warns that a single ranking mostly surfaces Ex lessons where syntax
  is the point; Claude splits insert-typed from cmdline-typed. Ruling: use the split; the budget in
  item 8 applies to insert text only, and item 10 handles Ex compaction separately.
- **Quiz kind:** no lesson uses it any more; `Quiz`/`quizKey` are dead code. Delete when convenient.

## Numbers worth remembering

| measure | value |
|---|---|
| lessons / rounds | 180 lessons, 174 with rounds, 846 rounds; all references replay green |
| reference keys | 7,580: 18.6% insert text, 34.5% cmdline text, 46.8% commands |
| Core band | 35% insert text, 3.9 command keys per round |
| lessons ≥25% typed | ~37 |
| `.` after it is taught | used in 9 of 143 lessons |
| coach report hidden reference | 254 of 705 coachable rounds |
| live hints in generated runs | ~1 per 1.3 keys |
| rounds with a shorter untaught route | 30 cursor + 10 edit |
| engine vs Neovim | 734 differential cases; 14 divergences; 387 text goals pass |
| suite | 41,532 tests green, tsc clean |
