#!/usr/bin/env bash
# Nightly (cron on sleepwalker, 02:45, before the 03:00 backup run): take a
# consistent SQLite snapshot on the droplet and pull it into the vimchi tree,
# which the `vimchi` local-tier backup target archives. Losing the droplet
# then loses at most a day of runs.
set -euo pipefail
host=${1:-kyle@vimchi.dev}
dest=/home/kyle/projects/vimchi/db-snapshot
mkdir -p "$dest"
ssh -o BatchMode=yes -o ConnectTimeout=20 "$host" 'sqlite3 /opt/vimchi/var/vimchi.db ".backup /opt/vimchi/var/snapshot.db"'
rsync -q -e "ssh -o BatchMode=yes" "$host":/opt/vimchi/var/snapshot.db "$dest/vimchi-dev.db"
sqlite3 "$dest/vimchi-dev.db" 'PRAGMA integrity_check;' | grep -qx ok
