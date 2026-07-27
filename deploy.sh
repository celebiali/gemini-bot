#!/bin/bash
# -------------------------------------------------------------
# Gemini Bot - Production Deployment Script
# -------------------------------------------------------------

set -e

echo "🚀 Starting Gemini Bot deployment..."

# 1. Pull latest code from GitHub
echo "📥 Pulling latest updates from GitHub..."
git pull origin main

# 2. Check if Docker is available
if command -v docker &> /dev/null && command -v docker-compose &> /dev/null; then
    echo "🐳 Docker detected. Building and restarting Docker container..."
    docker-compose up -d --build
    echo "✅ Docker deployment completed! Running on http://localhost:3000"
else
    echo "⚡ PM2 / Node mode detected. Installing dependencies & building..."
    npm ci
    npm run build

    if command -v pm2 &> /dev/null; then
        echo "🔄 Restarting application via PM2..."
        pm2 restart ecosystem.config.cjs || pm2 start ecosystem.config.cjs
        pm2 save
        echo "✅ PM2 deployment completed! Running on http://localhost:3000"
    else
        echo "✨ Production build ready in .output/server/index.mjs"
        echo "Run: node .output/server/index.mjs"
    fi
fi
