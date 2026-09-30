# Fronts 2 and 3: practice volume and exercise fidelity (claude, 2026-09-30)

Owner's report: "I find myself typing long strings more than practicing the motions." It's accurate,
and it's worst where a new learner spends their first hour. There is a second problem the typing
hides: each lesson gives about five reps of the key it names, in the same five fixed buffers every
time.

## Method

- `claude-fidelity.sweep.test.ts.txt` replays each of the 846 reference solutions in the 174
  `rounds` lessons through `createVim`, one key at a time. Each key is classified by `vim.mode`
  *before* it is fed:
  - **ins**: a printable key in insert or replace mode. This is literal text.
  - **cmdl**: a printable key on the `:` `/` `?` line.
  - **cmd**: everything else, including f/t/r arguments, `<Esc>`, `<CR>` and insert-mode `<C-…>`.
- Tables are in `claude-fidelity.data.md`: per lesson, per section, per band, the worst 25 by typed
  share and the worst 25 by absolute typed characters.
- `vim.lastCommand` gives the first lesson whose reference uses each command. That is compared with
  the first lesson whose chips or key cards teach it.
- Generated challenges were measured over 300 seeds each.
- Every redesign below was replayed in the engine: `claude-fidelity.proposals.test.ts.txt`, output in
  `…proposals.out.txt`.
- The temporary test files placed in `src/lessons/__tests__/` were deleted. The tree is clean apart
  from `docs/superpowers/audit/`.

## Headline numbers

The 7,580 reference keys split as follows:

| class | keys | share |
|---|---|---|
| literal insert text | 1,413 | 18.6% |
| command-line typing | 2,617 | 34.5% |
| motions, operators and commands | 3,550 | 46.8% |

By band:

| band | lessons | mean rounds | ins% | cmdl% | cmd keys/round |
|---|---|---|---|---|---|
| core | 64 | 5.3 | **35.1** | 6.4 | 3.9 |
| repeat | 16 | 4.1 | 23.2 | 11.4 | 10.8 |
| project | 33 | 4.8 | 4.6 | 52.5 | 3.6 |
| patterns | 33 | 4.2 | 0.8 | **80.7** | 2.6 |
| code | 28 | 5.0 | 32.5 | 3.3 | 4.1 |

- Core is the band the owner is in. A third of its keys are literal text, and it averages **3.9
  command keys per round**.

## Findings, ranked by effect on the learner

### F1. Early-core change lessons are typing drills (fidelity; high)

Four sections carry nearly all of the literal text (`claude-fidelity.data.md`, per-section table):

| section | literal text | chars per round |
|---|---|---|
| `insert-like-a-pro` | 79% | 10.1 |
| `insert-power` | 75% | 8.5 |
| `more-text-objects` | 54% | 4.2 |
| `text-objects` | 47% | 5.0 |

The motion sections are 0% (`essential-motions`, `screen-movement`, `indent-case`, `surround`), so
the problem is local to lessons where the named key enters insert mode. Each of those rounds uses the
key once and then asks for a whole line of prose or code.

The worst offenders by typed share (all 28 rounds of 15+ typed chars are listed in the data file):

| lesson | typed | per round | example round |
|---|---|---|---|
| `open-lines` (insert-like-a-pro.tsx:146) | 89.5% | 17.0 | `Olog.debug('getUser', id);<Esc>`: 25 chars to practice one `O` |
| `substitute` (insert-like-a-pro.tsx:249) | 86.3% | 18.8 | `Smap('n', '<lt>leader>w', '<lt>cmd>write<lt>CR>')<Esc>`: 39 chars |
| `insert-delete-word` (insert-power.tsx:23) | 85.9% | 13.2 | `<C-u>'nvim-telescope/telescope.nvim'<Esc>`: 31 chars |
| `change-lines` (basic-operators.tsx:578) | 75.9% | 16.4 | `jjf'Cprocess.env.API_URL;<Esc>` |
| `function-class-objects` (more-text-objects.tsx:293) | 74.4% | 10.2 | `cifreturn user.role === 'admin';<Esc>`: 29 chars |
| `back-to-edit` (marks-jumps.tsx:427) | 67.3% | 8.3 | `gi on first run.<Esc>` |
| `boss-csv-to-object` (macros.tsx:679) | 65.1% | 49.7 | 229 keys over 3 rounds, 150 of them literal, mostly scaffolding (`ggccconst users = [`) that has nothing to do with macros |

