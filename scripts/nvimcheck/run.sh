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
# Exit status: fails on the gate and on any extended or cases mismatch (strict since 2026-09-30, when
# the engine first matched Neovim on all of them). NVIMCHECK_STRICT=0 relaxes it to the gate only.
set -e
cd "$(dirname "$0")/../.."
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
OUT="$tmp/rounds.json" npx vitest run scripts/nvimcheck/export.test.ts >/dev/null
# A hang (a key sequence Neovim waits on) must fail the run, not stall it.
status=0
ROUNDS="$tmp/rounds.json" OUT="$tmp/report.txt" SANDBOX="$tmp/sandbox" \
  timeout 300 nvim --clean --headless -c "luafile scripts/nvimcheck/check.lua" >/dev/null 2>&1 || status=$?
if [ "$status" = 124 ]; then echo "nvimcheck: Neovim did not finish within 300s (hung?)" >&2; exit 1; fi
if [ ! -s "$tmp/report.txt" ]; then echo "nvimcheck: Neovim exited ($status) without writing a report" >&2; exit 1; fi
cat "$tmp/report.txt"
head -1 "$tmp/report.txt" | grep -q ' bad 0$'
if [ "${NVIMCHECK_STRICT:-1}" != 0 ]; then
  if grep -Eq '^(extended|cases) .*: ok [0-9]+ bad [1-9]' "$tmp/report.txt"; then exit 1; fi
fi
