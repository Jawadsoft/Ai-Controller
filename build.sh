#!/bin/bash

# Exit on any error
set -e

echo "🚀 Starting build process for Render.com deployment..."
echo "📅 Build started at: $(date)"

# Function to log messages with timestamps
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

# Function to handle errors
handle_error() {
    log "❌ Error occurred during build process"
    log "🔍 Error details: $1"
    exit 1
}

# Set error handler
trap 'handle_error "$BASH_COMMAND"' ERR

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    log "❌ package.json not found. Are you in the correct directory?"
    exit 1
fi

log "📁 Current directory: $(pwd)"
log "📦 Node.js version: $(node --version)"
log "📦 NPM version: $(npm --version)"

# Create uploads directory structure
log "📁 Creating uploads directory structure..."

# Create main uploads directory
mkdir -p uploads
log "✅ Created main uploads directory"

# Create subdirectories for different file types
subdirs=(
    "daive-audio"
    "daive-audio/greeting"
    "daive-audio/response"
    "vehicle-photos"
    "vehicle-images"
    "etl-documents"
    "temp"
)

for dir in "${subdirs[@]}"; do
    mkdir -p "uploads/$dir"
    log "✅ Created directory: uploads/$dir"
done

# Set proper permissions
log "🔐 Setting directory permissions..."
chmod -R 755 uploads
log "✅ Set directory permissions to 755"

# Verify directory structure
log "📋 Verifying directory structure:"
if command -v tree &> /dev/null; then
    tree uploads/ || true
else
    log "📁 Directory structure:"
    find uploads/ -type d | sort
fi

# Check directory permissions
log "🔐 Checking directory permissions:"
ls -la uploads/

# Create a test file to verify write permissions
log "🧪 Testing write permissions..."
test_file="uploads/test-write-permission.txt"
echo "Test file created at $(date)" > "$test_file"
if [ -f "$test_file" ]; then
    log "✅ Write permissions verified"
    rm "$test_file"
    log "✅ Test file cleaned up"
else
    log "❌ Write permissions failed"
    exit 1
fi

# Install dependencies
log "🔧 Installing Node.js dependencies..."
npm install --production=false

# Build the application (if you have a build script)
if [ -f "package.json" ] && grep -q "\"build\"" package.json; then
    log "🔨 Building application..."
    npm run build
    log "✅ Build completed"
fi

# Final verification
log "🔍 Final verification..."
if [ -d "uploads" ] && [ -d "uploads/daive-audio" ]; then
    log "✅ Uploads directory structure verified"
else
    log "❌ Uploads directory structure verification failed"
    exit 1
fi

log "🎉 Build process completed successfully!"
log "📁 Uploads directory structure is ready!"
log "📅 Build completed at: $(date)"

echo "✅ Build script completed successfully!"
