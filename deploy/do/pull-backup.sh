#!/usr/bin/env bash
# Take a consistent SQLite snapshot on the droplet and pull it locally.
# Schedule this yourself (cron, a systemd timer, or a manual run). A lost
# droplet then loses only the runs since the last successful pull.
#
#   VIMCHI_SSH_HOST     SSH destination (user@host or an ssh config alias)
#   VIMCHI_BACKUP_DEST  local directory; the snapshot is written as vimchi.db
#
# Usage: deploy/do/pull-backup.sh [user@host]
set -euo pipefail
cd "$(dirname "$0")"

if [[ -f local.env ]]; then
  set -a
  # shellcheck disable=SC1091
  . ./local.env
  set +a
fi

host=${1:-${VIMCHI_SSH_HOST:?set VIMCHI_SSH_HOST or pass user@host}}
dest=${VIMCHI_BACKUP_DEST:?set VIMCHI_BACKUP_DEST to a local directory}
mkdir -p "$dest"
ssh -o BatchMode=yes -o ConnectTimeout=20 "$host" 'sqlite3 /opt/vimchi/var/vimchi.db ".backup /opt/vimchi/var/snapshot.db"'
rsync -q -e "ssh -o BatchMode=yes" "$host":/opt/vimchi/var/snapshot.db "$dest/vimchi.db"
sqlite3 "$dest/vimchi.db" 'PRAGMA integrity_check;' | grep -qx ok
echo "snapshot ok: $dest/vimchi.db"
