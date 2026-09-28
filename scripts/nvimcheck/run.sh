#!/bin/sh
# Replays every plain-text lesson round in headless Neovim and reports mismatches.
set -e
cd "$(dirname "$0")/../.."
tmp=$(mktemp -d)
OUT="$tmp/rounds.json" npx vitest run scripts/nvimcheck/export.test.ts >/dev/null
ROUNDS="$tmp/rounds.json" OUT="$tmp/report.txt" nvim --clean --headless -c "luafile scripts/nvimcheck/check.lua" >/dev/null 2>&1
cat "$tmp/report.txt"
head -1 "$tmp/report.txt" | grep -q ' bad 0$'
