# 🚀 Production Deployment Guide for DAIVE Application

This guide will help you deploy your DAIVE application to a production server.

## 📋 Prerequisites

### Server Requirements
- **OS**: Ubuntu 20.04+ / CentOS 8+ / Debian 11+
- **RAM**: Minimum 2GB, Recommended 4GB+
- **Storage**: Minimum 20GB, Recommended 50GB+
- **Node.js**: Version 18.0.0 or higher
- **PostgreSQL**: Version 12 or higher
- **Nginx** (for reverse proxy and SSL)

### Local Requirements
- **Node.js**: Version 18.0.0 or higher
- **Git**: For version control
- **SSH**: For server access
- **PM2**: For process management

## 🔧 Step 1: Prepare Your Local Environment

### Install PM2 (Process Manager)
```bash
npm install -g pm2
```

### Build the Application
```bash
# Install dependencies
npm ci --only=production

# Build frontend
npm run build:frontend

# Create production bundle
npm run deploy:build
```

## 🌐 Step 2: Server Setup

### Connect to Your Server
```bash
ssh your-username@your-server-ip
```

### Install Node.js and npm
```bash
# Ubuntu/Debian
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# CentOS/RHEL
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo yum install -y nodejs

# Verify installation
node --version
npm --version
```

### Install PostgreSQL
```bash
# Ubuntu/Debian
sudo apt update
sudo apt install postgresql postgresql-contrib

# CentOS/RHEL
sudo yum install postgresql postgresql-server postgresql-contrib
sudo postgresql-setup initdb
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

### Create Database and User
```bash
sudo -u postgres psql

CREATE DATABASE daive_production;
CREATE USER daive_user WITH PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE daive_production TO daive_user;
ALTER USER daive_user CREATEDB;
\q
```

### Install Nginx
```bash
# Ubuntu/Debian
sudo apt install nginx

# CentOS/RHEL
sudo yum install nginx
sudo systemctl start nginx
sudo systemctl enable nginx
```

## 📁 Step 3: Deploy Application

### Create Application Directory
```bash
sudo mkdir -p /var/www/daive-production
sudo chown $USER:$USER /var/www/daive-production
```

### Upload Application Files
```bash
# From your local machine
rsync -avz --delete dist/ your-username@your-server-ip:/var/www/daive-production/

