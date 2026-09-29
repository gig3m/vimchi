# Writing lessons

Lessons live in `src/lessons/sections/<section>.tsx`, one file per sidebar section, listed in
`src/lessons/index.ts`. `CURRICULUM.md` says which lessons each section holds, in order.
`src/lessons/sections/next-steps.tsx` is the reference example: copy its shape and voice.

## Shape

Each lesson teaches 1–4 keys and has exactly these parts (`src/lessons/types.ts`):

| Field | What |
|---|---|
| `id` | kebab-case, unique app-wide. Never reuse or rename a shipped id (runs are stored against it). |
| `title` | ≤ 28 chars, from CURRICULUM.md. |
| `chips` | 1–4 keys shown in the sidebar, Vim notation without brackets: `C-v`, `esc`, `dd`. |
| `keyCards` | One card per key: `key`, short `glyph` (arrow, `del`, `e→a`), `label` (≤ 3 words), optional `sub`. |
| `intro` | Two short `<p>` paragraphs: what the keys do, then why or when. |
| `practice(total)` | One `<p>` telling the learner what the challenge wants. |
| `aside` | One `#` note: a tip, gotcha, count trick, or Vim-vs-Neovim difference. 1–3 sentences. |
| `challenge` | See below. |
| `boss?` | Optional section-end boss (★ in the sidebar, not counted). |

Use `<Code>` for keys and code, `<Mono>` for monospace without a chip, and `hl-green` / `hl-red` /
`hl-orange` spans to name colours on screen.

### Voice

Match the live lessons. Plain, short, second person. No exclamation marks, no "simply", no "powerful",
no "let's". Say what a key does before why it matters. Prefer concrete code over abstract description.
Neovim is the default: `Y` is `y$`, `gc` comments, `hlsearch` is on, 0.11 maps (`[b`, `grn`, `[d`) exist.
Put classic-Vim differences in the aside.

## Rules from review

These are enforced by the validator where possible.

1. **Lines ≤ 60 columns** in every practice buffer, goal and fix/replace code. Longer lines get
   clipped at some screen widths and hide targets. Wrap code the way a formatter would.
2. **Always give context: ≥ 3 lines per round**, even when the task is on one line. Surrounding real
   code lets learners use what they learned earlier (`j`, `f`, `w`, search…) and makes rounds feel
   like editing, not drills. Put the task line somewhere in the middle and vary where the cursor starts.
3. **Never block keys or punish skill.** Goals describe the *result* (text, cursor, buffer), never the
   route; any correct way passes. Scoring already caps accuracy at 100% when someone beats par. The
   reference `solution` is the idiomatic route using this lesson's keys; don't write prose that says
   other keys "won't work".
4. **Show, don't just tell.** Use the diagram components in `src/components/diagrams.tsx` where a
   picture explains faster than a sentence — word boundaries, where motions land, what a text object
   selects, what an edit does. They run the real engine, so they're always accurate:
   - `<Words text="res.json(); a-->b" big? />` — numbered boxes under each word/WORD.
   - `<Motions text="…" cursor={6} keys={['w', 'e', 'b']} chain? />` — where each motion lands.
   - `<Objects text="f(a, (b, c))" cursor={9} objects={['i(', 'a(', '2i(']} />` — what each object selects.
   - `<BeforeAfter lines={['…']} cursor={[0, 4]} keys="dw" name="app.ts"? />` — buffer, keys, result (`name` sets the filetype, e.g. for gc).
   All take an optional `caption`. Keep diagram text ≤ 60 columns. One or two per lesson at most;
   put them in the intro or aside where they explain the idea. Most lessons in the Core band and many
   in Deep Water benefit from one; concept lessons (Intro to Operators/Text Objects) should have them.

## Challenges

Prefer **`rounds`**. Each round is a small task with a reference solution.

```ts
challenge: {
  kind: 'rounds',
  base: { name: 'user.ts' },            // shared setup
  rounds: [
    {
      prompt: 'Rename "usr" to "user".', // one short line; omit for plain "reach the box" rounds
      setup: { text: 'const usr = 1;', cursor: { line: 0, col: 6 } },
      goal: { text: 'const user = 1;' },
      solution: 'cwuser<Esc>',          // idiomatic, minimal; its key count is the par
    },
  ],
}
```

- 4–8 rounds (validator allows 3–10). Vary the code and the position; don't repeat one edit six times.
- **Goals**: `text` (buffer must equal; small differences are drawn inline — a dotted marker with the text to add in a floating tag (never drawn as if it were in the buffer), red strike-through to remove, a dashed marker for new lines — and bigger ones in a goal pane under the editor; `showGoal: 'pane'` forces the pane), `cursor` (green box), `buffer`
  (current buffer name), `files` (disk contents after `:w`), `registers`, or `check(vim)` for anything
  else. Goals are checked in normal mode unless `mode: 'any'`.
