# Coach — "how would a better Vim user have done that?"

Status: approved design, 2026-09-29, revised the same day after review (a prototype motion
critic run over every reference solution). Implementation plan: see `docs/superpowers/plans/`.

## Purpose

The rings say *that* a run was slow or key-heavy. The coach says *what a better Vim user would
have typed instead*, starting from the learner's own keystrokes: "you pressed `hhhhhh`; `6h`
gets there in 2 keys, `Fx` in 2." The skill trained is choosing the right tool; the teaching
moment is the contrast between what you typed and the better sequence.

Success: after a round or a challenge run, one to five concrete "you did X, try Y" lines that
are specific to the keys typed and that a Vim teacher would actually give; a learner who
already used the better key sees nothing.

## Decisions (owner, 2026-09-29)

- **Where:** both. A "Better ways" panel after the round/run, always. A live one-line nudge
  under the editor as each inefficient segment closes, **behind a setting, default off**.
- **Source of better ways:** segment analysis (motion search + an edit rule library) for
  the specific lines, plus the round's reference as a whole-round comparison.
- **Vocabulary gate by curriculum position:** a suggestion may only use keys taught at or
  before the current lesson in `ORDER`; challenges use the union of the sections they name.
- **Counts on motions count as taught from the `words` lesson** (lesson 2 explains `3w` in
  prose), named by an explicit constant `COUNTS_TAUGHT_FROM = 'words'`, not derived from chips.
- **Minimum saving:** a suggestion is shown only when it saves ≥ 2 keys, or the learner used
  ≥ 1.5× the suggested keys.
- **References:** the critic's heuristics define "good"; a plan task audits every reference
  the critic still beats and rewrites only the genuinely wasteful ones.
- **Kinds:** the coach runs on `rounds` and `generated` challenges only. It is off for
  `target`/`word` (movement-only, hjkl drills), `fix`/`replace` (no reference, marks-driven),
  `quiz`, every lesson in the Macros section (`vim.recording` teaches deliberately safe
  motions) and every lesson in the Plugins band (picker/modal driven).
- **Never undercut the lesson:** if the learner used a key the current lesson drills (its
  chips), no suggestion replaces that key in that segment.
- Scores are unaffected. Nothing new is stored on the server.

## Engine hook (`src/vim/editor.ts`)

`Vim` reports what each completed command was, so the segmenter classifies positively:

```ts
export type CommandKind = 'motion' | 'operator' | 'action' | 'insert' | 'visual' | 'cmdline' | 'modal' | 'undo' | 'other';
/** Set by execute() (and the / ? cmdline completion path) for the last completed command. */
lastCommand: { keys: Key[]; kind: CommandKind; error: boolean } | null;
```

- `motion`: a cursor motion in normal mode with no operator (`h w fx 3j /foo<CR> G` …).
- `operator`: an operator + motion/text object (`dw ciw yy >>`), completed.
- `action`: a normal-mode command that changes text or state without an operator (`x r p J
  ~ . u` is `undo`); `insert`: entering insert/replace mode through leaving it (`i…<Esc>`,
  `cw…<Esc>` is `operator` whose keys include the typed text); `visual`: from `v/V/C-v` to
  the command that leaves visual mode; `cmdline`: an ex command; `modal`: keys consumed by a
  plugin modal/picker; `other`: marks, registers prefixes, `q` recording toggles, `z*`,
  window commands, `<Esc>` in normal mode.
- `error`: the command raised a Vim error (`vim.events` contains `'error'`).

## Recording (`src/lessons/runtime.ts`)

`Session` keeps an in-memory log for the run; nothing is stored in `Run`.

```ts
export type LogEntry = {
  key: Key;
  /** rounds: round index; generated: checklist item index; -1 when unattributed. */
  unit: number;
  /** Position/mode before the key, captured AFTER any advance() the key triggered. */
  before: { pos: Pos; mode: string; want: number };
  after:  { pos: Pos; mode: string; changed: boolean };
  /** Filled when this key completed a command. */
  command: Vim['lastCommand'] | null;
  /** True on the first key after a hard boundary (round load, :reset, restart). */
  boundary: boolean;
};
```

