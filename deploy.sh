#!/usr/bin/env bash
set -euo pipefail

echo ""
echo "📦 Pulling latest code..."
echo ""

git pull || { echo "❌ Git pull failed! Aborting deployment."; exit 1; }

echo ""
echo "📋 Saving current container logs..."
echo ""
mkdir -p logs
LOG_FILE="logs/harisco-ticketing-$(date +%Y%m%d-%H%M%S).log"
docker compose logs harisco-ticketing-system > "$LOG_FILE" 2>&1 || true

echo ""
echo "💾 Backing up database..."
echo ""
mkdir -p backups
DB_BACKUP="backups/database-$(date +%Y%m%d-%H%M%S).sqlite"
if [ -f data/database.sqlite ]; then
  cp data/database.sqlite "$DB_BACKUP"
  echo "✅ Database backed up to $DB_BACKUP"
else
  echo "⚠️  No database file found at data/database.sqlite"
fi

echo ""
echo "🔖 Tagging current image for rollback..."
echo ""
CURRENT_IMAGE=$(docker compose images -q harisco-ticketing-system || echo "")
if [ -n "$CURRENT_IMAGE" ]; then
  docker tag "$CURRENT_IMAGE" harisco-ticketing-system:rollback || true
  echo "✅ Current image tagged as harisco-ticketing-system:rollback"
else
  echo "⚠️  No current image found to tag"
fi

echo ""
echo "⚡ Building and deploying..."
echo ""

if docker compose up -d --build; then
  echo ""
  echo "🧹 Cleaning up old images..."
  docker image prune -f
  echo ""
  echo "✅ Deployment complete!"
else
  echo ""
  echo "❌ Build failed! Rolling back..."
  echo ""

  if [ -n "$CURRENT_IMAGE" ]; then
    docker compose down || true
    docker tag "$CURRENT_IMAGE" harisco-ticketing-system:latest || true
    docker compose up -d || true
    echo "🔄 Rolled back to previous version"
  else
    echo "❌ No rollback image available. Manual intervention required."
  fi

  exit 1
fi
