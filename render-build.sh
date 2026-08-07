#!/usr/bin/env bash
# Render build script with Chrome installation

set -e  # Exit on error

echo "🚀 Starting Render build process..."

# Install Chrome dependencies
echo "📦 Installing Chrome..."
apt-get update
apt-get install -y wget gnupg ca-certificates

# Add Google Chrome repository
wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add -
sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google-chrome.list'

# Update and install Chrome
apt-get update
apt-get install -y google-chrome-stable \
  fonts-liberation \
  libappindicator3-1 \
  libasound2 \
  libatk-bridge2.0-0 \
  libatk1.0-0 \
  libatspi2.0-0 \
  libcups2 \
  libdbus-1-3 \
  libdrm2 \
  libgbm1 \
  libgtk-3-0 \
  libnspr4 \
  libnss3 \
  libwayland-client0 \
  libxcomposite1 \
  libxdamage1 \
  libxfixes3 \
  libxkbcommon0 \
  libxrandr2 \
  xdg-utils

# Verify Chrome installation
echo "✅ Verifying Chrome installation..."
google-chrome-stable --version

# Install npm dependencies
echo "📦 Installing npm packages..."
npm install

# Build frontend
echo "🔨 Building frontend..."
npm run build

echo "✅ Build complete! Chrome is ready at /usr/bin/google-chrome-stable"
