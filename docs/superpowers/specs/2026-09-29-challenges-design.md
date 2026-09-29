# Challenges — combined-skill trainer

Status: approved design, 2026-09-29. Implementation plan: see `docs/superpowers/plans/`.

## Purpose

Lessons teach one to four keys each. Challenges are where a learner puts the keys of
several sections together on one realistic file: many edits at once, one clock, choose
your own tools. They are the "boss of bosses": not part of the curriculum count, but the
thing the curriculum builds toward.

Success: a learner who has finished the matching sections can open Challenge 1, get a
fresh 25–40 line file with 8–12 needed edits, fix it end-to-end without being told which
key to press, and get the same Speed / Accuracy / Correct score lessons give. Replaying
gives a different file or different edits; a seed replays an exact one.

## Decisions (owner, 2026-09-29)

- **Play style: hybrid.** All edits are present from the start, the inline goal diff stays
  on, and a checklist tells the learner *what* each edit is so the test is choosing the
  tool, not spotting the diff.
- **Content: procedural.** A hand-written corpus of clean base files plus mutation
  generators keyed to skills, seeded so a run is reproducible. No model in the loop at
  play time. A hand-authored challenge is the degenerate case of a fixed mutation list.
- **Scope of the first pass: Challenges 1 and 2.** The ladder is designed for five; 3–5
  mostly add mutation kinds.

## The ladder

| # | id | Skills (sections) | Mutation kinds |
|---|----|-------------------|----------------|
| 1 | `challenge-fix-the-file` | Getting Around, Small Edits, Next Steps, Motions, Search: hjkl, w/b/e, f/t, 0/$, `x`, `r`, `i`/`a`, `/` | dropped-char, extra-char, wrong-char, wrong-literal, wrong-short-ident |
| 2 | `challenge-operators` | + First Operators: `d`/`c`/`y` + motion, `dd`/`cc`, `.`, `u` | all of 1 + stray-line, stray-word, wrong-word, missing-duplicate-line, line-to-remove |
| 3 | (later) text objects & visual | `iw`/`i(`/`i"`, visual | change string contents, reorder args, reindent block |
| 4 | (later) rename & replace | `*`, `n`, `cgn`, `:s` | rename identifier in N places, pattern replace |
| 5 | (later) registers & macros | yank/put, `q` | move code between spots, structured repeat |

Each challenge's edit count: 1 → 8–12, 2 → 10–14. A challenge draws only mutations its
skill set fixes efficiently; a bigger hammer (`:%s` in Challenge 1) still passes but does
not beat par on keys.

## Content model

### Types (`src/lessons/types.ts`)

```ts
export type GeneratedChallenge = {
  kind: 'generated';
  /** Skill tags shown as chips and used to pick mutation kinds. */
  skills: string[];
  /** Mutation kind ids this challenge may draw from. */
  mutations: string[];
  /** Base files; one is chosen per run. */
  corpus: CorpusFile[];
  /** Inclusive range of mutations per run. */
  edits: [number, number];
};

export type CorpusFile = { name: string; lines: string[] };

export type Lesson = { /* existing */ challenge: Challenge; /* Challenge gains GeneratedChallenge */ };
export type Section = { /* existing */ band: 'core' | 'deep' | 'plugins' | 'challenges' };
```

### Corpus (`src/challenges/corpus/`)

~10 clean files per challenge, 25–40 lines, TypeScript, Go and Lua, hand-written in the
repo, each with a `name` for syntax colouring. They must be "mutation-rich": identifiers
used more than once, string and number literals, short lines and long lines. Files are
shared between challenges where they fit; Challenge 2 needs files with removable lines.

### Mutations (`src/challenges/mutations/*.ts`)

A mutation kind is a pure module:

```ts
export type Site = { line: number; col: number; len: number };  // region in the ORIGINAL text
export type Mutation = {
  kind: string;
  site: Site;                 // region in the original
  after: string[];            // the whole mutated file (only lines near site differ)
  region: { line: number; start: number; end: number }[]; // region(s) in the MUTATED text a fix must touch
  checklist: string;          // e.g. `"usre" → "user"` or `remove the stray "debug" line`
  /** Ideal fix from `from` (cursor after the previous fix), Vim keys. Motion part is computed. */
  solution: (from: Pos) => string;
  parMs: number;              // time allowance for the edit itself (motion time added by generator)
};
export type MutationKind = {
  id: string;
  sites: (lines: string[]) => Site[];       // candidates in the original
  apply: (lines: string[], site: Site, rng: Rng) => Mutation;
};
```

Challenge 1 kinds and their intended fix (par):

- `dropped-char`: remove one char inside a word → `i<c><Esc>` or `a<c><Esc>` (motion + 3).
- `extra-char`: insert one wrong char inside a word → `x` (motion + 1).
- `wrong-char`: replace one char → `r<c>` (motion + 2).
- `wrong-literal`: change a numeric literal's digit or a short string literal's char →
  `r`/`x`/`i` as above; checklist quotes old → new.
- `wrong-short-ident`: change one char of a 3–6 char identifier at one use →
  `r<c>`, or `x`/`i` when a char was dropped/added. Only one site per identifier in
  Challenge 1 (multi-site rename is Challenge 4).

Challenge 2 adds:

- `stray-line`: insert a plausible junk line (`console.log(...)`, `// TODO`, a duplicated
  line) → `dd`.
- `stray-word`: insert an extra word → `dw`/`daw` (par `dw`).
- `wrong-word`: replace a word with a different word → `cw<word><Esc>`.
- `missing-duplicate-line`: delete one line that is a near-copy of its neighbour (e.g.
  the second of two similar assignments) → `yyp` + `r`/`cw` fix-up; par is `yyp`
  plus the diff of the two lines.
