#!/bin/bash

# GreenCompass Backend Startup Script
# Make executable with: chmod +x start-server.sh

echo "🚀 Starting GreenCompass Backend Server"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "⚠️  Node.js version $NODE_VERSION detected. Version 18+ is recommended."
fi

# Navigate to backend directory
cd "$(dirname "$0")"

# Install dependencies if not present
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
    
    echo "🌐 Installing Playwright browser..."
    npm run install-browser
fi

# Create .env file if not exists
if [ ! -f ".env" ]; then
    echo "⚙️  Creating environment file..."
    cp .env.example .env
    echo "✏️  Please edit .env file with your settings"
fi

# Check system resources
MEMORY_MB=$(free -m | awk 'NR==2{print $2}')
if [ "$MEMORY_MB" -lt 1024 ]; then
    echo "⚠️  Note: ${MEMORY_MB}MB RAM available. 1GB+ recommended for optimal performance."
fi

# Get VM IP address for network access
VM_IP=$(hostname -I | awk '{print $1}' 2>/dev/null || echo "192.168.x.x")

echo "🔍 System Check:"
echo "   Node.js: $(node -v)"
echo "   Memory: ${MEMORY_MB}MB"
echo "   Platform: $(uname -s)"
echo "   VM IP: $VM_IP"

# Start server
echo ""
echo "🎯 Starting server..."
echo "   Local access: http://localhost:3001/health"
echo "   Network access: http://$VM_IP:3001/health"
echo "   API base URL: http://$VM_IP:3001/api"
echo ""
echo "📋 Frontend Configuration:"
echo "   Set EXPO_PUBLIC_BACKEND_URL=http://$VM_IP:3001"
echo ""
echo "📝 Logs will appear below..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Start with proper signal handling
exec npm start
