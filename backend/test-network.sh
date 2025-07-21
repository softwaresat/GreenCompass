#!/bin/bash

# Network connectivity test script for GreenCompass backend
echo "🌐 GreenCompass Backend Network Test"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Get VM IP address
VM_IP=$(hostname -I | awk '{print $1}' 2>/dev/null)
PORT=3001

if [ -z "$VM_IP" ]; then
    echo "❌ Could not determine VM IP address"
    echo "💡 Manually run: hostname -I"
    exit 1
fi

echo "📍 VM IP Address: $VM_IP"
echo "🔌 Backend Port: $PORT"
echo ""

# Check if server is running
echo "🔍 Testing server status..."
if curl -s http://localhost:$PORT/health > /dev/null 2>&1; then
    echo "✅ Server is running locally"
else
    echo "❌ Server is not running locally"
    echo "💡 Start with: ./start-server.sh"
    exit 1
fi

# Test network accessibility
echo ""
echo "🌐 Testing network accessibility..."
echo "📋 Frontend should use these URLs:"
echo "   Backend URL: http://$VM_IP:$PORT"
echo "   Health check: http://$VM_IP:$PORT/health"
echo "   API endpoint: http://$VM_IP:$PORT/api/scrape-playwright"
echo ""

echo "⚙️ Environment variable to set in frontend:"
echo "   EXPO_PUBLIC_BACKEND_URL=http://$VM_IP:$PORT"
echo ""

echo "🧪 Testing from external network..."
echo "Run this command from your frontend machine:"
echo "   curl http://$VM_IP:$PORT/health"
echo ""
echo "Expected response: {\"status\":\"healthy\",\"timestamp\":...}"
