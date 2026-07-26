#!/bin/bash
# Run nightly from DSM Task Scheduler (Panneau de configuration → Planificateur
# de tâches → Créer → Tâche déclenchée → Script défini par l'utilisateur), as
# the same user that owns the Container Manager project. See docs/04-exploitation.md §7.
#
# Usage: ./backup.sh [backup_dir]   (default: /volume1/backups/clhub)
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_DIR="${1:-/volume1/backups/clhub}"
TIMESTAMP="$(date +%Y-%m-%d_%H%M)"
DAILY_RETENTION_DAYS=14

mkdir -p "$BACKUP_DIR"
cd "$PROJECT_DIR"

# No password needed: pg_dump run this way connects over the container's
# local Unix socket, which the official postgres image trusts by default —
# the same reason compose.yaml's healthcheck doesn't need one either.
docker compose exec -T db pg_dump -U clhub -Fc -d clhub \
  > "$BACKUP_DIR/clhub-$TIMESTAMP.dump.tmp"
mv "$BACKUP_DIR/clhub-$TIMESTAMP.dump.tmp" "$BACKUP_DIR/clhub-$TIMESTAMP.dump"

tar -czf "$BACKUP_DIR/uploads-$TIMESTAMP.tar.gz.tmp" -C "$PROJECT_DIR" uploads
mv "$BACKUP_DIR/uploads-$TIMESTAMP.tar.gz.tmp" "$BACKUP_DIR/uploads-$TIMESTAMP.tar.gz"

# Daily rotation — Hyper Backup (see docs/04-exploitation.md §7) is what
# actually protects against this box itself failing; this just keeps
# /volume1/backups/clhub from growing forever.
find "$BACKUP_DIR" -maxdepth 1 -name 'clhub-*.dump' -mtime "+$DAILY_RETENTION_DAYS" -delete
find "$BACKUP_DIR" -maxdepth 1 -name 'uploads-*.tar.gz' -mtime "+$DAILY_RETENTION_DAYS" -delete

echo "Backup done: $BACKUP_DIR/clhub-$TIMESTAMP.{dump,tar.gz}"
