#!/usr/bin/env bash
# One-shot: create the vimchi droplet on DigitalOcean with cloud-init, wait for
# its public IP, point vimchi.dev (+ www) at it on Porkbun. Run from sleepwalker
# (needs DIGITALOCEAN_TOKEN, TAILSCALE_API_KEY_EXP20260922, PORKBUN_* in keys).
set -euo pipefail
cd "$(dirname "$0")"
: "${DIGITALOCEAN_TOKEN:?}" "${TAILSCALE_API_KEY_EXP20260922:?}" "${PORKBUN_API_KEY:?}" "${PORKBUN_SECRET_API_KEY:?}"
DO="https://api.digitalocean.com/v2"
do_api() { curl -fsS -H "Authorization: Bearer $DIGITALOCEAN_TOKEN" -H "Content-Type: application/json" "$@"; }

if do_api "$DO/droplets?per_page=100" | python3 -c 'import json,sys; sys.exit(0 if any(d["name"]=="vimchi" for d in json.load(sys.stdin)["droplets"]) else 1)'; then
  echo "droplet 'vimchi' already exists" >&2; exit 1
fi

# A one-use, pre-authorized Tailscale auth key so the box joins the tailnet on first boot.
ts_key=$(curl -fsS -u "$TAILSCALE_API_KEY_EXP20260922:" -H "Content-Type: application/json" \
  https://api.tailscale.com/api/v2/tailnet/-/keys \
  -d '{"capabilities":{"devices":{"create":{"reusable":false,"ephemeral":false,"preauthorized":true}}},"expirySeconds":3600,"description":"vimchi droplet first boot"}' \
  | python3 -c 'import json,sys; print(json.load(sys.stdin)["key"])')
hub_key=$(cat ~/.ssh/id_ed25519.pub)
key_id=$(do_api "$DO/account/keys" | python3 -c 'import json,sys; print(next(k["id"] for k in json.load(sys.stdin)["ssh_keys"] if k["name"]=="sleepwalker-hub"))')
user_data=$(sed -e "s|__HUB_KEY__|$hub_key|" -e "s|__TS_AUTHKEY__|$ts_key|" cloud-init.yaml)

body=$(python3 -c 'import json,sys; print(json.dumps({"name":"vimchi","region":"nyc3","size":"s-1vcpu-1gb","image":"ubuntu-24-04-x64","ssh_keys":[int(sys.argv[1])],"backups":False,"ipv6":False,"monitoring":True,"tags":["vimchi"],"user_data":sys.stdin.read()}))' "$key_id" <<< "$user_data")
id=$(do_api -X POST "$DO/droplets" -d "$body" | python3 -c 'import json,sys; print(json.load(sys.stdin)["droplet"]["id"])')
echo "droplet id $id; waiting for a public IP"
ip=""
for _ in $(seq 1 60); do
  ip=$(do_api "$DO/droplets/$id" | python3 -c 'import json,sys; d=json.load(sys.stdin)["droplet"]; print(next((n["ip_address"] for n in d["networks"]["v4"] if n["type"]=="public"), "") if d["status"]=="active" else "")')
  [ -n "$ip" ] && break
  sleep 5
done
[ -n "$ip" ] || { echo "no IP after 5 min" >&2; exit 1; }
echo "public ip $ip"

pb() { curl -fsS -X POST "https://api.porkbun.com/api/json/v3/$1" -H "Content-Type: application/json" -d "$2"; }
auth="\"apikey\":\"$PORKBUN_API_KEY\",\"secretapikey\":\"$PORKBUN_SECRET_API_KEY\""
for sub in "" www; do
  # Replace any existing A record for the name, then create the new one.
  pb "dns/deleteByNameType/vimchi.dev/A/$sub" "{$auth}" >/dev/null || true
  pb "dns/create/vimchi.dev" "{$auth,\"name\":\"$sub\",\"type\":\"A\",\"content\":\"$ip\",\"ttl\":\"600\"}" >/dev/null
  echo "dns ${sub:+$sub.}vimchi.dev -> $ip"
done
echo "$ip" > .droplet-ip
echo "done. cloud-init takes a few minutes; then: ssh kyle@$ip"
