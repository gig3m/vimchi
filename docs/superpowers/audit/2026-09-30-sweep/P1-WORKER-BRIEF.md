# P1 worker brief (2026-09-30)

You are one of several parallel workers rewriting vimchi lessons on branch `p1` in
/home/kyle/projects/vimchi. Other workers edit OTHER files at the same time.

Hard rules:
- Edit ONLY the files your prompt assigns. Never touch other section files, `src/lessons/index.ts`,
  `CURRICULUM.md`, or run `npm run curriculum`. Do not commit; the coordinator commits.
- Do not run the full suite. Run your lessons filtered:
  `npx vitest run src/lessons/__tests__/lessons.test.ts src/lessons/__tests__/registry.test.ts src/lessons/__tests__/typing.test.ts -t "<lesson id>"`
  and at the end `npx vitest run src/lessons/__tests__/typing.test.ts src/lessons/__tests__/registry.test.ts` (whole files) plus
  `npx vitest run src/coach/__tests__/coach.test.ts` (the reference audit). If a failure names a file you do
  not own, ignore it and say so in your report.
- Every round: buffer and goal lines ≤ 60 columns, ≥ 3 lines, goal not met at setup, the `solution` replays
  to the goal (`lessons.test.ts` checks all of this). Prompts describe the goal in one sentence.
- Keep lesson ids. Keep chips unless the prompt says otherwise. Copy (intro/aside) may change where the
  rounds' shape changes; keep it two short paragraphs.

The budgets (`src/lessons/__tests__/typing.test.ts`):
- Core and Code bands: a reference solution types at most 6 literal characters in insert/replace mode
  per round; 8 if the lesson sets `typing: true` (only for lessons whose skill IS insert-mode editing:
  insert-line-ends, replace-mode, insert-delete-word, snippets, back-to-edit, paste-while-typing).
- Project and Patterns bands: at most 24 characters typed on the command line per round.

Design levers (from the fidelity reports, which contain engine-replayed redesigns for the worst lessons —
`claude-fidelity.report.md` §"Redesigns" and `codex-fidelity.report.md` §2; use them):
1. deletion goals; 2. short replacements (a digit, `}`, `end`, `no`, `x`); 3. buffer-sourced text
(yank/put, `<C-r>`); 4. **multi-site rounds**: 2–3 instances of the edit in one round so the key runs
2–3 times with navigation between, and once `.` has been taught (lesson `repeat-last-change`, curriculum
#35, i.e. from `basic-operators`' second half onward) the reference IS the `.` solution, e.g.
`fyCno<Esc>j0fy.j0fy.`. Aim for at least two multi-site rounds per lesson in sections after `.`.
5. For Ex lessons: preload the pattern with `setup.search: 'word'` and use `:%s//new/g`, 3–6 character
identifiers, short paths; keep the real syntax (ranges, flags, `\v`, `\zs`, `\=`), since that is the skill.

Report back (≤ 25 lines): files changed, per lesson the old→new typed chars, anything you could not fit
in the budget and why, and the test commands you ran with their results.