# Or manually upload the 'dist' folder contents
```

### Install Dependencies on Server
```bash
cd /var/www/daive-production
npm ci --only=production
```

### Create Required Directories
```bash
mkdir -p logs uploads/daive-audio
chmod 755 uploads uploads/daive-audio
chmod 644 logs
```

## ⚙️ Step 4: Environment Configuration

### Create Production Environment File
```bash
nano .env.production
```

Add the following content:
```env
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://daive_user:your_secure_password@localhost:5432/daive_production
JWT_SECRET=your_super_secure_jwt_secret_key_here
SESSION_SECRET=your_super_secure_session_secret_key_here
FRONTEND_URL=https://yourdomain.com
```

### Set API Keys
```bash
# Set your actual API keys
export OPENAI_API_KEY="your-openai-api-key"
export ELEVENLABS_API_KEY="your-elevenlabs-api-key"
export DEEPGRAM_API_KEY="your-deepgram-api-key"
```

## 🚀 Step 5: Start Application with PM2

### Start the Application
```bash
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup
```

### Verify Application Status
```bash
pm2 status
pm2 logs daive-backend
```

## 🌐 Step 6: Configure Nginx Reverse Proxy

### Create Nginx Configuration
```bash
sudo nano /etc/nginx/sites-available/daive-production
```

Add the following configuration:
```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    location / {
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

    # Serve static files
    location /uploads/ {
        alias /var/www/daive-production/uploads/;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
```

### Enable the Site
```bash
sudo ln -s /etc/nginx/sites-available/daive-production /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## 🔒 Step 7: SSL Configuration (HTTPS)

### Install Certbot
```bash
# Ubuntu/Debian
sudo apt install certbot python3-certbot-nginx

# CentOS/RHEL
sudo yum install certbot python3-certbot-nginx
```

### Obtain SSL Certificate
```bash
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

### Auto-renewal
```bash
sudo crontab -e
# Add this line for auto-renewal
0 12 * * * /usr/bin/certbot renew --quiet
```

## 📊 Step 8: Monitoring and Maintenance

### PM2 Monitoring
```bash
# View application status
pm2 status

# Monitor resources
pm2 monit

# View logs
pm2 logs daive-backend

# Restart application
pm2 restart daive-backend
```

### Database Backup
```bash
# Create backup script
nano backup-database.sh
```

Add content:
```bash
#!/bin/bash
BACKUP_DIR="/var/backups/daive"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/daive_backup_$DATE.sql"

mkdir -p $BACKUP_DIR
pg_dump $DATABASE_URL > $BACKUP_FILE
gzip $BACKUP_FILE

# Keep only last 7 days of backups
find $BACKUP_DIR -name "*.sql.gz" -mtime +7 -delete
```

### Log Rotation
```bash
# Configure logrotate
sudo nano /etc/logrotate.d/daive-production
```

Add content:
```
/var/www/daive-production/logs/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 daive daive
    postrotate
        pm2 reloadLogs
    endscript
}
```

## 🔄 Step 9: Deployment Updates

### Update Application
```bash
# Pull latest changes
git pull origin main

# Build and deploy
npm run deploy:build

# Restart application
pm2 restart daive-backend
```

### Rollback (if needed)
```bash
# Stop current version
pm2 stop daive-backend

# Restore from backup
cp -r /var/www/daive-production-backup/* /var/www/daive-production/

# Restart
pm2 start ecosystem.config.js --env production
```

## 🧪 Step 10: Testing

### Health Check
```bash
# Test API endpoint
curl -f http://localhost:3000/api/daive/crew-ai-settings?dealerId=test

# Test from external
curl -f https://yourdomain.com/api/daive/crew-ai-settings?dealerId=test
```

### Performance Testing
```bash
# Install Apache Bench
sudo apt install apache2-utils

# Test performance
ab -n 1000 -c 10 https://yourdomain.com/api/daive/crew-ai-settings?dealerId=test
```

## 📝 Troubleshooting

### Common Issues

#### Application Won't Start
```bash
# Check logs
pm2 logs daive-backend

# Check environment variables
echo $NODE_ENV
echo $DATABASE_URL

# Check database connection
psql $DATABASE_URL -c "SELECT 1"
```

#### Nginx Issues
```bash
# Check Nginx status
sudo systemctl status nginx

# Check configuration
sudo nginx -t

# Check error logs
sudo tail -f /var/log/nginx/error.log
```

#### Database Issues
```bash
# Check PostgreSQL status
sudo systemctl status postgresql

# Check connection
sudo -u postgres psql -d daive_production -c "SELECT 1"
```

## 🎯 Quick Deployment Commands

### One-liner deployment (after initial setup)
```bash
# Local build
npm run deploy:build

# Server deployment
rsync -avz --delete dist/ user@server:/var/www/daive-production/ && \
ssh user@server "cd /var/www/daive-production && npm ci --only=production && pm2 restart daive-backend"
```

### Health monitoring
```bash
# Check all services
pm2 status && sudo systemctl status nginx postgresql

# Quick health check
curl -f https://yourdomain.com/api/daive/crew-ai-settings?dealerId=test
```

## 🎉 Congratulations!

Your DAIVE application is now running in production! 

### Next Steps:
1. **Set up monitoring** (UptimeRobot, Pingdom)
2. **Configure backups** (automated database backups)
3. **Set up alerts** (email/SMS notifications)
4. **Performance optimization** (CDN, caching)
5. **Security hardening** (firewall, fail2ban)

### Support:
- **PM2 Documentation**: https://pm2.keymetrics.io/
- **Nginx Documentation**: https://nginx.org/en/docs/
- **PostgreSQL Documentation**: https://www.postgresql.org/docs/

---

**Remember**: Always test in staging before deploying to production!
