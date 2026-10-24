<p><img src="public/logo/vimchi-lockup.svg" alt="vimchi" width="224" height="64"></p>

# vimchi

A browser Vim tutor: 193 short lessons, each one a real edit, from `hjkl` to macros, quickfix, and the Neovim plugins people actually run.

**Play it at [vimchi.dev](https://vimchi.dev).**

![The Quotes lesson: the sidebar lists the Text Objects section, and the practice editor is mid-`ci"`, in Insert mode renaming a package.json string to "vimchi" with the remaining text hinted above the cursor](docs/screenshot.png)

No install. Progress stays in the browser. Sign in with GitHub when you want runs to follow you to another machine.

## Features

- **Short lessons, one challenge each.** Every lesson teaches 1–4 keys, then asks you to use them. Results show time, a personal best, and speed / accuracy / correct.
- **A Vim engine written in TypeScript.** Modes, operators, text objects, registers, macros, dot-repeat, undo, Vim regex, ex commands, splits, quickfix, and folds. Lessons run on that engine, so what you practice is what the page grades.
- **The path from first motions to a starter config.** Core motions and operators, then registers and macros, then buffers, windows, jumps, and quickfix, then `:s` and `:g`, then Neovim built-ins and the plugins LazyVim and kickstart share (surround, flash, telescope, an explorer, gitsigns, lazygit, LSP edits, snippets).
- **A coach.** After a lesson, "Better ways" points at shorter sequences that still reach the goal, using only keys you have already been taught. Live hints can show one of those while you type.
- **Generated challenges.** Seeded files with a pile of small mistakes, and a checklist of what's left.
- **An account is optional.** The built SPA is the whole tutor. The Go server adds GitHub sign-in and syncs lesson runs to SQLite.

The full ordered list is [`CURRICULUM.md`](CURRICULUM.md): 30 sections, 193 lessons, 184 of them counted toward completion. Boss levels and the Challenges band are optional.

## Quick start

```sh
npm install
npm run dev        # http://localhost:5317
npm test           # engine + every lesson's reference solution
npm run build      # typecheck + production bundle in dist/
```

The dev server is the whole tutor. Lesson runs are stored in `localStorage`. Sign-in needs the server below.

### Server (optional)

GitHub sign-in and synced runs live in `server/`. It needs Go 1.26+ and no cgo.

```sh
cd server
cp .env.example .env   # GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET
set -a; . ./.env; set +a
go run ./cmd/vimchi    # :8080
```

Run `npm run dev` beside it. Vite proxies `/api` and `/auth` to port 8080. The GitHub OAuth callback is `$VIMCHI_BASE_URL/auth/github/callback`.

For a production binary, `npm run build`, then start the server with `VIMCHI_STATIC` pointed at `dist/`, `VIMCHI_BASE_URL` set to the public origin, and `VIMCHI_SECURE_COOKIES=1` when TLS ends at a proxy.

```sh
cd server && go test ./...
```

Docker, locally:

```sh
cp docker/.env.example docker/.env   # optional OAuth keys
./docker/up.sh                        # http://localhost:8080
```

The public site's deploy notes are in [`deploy/do/README.md`](deploy/do/README.md). Copy `deploy/do/local.env.example` to `local.env` (gitignored) before creating or updating a host.

## How lessons work

Each lesson is the same shape:

1. **Intro.** Two short paragraphs on what the keys do and when they earn their keep.
2. **Key cards.** One card per key: the cap, a glyph, a label.
3. **Practice.** Exactly one challenge: reach targets, fix a marked file, or edit until the buffer matches the goal.
4. **Results.** Time, personal best, score.
5. **Aside.** One `#` note: a tip, a gotcha, or a Vim-versus-Neovim difference.

Any sequence that reaches the goal passes. The reference solution is the idiomatic route using that lesson's keys, and it is what `npm test` replays. The coach only suggests keys taught at or before the current lesson.

Sections sit in six bands: **Core**, **Repeat**, **Project**, **Patterns**, **Code**, and **Challenges**. A section can end with an optional ★ boss that does not count toward completion.

Authoring rules: [`docs/LESSONS.md`](docs/LESSONS.md). Plugin lessons: [`docs/PLUGINS.md`](docs/PLUGINS.md).

## Tech stack

| Piece | Where |
|---|---|
| React 19, TypeScript, Vite | `src/` — UI, lessons, the Vim engine |
| Vim engine | `src/vim/` |
| Lessons | `src/lessons/sections/` |
| Coach | `src/coach/` |
| Go 1.26 server, SQLite (`modernc.org/sqlite`, no cgo), GitHub OAuth | `server/` |
| Docker image (Node build + static Go binary) and Caddy | `Dockerfile`, `deploy/do/` |

Fonts (IBM Plex Sans, JetBrains Mono, Space Grotesk) load from Google Fonts under the SIL Open Font License.

## Contributing

Issues and pull requests are welcome, including new lessons and engine fixes.

- `npm test` and `npm run typecheck` should pass.
- New or edited lessons follow [`docs/LESSONS.md`](docs/LESSONS.md). Keep lesson ids stable: runs are stored against them. Copy the shape of `src/lessons/sections/next-steps.tsx`.
- `npm run curriculum` regenerates `CURRICULUM.md` when the lesson list changes.
- `npm run check:nvim` (needs `nvim` on `PATH`) replays reference solutions and `scripts/nvimcheck/cases.json` in `nvim --clean --headless` and compares text, cursor, and registers. `NVIMCHECK_STRICT=0` keeps only the text gate.
- `node scripts/look.mjs <lesson-id>` plays a lesson in headless Chromium and writes screenshots under `look/` (gitignored), so you can see the screen the learner sees. `scripts/play.mjs` is the same idea for a one-off script.

Browsers reserve Ctrl-W/N/T/Q. The practice editor maps Alt-W/N/T/Q to them, and its full-screen button uses the Keyboard Lock API to capture the real keys in Chromium.

## Credits

Plugin lessons emulate default keymaps (LazyVim's where the starters differ, such as mini.surround on `gsa` / `gsd` / `gsr`; flash.nvim is on in every lesson) of mini.surround, mini.ai, nvim-treesitter-textobjects, flash.nvim, telescope.nvim, snacks.explorer, neo-tree, gitsigns.nvim, lazygit, grug-far.nvim, and a LuaSnip/blink.cmp-style completion flow. Their code is not included.

Challenge files in `src/challenges/corpus/` are short excerpts, attributed per file, with license texts at [`public/THIRD-PARTY-NOTICES.txt`](public/THIRD-PARTY-NOTICES.txt): TheAlgorithms/Go (MIT), TheAlgorithms/TypeScript (MIT), charmbracelet/lipgloss (MIT), echasnovski/mini.nvim (MIT), google/uuid (BSD-3-Clause), lewis6991/gitsigns.nvim (MIT), stevearc/oil.nvim (MIT), unjs/ufo (MIT).

## License

[MIT](LICENSE).
