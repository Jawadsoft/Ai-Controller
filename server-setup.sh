#!/bin/bash

# 🖥️ Vehicle Management System Server Setup Script
# This script sets up a fresh Ubuntu/Debian server for production deployment

set -e  # Exit on any error

echo "🖥️ Starting Vehicle Management System server setup..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
APP_NAME="vehicle-management"
APP_USER="vehicleapp"
APP_DIR="/var/www/vehicle-management"
DB_NAME="vehicle_management"
DB_USER="vehicle_user"

# Log function
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
    exit 1
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   error "This script must be run as root. Please use: sudo $0"
fi

# Check OS
if [[ ! -f /etc/os-release ]]; then
    error "Could not determine OS. This script supports Ubuntu/Debian systems."
fi

source /etc/os-release
if [[ "$ID" != "ubuntu" && "$ID" != "debian" ]]; then
    error "This script supports Ubuntu/Debian systems. Detected: $ID"
fi

log "Setting up server for $ID $VERSION_ID..."

# Update system
log "Updating system packages..."
apt update && apt upgrade -y

# Install essential packages
log "Installing essential packages..."
apt install -y curl wget git unzip software-properties-common apt-transport-https ca-certificates gnupg lsb-release

# Install Node.js 18+
log "Installing Node.js 18+..."
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt-get install -y nodejs

# Verify Node.js installation
NODE_VERSION=$(node --version)
NPM_VERSION=$(npm --version)
log "✅ Node.js $NODE_VERSION installed"
log "✅ npm $NPM_VERSION installed"

# Install PM2 globally
log "Installing PM2 process manager..."
npm install -g pm2

# Install nginx
log "Installing nginx..."
apt install -y nginx

# Install PostgreSQL
log "Installing PostgreSQL..."
apt install -y postgresql postgresql-contrib

# Install Certbot for SSL
log "Installing Certbot for SSL certificates..."
apt install -y certbot python3-certbot-nginx

# Install additional tools
log "Installing additional tools..."
apt install -y htop nginx-extras

# Create application user
log "Creating application user..."
if ! id "$APP_USER" &>/dev/null; then
    useradd -m -s /bin/bash "$APP_USER"
    usermod -aG sudo "$APP_USER"
    log "✅ User $APP_USER created"
else
    log "✅ User $APP_USER already exists"
fi

# Create application directory
log "Creating application directory..."
mkdir -p "$APP_DIR"
chown "$APP_USER:$APP_USER" "$APP_DIR"

# Setup PostgreSQL
log "Setting up PostgreSQL database..."
sudo -u postgres psql -c "CREATE DATABASE $DB_NAME;" || warning "Database might already exist"
sudo -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$(openssl rand -base64 32)';" || warning "User might already exist"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;" || warning "Privileges might already be granted"
sudo -u postgres psql -c "ALTER USER $DB_USER CREATEDB;" || warning "Could not grant CREATEDB privilege"

# Configure PostgreSQL for remote access
log "Configuring PostgreSQL for remote access..."
PG_CONF="/etc/postgresql/*/main/postgresql.conf"
PG_HBA="/etc/postgresql/*/main/pg_hba.conf"

# Update postgresql.conf
if [[ -f "$PG_CONF" ]]; then
    sed -i "s/#listen_addresses = 'localhost'/listen_addresses = '*'/" "$PG_CONF"
    log "✅ PostgreSQL configured to listen on all interfaces"
fi

# Update pg_hba.conf
if [[ -f "$PG_HBA" ]]; then
    echo "host all all 0.0.0.0/0 md5" >> "$PG_HBA"
    log "✅ PostgreSQL configured to accept remote connections"
fi

# Setup firewall
log "Setting up firewall..."
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 80
ufw allow 443
ufw --force enable
log "✅ Firewall configured (SSH, HTTP, HTTPS allowed)"

