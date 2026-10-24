#!/usr/bin/env bash
# Deploy vimchi to the droplet: build the image locally, ship it over SSH,
# sync compose + Caddyfile, restart, smoke-test.
# Usage: deploy/do/deploy.sh [user@host]
# The host defaults to VIMCHI_SSH_HOST from the environment or local.env.
set -euo pipefail
cd "$(dirname "$0")"

if [[ -f local.env ]]; then
  set -a
  # shellcheck disable=SC1091
  . ./local.env
  set +a
fi

host=${1:-${VIMCHI_SSH_HOST:?set VIMCHI_SSH_HOST or pass user@host}}
public_url=${VIMCHI_PUBLIC_URL:-https://vimchi.dev}

docker build -q -t vimchi:latest ../.. > /dev/null
echo "built; shipping image to $host"
docker save vimchi:latest | gzip | ssh "$host" 'gunzip | docker load' > /dev/null
rsync -a compose.yml Caddyfile "$host":/opt/vimchi/
ssh "$host" 'cd /opt/vimchi && set -a && . ./.env && set +a && docker compose up -d --remove-orphans && docker image prune -f > /dev/null'
sleep 3
ssh "$host" 'curl -fsS http://127.0.0.1:8080/healthz 2>/dev/null || docker exec vimchi wget -qO- http://127.0.0.1:8080/healthz'
echo
curl -fsS -o /dev/null -w "${public_url} -> %{http_code}\n" "${public_url}/" || echo "public check failed (DNS/TLS may still be settling)"
