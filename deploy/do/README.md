# vimchi.dev — the public droplet

DigitalOcean `vimchi` (nyc3, s-1vcpu-1gb, Ubuntu 24.04), public IP in `.droplet-ip`,
tailnet `vimchi` / `100.95.113.100`. Created by `create-droplet.sh` (cloud-init in
`cloud-init.yaml`): user `kyle` with the hub key, fleet SSH CA trust + a fleet **host**
cert (serial 24) but **no fleet user cert**, so the box can never read keys; Docker;
Tailscale; ufw 22/80/443; unattended-upgrades with a 09:00 reboot window.

- **Deploy:** `deploy/do/deploy.sh` from sleepwalker — builds the image here, ships it with
  `docker save | ssh docker load`, syncs `compose.yml` + `Caddyfile` to `/opt/vimchi`,
  `docker compose up -d`, smoke-tests `/healthz`. Nothing builds on the 1 GB box.
- **Secrets:** `/opt/vimchi/.env` (kyle, 0600) holds the GitHub OAuth app for
  `https://vimchi.dev/auth/github/callback`. Written by hand once; empty = sign-in off.
- **TLS:** Caddy, automatic Let's Encrypt for `vimchi.dev`; `www` redirects to the apex.
- **Backups:** `pull-backup.sh` runs from sleepwalker's crontab at 02:45, takes an
  `sqlite3 .backup` on the droplet and pulls it to `~/projects/vimchi/db-snapshot/vimchi-dev.db`,
  which the `vimchi` local-tier target archives at 03:00.
- **Server hardening for the public:** per-IP rate limits on `/auth/*` and run writes,
  `VIMCHI_TRUST_PROXY=1` so the client IP comes from Caddy's `X-Forwarded-For`, and a
  20,000-run cap per user (oldest dropped).
- The tailnet instance on sleepwalker (`vimchi.nrsil.io`) stays as staging.
