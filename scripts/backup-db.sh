#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="backups"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
DB_FILE="data/database.sqlite"

mkdir -p "$BACKUP_DIR"

if [ ! -f "$DB_FILE" ]; then
  echo "❌ Database file not found at $DB_FILE"
  exit 1
fi

BACKUP_FILE="$BACKUP_DIR/database-$TIMESTAMP.sqlite"

cp "$DB_FILE" "$BACKUP_FILE"

# Compress backup (optional, requires gzip)
if command -v gzip &> /dev/null; then
  gzip -f "$BACKUP_FILE"
  BACKUP_FILE="$BACKUP_FILE.gz"
fi

echo "✅ Database backed up to $BACKUP_FILE"
echo "📊 Size: $(du -h "$BACKUP_FILE" | cut -f1)"
