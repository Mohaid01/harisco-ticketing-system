#!/usr/bin/env bash
set -euo pipefail

echo ""
echo "📋 Saving current container logs..."
echo ""
mkdir -p logs
LOG_FILE="logs/harisco-ticketing-$(date +%Y%m%d-%H%M%S).log"
docker logs harisco-ticketing-system > "$LOG_FILE" 2>&1 || true

echo ""
echo "📦 Pulling latest code..."
echo ""
git pull || { echo "❌ Git pull failed! Aborting deployment."; exit 1; }

echo ""
echo "🛑 Stopping current container..."
echo ""
docker-compose down

echo ""
echo "🚀 Building and starting..."
echo ""
docker-compose up -d --build

echo ""
echo "✅ Deployment complete!"
