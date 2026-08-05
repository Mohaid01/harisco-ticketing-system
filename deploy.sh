#!/usr/bin/env bash
# Exit immediately if a command exits with a non-zero status
set -e

echo ""
echo "📦 Pulling latest code..."
echo ""

# Gracefully handle git conflicts instead of randomly crashing
git pull || { echo "❌ Git pull failed! Aborting deployment."; exit 1; }

echo ""
echo "📋 Saving current container logs..."
echo ""
mkdir -p logs
LOG_FILE="logs/harisco-ticketing-$(date +%Y%m%d-%H%M%S).log"

# Uses modern docker compose syntax
docker compose logs harisco-ticketing-system > "$LOG_FILE" 2>&1 || true

echo ""
echo "⚡ Building and updating services..."
echo ""

# Rebuilds and restarts without tearing down everything first
docker compose up -d --build || { echo "❌ Build/restart failed! Check logs."; exit 1; }

echo ""
echo "🧹 Cleaning up old unused images..."
echo ""

# Prevents your server hard drive from filling up over time
docker image prune -f

echo ""
echo "✅ Deployment complete!"
echo ""
