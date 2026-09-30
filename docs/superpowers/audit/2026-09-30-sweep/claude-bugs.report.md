# vimchi sweep: bugs from the app angle (front 5)

Reviewer: Claude. Front 5 (bugs), app side: lesson data, UI, progress/state, server, headless playthroughs.
Engine-vs-Neovim semantics belong to the Codex reviewer; the engine bugs below are ones I ran into.
Raw data, scripts and screenshots: `docs/superpowers/audit/2026-09-30-sweep/claude-bugs/`.

## Baseline

- `npm test`: 33 files passed, 3 skipped; 41,532 tests passed (`claude-bugs/vitest.log`). `tsc -b` is clean.
  `go test` was not run because Go is not installed on this box.
- The existing suite already checks, for every rounds lesson: lines up to 60 columns (buffer and goal),
  goal not met at setup, goal not met after the cursor carries over, and the reference solution reaching
  the goal. My sweep added a check of the other files in each project setup: **0 lines over 60 columns**
  (`files-long.tsv`).
- **12 headless playthroughs** (Chromium in the cellgate-bridge image, against a fresh `vite build` in
  scratch, `vite preview :5397`), covering:
  - target `move`, word `words`, replace `r`;
  - rounds `change-words`, `find-char`, `insert-line-ends`;
  - plugin sims `add-surroundings`, `picker-files`, `oil-open-directory`, `diagnostics`;
  - generated `challenge-fix-the-file?seed=7` and `challenge-operators?seed=42`.

  All 12 reached Results. There were no page errors and no stuck states. `find-char` rounds 3, 4 and 6
  needed `:reset`, only because the cursor carried over and my scripted reference solution assumes the
  setup cursor, which is expected. The only console error is the guest `/api/me` 401 (see M9).
  The fix lesson `x` played only partly, because my DOM mark detector failed. The fix/undo logic was
  checked in node instead (I3, M11).
- **No quiz playthrough was possible: no lesson uses `kind: 'quiz'`** (lesson kinds: 174 rounds,
  2 generated, 1 each of target, word, fix and replace). `Quiz`/`quizKey` in `Practice.tsx` and
  `runtime.ts` are dead code.

---

## Critical

### C1. On non-US keyboards, AltGr and Option characters arrive as Alt chords, so `@ { } [ ] ~ | \` cannot be typed
- **Where:** `src/vim/keys.ts:86-98`. `e.ctrlKey && !e.altKey` fails for AltGr (Windows reports it as
  Ctrl+Alt), and then `if (e.altKey && k.length === 1) return '<A-' + k + '>'` catches it.
- **Repro (node, `keyFromEvent`):**

  | Keyboard and keys | Result |
  |---|---|
  | Windows DE, AltGr+Q `{key:'@', ctrlKey, altKey}` | `<A-@>` |
  | Windows DE, AltGr+7 `{key:'{'}` | `<A-{>` |
  | Mac DE, Option+L `{key:'@', altKey}` | `<A-@>` |
  | Mac DE, Option+8 | `<A-{>` |
  | Mac US, Option+w | `<A-∑>` |

