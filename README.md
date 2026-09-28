# vimchi

A browser Vim tutor in vim-hero's shape — small lessons of 1–4 keys, each with one practice
challenge — that goes deeper: registers, macros, ex commands, regex, windows, quickfix, and the
Neovim plugins people actually run. The lesson plan is in `CURRICULUM.md`.

## Frontend

```sh
npm install
npm run dev        # http://localhost:5317
npm test           # engine + every lesson's reference solution
npm run build      # typecheck + production bundle in dist/
```

- `src/vim/` — a Vim engine in TypeScript (modes, operators, text objects, registers, macros,
  dot-repeat, undo, Vim regex, ex commands, splits, quickfix, folds) plus plugin emulations in
  `src/vim/plugins/`.
- `src/lessons/` — lesson content (`sections/*.tsx`), the challenge runtime, and the validator.
  Authoring guide: `docs/LESSONS.md`; plugin API: `docs/PLUGINS.md`.
- `src/components/` — the UI (design: Claude Design project "Vim Tutor v2").

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
