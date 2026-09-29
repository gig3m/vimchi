# vimchi

A browser Vim tutor, inspired by vim-hero's short-lesson format — small lessons of 1–4 keys, each with one practice
challenge — that goes deeper: registers, macros, ex commands, regex, windows, quickfix, and the
Neovim plugins people actually run. The lesson plan is in `CURRICULUM.md`.

## Frontend

```sh
npm install
npm run dev        # http://localhost:5317
npm test           # engine + every lesson's reference solution
npm run build      # typecheck + production bundle in dist/
```

- `src/vim/` — a Vim engine written from scratch in TypeScript (modes, operators, text objects, registers, macros,
  dot-repeat, undo, Vim regex, ex commands, splits, quickfix, folds) plus plugin emulations in
  `src/vim/plugins/`.
- `src/lessons/` — lesson content (`sections/*.tsx`), the challenge runtime, and the validator.
  Authoring guide: `docs/LESSONS.md`; plugin API: `docs/PLUGINS.md`.
- `src/components/` — the UI.

Browsers reserve Ctrl-W/N/T/Q. The practice editor maps Alt-W/N/T/Q to them, and its
"full screen" button uses the Keyboard Lock API to capture the real keys (Chromium).

## Running the server

The Go backend in `server/` handles GitHub sign-in, syncs lesson runs to SQLite,
and serves the built SPA. It needs Go 1.26+ and no cgo.

```sh
cd server
cp .env.example .env   # fill in GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET
set -a; . ./.env; set +a
go run ./cmd/vimchi
```

- **Dev:** run `npm run dev` alongside it; Vite proxies `/api` and `/auth` to
  `:8080`. Set the GitHub OAuth app's callback to
  `$VIMCHI_BASE_URL/auth/github/callback` (the Vite origin).
- **Prod:** `npm run build`, then run the server with `VIMCHI_STATIC` pointing at
  `dist/`, `VIMCHI_BASE_URL` set to the public origin and `VIMCHI_SECURE_COOKIES=1`
  if TLS terminates at a proxy.

Tests: `cd server && go test ./...`

The frontend also works on its own as a static site (`dist/`): without the server, progress
stays in the browser's localStorage and sign-in is unavailable.

## Deploying on sleepwalker

`Dockerfile` builds the SPA (node) and the server (Go, static binary) into one image;
`docker/docker-compose.yml` runs it as container `vimchi` on the `nginx-proxy-manager_default`
network (no host port) with SQLite bind-mounted at `var/`. NPM proxies `https://vimchi.nrsil.io`
to `vimchi:8080`; `GET /healthz` is the uptime probe (200 `{"ok":true}` when SQLite answers).

```sh
docker/up.sh          # build + (re)start; also the redeploy command after a code change
```

`up.sh` injects `VIMCHI_GITHUB_CLIENT_ID` / `VIMCHI_GITHUB_CLIENT_SECRET` from `keys` when they
exist; until a GitHub OAuth app is registered (callback
`https://vimchi.nrsil.io/auth/github/callback`) the tutor runs with sign-in disabled.

## Credits

The plugin lessons emulate the default keymaps of vim-surround/nvim-surround, vim-exchange,
ReplaceWithRegister, vim-abolish, mini.ai, flash.nvim, harpoon, telescope.nvim, oil.nvim,
vim-fugitive and gitsigns.nvim; their code is not included, except that the case-coercion rules
in `src/vim/plugins/abolish.ts` are translated from Tim Pope's abolish.vim (Vim license). Fonts (IBM Plex Sans,
JetBrains Mono, Space Grotesk) load from Google Fonts under the SIL Open Font License.

Challenge files (`src/challenges/corpus/`) are short excerpts from these repos, used under their
licenses and attributed per file: `TheAlgorithms/Go` (MIT), `TheAlgorithms/TypeScript` (MIT), `charmbracelet/lipgloss` (MIT), `echasnovski/mini.nvim` (MIT), `google/uuid` (BSD-3-Clause), `lewis6991/gitsigns.nvim` (MIT), `stevearc/oil.nvim` (MIT), `unjs/ufo` (MIT).

## License

MIT — see `LICENSE`.