- **Effect:** On German, French, Nordic, Polish and other layouts, on both Windows and macOS, the learner
  cannot type `@q` (macros), `{`/`}` (paragraphs), `[`/`]` motions, `~`, `|` or `\`, and cannot insert
  those characters in insert mode. Whole sections cannot be completed. Linux is unaffected because it
  reports AltGr as `AltGraph` without `altKey`.
- **Expected:** a printable `e.key` produced through AltGr or Option is the literal character.
- **Fix shape:**
  - Return the plain character when `e.getModifierState?.('AltGraph')` is true.
  - Emit `<A-x>` only when `e.key` is the unshifted key for `e.code`, i.e. `/^Key[A-Z]$|^Digit\d$/`
    and `e.key.toLowerCase() === code letter`. Otherwise, when Alt is held, pass `e.key` through.
  - Build the stand-ins in `Practice.tsx:35` from `e.code` (`KeyW`→`<C-w>`), which also fixes Mac Option
    stand-ins (M13).
  - Add `KeyEventLike.code` and unit tests for the rows above.

---

## Important

### I1. For a signed-in user, a failed save loses the run permanently; 401 and 429 are not handled
- **Where:** `src/state/store.ts:94-101`, `src/state/api.ts:12-13`.
- **Repro:** sign in, then make `POST /api/runs` fail: network blip, deploy restart, session expired or
  revoked (401), or rate limit (429, see I2). Finish a lesson.
- **Actual:**
  - The run is added to in-memory `serverRuns` and shows "Could not save that run to the server."
  - It is never retried or written to localStorage, and it disappears on reload.
  - After a 401 the UI still shows the user as signed in, so every later run is lost the same way.
- **Expected:** runs are durable until the server acknowledges them, and an expired session drops to
  guest mode or asks the user to sign in again.
- **Fix shape:**
  - Keep an outbox in localStorage: append on finish, POST, remove on 204, flush on load and on `online`.
    Server dedup on `(user, lesson, at)` already makes resends idempotent.
  - On 401, `setAccount(null)` and show "Session expired, sign in again". The outbox then drains through
    the existing guest import.
  - On 429, honour `Retry-After`.

### I2. The production rate limiter puts every client in one bucket, and turning on proxy trust makes it spoofable
- **Where:** `server/internal/httpapi/ratelimit.go:66-80`, `server/cmd/vimchi/main.go:56`,
  `docker/docker-compose.yml:15-21`.
- **Actual:** compose does not set `VIMCHI_TRUST_PROXY`, and the app sits behind NPM, so `clientIP` is
  always the NPM container's address. As a result:
  - All users share one bucket: 20-burst, 10/min for sign-in (`/auth/*`) and 60/min for run writes and
    imports.
  - A few concurrent learners, or one reload-happy one, can 429 everyone else's sign-in and run saves.
    Combined with I1, those runs are lost.
  - If the variable is switched on, `clientIP` takes the **first** `X-Forwarded-For` hop. That hop is
    client-controlled, because NPM appends the real address, so it can be spoofed to bypass the limits.
    Unique fake IPs also grow `buckets` for 10 minutes each. The test at `httpapi_test.go:435-449`
    asserts the first-hop behaviour.
- **Fix shape:** set `VIMCHI_TRUST_PROXY=1` in compose, and use the **last** XFF hop, or the last hop
  not in a trusted-proxy CIDR list. Update the test.

### I3. The replace lesson counts `u` as a second mistake after telling the learner to "Press u"
- **Where:** `src/lessons/runtime.ts:447-458` (`checkEdit`, replace branch).
- **Repro (node, lesson `r`):** move to the first mark (0:17), `rz`, then `u`.
  - After `rz`: msg "Not quite. This spot should be "t"." Edits 1, mistakes 1.
  - After `u`: the same error message again, with **edits 2, mistakes 2**. Undo restores the original
    wrong character, and that still differs from `cor[i]`.
- **Effect:** following the app's own advice halves the Correct ring and shows a false error.
- **Fix shape:** judge only the characters that changed **to** a value other than both `before` and the
  original `c.code[r][i]`. More simply, skip scoring when `vim.lastCommand.kind === 'undo'`. The fix
  branch has the mirror issue (M11).

### I4. Rounds whose goal a shorter route reaches without the taught key
- **Method:** `claude-bugs/sweep.vitest.ts.txt` (rename to `*.test.ts` to run it).
  - For cursor-only rounds, a breadth-first search over hjkl, wbeWBE, 0^$, gg, G, {}, %, HML, counts 2-9
    and f/F/t/T, excluding the lesson's chips.
  - For text rounds, a search over generic edits (x X dd D J p P ~ u, hjkl, w b e 0 $, dw).
  - Every hit was re-verified with `goalMet` on a fresh editor (`alt-verified.tsv`). Rounds with
    `setup.init` were ignored.
- **30 verified cursor rounds have a strictly shorter non-taught route; 10 text rounds** are solvable by
  generic edits. The worst are 1-key alternatives:

  | Round | Reference | Shorter route |
  |---|---|---|
  | `word-ends-backward` r1 | `ge` | `b` (1). Start col 16: the previous word is the one-char `=`, so its start is its end. |
  | `search-backward` r2 | `?try<CR>` (5) | `M` (1). The target is exactly the middle screen row. |
  | `half-pages` r1 / r6 | `<C-d><C-d>` / `<C-u><C-u>` | `L` / `H` (1) |
  | `full-pages` r4 | `<C-b>k` | `H` |
  | `gitsigns-hunks` r4 / r5 | `]h` / `[c[c` | `H` (1) |
  | `change-edges` r1 | `` `] `` | `%` |
  | `change-edges` r5 | `` `] `` | `G` (the function ends the file) |
  | `jump-to-line` r3 | `:$<CR>` | `G` |
  | `line-ends` r4 | `j0` | `w` |
  | `cmdline-word` r4 | `:s/<C-r><C-w>/username/<CR>` (16) | `ll~` (3). `userName`→`username` is one case flip. |
  | `commenting` r6 | `gcc` | `dw` (deletes `-- `) |
  | `flash-motions` r2 | `ds.fa` | `kdd` |
  | `visual-lines` r2 | `VjjjJ` | `JJJ` |
  | `search-as-motion` r1 / r4 | `d/return<CR>` / `d/"version<CR>` | `Jdd` |

  - `delete-words` r1 ("Delete the second await") is met by `dw` on the **first** `await`, because the
    two words are identical.
  - `opening-files` r5 ("Reload the file from disk") is met by `P`: the deleted lines are still in `"`.
- **Effect:** par (solution length) says the taught key is the best route when it is not. Learners who
  find the shortcut get no reinforcement of the lesson's key. The Coach may even recommend the non-taught
  route. Screen-relative cases (H, M, L) depend on `height`.
- **Fix shape:**
  - Move targets or cursors so the taught key is uniquely shortest: e.g. a target not on a screen edge,
    a word longer than one character, a non-case rename.
  - Add a CI guard: this breadth-first search as a test that fails when a non-chip route is strictly
    shorter, with an allowlist.

### I5. Generated challenges clip their code under the checklist at common desktop widths
- **Where:** `.ed-body.with-list` layout in `src/styles.css`, and `EditorView` horizontal scroll.
- **Measured at a 1400×1000 viewport, `challenge-fix-the-file?seed=7`:**
  - `.ev-panes` is 462px wide against 523px of content, with a 52px gutter and 7.5px cells, so **about 54
    columns are visible**.
  - Corpus lines run to about 60 columns. Line 8 (`...length: m + 1 }, () =>`) and line 17 are cut off
    (`shots/20-gen-start.png`), and it gets worse at 1280px.
  - Auto-scroll only follows the cursor, so a fix or ghost-text tag near a line's end is invisible until
    the learner happens to move there.
- **Fix shape:** at desktop widths, let the checklist sit below the editor unless there are 60 columns
  plus the gutter of room, or overlay a collapsed checklist. Alternatively, compute the minimum width
  from `max(line length)` and wrap the list first.

### I6. A seed link is ignored after "New file" (stale seed in App)
- **Where:** `src/components/Practice.tsx:137` (`history.replaceState` does not fire `hashchange`) and
  `src/App.tsx:39`.
- **Repro (Playwright, `play3.py`):**
  1. Open `#challenge-fix-the-file?seed=7` and solve it.
  2. Press `f`. The URL becomes `#challenge-fix-the-file` with a random file of 10 items.
  3. Set `location.hash = '#challenge-fix-the-file?seed=7'`.
- **Actual:** App's `seed` state is still 7, so `setSeed(7)` is a no-op and Practice's `[p.seed]` effect
  never fires. The random file stays, and the log prints `STALE`. A reload loads seed 7 correctly.
- **Fix shape:** have `newFile` tell App (an `onSeed(null)` prop), or key the effect on `location.hash`.
  Simplest: in `onHash`, always pass a fresh object or counter, e.g. `setSeed` plus a nonce.

---

## Minor

### M1. Insert-hint tags cover the line above and can read as typos
- **Where:** `EditorView.tsx:248` and `InsertHint` (`:453-473`).
- The tag floats over the previous row's text. The screenshots show line 1 reading `export as[e]c` in
  `change-words` at 390px (`shots/33-change-words-editor-390.png`), and `ex[e]rt` or `c[i]st` in
  generated files (`shots/34-gen-768.png`, `20-gen-start.png`).
- In a lesson about spotting typos, this manufactures a fake one.
- **Fix:** make the tag semi-transparent over text, put it in the gutter margin, or give the row with a
  hint extra top padding.

### M2. The "Better ways" scroll box sits flush against the action buttons
- **Where:** `styles.css:197`, `:519`.
- In `shots/20-gen-end.png` the last row is cut off and touches the Repeat / Next buttons, with no
  scroll affordance. The box cannot be scrolled from the keyboard, because every key goes to `handle`.
- **Fix:** add `margin-top` to `.res-actions` and a fade or "more" cue.

### M3. Tab handling
- `Practice.tsx:194` swallows Tab on the Results screen (`!s.done`). Measured: focus stays on `.editor`,
  so keyboard users cannot tab to the result buttons (the shortcuts exist, but the a11y is broken).
- In normal mode, Tab leaves the editor. Yet the `C-i` key card in `marks-jumps.tsx:744` says
  "same key as Tab", which invites a key that moves focus away.
- **Fix:** let Tab through on Results. Map normal-mode `<Tab>` to `<C-i>` in the `jumplist` lesson, or
  drop that sub-label.

### M4. A stale round-advance timer can survive a lesson change
- **Where:** `Practice.tsx:183`. The lesson-change block (`:47-52`, `:68-72`) never clears `advanceT`.
- A sidebar click within 450 ms of a round tick runs `s.advance()` on the old session. It then sets
  `segCount.current` to the old log length, after the new lesson reset it to 0. The new lesson's first
  live-coach nudges are suppressed.
- **Fix:** `clearTimeout(advanceT.current)` in the lesson-change block.

### M5. Sign-in returns without the hash
- **Where:** `SignIn.tsx:29` passes `pathname + search`.
- The app routes by `#id?seed=N`, so the user comes back to `/` and lands on `prog.lesson`. That value
  is only updated by `go()`, not by back/forward or typed URLs (`App.tsx:36-46`), so it can be a
  different lesson, and a seed link is lost.
- **Fix:** pass `+ location.hash` (URL-encoded; `SanitizeReturn` accepts it), and call `prog.setLesson`
  in `onHash`.

### M6. Hash routing leftovers
- `#no-such-lesson` shows "Four Keys to Move" but keeps the bogus hash, so a reload still shows the
  fallback.
- The logo (`Sidebar.tsx:71`, `href="#"`) pushes a history entry and does nothing, not even leaving the
  Profile view.
- Profile has no URL, so Back from Profile skips to the previous lesson.
- **Fix:** `replaceState` to the resolved id, make the logo call `go(ORDER[0].id)` or close Profile, and
  give Profile a `#profile` hash.

### M7. Guest import edge cases
- **Where:** `store.ts:69-88`, `runs.go:14,70`.
- More than 5000 guest runs gives a 413 on every page load, forever, with a permanent `syncError`. The
  client should chunk.
- A run finished while the import request is in flight is appended locally, then wiped by
  `updateLocal(v => ({...v, runs: []}))` (`store.ts:79`). Only the snapshot that was read should be
  removed.

### M8. The server rejects runs longer than 24 h
- **Where:** `run.go:31,45`.
- The timer starts at the first key, so a tab left mid-lesson overnight and then finished returns 400,
  and I1 applies.
- **Fix:** clamp `time` on the client, or relax the check.

### M9. Every guest page load logs a console error
- `GET /api/me` returns 401 by design. It is noise in bug reports.
- **Fix:** return `204` or `{account:null}` for "not signed in".

### M10. Tabs render as a fixed `tabstop` width, not to the next tab stop
- **Where:** `EditorView.tsx:253`.
- `substitute.tsx:605` (`'    return 0\t'`) draws 8 cells where Vim draws 4.
- `AnnMarks` indents in `ch` from `/^\s*/` length (`EditorView.tsx:479`), so new-line markers in
  tab-indented Go lessons sit at 1 ch per tab.

### M11. The fix lesson counts `u` as a correct edit
- **Where:** `runtime.ts:439-445`.
- After a wrong `x` followed by `u`, the result is edits 2, mistakes 1, shown as "1 of 2 edits right".
  The undo inflates the denominator (the mirror of I3).

### M12. Mobile
- At 390px there is no horizontal page scroll (checked by measurement), but the sidebar stacks above
  the page.
- The editor is a focusable `<div>`, so touch devices will not raise a virtual keyboard. This was **not
  verified on a device**: headless Chromium has no on-screen keyboard.
- "Click to focus the editor" gives no hint that a hardware keyboard is needed.

### M13. The Mac Alt stand-ins do not work
- Prompts such as `picker-files` say "Alt-n stands in for C-n".
- On a Mac, Option-n is a dead key, so `keyFromEvent` returns `null` and the next letter composes `ñ`.
  Option-w gives `<A-∑>`.
- Ctrl-n/w/t are not browser shortcuts on macOS, so Mac users do not need the stand-in, but the
  instruction misleads them. This is fixed by C1's `e.code` approach.

### M14. Engine divergences found while checking lesson data (for the Codex report)
- `G`, `gg` and `{N}G` jump to the first non-blank, i.e. Vim's `startofline`. Neovim's default
  `nostartofline` keeps the column.
- Checked with `nvim --clean` on the `top-bottom` buffer: `10G` from (27,2) lands on 0-based col **16**
  in Neovim. The engine gives col 0, and round 6's goal is col 0, so the round is unsolvable by the
  taught key in real Neovim.
- `30gg` agrees only by coincidence of indentation.

### M15. Prompt quotes a paraphrase, not buffer text
- `growing-selections` r2 (`visual-mode.tsx:698`) quotes `"(isAdmin || isOwner)"`, but the buffer has
  `(isAdmin(user) || isOwner(user))`.
- The other six quoted-text hits are pattern descriptions ("key = value", "Last, First"); see
  `prompt-quoted.tsv`.

---

## Checked and found sound
- **Practice persistence:** switching lessons resets the session, `finished`, the seed and nudges. `n`
  from Results goes to the next lesson with focus retained, and Back returns to a fresh session of the
  previous lesson.
- **URL input:** a bad seed (`?seed=abc`) falls back to a random file.
- **Server state and auth:** run dedup on `(user, lesson, at)` makes a double import idempotent (it
  happens in dev under StrictMode). The 20k-run cap trims oldest-first. The OAuth state cookie is
  single-use, Lax and Path-scoped. `SanitizeReturn` rejects `//`, `\` and control characters.
  `CrossOriginProtection` guards the POSTs.
- **Server responses:** `index.html` is `no-cache` and assets are `immutable`. `/healthz` returns 503
  when the database fails; it lacks `no-store` on that path only, which is trivial.