The text also costs score, not just time:
- Par keys is the length of the reference, and accuracy is `parKeys / keys` (runtime.ts:103-106).
- Par time is `1500 + 450 ms × par keys` per round (runtime.ts:155-156, 570).
- So in a 40-char `S` round, a typo in the prose costs as much as a wrong motion. The learner is
  graded mostly on transcription.

### F2. About five reps of the named key per lesson, in fixed buffers (volume; high)

- Rounds per lesson: 3 (×8), 4 (×48), 5 (×81), 6 (×34), 7 (×3). The test caps it at 10
  (lessons.test.ts:38).
- In 90 of the 132 lessons where every round's reference uses a chip, the chips appear at most
  `rounds + 1` times in the whole playthrough. That is one rep per round.
- Where a lesson has several chips, reps per chip fall to 1–2. Examples:
  - `text-objects-quotes` has 5 uses across `i"` `i'` `` i` ``.
  - `text-objects-parens` has 5 across `i(` `a(` `ib`.
  - `sentences-paragraphs` has 5 across 4 chips.
- "Repeat" (Practice.tsx:124) builds a new `Session` on the same challenge, so the same five buffers
  come back with the same targets. A second pass rehearses answers rather than building the skill.
- Nothing schedules a return to an old lesson. There is no review in `src/`, although `runs`
  (server/internal/store/migrations/001_init.sql:19) already stores lesson, time, speed and accuracy
  per run, which is all a scheduler would need.

### F3. `.` is taught and then almost never used (volume and fidelity; high)

- `repeat-last-change` is curriculum index 34.
- Of the 143 rounds lessons from there on, **9** ever use `.` in a reference. The other 134 each
  have one site per round, so repeating a change never pays.
- Vim's main habit of change, then `.`, `n.` or `;.`, is therefore never practiced after its own
  lesson.
- The same single-site shape is why 90 lessons give one rep per round (F2).

### F4. Patterns and project bands type long command lines (fidelity; medium)

- Command-line typing makes up:

  | section | share |
  |---|---|
  | `substitute` | 87% |
  | `quickfix` | 86% |
  | `global-commands` | 81% |
  | `buffers-files` | 70% |

- Much of this is intrinsic, because the syntax is the lesson. But patterns are often longer than
  the concept needs. For example, `sub-confirm` types 14–22 characters of `:%s/…/…/gc` per round
  for a skill that is the 3–5 `y`/`n`/`q`/`a`/`l` answers after it.
- Fix shape:
  - Preload the pattern with `setup.search`, which the type already supports (types.ts:149), and
    use `:%s//new/gc`.
  - Or use 3–6 character identifiers.
  - This is a smaller problem than F1: learners of `:s` expect to type.

### F5. The generated challenges have the right fidelity but the wrong mix (medium)

Over 300 seeds each, `claude-fidelity.data.md` shows:

| challenge | literal text in par | motion in par |
|---|---|---|
| `challenge-fix-the-file` | 4.0% | 72.2% |
| `challenge-operators` | 8.3% | 67.1% |

That is the ratio the owner wants. But:

- **The operator kinds barely show up in `challenge-operators`.** The generator shuffles one
  candidate per *site* (generate.ts:48), and char kinds have far more sites than line kinds. Over
  2,978 items the char kinds were 80.5%:

  | kind | items |
  |---|---|
  | `wrong-word` | 254 |
  | `stray-word` | 176 |
  | `stray-line` | 131 |
  | `line-to-remove` | 14 |
  | `missing-duplicate-line` | 5 |

  That is about 1.9 operator edits per run, in a challenge named Operators whose chips are
  `d c dd .`. The only cap is "no kind above half".
- **`.` in the chips is never useful.** Rule 3 (regions never share a line) plus random sites mean
  no two items are the same edit.
- **The edit count is below spec.** The spec says Challenge 2 has 10–14 edits
  (challenges-design.md:38); the code has `edits: [8, 12]` (src/challenges/index.ts:32).

### F6. A reference uses a key before it is taught (fidelity; medium)

- The worst case is `insert-mode` (curriculum #4, next-steps.tsx:11). Its references use `f` in 4 of
  5 rounds (next-steps.tsx:61, 91, 112, 121: `jfHflal`, `jf;i)`, `2jfia!`, `kf,a `). `f` is taught
  two lessons later in `find-char` (#6).
- A learner who has only `hjkl w b e` needs more keys than the par, so accuracy drops for following
  the curriculum.
- Minor cases, all listed in the data file: `:w` (#84, no chip until #116), `:j` (ex-ranges), `]Q`
  (references), `[c` (gitsigns-hunks), `:wa` (lsp-rename).

### F7. Some chips are not what the rounds drill (low)

These are approximate matches of chip strings against solutions (data file, `chipHits` column):
- `counts-operators` names `3dw d3w`, but its references are `d2w 4dd c3w d3w 2yy`. The
  count-first form (`3dw`) appears only as `4dd` and `2yy`.
- `reaching-objects` names `ci" ci' ci(`, but 3 of its 7 rounds are `di{`, `di'` and `` ci` ``.

This is worth a pass, but it is secondary.

## Recommended shape of practice

The fix needs two things together: rounds that **exercise the key, not the keyboard** (F1, F3, F6),
and **more, varied reps** (F2). Adding rounds alone would multiply the typing, and adding challenges
alone would not give a new key the repetitions it needs. In order of payoff per unit of work:

1. **An authoring budget, enforced by a test (cheap, now).**
   - Add the sweep's classifier to `lessons.test.ts`.
   - Limit: at most 6 literal characters per round in the core and code bands. A lesson can opt out
     with an explicit `typing: true` (for example `insert-like-a-pro`, capped at 8).
   - Rewrite the ~37 lessons at ≥25% typed with four levers:
     - **deletion** goals;
     - **short replacements** (a digit, `}`, `end`, `no`);
     - **buffer-sourced text** (yank and put, `<C-r>`);
     - **multi-site rounds**.
   - Worked examples are below. Everything in them is verified.

2. **Multi-site rounds from lesson 34 on.**
   - Give 2–3 instances of the edit per round, so the named key runs 2–3 times with fresh
     navigation between.
   - After `.` is taught, par should *be* the `.` solution. For example, the reference for "flip all
     three flags" is `fyCno<Esc>j0fy.j0fy.`.
   - This triples reps without adding rounds or typing.

3. **Per-lesson "Reps" (the volume lever).**
   - After the authored rounds, offer 10–15 generated mini-rounds of that lesson's edit on corpus
     files, with random sites and positions, and a per-rep timer.
   - The machinery exists:
     - `target`/`word` already do this for motions (`count: 12`, runtime.ts:224).
     - `src/challenges` has seeded corpus files, mutation kinds with a motion-free `fixKeys`, a par,
       and a checklist.
   - What is missing is a skill-keyed mutation per lesson family. Examples:
     - `wrong-string-contents` → `ci"`/`ci'` with a replacement of at most 6 chars drawn from the
       corpus.
     - `stray-arg` → `daa`.
     - `wrong-args` → `ci(`.
     - `extra-block` → `dap`/`daf`.
     - `indent-off` → `>ip`/`=ip`.
     - `stray-line` ×3 → `dd` then `.`.
   - Blocked, varied repetition of one new key is what builds it. The authored rounds stay as the
     worked examples.

4. **Spaced, mixed review ("Warm-up").**
   - An 8–10 item set drawn from the Reps generators of lessons last completed about 1, 3, 7 and 21
     days ago, weighted toward low `acc`/`speed` in `runs`.
   - It needs no schema change: `runs(lesson, at, speed, acc)` is enough.
   - This is the interleaved practice that keeps early keys alive once the learner is 60 lessons
     further on.

5. **Challenges 3–5: yes, as capstones, after a fix to the mix.**
   - Weight by kind, not by site. Pick the kind first, then a site of that kind.
   - Honour the spec's 10–14 edits.
   - For Challenge 4, emit *repeated* edits (the same rename ×3) so `*`/`cgn`/`.` are par.
   - Challenges test *choosing* among known keys under mixed demand. That is the right final layer,
     but it cannot replace (3): each Challenge 2 run exercises roughly two operator edits.

6. **Timed reps only once accuracy is clean.**
   - Show reps per minute on the Reps set when the last run's `acc` is at least 0.9.
   - Time pressure before that rehearses the wrong keys.

## Redesigns for the 10 worst lessons

Each round below was replayed in the engine (the ✓ is from `claude-fidelity.proposals.out.txt`).
Lines are ≤60 columns and buffers have ≥3 lines, as `lessons.test.ts` requires. Unchanged rounds are
marked *keep*.

### 1. `open-lines` (o/O): 102 typed chars / 6 rounds → 8 / 5, with 6 uses of o/O

- *Put a blank line between the two functions.* ✓ `jo<Esc>` (0 typed)
  - Buffer: `function one() {` / `  return 1;` / `}` / `function two() {` / `  return 2;` / `}`
  - Cursor 1:4. Goal: a `''` line after the first `}`.
- *Give the heading a blank line above and below.* ✓ `O<Esc>jo<Esc>` (0)
  - Buffer: `# vimchi` / `A browser Vim tutor.` / `## Usage` / `Run npm run dev.`
  - Cursor on `## Usage`, mid-line.
- *Close the table.* ✓ `jjO}<Esc>` (1). This teaches picking O from the line below to get the right
  indent.
  - Buffer: `local M = {` / `  x = 1,` / `  y = 2,` / `return M`
  - Cursor 1:3. Goal: `}` above `return M`.
- *Add a blank line after the imports.* *keep* (`O<Esc>`)
- *Mark the query with a TODO above it (keep the indent).* ✓ `O// TODO<Esc>` (7). It shows
  autoindent.
  - Buffer: `getUser` with `  const row = await db.user.find(id);`, cursor mid-line.

### 2. `substitute` (s/S): 113 → 16 typed, s/S used 8 times

- R1 `s===` and R2 `sand`: *keep*, 3 chars each.
- *Make every bullet a dash.* ✓ `s-<Esc>js-<Esc>js-<Esc>` (3 typed, 3 reps)
  - Buffer: `* Write` / `* Test` / `* Ship`
- *Change "14px" to "1rem".* ✓ `4s1rem<Esc>` (4). It keeps the count lesson of the old R3 without
  `0.875rem`.
- *The stray print should be the `end` of the if.* ✓ `jjSend<Esc>` (3)
  - Buffer: `if ok then` / `  run()` / `print('x')` / `return ok`
- Drop the three 27–39 char `S` rounds (R4–R6).

### 3. `change-lines` (cc/C): 82 → 19 typed, C/cc used 6 times

- *Turn every "yes" into "no".* ✓ `fyCno<Esc>j0fyCno<Esc>j0fyCno<Esc>` (6 typed, 3 reps)
  - Buffer: `debug: yes` / `verbose: yes` / `color: yes`
  - After `.` exists, this is the model multi-site round.
- *The debug line should close the function.* ✓ `jjcc}<Esc>` (1)
  - Buffer: `function one() {` / `  return 1;` / `console.log('here');` / `one();`
- *Set the port to 8080 and drop the comment.* ✓ `jf3C8080;<Esc>` (5)
  - Line: `const port = 3000; // TODO`
- *Replace the call with a bare return (keep the indent).* ✓ `jf,ccreturn;<Esc>` (7)
  - Line: `  redirect("/login", { replace: true });`. It shows that cc keeps the indent.
- Keep old R4 (`<cmd>write<CR>`) out; it is 16 chars of `<lt>` escaping.

### 4. `reaching-objects` (ci" ci' ci( from outside): 58 → ~10 typed

- R1 `ci'`: *keep*, but change `rose-pine` to `nord` (4).
- R2 `jci',`: *keep*, 1 char.
- *Simplify the condition to ok.* ✓ `ci(ok<Esc>` (2), cursor at column 0 of
  `  if (user.role === 'admin') {`. This replaces the 13-char `isAdmin(user)`.
- *Empty all three test names.* ✓ `di'jdi'jdi'` (0 typed, 3 reps from column 0)
  - Buffer: three lines `it('TODO …', () => {});`
- Replace the 22-char commit message round with the same message set to `v2`. Keep `di{` and `di'`.
- Bring the chips in line: either add `di` to the chips or make the `d` rounds `c` rounds.

### 5. `text-objects-quotes` (and the same fix for `-parens`, `-tags`, `word-objects-big`)

- The fix for the whole family: at most 6 chars of replacement, two quoted sites per round, and half
  the rounds use `d`/`y` rather than `c`.
- *Name it "vimchi" and point main at "src".* ✓ `jfvci"vimchi<Esc>jfdci"src<Esc>` (9 typed for 2
  reps)
  - Buffer: `package.json` with `"name": "vim-tutor-draft"` and `"main": "dist/index.js"`
- Change R2 `tokyonight` to `nord`, and R3 `` ci`/api/v2/users `` to `` ci`v2 `` on `` `v1` ``.
- Engine note: a bare `ci"` from column 0 of `"name": "…"` changes the *key*. Real Vim does the same.
  The round teaches that, so say it in the prompt.

### 6. `function-class-objects` (if/af/ic/ac): 61 → ~4 typed

- R2 `daf`, R3 `dac`, R6 `daf`: *keep*.
- *Duplicate the add() method above itself.* ✓ `yafP` (0 typed), `plugins: ['mini-ai']`
  - Buffer: `class Cart {` / `  add(item: Item) {` / `    this.items.push(item);` / `  }` / `}`
- *Indent the body one more level.* ✓ `>if` (0)
  - Buffer: `total(xs)` with a 3-line body
- R4 `cic`: shorten to `ciclog = x;` or swap it for `yicP` if `ic` needs a put.
- Engine note: `dif` on a mini-ai function body leaves a `'  '` line rather than removing it. Check
  this against Neovim with mini.ai before using `dif` in a round (worth a bug-front check).

### 7. `insert-delete-word` (C-w/C-u): 79 → ~25 typed

- The skill is erasing in insert mode. Retyped words should be ≤6 chars, and at least two rounds
  should need no retyping at all.
- *You typed "totl". Erase it and finish with sum);* ✓ `A<C-w>sum);<Esc>` (5)
- *Delete the trailing junk words*: `<C-w><C-w><Esc>` on a line ending in `foo bar` (0 typed).
- Change R6 (`<C-u>` + 31 chars) to `<C-u>nil<Esc>` on a garbled `  retrun nul` Lua line.

### 8. `back-to-edit` (`. gi): 33 → ~6 typed

- *Finish the call you left: close it with ");".* ✓ `gi);<Esc>` (2)
  - `init: history('A throw new HttpError(res.status<Esc>gg')`, cursor at the top.
- R4: pre-type through `…on first run` in `init`, so the solution is `gi.<Esc>`.
- R3 (`'.A // ms`): change the comment to a trailing `,` (1). R2 is *keep*.

### 9. `boss-csv-to-object` (q/@a): 150 → 21 typed / 3 rounds

- Put the wrapper lines (`const users = [`, `];`) in the setup. Typing `ggccconst users = [` is not
  macro practice.
- *Turn each row into [id, 'name'],* ✓ `qaI[<Esc>f,a '<Esc>A'],<Esc>jq2@a` (6 typed, 21 keys)
- *Three columns: [id, 'name', 'role'],* ✓
  `qaI[<Esc>f,a '<Esc>f,i'<Esc>la '<Esc>A'],<Esc>jq2@a` (9 typed)
- R3: the same with 6 rows and `5@a` (or `:2,6norm @a`), reusing the 2-column macro.

### 10. `paste-while-typing` (C-r): 47 → ~6 typed, 5 uses of C-r

- Put the scaffold in the buffer, so the only text is what `<C-r>` inserts.
- *Fill both blanks with the word under the cursor.* ✓ `yiwjf'a<C-r>0<Esc>f a<C-r>0<Esc>` (2 typed)
  - Line: `console.log('', );` under `const subtotal = sum(lines);`
- *Put the key name inside get().* ✓ `yiwjf'a<C-r>0<Esc>` (1)
  - Lines: `const key = timeoutMs;` / `const t = settings.get('');`
- R3 (`<C-r>u`) and R4 (`:%s/<C-r>0/…`): *keep*. R4 teaches `<C-r>` on the command line.

### Also consider

- `replace-mode` (63%, 7.6 chars per round) and `insert-line-ends` (66% but 4.8 per round) are
  typing by nature, and short enough. Give them multi-site rounds; don't cut their text further.
- `snippets` (95%) is 3 rounds of placeholder text. Shorten the placeholders to 1–4 chars.
- `insert-mode` (F6): rewrite with `w`/`e`/`l` references, or move `find-char` before it.
