#!/bin/bash

echo "🚀 Setting up CrewAI Test Suite..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

echo "✅ Node.js version: $(node --version)"

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm first."
    exit 1
fi

echo "✅ npm version: $(npm --version)"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Check if the server is running
echo "🔍 Checking if the server is running..."
if curl -s http://localhost:3000/api/daive/health > /dev/null; then
    echo "✅ Server is running on http://localhost:3000"
else
    echo "⚠️  Server is not running on http://localhost:3000"
    echo "   Please start your server first with: npm run dev"
    echo "   Then run the tests with: npm test"
    exit 1
fi

# Run the basic test suite
echo "🧪 Running CrewAI test suite..."
npm test

echo "✅ Test setup complete!"
echo ""
echo "📋 Available commands:"
echo "  npm test        - Run basic test suite"
echo "  npm run test-full - Run full test suite"
echo ""
echo "🔧 Configuration:"
echo "  Edit simple-crewai-test.js to change test settings"
echo "  Update TEST_CONFIG.testDealerId to match your database"
