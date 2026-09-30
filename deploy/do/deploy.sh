#!/usr/bin/env bash
# Deploy vimchi to the public droplet: build the image here, ship it over SSH,
# sync compose + Caddyfile, restart, smoke-test. Usage: deploy/do/deploy.sh [host]
set -euo pipefail
cd "$(dirname "$0")"
host=${1:-kyle@vimchi.dev}
docker build -q -t vimchi:latest ../.. > /dev/null
echo "built; shipping image to $host"
docker save vimchi:latest | gzip | ssh "$host" 'gunzip | docker load' > /dev/null
rsync -a compose.yml Caddyfile "$host":/opt/vimchi/
ssh "$host" 'cd /opt/vimchi && set -a && . ./.env && set +a && docker compose up -d --remove-orphans && docker image prune -f > /dev/null'
sleep 3
ssh "$host" 'curl -fsS http://127.0.0.1:8080/healthz 2>/dev/null || docker exec vimchi wget -qO- http://127.0.0.1:8080/healthz'
echo
curl -fsS -o /dev/null -w 'https://vimchi.dev -> %{http_code}\n' https://vimchi.dev/ || echo "public check failed (DNS/TLS may still be settling)"
