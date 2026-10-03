#!/usr/bin/env bash
# Build and start (or recreate) vimchi. Containers cannot reach keys, so the
# GitHub OAuth app credentials are injected here at start when they exist in
# keys (GITHUB_VIMCHI_CLIENT_ID / GITHUB_VIMCHI_CLIENT_SECRET, mapped onto the compose
# variables); without them the tutor still works, only sign-in is off.
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p ../var
if keys list | grep -qx GITHUB_VIMCHI_CLIENT_ID && keys list | grep -qx GITHUB_VIMCHI_CLIENT_SECRET; then
  exec keys exec GITHUB_VIMCHI_CLIENT_ID GITHUB_VIMCHI_CLIENT_SECRET -- sh -c \
    'VIMCHI_GITHUB_CLIENT_ID=$GITHUB_VIMCHI_CLIENT_ID VIMCHI_GITHUB_CLIENT_SECRET=$GITHUB_VIMCHI_CLIENT_SECRET docker compose up -d --build "$@"' sh "$@"
fi
echo "up.sh: GITHUB_VIMCHI_CLIENT_ID/SECRET not in keys; starting with sign-in disabled" >&2
exec docker compose up -d --build "$@"
