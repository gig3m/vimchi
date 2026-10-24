#!/usr/bin/env bash
# Create the vimchi droplet on DigitalOcean, wait for a public IP, and
# optionally point DNS at it. Copy local.env.example to local.env first.
#
#   deploy/do/create-droplet.sh            # create the droplet
#   deploy/do/create-droplet.sh --render   # print rendered cloud-init and exit
set -euo pipefail
cd "$(dirname "$0")"

if [[ -f local.env ]]; then
  set -a
  # shellcheck disable=SC1091
  . ./local.env
  set +a
fi

render_only=0
if [[ "${1:-}" == "--render" ]]; then
  render_only=1
fi

: "${VIMCHI_SSH_USER:?set VIMCHI_SSH_USER (see local.env.example)}"

export VIMCHI_DOMAIN="${VIMCHI_DOMAIN:-vimchi.dev}"
export VIMCHI_DO_REGION="${VIMCHI_DO_REGION:-nyc3}"
export VIMCHI_DO_SIZE="${VIMCHI_DO_SIZE:-s-1vcpu-1gb}"
export VIMCHI_DROPLET_NAME="${VIMCHI_DROPLET_NAME:-vimchi}"

if [[ ! "$VIMCHI_DOMAIN" =~ ^[A-Za-z0-9.-]+$ ]]; then
  echo "VIMCHI_DOMAIN must be a hostname" >&2
  exit 1
fi

# --render does not call APIs. Set TAILSCALE_AUTHKEY to preview that branch;
# a real create mints a one-time key from TAILSCALE_API_KEY when the auth key is empty.
if [[ "$render_only" -eq 0 && -n "${TAILSCALE_API_KEY:-}" && -z "${TAILSCALE_AUTHKEY:-}" ]]; then
  TAILSCALE_AUTHKEY=$(curl -fsS -u "$TAILSCALE_API_KEY:" -H "Content-Type: application/json" \
    https://api.tailscale.com/api/v2/tailnet/-/keys \
    -d '{"capabilities":{"devices":{"create":{"reusable":false,"ephemeral":false,"preauthorized":true}}},"expirySeconds":3600,"description":"vimchi droplet first boot"}' \
    | python3 -c 'import json,sys; print(json.load(sys.stdin)["key"])')
  export TAILSCALE_AUTHKEY
fi

user_data=$(python3 render-cloud-init.py)

if [[ "$render_only" -eq 1 ]]; then
  printf '%s\n' "$user_data"
  exit 0
fi

: "${DIGITALOCEAN_TOKEN:?set DIGITALOCEAN_TOKEN in local.env}"
: "${VIMCHI_DO_SSH_KEY_NAME:?set VIMCHI_DO_SSH_KEY_NAME to an SSH key name on the DigitalOcean account}"

DO="https://api.digitalocean.com/v2"
do_api() { curl -fsS -H "Authorization: Bearer $DIGITALOCEAN_TOKEN" -H "Content-Type: application/json" "$@"; }

if do_api "$DO/droplets?per_page=100" | python3 -c 'import json,os,sys; name=os.environ["VIMCHI_DROPLET_NAME"]; sys.exit(0 if any(d["name"]==name for d in json.load(sys.stdin)["droplets"]) else 1)'; then
  echo "droplet '$VIMCHI_DROPLET_NAME' already exists" >&2
  exit 1
fi

export DO_SSH_KEY_ID
DO_SSH_KEY_ID=$(do_api "$DO/account/keys" | python3 -c 'import json,os,sys
name=os.environ["VIMCHI_DO_SSH_KEY_NAME"]
match=[k["id"] for k in json.load(sys.stdin)["ssh_keys"] if k["name"]==name]
if len(match)!=1:
    sys.exit(f"expected one DigitalOcean SSH key named {name!r}, found {len(match)}")
print(match[0])')

body=$(python3 -c 'import json,os,sys
print(json.dumps({
  "name": os.environ["VIMCHI_DROPLET_NAME"],
  "region": os.environ["VIMCHI_DO_REGION"],
  "size": os.environ["VIMCHI_DO_SIZE"],
  "image": "ubuntu-24-04-x64",
  "ssh_keys": [int(os.environ["DO_SSH_KEY_ID"])],
  "backups": False,
  "ipv6": False,
  "monitoring": True,
  "tags": ["vimchi"],
  "user_data": sys.stdin.read(),
}))' <<< "$user_data")

id=$(do_api -X POST "$DO/droplets" -d "$body" | python3 -c 'import json,sys; print(json.load(sys.stdin)["droplet"]["id"])')
echo "droplet id $id; waiting for a public IP"
ip=""
for _ in $(seq 1 60); do
  ip=$(do_api "$DO/droplets/$id" | python3 -c 'import json,sys; d=json.load(sys.stdin)["droplet"]; print(next((n["ip_address"] for n in d["networks"]["v4"] if n["type"]=="public"), "") if d["status"]=="active" else "")')
  [[ -n "$ip" ]] && break
  sleep 5
done
[[ -n "$ip" ]] || { echo "no IP after 5 min" >&2; exit 1; }
echo "public ip $ip"

if [[ -n "${PORKBUN_API_KEY:-}" && -n "${PORKBUN_SECRET_API_KEY:-}" ]]; then
  pb() { curl -fsS -X POST "https://api.porkbun.com/api/json/v3/$1" -H "Content-Type: application/json" -d "$2"; }
  auth="\"apikey\":\"$PORKBUN_API_KEY\",\"secretapikey\":\"$PORKBUN_SECRET_API_KEY\""
  for sub in "" www; do
    pb "dns/deleteByNameType/$VIMCHI_DOMAIN/A/$sub" "{$auth}" >/dev/null || true
    pb "dns/create/$VIMCHI_DOMAIN" "{$auth,\"name\":\"$sub\",\"type\":\"A\",\"content\":\"$ip\",\"ttl\":\"600\"}" >/dev/null
    echo "dns ${sub:+$sub.}$VIMCHI_DOMAIN -> $ip"
  done
else
  echo "Porkbun keys not set; point ${VIMCHI_DOMAIN} and www at $ip yourself"
fi

echo "$ip" > .droplet-ip
if [[ -n "${TAILSCALE_AUTHKEY:-}" ]]; then
  echo "done. cloud-init takes a few minutes. SSH listens on the tailnet only (public 22 is closed)."
else
  echo "done. cloud-init takes a few minutes; then: ssh ${VIMCHI_SSH_USER}@${ip}"
fi
