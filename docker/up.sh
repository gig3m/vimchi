#!/usr/bin/env bash
# Build and start (or recreate) vimchi. Containers cannot reach keys, so the
# GitHub OAuth app credentials are injected here at start when they exist in
# keys (VIMCHI_GITHUB_CLIENT_ID / VIMCHI_GITHUB_CLIENT_SECRET); without them
# the tutor still works, only sign-in is off.
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p ../var
if keys list | grep -qx VIMCHI_GITHUB_CLIENT_ID && keys list | grep -qx VIMCHI_GITHUB_CLIENT_SECRET; then
  exec keys exec VIMCHI_GITHUB_CLIENT_ID VIMCHI_GITHUB_CLIENT_SECRET -- docker compose up -d --build "$@"
fi
echo "up.sh: VIMCHI_GITHUB_CLIENT_ID/SECRET not in keys; starting with sign-in disabled" >&2
exec docker compose up -d --build "$@"
