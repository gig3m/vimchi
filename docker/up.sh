#!/usr/bin/env bash
# Build and start vimchi. GitHub OAuth credentials are read from docker/.env
# when that file exists (see .env.example). Without them the tutor still
# runs and sign-in stays off.
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p ../var
if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env
  set +a
fi
exec docker compose up -d --build "$@"