- Only keys that reached `vim.feed` are logged (arrow keys rejected by the Session, and quiz
  keys, are not).
- Attribution for generated challenges: the item whose `done` flipped on this key; otherwise
  the item whose display line is nearest the cursor.
- Hard boundaries (no segment may cross them): round load/advance, `:reset` (the microtask
  is flushed by treating the `:reset<CR>` key itself as the boundary), restart, new file.
- `Session.log(): LogEntry[]`; `Session.setupFor(unit)` returns the `Setup` (rounds) or
  `{ text: g.start, name: g.file }` (generated) so a scratch Vim can be rebuilt.

## Engine (`src/coach/`, pure, no DOM)

### Segmenter (`segment.ts`)

```ts
export type Segment =
  | { kind: 'motion'; unit: number; keys: Key[]; from: Pos; to: Pos; logStart: number; logEnd: number }
  | { kind: 'edit';   unit: number; keys: Key[]; from: Pos; logStart: number; logEnd: number; command: CommandKind }
  | { kind: 'break';  unit: number; keys: Key[]; logStart: number; logEnd: number; reason: 'undo' | 'error' | 'other' | 'modal' | 'cmdline' | 'boundary' };
export function segment(log: LogEntry[]): Segment[];
```

- A **motion** run is a maximal sequence of consecutive commands with `kind === 'motion'`
  and `error === false`, in the same unit, not crossing a boundary, while `vim.recording` is
  false. It ends at the first command of any other kind. Its keys are the concatenation of
  those commands' keys (`hhhhhh`, `jfHfl`, `/foo<CR>`).
- An **edit** is one completed command of kind `operator`, `action`, `insert` or `visual`.
- Everything else is a **break**: `undo` (which also discards the edit segment it undoes,
  see below), `error` (a typo; its keys are removed from any motion run), `modal`, `cmdline`
  (kept so replay is exact, never critiqued; `:s` changes text but is not an edit segment),
  `other`, and boundaries. Rule windows never span a break.
- **Undo:** an `undo` command discards the most recent edit segment (turned into a break) and
  itself. Overshoot-and-correct in a motion run (`fxfx`) stays critiqued: that is technique.
- Visual-mode motions are not critiqued in v1 (the whole `visual` command is one edit).

### Replay (`replay.ts`)

Suggestions are verified against real state, not text:

```ts
/** A scratch Vim in the state just before log index i: setup rebuilt, keys 0..i-1 fed. */
export function stateBefore(session: SessionLike, i: number): Vim;
```

`createVim(session.setupFor(unit))` then `feedKeys` of every logged key from the unit's
boundary to `i - 1`. Cost is trivial (a round is tens of keys). A suggestion for a segment is
accepted only if, fed into `stateBefore(logStart)`, it yields the same text, cursor and mode
as the learner's keys did at `logEnd`, **and** the same values of every piece of state that a
later logged command in the same unit reads before overwriting it: the unnamed and last-used
registers (read by `p P`), `lastFind` (`;` `,`), the search pattern (`n N cgn :s//`), and
`lastChange` (`.`). If nothing later reads a piece of state, it may differ.

### Motion critic (`motion.ts`)

For a motion segment from A to B, a uniform-cost search (Dijkstra, cost = keys) over states
`(pos, want, lastFind)` on the buffer at `stateBefore(logStart)`, driving the real engine on
that scratch Vim (correctness over speed; runs are short). Vocabulary:

- singles: `h j k l w b e W B E 0 ^ $ ge gE`
- `G` / `gg` only when B is the last / first line; `{` / `}` only when B is a blank line;
- `f t F T` + a character on the current line, then `;` / `,` only after an `f/t` inside the
  same suggestion (never leaning on `lastFind` from before the segment);
- counts 2–9 on `h j k l` only; counts on `w b e W B E` capped at 3; no counts on `f/t`;
- `/word<CR>` where `word` is the shortest unique identifier prefix at B, real cost
  (2 + prefix length); `?` likewise backward.

Search cost must be `< learner keys`. Candidates surviving the vocabulary gate, the
never-undercut rule, the state check and the minimum-saving rule are ranked by keys saved,
then by fewer distinct keys, then preferring `f/t` targets that occur once on the line. Up
to two are shown.

