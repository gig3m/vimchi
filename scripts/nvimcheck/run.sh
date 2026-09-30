#!/bin/sh
# Replays every plain-text lesson round in headless Neovim (nvim --clean) and reports mismatches.
#
# Output, three sections:
#   ok N bad M            the gate: each round's reference solution leaves the goal text in Neovim.
#   extended: ok N bad M  engine vs Neovim on the same rounds: cursor (Neovim defaults, nostartofline),
#                         unnamed register text + type, registers the goal names, and follow-up probes
#                         (x always, p when the register is non-empty) fed after the solution.
#   cases: ok N bad M     engine vs Neovim on scripts/nvimcheck/cases.json, ad-hoc {id, text, cursor?,
#                         keys, name?, options?} entries that are not lesson rounds. Append freely.
#
# Exit status: fails only on the gate by default. NVIMCHECK_STRICT=1 also fails on any extended or
# cases mismatch (flip it once the engine matches Neovim there).
set -e
cd "$(dirname "$0")/../.."
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
OUT="$tmp/rounds.json" npx vitest run scripts/nvimcheck/export.test.ts >/dev/null
ROUNDS="$tmp/rounds.json" OUT="$tmp/report.txt" SANDBOX="$tmp/sandbox" \
  nvim --clean --headless -c "luafile scripts/nvimcheck/check.lua" >/dev/null 2>&1
cat "$tmp/report.txt"
head -1 "$tmp/report.txt" | grep -q ' bad 0$'
if [ -n "$NVIMCHECK_STRICT" ] && [ "$NVIMCHECK_STRICT" != 0 ]; then
  if grep -Eq '^(extended|cases) .*: ok [0-9]+ bad [1-9]' "$tmp/report.txt"; then exit 1; fi
fi
