#!/bin/bash

# 🚀 Vehicle Management System Deployment Script
# This script deploys the application to a production server

set -e  # Exit on any error

echo "🚀 Starting Vehicle Management System deployment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
APP_NAME="vehicle-management"
BACKUP_DIR="/var/backups/vehicle-management"
LOG_FILE="/var/log/vehicle-management/deploy.log"

# Create log directory
sudo mkdir -p /var/log/vehicle-management
sudo chown $USER:$USER /var/log/vehicle-management

# Log function
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$LOG_FILE"
    exit 1
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$LOG_FILE"
}

info() {
    echo -e "${BLUE}[INFO]${NC} $1" | tee -a "$LOG_FILE"
}

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   error "This script should not be run as root. Please run as a regular user with sudo privileges."
fi

# Check if we're in the right directory
if [[ ! -f "package.json" ]]; then
    error "package.json not found. Please run this script from the project root directory."
fi

# Check if PM2 is installed
if ! command -v pm2 &> /dev/null; then
    error "PM2 is not installed. Please install it first: npm install -g pm2"
fi

# Check if nginx is running
if ! sudo systemctl is-active --quiet nginx; then
    warning "Nginx is not running. Please start it first: sudo systemctl start nginx"
fi

# Check if PostgreSQL is running
if ! sudo systemctl is-active --quiet postgresql; then
    warning "PostgreSQL is not running. Please start it first: sudo systemctl start postgresql"
fi

log "Starting deployment process..."

# Create backup directory
sudo mkdir -p "$BACKUP_DIR"
sudo chown $USER:$USER "$BACKUP_DIR"

# Backup current version if it exists
if pm2 list | grep -q "$APP_NAME"; then
    log "Creating backup of current version..."
    BACKUP_FILE="$BACKUP_DIR/backup-$(date +'%Y%m%d-%H%M%S').tar.gz"
    tar -czf "$BACKUP_FILE" dist/ 2>/dev/null || warning "Could not create backup"
    log "Backup created: $BACKUP_FILE"
fi

# Pull latest changes (if git repository)
if [[ -d ".git" ]]; then
    log "Pulling latest changes from git..."
    git pull origin main || warning "Could not pull latest changes"
else
    log "No git repository found, using current code"
fi

# Install dependencies
log "Installing dependencies..."
npm ci --only=production || error "Failed to install dependencies"

# Build frontend
log "Building frontend application..."
npm run build || error "Failed to build frontend"

# Set proper permissions
log "Setting proper permissions..."
sudo chown -R www-data:www-data dist/
sudo chmod -R 755 dist/

# Restart PM2 processes
log "Restarting PM2 processes..."
if pm2 list | grep -q "$APP_NAME"; then
    pm2 restart "$APP_NAME" || error "Failed to restart PM2 process"
else
    pm2 start ecosystem.config.js --env production || error "Failed to start PM2 process"
fi

# Save PM2 configuration
pm2 save || warning "Could not save PM2 configuration"

# Reload nginx
log "Reloading nginx configuration..."
sudo systemctl reload nginx || warning "Could not reload nginx"

# Wait for services to be ready
log "Waiting for services to be ready..."
sleep 5

# Health checks
log "Performing health checks..."

# Check if backend is responding
if curl -f -s http://localhost:3000/health > /dev/null; then
    log "✅ Backend health check passed"
else
    error "❌ Backend health check failed"
fi

# Check if frontend is accessible
if curl -f -s http://localhost:8080 > /dev/null; then
    log "✅ Frontend accessibility check passed"
else
    warning "⚠️ Frontend accessibility check failed (this might be normal if nginx is configured)"
fi

# Check PM2 status
log "PM2 process status:"
pm2 status

# Cleanup old backups (keep last 5)
log "Cleaning up old backups..."
cd "$BACKUP_DIR"
ls -t | tail -n +6 | xargs -r rm -f

# Final status
log "🎉 Deployment completed successfully!"
log "📊 Application Status:"
log "   Backend: http://localhost:3000"
log "   Frontend: http://localhost:8080"
log "   Health Check: http://localhost:3000/health"

# Show recent logs
log "📋 Recent application logs:"
pm2 logs --lines 10

echo ""
echo -e "${GREEN}✅ Deployment completed successfully!${NC}"
echo -e "${BLUE}🌐 Your application should now be accessible${NC}"
echo -e "${YELLOW}📋 Check the logs above for any warnings or errors${NC}"
echo -e "${BLUE}📊 Monitor with: pm2 monit${NC}"
echo -e "${BLUE}📝 View logs with: pm2 logs${NC}"