### Edit critic (`rules.ts`)

A rule sees a window of segments and consumes what it matches:

```ts
export type Rule = {
  id: string;
  /** Keys the suggestion uses, for the vocabulary gate (inserted text and arguments exempt). */
  uses: string[];
  apply(segs: Segment[], i: number, ctx: RuleCtx): { consumed: number; suggestion: Suggestion } | null;
};
```

First library, stated correctly against this engine (`cw` behaves like `ce`; `dw` eats the
trailing space; `I` is `^i`):

| id | learner did (segments) | suggest | notes |
|----|------------------------|---------|-------|
| `count-x` | `x` × N (N ≥ 3), consecutive, cursor never clamped at end of line | `Nx`; `de`/`diw` when the span is exactly a word | at end of line `x` walks backwards: no suggestion |
| `x-i-to-r` | `x` then `i<c><Esc>` or `a<c><Esc>` at the same spot | `r<c>` | |
| `A-at-eol` | motion ending on the last char (`$`, `fx`…) then `a…<Esc>` | `A…<Esc>` | |
| `I-at-bol` | `^` then `i…<Esc>` | `I…<Esc>` | `0i` is not `I` on indented lines |
| `ddp` | `dd`, `j`, `P` on adjacent lines; or `dd`, `k`, `P` | `ddp` / `ddkP` | `ddjp` is a different edit |
| `count-dd` | `dd` × N (N ≥ 2) consecutive | `Ndd` | |
| `dot-repeat` | identical edit keys twice with only motions between | `.` for the second | only when saves ≥ 2; `count-x` wins on overlap |
| `cw` | `de` then `i<text><Esc>`; or `dw` then `i<text> <Esc>` | `cw<text><Esc>` | |
| `o-not-A-CR` | `A<CR>…<Esc>` | `o…<Esc>` | |

Overlap: rules are tried in table order at each index; the first match consumes its segments.
A motion critique and a rule that cover the same segments are merged into one critique
(`jj$a` → `2j` + `A`, shown once with combined saves), never double-counted.

### Vocabulary gate (`vocab.ts`)

- `taughtBy(lessonId): Set<string>` = tokens of `chips` and `keyCards[].key` of every lesson at
  or before `lessonId` in `ORDER`, plus counts once `COUNTS_TAUGHT_FROM` is passed.
- **Tokenizer** (`tokenize(chip): string[]`): splits a chip into engine commands: `dt` →
  `d`,`t`; `ci"` → `c`,`i"`; `$A` → `$`,`A`; `"ap` → `"`,`p`; `C-w h` → `<C-w>`,`h`; `␣ff` →
  `<Space>`,`f`,`f`; `:noh` → `:`; `/e` → `/`; `3dw` → `d`,`w`; `esc`/`CR`/`enter` → `<Esc>`,
  `<CR>`. Output uses `keys.ts` notation. Words that are not keys (`macros`) produce nothing.
- A suggestion lists its `uses`; inserted text, `r`'s character, `f`'s character and search
  words are exempt. `<CR>` after `/` is part of the `/` token.
- Same letter, different meanings (`s`, `o`, `gu`, `u`, `i`/`a`) are treated as one token:
  harmless for motions and edits in v1, noted.
- Challenges: `GeneratedChallenge` gains `sections: string[]` (section ids from the ladder in
  the challenges spec); `taughtBy` for a challenge is the union of those sections' lessons.

### Reference comparison

Rounds: compare the learner's keys for the round against `par` (reference length +
`carryExtra`, what the score already uses), and show the reference keys only when (a) the
learner used ≥ 2 keys more than par, (b) every key the reference uses passes the gate, and
(c) the cursor did not carry over, or the line says "from the round's start". At most three
reference lines per run, worst first. Generated challenges: per item, "par N keys, you used
M" as counts only (motion par is a number, not a key string).

### Output (`index.ts`)

```ts
export type Suggestion = { keys: string; saves: number; why: string; rule: string };
export type Critique = { unit: number; you: string; better: Suggestion[]; logStart: number; logEnd: number };
export type Report = { critiques: Critique[]; reference: { unit: number; you: number; par: number; ref?: string }[] };
export function coach(session: SessionLike, lessonId: string): Report;
export function coachSegment(session: SessionLike, lessonId: string, seg: Segment): Critique | null; // live nudge
```

