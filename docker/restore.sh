#!/bin/bash
# Restores a backup produced by backup.sh. Run by hand during an incident —
# never automated. See docs/04-exploitation.md §7 for the full procedure and
# for the record of the dry run this script was validated against.
#
# Usage: ./restore.sh /volume1/backups/clhub/clhub-2026-07-26_0200.dump
set -euo pipefail

if [ $# -ne 1 ]; then
  echo "Usage: $0 <path-to-clhub-*.dump>" >&2
  exit 1
fi

DUMP_FILE="$1"
UPLOADS_ARCHIVE="${DUMP_FILE/clhub-/uploads-}"
UPLOADS_ARCHIVE="${UPLOADS_ARCHIVE%.dump}.tar.gz"
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ ! -f "$DUMP_FILE" ]; then
  echo "No such dump file: $DUMP_FILE" >&2
  exit 1
fi

cd "$PROJECT_DIR"

echo "Stopping web so nothing writes to the database mid-restore..."
docker compose stop web

echo "Restoring database from $DUMP_FILE..."
docker compose exec -T db dropdb -U clhub --if-exists clhub
docker compose exec -T db createdb -U clhub clhub
docker compose exec -T db psql -U clhub -d clhub -c "CREATE EXTENSION IF NOT EXISTS btree_gist;"
docker compose exec -T db pg_restore -U clhub -d clhub --no-owner --no-privileges < "$DUMP_FILE"

if [ -f "$UPLOADS_ARCHIVE" ]; then
  echo "Restoring uploads from $UPLOADS_ARCHIVE..."
  rm -rf "$PROJECT_DIR/uploads"
  tar -xzf "$UPLOADS_ARCHIVE" -C "$PROJECT_DIR"
else
  echo "No matching uploads archive ($UPLOADS_ARCHIVE) — skipping, database only." >&2
fi

echo "Starting web back up..."
docker compose start web

echo "Restore complete. Check /api/health and spot-check a few pages."
