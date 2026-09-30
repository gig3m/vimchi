# vimchi full sweep — shared brief (2026-09-30)

You are one of several independent reviewers auditing vimchi, a browser Vim tutor at
/home/kyle/projects/vimchi (TypeScript/React/Vite front end, custom Vim engine in `src/vim`,
lessons in `src/lessons/sections/*.tsx`, generated challenges in `src/challenges`, the Coach in
`src/coach`, practice UI in `src/components/Practice.tsx` + `EditorView.tsx`, Go server in
`server/`). Docs: `CURRICULUM.md` (generated lesson list), `docs/LESSONS.md` (authoring rules),
`docs/PLUGINS.md`, `docs/superpowers/specs/*.md` (design history), `README.md`.

Rules for every reviewer:
- READ-ONLY: do not commit, push, deploy, edit tracked files, or touch Docker/containers.
  Scratch scripts go in /tmp or in your report directory only.
- Run `npx vitest run <file>` / `npx tsc -b` freely (the full suite is ~1 min, 41k tests).
- `createVim()` from `src/lessons/runtime.ts` and `Session` there let you replay any lesson in
  node via vitest; `scripts/play.mjs` documents the Playwright approach (headless Chromium is
  only available via `docker run … cellgate-bridge-cellgate-bridge:latest python /script.py`,
  see `~/docker/wilco/CLAUDE.md` for the recipe; the app must be served, e.g. `npx vite preview --port 53xx`).
- Ground every claim in a file:line, a replayed key sequence, or a measurement. No vibes.
- Rank findings by the effect on a learner. Be concrete about the fix shape.
- Write your report as Markdown to the path your prompt names. Keep it under ~400 lines;
  put raw data (scripts, tables) in sibling files.

The five audit fronts (each reviewer owns one or two; say which):
1. Curriculum coverage: does the lesson set cover what a new-to-Vim → power user actually needs,
   in a sound order? What is missing, what is redundant, what is mis-sequenced?
2. Practice volume: do the rounds per lesson build the skill to fluency? If not, in what SHAPE
   should more practice be added (more rounds, generated drills, spaced review, mixed sets…)?
3. Exercise fidelity: do exercises exercise the skill being taught, or does the learner spend
   keystrokes typing literal text? Measure: for each rounds lesson, share of solution keys that
   are inserted text vs motions/operators/commands. The owner's own report: "I find myself
   typing long strings more than practicing the motions."
4. Coaching: does the app teach the learner how to improve — live hints and the post-challenge
   "Better ways" report (src/coach)? Where is it silent, wrong, or unhelpful?
5. Bugs: engine correctness vs real Neovim, UI/UX defects, state/progress bugs, server issues.