`critiques` sorted by best `saves` desc, then unit asc, then `logStart` asc; capped at five in
the UI. `why` is one short sentence from a fixed table keyed by rule/motion family ("`f`
jumps to a character on the line").

## UI

### After the round/run (`BetterWays.tsx`, rendered by `Results.tsx`)

A "Better ways" block under the rings when there is anything to say. Up to five critiques:
`Round 3 · you ⟨h⟩⟨h⟩⟨h⟩⟨h⟩⟨h⟩⟨h⟩⟨x⟩ → ⟨F⟩⟨x⟩⟨x⟩ · saves 4` with key chips; inserted text is
one literal chip (`⟨loadOrders⟩`), not one chip per character. Then up to three reference
lines. Nothing renders when there is nothing to say. The block scrolls inside the results
panel rather than growing it.

### Live nudge (`Practice.tsx`)

Setting `coachLive` (boolean, default false) in `localStorage` (`vimchi.coach.v1`) via
`useSettings()` in `src/state/settings.ts`. Toggle: a "Live hints" switch in the sidebar
footer next to the profile button. When on:

- A segment closes when its command completes, **and also** on goal met, target hit, item
  done and round advance, so the last motion run of a round is critiqued too.
- On close, `coachSegment` runs; a surviving critique shows one line under the editor, in
  the same slot as the tutor `msg` row (it yields to a Vim error or a tutor warning), for
  4 s or until the next critique replaces it. It is cleared on advance, restart and new
  file, never merely by the next key.
- Never more than one at a time. Off: nothing live; the after-run panel is unchanged.

## Testing

- `segment.test.ts`: hand-built logs → expected segments: motion then edit; insert spanning
  keys; undo discarding the undone edit and itself; a typo key removed from a run; a yank as a
  break not a motion; a picker as a break; boundaries splitting runs.
- `motion.test.ts`: property over corpus files and random (A, B): every suggestion replays
  from A to B on the real engine, is strictly shorter, respects the count limits, never uses
  `G`/`{` off their targets; already-optimal inputs (`w`, `fx`, `6h`) get nothing.
- `rules.test.ts`: per rule, a positive case (fires, replay matches text and cursor), a
  negative case (does not fire; includes `ddjp`, `0i` on an indented line, `x`×N at end of
  line), and `uses` matches the keys in the suggestion.
- `vocab.test.ts`: the tokenizer over every chip and key card in the curriculum produces
  only `keys.ts` tokens; `taughtBy` is monotonic along `ORDER`; counts appear from `words`;
  a `cgn` suggestion is dropped early and kept after its section.
- `coach.test.ts`: every `rounds` reference playthrough yields zero critiques **after the
  audit task**; until then the test lists the offenders and the audit task drives it to
  zero. Generated challenges: replaying each item's fix keys with the true shortest motion
  (reconstructed by the same search) yields zero critiques over 50 seeds.
- Live nudge and panel: Playwright shot with a deliberately wasteful round, with the toggle
  on and off.

## Files

- new: `src/coach/{segment,replay,motion,rules,vocab,index}.ts` + `__tests__/`,
  `src/state/settings.ts`, `src/components/BetterWays.tsx`.
- edit: `src/vim/editor.ts` (`lastCommand`), `src/lessons/runtime.ts` (log, `setupFor`),
  `src/lessons/types.ts` (`GeneratedChallenge.sections`), `src/challenges/index.ts`,
  `src/components/{Results,Practice,Sidebar}.tsx`, `src/styles.css`, `CURRICULUM.md` (Coach
  section), `docs/LESSONS.md` (adding a rule; the reference audit).
- audit: `src/lessons/sections/*.tsx` reference solutions the critic beats (a plan task with
  its own review list).

## Out of scope

Server storage of logs or reports; stats over time; suggestions using keys not yet taught;
critiquing visual-mode motions, command-line or quiz answers; movement-only, fix/replace,
macro and plugin lessons; AI-generated explanations.
