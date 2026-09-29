# Coach — "how would a better Vim user have done that?"

Status: approved design, 2026-09-29. Implementation plan: see `docs/superpowers/plans/`.

## Purpose

The rings say *that* a run was slow or key-heavy. The coach says *what a better Vim user would
have typed instead*, starting from the learner's own keystrokes: "you pressed `hhhhhh`; `6h`
gets there in 2 keys, `Fx` in 2." The skill trained is choosing the right tool; the teaching
moment is the contrast between what you typed and the better sequence.

Success: after a round or a challenge run, one to five concrete "you did X, try Y" lines that
are specific to the keys typed; a learner who already used the better key sees nothing.

## Decisions (owner, 2026-09-29)

- **Where:** both. A "Better ways" panel after the round/run, always. A live one-line nudge
  under the editor as each inefficient segment closes, **behind a setting, default off**.
- **Source of better ways:** segment analysis (motion search + an edit rule library) for
  the specific lines, plus the round's reference solution as a whole-round comparison.
- **Vocabulary gate:** a suggestion may only use keys taught at or before the current
  lesson in curriculum order; challenges use the union of the sections they draw on.
- Scores are unaffected. Nothing new is stored on the server.

## Recording (`src/lessons/runtime.ts`)

`Session` keeps an in-memory log for the run:

```ts
export type LogEntry = {
  key: Key;
  /** Round index (rounds) or checklist item index (generated); -1 when unattributed. */
  unit: number;
  before: { pos: Pos; mode: string; text: string };   // text: buffer as one string, for replay
  after:  { pos: Pos; mode: string; changed: boolean };
};
```

- `text` is captured only when a segment might start (normal mode, no pending keys), so the
  log costs one string per motion run, not per key. Implementation may store a reference to
  the lines array snapshot instead of joining.
- Attribution for generated challenges: the item whose `done` flipped on this key; otherwise
  the item whose display line is nearest the cursor.
- `Session.log(): LogEntry[]`. Cleared on restart. Not part of `Run`.

## Engine (`src/coach/`, pure, no DOM)

### Segmenter (`segment.ts`)

```ts
export type Segment =
  | { kind: 'motion'; unit: number; keys: Key[]; from: Pos; to: Pos; lines: string[] }
  | { kind: 'edit';   unit: number; keys: Key[]; from: Pos; lines: string[]; after: string[] };
export function segment(log: LogEntry[]): Segment[];
```

- A **motion** run is a maximal sequence of normal-mode keys that changed nothing but the
  cursor (`changed === false`, mode stays normal, no pending), ending at the first key that
  changes the buffer or enters another mode. `hhhhhhx` → motion `hhhhhh` (from A to B on
  `lines`), then edit `x`.
- An **edit** runs from the first key that changes the buffer or leaves normal mode to the
  key that returns to normal mode with an empty pending buffer. Undo (`u`, `C-r`) closes and
  discards the segment it lands in (undoing is not critiqued).
- Keys that neither move nor change (a pending operator waiting, `<Esc>` in normal mode) are
  absorbed into the following segment. Command-line and quiz keys are ignored.

### Motion critic (`motion.ts`)

For a motion segment from A to B on `lines`, find shorter sequences with a breadth-first
search over a wider vocabulary than `shortestPath`'s:

- single keys: `h j k l w b e W B E 0 ^ $ ge gE G gg { }`
- with argument: `f t F T` + a character on the line, then `;` / `,`
- counts 2–9 before any of the above
- `/word<CR>` where `word` is the identifier at B (cost = 2 + word length, capped at 8)

The search is a BFS over `(pos)` states with per-step cost = number of keys; depth-limited so
it never exceeds the length of what the learner typed. Any sequence strictly shorter than the
learner's is a candidate; return up to two, ranked by keys saved then by simplicity (fewer
distinct keys). `step()` in `runtime.ts` is extended to the new keys, or the search drives the
real engine on a scratch `Vim` (preferred: correctness over speed; a motion run is short).

### Edit critic (`rules.ts`)

A rule is `{ id, keys: string[] (vocabulary it uses), apply(seg: Segment & {kind:'edit'}, ctx) => Suggestion | null }`.
First library, each with the shorter keys it proposes:

| id | learner did | suggest |
|----|-------------|---------|
| `count-x` | `x` × N (N ≥ 3) on one line | `Nx`; `dw`/`de` when the span is exactly a word |
| `x-i-to-r` | `x` then `i<c><Esc>` (or `a`) at the same spot | `r<c>` |
| `i-at-eol` | `$` (or motion to last char) then `a` | `A` |
| `i-at-bol` | `0`/`^` then `i` | `I` |
| `ddp` | `dd`, `j`, `p` on adjacent lines | `ddp` |
| `dot-repeat` | the same edit segment keys typed twice in a row at different spots | `.` for the second |
| `cw` | `dw` (or `x`×N over a word) then `i<text><Esc>` | `cw<text><Esc>` |
| `o-not-A-CR` | `A<CR>` | `o` |
| `count-dd` | `dd` × N (N ≥ 2) consecutive | `Ndd` |

