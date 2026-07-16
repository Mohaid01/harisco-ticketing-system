#!/usr/bin/env bash

set -e

echo ""
echo "📦 Pulling latest code..."
echo ""

git pull

echo ""
echo "🛑 Stopping current services..."
echo ""

docker-compose down

echo ""
echo "⚡ Building and restarting services..."
echo ""

docker-compose up -d --build

echo ""
echo "✅ Deployment complete!"
echo ""