- `line-to-remove`: mark an original line as one to delete (the goal omits it) → `dd`.

Rules every kind obeys, enforced by tests:

1. `after` differs from the original only within `site` (or the inserted/removed line).
2. Replaying `solution(from)` through the Vim engine from `after` with the cursor at
   `from` reproduces the original exactly.
3. Mutations chosen for one run have non-overlapping regions, and never share a line with
   another mutation's region (keeps the checklist tick unambiguous).
4. No mutation may produce text identical to the original (the rng retries, then the site
   is dropped).

### Generator (`src/challenges/generate.ts`)

```ts
export type Generated = {
  seed: number;
  file: string;
  start: string[];   // mutated
  goal: string[];    // original
  items: ChecklistItem[];   // one per mutation, in document order
  parKeys: number;
  parMs: number;
};
export function generate(c: GeneratedChallenge, seed: number): Generated;
```

- PRNG: mulberry32 over the 32-bit seed. Same challenge + seed → identical `Generated`.
- Pick a file, then N (uniform in `edits`) mutations: shuffle candidate (kind, site)
  pairs across all allowed kinds with kind-balanced weighting (no more than ceil(N/2) of
  one kind), take the first N that do not conflict, apply them from the bottom of the file
  up so line numbers stay valid.
- Par: walk items in document order from the setup cursor (line 0, col 0); for each,
  motion keys = `shortestPath(start, prevPos, regionStart, 'hjklwbeWBE0$', 80)` (capped
  and with `/`-search counted as 3 keys when the path exceeds 8), plus the kind's edit
  keys. parMs = Σ (motion keys × 250 ms + kind.parMs).
- Checklist item: `{ text, region, kind }`. `text` is the human line; `region` is the
  line-span in the *start* text that must match the goal for the tick. For a removed
  line (`stray-line`, `line-to-remove`) the tick means the line is gone: the aligned
  goal has no counterpart for it. For a missing line the tick means the aligned goal
  line now exists and matches.

## Play

### Runtime (`src/lessons/runtime.ts`)

A `generated` challenge is run as a single-round text-goal session: `createVim({ text:
g.start, name: g.file })`, goal `{ text: g.goal }`, keys unrestricted, done when the buffer
equals the goal. The runtime holds `Generated` for the view, exposes `items` with a live
`done: boolean` per item (region in the current buffer equals the goal's corresponding
lines, aligned via the existing `align()` LCS so line insert/delete doesn't shift ticks),
and finalizes with `finalize(elapsed, g.parMs, g.parKeys, keys, correct, …)`.

`correct` = 1 − (collateral hunks / items), where a collateral hunk is a diff hunk at
completion-time-max that was outside every item's region (tracked as the max over the
run of hunks outside regions, so damage that was later undone still costs). Clamped to
[0, 1].

The seed is chosen at session start (`Math.random`-derived) unless the URL hash carries
`?seed=N`; the Results screen shows "seed N · replay this one" (link `#<id>?seed=N`) and
"new file" (restart with a fresh seed). The stored `Run` is unchanged; seed is not stored.

### UI

- `Sidebar.tsx`: fourth band `Challenges` after Plugins; entries show the skill chips and
  best score; styled like bosses (★, not counted). `COUNTED` already excludes bosses;
  challenge lessons set `boss: true` so no completion math changes.
- Lesson page: intro (two paragraphs: what skills this combines, how to think about
  ordering the work), no key cards, practice text "Fix every item on the list. Any keys
  you like.", the editor, results, one aside tip. `keyCards: []` renders nothing.
- `Checklist.tsx`: a panel to the right of the editor on wide screens, under it on
  narrow, one row per item: a tick box, the text, and a muted line number that updates
  as lines move. Done rows get the green tick and dim. Rows are not clickable (no
  cursor teleport).
- The inline goal overlay stays on (hybrid). Pane fallback rules unchanged.

## Scoring and storage

Same rings and `score` formula. Runs save under the challenge lesson id (`[a-z0-9-]`, fits
the server regex). Personal best per challenge, not per seed. Nothing changes on the Go
side.

## Testing

- `src/challenges/__tests__/mutations.test.ts`: for every kind × every corpus file ×
  every site × 5 seeds — rules 1, 2 and 4 above; solution replay uses the real engine.
- `generate.test.ts`: determinism (same seed → deep-equal), N within range, no overlapping
  regions, kind balance, par finite and > 0, both challenges over 200 seeds each.
- `runtime` test: a generated session completed by replaying every item's solution in
  document order ends `done`, all items ticked, `correct == 1`, keys == parKeys.
- Existing `every lesson's reference solution` test keeps passing (generated lessons are
  skipped there and covered by the above).
- Playwright shot of Challenge 1 mid-run with two items ticked, checked by eye.

## Files

- new: `src/challenges/{corpus/*.ts,mutations/*.ts,generate.ts,rng.ts,index.ts}`,
  `src/lessons/sections/challenges.tsx`, `src/components/Checklist.tsx`, tests.
- edit: `src/lessons/types.ts`, `src/lessons/runtime.ts`, `src/lessons/index.ts`,
  `src/components/{Sidebar,Practice,Results,LessonPage}.tsx`, `src/styles.css`,
  `CURRICULUM.md`, `docs/LESSONS.md` (a "Challenges" section on adding a mutation kind).

## Out of scope

Challenges 3–5, model-generated content, storing seeds with runs, per-seed leaderboards,
clickable checklist teleport.
