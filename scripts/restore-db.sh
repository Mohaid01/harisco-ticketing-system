#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="backups"
DB_FILE="data/database.sqlite"

if [ -z "${1:-}" ]; then
  echo "Usage: $0 <backup-file>"
  echo ""
  echo "Available backups:"
  ls -lh "$BACKUP_DIR"/*.sqlite* 2>/dev/null || echo "  No backups found"
  exit 1
fi

BACKUP_FILE="$1"

if [ ! -f "$BACKUP_FILE" ]; then
  # Try prepending backup dir
  if [ -f "$BACKUP_DIR/$BACKUP_FILE" ]; then
    BACKUP_FILE="$BACKUP_DIR/$BACKUP_FILE"
  else
    echo "❌ Backup file not found: $BACKUP_FILE"
    exit 1
  fi
fi

# Stop the container first
echo "🛑 Stopping container..."
docker compose stop harisco-ticketing-system || true

# Restore the database
echo "📦 Restoring database from $BACKUP_FILE..."
cp "$BACKUP_FILE" "$DB_FILE"

# Restart the container
echo "🚀 Starting container..."
docker compose start harisco-ticketing-system

echo "✅ Database restored successfully"
