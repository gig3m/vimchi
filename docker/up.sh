#!/usr/bin/env bash
# Build and start (or recreate) vimchi. Containers cannot reach keys, so the
# GitHub OAuth app credentials are injected here at start when they exist in
# keys (VIMCHI_GHAUTH_CLIENTID / VIMCHI_GHAUTH_SECRET, mapped onto the compose
# variables); without them the tutor still works, only sign-in is off.
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p ../var
if keys list | grep -qx VIMCHI_GHAUTH_CLIENTID && keys list | grep -qx VIMCHI_GHAUTH_SECRET; then
  exec keys exec VIMCHI_GHAUTH_CLIENTID VIMCHI_GHAUTH_SECRET -- sh -c \
    'VIMCHI_GITHUB_CLIENT_ID=$VIMCHI_GHAUTH_CLIENTID VIMCHI_GITHUB_CLIENT_SECRET=$VIMCHI_GHAUTH_SECRET docker compose up -d --build "$@"' sh "$@"
fi
echo "up.sh: VIMCHI_GHAUTH_CLIENTID/SECRET not in keys; starting with sign-in disabled" >&2
exec docker compose up -d --build "$@"