- Target-style lessons (motions) use rounds with `goal: { cursor }` and `showGoal: false`.
- `solution` uses Vim key notation: `<Esc>`, `<CR>`, `<C-v>`, `<C-r>`, `<lt>` for a literal `<`,
  `<Space>` or a literal space. It must be what a fluent user would type, and the shortest reasonable
  way *using this lesson's keys*.
- **Setup**: `text` + `name` (the name picks syntax colours: `.ts .js .lua .md .json .py .go .csv`),
  or `files` + `open` for multi-file lessons. Also `cursor`, `options`, `registers`, `marks`, `folds`,
  `search`, `height` (editor rows; use a long file + `height: 12` for scrolling lessons), `plugins`,
  and `init(vim)` for anything else (splits, quickfix lists, jumplists).
- Positions are 0-based `{ line, col }`.
- Use realistic code: TypeScript, Lua (Neovim config), Markdown, JSON, CSV, shell. Vary domains.

Other kinds:

- `target` / `word` / `fix` / `replace`: random-target and typo lessons (see getting-around.tsx,
  small-edits.tsx). Only use when the lesson is purely about moving or single-char fixes.
- `quiz`: multiple choice (≤ 4 options, 3–8 questions, `explain` on each). Use only for things the
  browser can't do (see below) or concepts without a buffer (config literacy, `:w`/`:q`).

### Browser limits

A normal tab can't capture `C-w`, `C-n`, `C-t`, `C-q`. The tutor maps **Alt-w/n/t/q** to them and
the "full screen" button captures the real keys. Lessons using these keys may still be rounds; mention
the Alt stand-in once in the practice line, e.g. "(In the browser, `Alt-w` stands in for `C-w`.)".
Solutions still use the real notation (`<C-w>l`).

## The engine

`src/vim` is a from-scratch Vim in TypeScript (normal/insert/visual/replace/cmdline modes, operators,
text objects, registers, marks, jumplist, changelist, macros, dot-repeat, undo, search with Vim regex,
`:s :g :v :normal :m :t :d :y :j :sort :!`, buffers, splits, tabs, quickfix, folds, completion).
Plugins live in `src/vim/plugins` (see `docs/PLUGINS.md`).

If the engine gets something wrong, **fix it** — but surgically:

- Edit only the lines involved. Never reformat or restructure engine files; other people are editing
  them at the same time. Re-read a file right before editing it.
- Add a regression case to `src/vim/__tests__/editor.test.ts` (append to the relevant `it.each`
  table or add a new `it`) using real Neovim behaviour as the expected value.
- Run `npx vitest run src/vim` afterwards; all engine tests must pass.

## Checking your work

```sh
LESSON_SECTION=<section-id> npx vitest run src/lessons   # your section only
npx vitest run src/vim                                   # engine
npx tsc --noEmit -p . 2>&1 | grep <your-file>            # types for your files
```

The validator runs every round's solution through the engine, checks the goal is reached (and not
already met at the start), plays the whole lesson through a `Session`, and checks shape rules.

## Challenges

Generated challenges live in `src/challenges/`. Two things to extend:

- **Corpus** (`corpus/index.ts`): 25–40 lines, ≤ 60 columns, no tabs, ≥ 6 short identifiers used
  twice, ≥ 3 numbers; at least four files corpus-wide carry an adjacent near-duplicate line pair.
  Every entry is an attributed excerpt (`source`: repo, path, commit, MIT/BSD/Apache/ISC license)
  and its repo is listed in README Credits. `corpus.test.ts` enforces all of it.
- **Mutation kinds** (`mutations/*.ts`): `sites()` lists candidates in the original; `apply()` returns
  the changed line(s), a checklist line, `fixAt` and motion-free `fixKeys`. `mutations.test.ts`
  replays `fixKeys` through the engine from `fixAt` and requires the original back, for every site of
  every corpus file. Register the kind in `mutations/index.ts` and list it in a challenge's
  `mutations` in `challenges/index.ts`. `generate.test.ts` then checks every corpus file still
  supports the challenge's edit range with the one-line-gap rule.

## Coach rules

`src/coach/rules.ts` holds the edit rules. A rule sees the segment list and an index, returns
how many segments it consumed and its suggestions in preference order (later ones are
fallbacks when an earlier one fails the state check), and lists the keys it `uses` (for the
vocabulary gate). Add a positive and a negative case to `rules.test.ts`; the test replays both
the learner's keys and the suggestion on the engine and requires the same text and cursor.
Motion heuristics live in `motion.ts`; a coincidence that slips through gets a heuristic and a
test there, not a rewritten reference. `coach.test.ts` requires every reference solution to
yield zero critiques: a new lesson whose reference is wasteful fails that test, and a chip
missing from a lesson (the coach never undercuts a section's chips) shows up the same way.
