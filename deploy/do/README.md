# Deploying vimchi.dev

Production is a single Docker host (the live site is a DigitalOcean droplet:
Ubuntu 24.04, created by `create-droplet.sh`). Caddy terminates TLS for
`vimchi.dev` and proxies to the app. Nothing in this folder should contain
real hostnames, addresses, SSH keys, or backup paths. Those live in
`local.env`, which is gitignored.

```sh
cp deploy/do/local.env.example deploy/do/local.env
# fill in tokens, the SSH user, and the SSH destination
```

`cloud-init.yaml` is a template. `create-droplet.sh` renders it with
`render-cloud-init.py` and sends the result as user-data. Check the rendered
file before you create anything:

```sh
deploy/do/create-droplet.sh --render
```

## What the droplet gets

- A sudo user named by `VIMCHI_SSH_USER`, with the public key at `VIMCHI_SSH_PUBKEY`.
- Password login and root SSH disabled.
- Docker, plus `ufw` allowing 80/tcp and 443/tcp.
- Optional SSH user CA, revoked key, and host CA, one line each
  (`VIMCHI_SSH_USER_CA`, `VIMCHI_SSH_REVOKED_KEYS`, `VIMCHI_SSH_HOST_CA`).
  Leave them empty to skip. Do not commit the key material.
- Optional Tailscale. Set `TAILSCALE_API_KEY` and the first boot joins the
  tailnet and does not open public SSH. Leave it unset and port 22 is opened
  instead.
- Unattended upgrades with a 09:00 reboot window.
- `/opt/vimchi/.env` (mode 0600) for the GitHub OAuth app
  (`VIMCHI_GITHUB_CLIENT_ID`, `VIMCHI_GITHUB_CLIENT_SECRET`) and `TZ`.
  Empty OAuth values leave sign-in off. Set `TZ` there if logs should use a
  local zone; the compose file defaults to UTC. Also set `VIMCHI_BASE_URL`
  if the public origin is not `https://vimchi.dev`.

`create-droplet.sh` needs `DIGITALOCEAN_TOKEN`. It looks up
`VIMCHI_DO_SSH_KEY_NAME` on the DigitalOcean account, waits for a public IP,
and writes that IP to `.droplet-ip` (gitignored). Region, size, and droplet
name default to `nyc3`, `s-1vcpu-1gb`, and `vimchi`. When both Porkbun keys
are set it updates the apex and `www` A records for `VIMCHI_DOMAIN`; otherwise
it prints the IP and leaves DNS to you. Edit `Caddyfile` if you serve a
different domain.

## Deploy

`deploy/do/deploy.sh` builds the image on the machine you run it from
(`Dockerfile`: Node builds the SPA, Go builds a static server binary), ships
it with `docker save | ssh docker load`, syncs `compose.yml` and `Caddyfile`
to `/opt/vimchi`, runs `docker compose up -d`, and curls `/healthz`. Pass
`user@host`, or set `VIMCHI_SSH_HOST`. The public smoke test uses
`VIMCHI_PUBLIC_URL` (default `https://vimchi.dev`).

`GET /healthz` returns 200 `{"ok":true}` when SQLite answers.

The server rate-limits `/auth/*` and run writes, trusts `X-Forwarded-For`
from Caddy (`VIMCHI_TRUST_PROXY=1`), and caps stored runs per user.

## Backups

`pull-backup.sh` runs `sqlite3 .backup` on the droplet and rsyncs the snapshot
to `$VIMCHI_BACKUP_DEST/vimchi.db`, then checks `PRAGMA integrity_check`.
Set `VIMCHI_SSH_HOST` and `VIMCHI_BACKUP_DEST` (any local directory you choose)
and schedule the script however you like. The droplet image includes `sqlite3`.

## Local image

`docker/docker-compose.yml` and `docker/up.sh` run the same image on your
machine, with SQLite bind-mounted at `var/`. See `docker/.env.example`.