Each rule's suggestion must reproduce the segment's `after` text when replayed from `from`
on `lines` (verified in tests, and re-verified at runtime before showing: a suggestion that
fails replay is dropped silently).

### Vocabulary gate (`vocab.ts`)

`taughtBy(lessonId): Set<string>` = the union of `chips` and `keyCards[].key` of every lesson
at or before `lessonId` in `ORDER`, normalised (`C-d` style, counts stripped, `f{char}` → `f`).
For a challenge lesson, the union of the sections named in its `challenge.skills` mapping
(a static table in `vocab.ts`: skill tag → section ids). A suggestion is kept only if every
key it uses is in the set. Counts (`6h`) are allowed once the count lesson is taught; until
then `6h` is not suggested but `Fx` may be.

### Reference comparison

Per round (rounds lessons): `{ you: keys typed, ref: solutionKeys(round.solution) }`, shown
only when `you.length > ref.length`. Challenges: per item, `you` vs motion-par + `fixKeys`.

### Output (`index.ts`)

```ts
export type Suggestion = { keys: string; saves: number; why: string; rule: string };
export type Critique = {
  segment: Segment;
  you: string;               // keys typed, Vim notation
  better: Suggestion[];      // ≤ 2, best first
};
export type Report = { critiques: Critique[]; reference: { unit: number; you: string; ref: string }[] };
export function coach(log: LogEntry[], lessonId: string, refs: { unit: number; ref: string }[]): Report;
```

`critiques` sorted by `saves` desc, then by unit.

## UI

### After the round/run (`Results.tsx`)

A "Better ways" block under the rings when `report.critiques.length > 0` or any reference
line exists. Up to **five** critiques: `Round 3 · you: ⟨h⟩⟨h⟩⟨h⟩⟨h⟩⟨h⟩⟨h⟩⟨x⟩ → ⟨F⟩⟨x⟩⟨x⟩ saves 4`
with key chips (`Kbd`), the `why` in muted text ("`f` jumps to a character on the line").
Then the reference lines: "Round 3 reference: ⟨F⟩⟨x⟩⟨x⟩ (3 keys, you used 7)". Nothing is
rendered when there is nothing to say.

### Live nudge (`Practice.tsx`)

Setting `coachLive` (boolean, default false), stored in `localStorage` (`vimchi.coach.v1`)
via a small `useSettings()` hook in `src/state/settings.ts`. Toggle in the sidebar footer:
"Live hints" switch next to the profile button. When on: as each segment closes, run the
critics on that segment alone; if a suggestion survives, show one line under the editor —
"`6h` does that in 2" — that fades after 4 s or on the next key. Never more than one at a
time; a new one replaces the old. Off: nothing live; the after-run panel is unchanged.

### Sidebar / stats

Out of scope for v1: no history of suggestions, no "most common inefficiency" stat.

## Testing

- `segment.test.ts`: hand-built logs → expected segments (motion then edit; insert spanning
  keys; undo discarding; pending operator absorbed).
- `motion.test.ts`: property over corpus files and random (A, B): every suggestion replays
  from A to B on the real engine and is shorter than the input; the search never suggests
  when the input is already optimal (e.g. `w`, `fx`).
- `rules.test.ts`: per rule, a positive case (fires, replay matches `after`), a negative case
  (does not fire), and the vocabulary keys listed match what the suggestion uses.
- `vocab.test.ts`: `taughtBy` grows monotonically along `ORDER`; a `cgn` suggestion is dropped
  on an early lesson and kept after the section that teaches it.
- `coach.test.ts`: every existing lesson's reference-solution playthrough yields **zero**
  critiques (references are already efficient; this also audits the references). A generated
  challenge run replayed with its fix keys and par motions yields zero.
- Live nudge and panel: Playwright shot with a deliberately wasteful round.

## Files

- new: `src/coach/{segment,motion,rules,vocab,index}.ts` + `__tests__/`, `src/state/settings.ts`,
  `src/components/BetterWays.tsx`.
- edit: `src/lessons/runtime.ts` (log), `src/components/{Results,Practice,Sidebar}.tsx`,
  `src/styles.css`, `CURRICULUM.md` (a Coach section), `docs/LESSONS.md` (adding a rule).

## Out of scope

Server storage of logs or reports; stats over time; suggestions that use keys not yet taught;
critiquing command-line or quiz answers; AI-generated explanations.
