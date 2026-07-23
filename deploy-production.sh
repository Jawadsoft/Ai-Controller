#!/bin/bash

echo "🚀 Starting Production Deployment..."

# Clean previous build
echo "🧹 Cleaning previous build..."
rm -rf dist/

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Build the application
echo "🔨 Building application..."
npm run build:production

# Check if build was successful
if [ ! -d "dist" ]; then
    echo "❌ Build failed - dist folder not found"
    exit 1
fi

if [ ! -d "dist/server" ]; then
    echo "❌ Build failed - server folder not found in dist"
    exit 1
fi

echo "✅ Build completed successfully!"
echo "📁 Build output:"
echo "   - Frontend: dist/"
echo "   - Backend: dist/server/"
echo "   - Server file: dist/server/server.js"

# Copy environment file if it exists
if [ -f ".env" ]; then
    echo "🔐 Copying environment file..."
    cp .env dist/server/
else
    echo "⚠️  No .env file found - please create one in dist/server/"
fi

echo ""
echo "🚀 To start production server:"
echo "   cd dist/server"
echo "   npm install --production"
echo "   node server.js"
echo ""
echo "   Or from root: npm run start:production"