# Configure nginx
log "Configuring nginx..."
cat > /etc/nginx/sites-available/vehicle-management << 'EOF'
server {
    listen 80;
    server_name _;
    
    # Redirect all HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name _;
    
    # SSL configuration (will be updated by Certbot)
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    
    # Frontend (React app)
    location / {
        root /var/www/vehicle-management/dist;
        try_files $uri $uri/ /index.html;
        
        # Cache static assets
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }
    
    # Backend API
    location /api {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
    
    # WebSocket support
    location /ws {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
    
    # Health check
    location /health {
        proxy_pass http://localhost:3000;
        access_log off;
    }
}
EOF

# Enable the site
ln -sf /etc/nginx/sites-available/vehicle-management /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Test nginx configuration
nginx -t || error "Nginx configuration test failed"

# Start and enable services
log "Starting and enabling services..."
systemctl enable nginx postgresql
systemctl start nginx postgresql

# Create log directories
log "Creating log directories..."
mkdir -p /var/log/vehicle-management
mkdir -p /var/backups/vehicle-management
chown "$APP_USER:$APP_USER" /var/log/vehicle-management
chown "$APP_USER:$APP_USER" /var/backups/vehicle-management

# Setup PM2 startup script
log "Setting up PM2 startup script..."
pm2 startup systemd -u "$APP_USER" --hp /home/"$APP_USER"
log "✅ PM2 startup script configured"

# Create environment file template
log "Creating environment file template..."
cat > "$APP_DIR/.env.production.template" << 'EOF'
# Production Environment Configuration
NODE_ENV=production
PORT=3000

# Database
DATABASE_URL=postgresql://vehicle_user:your_password_here@localhost:5432/vehicle_management

# Security
JWT_SECRET=your-super-strong-jwt-secret-here-64-characters-minimum
SESSION_SECRET=your-super-strong-session-secret-here-64-characters-minimum

# URLs
FRONTEND_URL=https://yourdomain.com
BACKEND_URL=https://yourdomain.com

# API Keys (update with your actual keys)
OPENAI_API_KEY=sk-your-openai-api-key-here
DEEPGRAM_API_KEY=your-deepgram-api-key-here
ELEVENLABS_API_KEY=your-elevenlabs-api-key-here

# Security Settings
CORS_ORIGIN=https://yourdomain.com
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# SSL/HTTPS
FORCE_HTTPS=true
SECURE_COOKIES=true
EOF

chown "$APP_USER:$APP_USER" "$APP_DIR/.env.production.template"

# Create deployment script
log "Creating deployment script..."
cat > "$APP_DIR/deploy.sh" << 'EOF'
#!/bin/bash
cd "$(dirname "$0")"
./deploy.sh
EOF

chmod +x "$APP_DIR/deploy.sh"
chown "$APP_USER:$APP_USER" "$APP_DIR/deploy.sh"

# Setup log rotation
log "Setting up log rotation..."
cat > /etc/logrotate.d/vehicle-management << 'EOF'
/var/log/vehicle-management/*.log {
    daily
    missingok
    rotate 52
    compress
    delaycompress
    notifempty
    create 644 vehicleapp vehicleapp
    postrotate
        systemctl reload nginx
    endscript
}
EOF

# Final configuration
log "Finalizing configuration..."

# Set proper permissions
chown -R "$APP_USER:$APP_USER" "$APP_DIR"

# Create systemd service for the application
cat > /etc/systemd/system/vehicle-management.service << EOF
[Unit]
Description=Vehicle Management System
After=network.target postgresql.service

[Service]
Type=simple
User=$APP_USER
WorkingDirectory=$APP_DIR
ExecStart=/usr/bin/pm2 start ecosystem.config.js --env production
ExecReload=/usr/bin/pm2 reload all
ExecStop=/usr/bin/pm2 stop all
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable vehicle-management

# Performance tuning
log "Applying performance optimizations..."

# Nginx optimizations
cat >> /etc/nginx/nginx.conf << 'EOF'

# Performance optimizations
http {
    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types
        text/plain
        text/css
        text/xml
        text/javascript
        application/json
        application/javascript
        application/xml+rss
        application/atom+xml
        image/svg+xml;
    
    # Client optimizations
    client_max_body_size 10M;
    client_body_timeout 60s;
    client_header_timeout 60s;
    
    # Proxy optimizations
    proxy_connect_timeout 60s;
    proxy_send_timeout 60s;
    proxy_read_timeout 60s;
}
EOF

# PostgreSQL optimizations
cat >> /etc/postgresql/*/main/postgresql.conf << 'EOF'

# Performance optimizations
shared_buffers = 256MB
effective_cache_size = 1GB
work_mem = 4MB
maintenance_work_mem = 64MB
checkpoint_completion_target = 0.9
wal_buffers = 16MB
default_statistics_target = 100
random_page_cost = 1.1
effective_io_concurrency = 200
EOF

# Restart services to apply changes
log "Restarting services to apply optimizations..."
systemctl restart postgresql
systemctl restart nginx

# Final status
log "🎉 Server setup completed successfully!"
log ""
log "📊 Server Status:"
log "   ✅ Node.js: $NODE_VERSION"
log "   ✅ npm: $NPM_VERSION"
log "   ✅ PM2: $(pm2 --version)"
log "   ✅ nginx: $(nginx -v 2>&1)"
log "   ✅ PostgreSQL: $(psql --version)"
log ""
log "🔧 Next Steps:"
log "1. Configure your domain DNS to point to this server"
log "2. Update the nginx configuration with your domain"
log "3. Obtain SSL certificate: sudo certbot --nginx -d yourdomain.com"
log "4. Copy your application code to $APP_DIR"
log "5. Create .env.production file from the template"
log "6. Run the deployment script: ./deploy.sh"
log ""
log "📁 Application Directory: $APP_DIR"
log "👤 Application User: $APP_USER"
log "🗄️ Database: $DB_NAME (user: $DB_USER)"
log "🌐 Web Server: nginx (ports 80/443)"
log "🔧 Process Manager: PM2"
log ""
log "📋 Useful Commands:"
log "   Check status: systemctl status vehicle-management"
log "   View logs: journalctl -u vehicle-management -f"
log "   Monitor PM2: pm2 monit"
log "   Check nginx: systemctl status nginx"
log "   Check database: systemctl status postgresql"
