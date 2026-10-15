#!/bin/bash
# Nightly logical backup of the ORYN database into /backups, keeping $KEEP_DAYS days.
# These files sit on the same server: copy them to a second company-owned machine as well.
set -uo pipefail
while true; do
  stamp=$(date -u +%Y%m%d-%H%M)
  if pg_dump -Fc -d oryn -f "/backups/oryn-$stamp.dump.partial"; then
    mv "/backups/oryn-$stamp.dump.partial" "/backups/oryn-$stamp.dump"
    echo "[backup] wrote oryn-$stamp.dump"
  else
    echo "[backup] FAILED at $stamp" >&2
    rm -f "/backups/oryn-$stamp.dump.partial"
  fi
  find /backups -name 'oryn-*.dump' -mtime +"${KEEP_DAYS:-14}" -delete
  sleep "${BACKUP_INTERVAL_SECONDS:-86400}"
done
