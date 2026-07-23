# 🌐 Public Server Deployment Setup

## 🖥️ Server Requirements

### **Minimum Server Specifications**
- **CPU**: 2+ cores (4+ recommended)
- **RAM**: 4GB minimum (8GB recommended)
- **Storage**: 50GB SSD minimum
- **OS**: Ubuntu 20.04+ / CentOS 8+ / Debian 11+
- **Network**: Public IP with ports 80/443 open

### **Recommended Cloud Providers**
- **AWS EC2**: t3.medium or larger
- **DigitalOcean**: Basic Droplet ($12/month)
- **Linode**: Nanode ($5/month)
- **Vultr**: Cloud Compute ($6/month)
- **Google Cloud**: e2-medium

## 🚀 Deployment Options

### **Option 1: Traditional VPS Deployment**
```bash
# Server setup commands
sudo apt update && sudo apt upgrade -y
sudo apt install -y nginx postgresql nodejs npm git
sudo systemctl enable nginx postgresql
```

### **Option 2: Docker Deployment**
```dockerfile
# Dockerfile for the application
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

### **Option 3: PM2 + Nginx Reverse Proxy**
```bash
# Install PM2 globally
npm install -g pm2

# Start application with PM2
pm2 start ecosystem.config.js --env production
pm2 startup
pm2 save
```

## 🔧 Server Configuration

### **1. Domain & SSL Setup**
```bash
# Install Certbot for SSL
sudo apt install -y certbot python3-certbot-nginx

# Get SSL certificate
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Auto-renewal
sudo crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet
```

### **2. Nginx Configuration**
```nginx
# /etc/nginx/sites-available/vehicle-management
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;
    
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
}
```

### **3. Database Setup**
```bash
# PostgreSQL installation
sudo apt install -y postgresql postgresql-contrib

# Create database and user
sudo -u postgres psql
CREATE DATABASE vehicle_management;
CREATE USER vehicle_user WITH PASSWORD 'strong_password_here';
GRANT ALL PRIVILEGES ON DATABASE vehicle_management TO vehicle_user;
\q

# Configure PostgreSQL for remote access
sudo nano /etc/postgresql/*/main/postgresql.conf
# Change: listen_addresses = '*'

sudo nano /etc/postgresql/*/main/pg_hba.conf
# Add: host all all 0.0.0.0/0 md5
```

## 🔐 Environment Configuration

### **Production Environment File**
```env
# .env.production
NODE_ENV=production
PORT=3000

# Database
DATABASE_URL=postgresql://vehicle_user:strong_password_here@localhost:5432/vehicle_management

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
```

## 🚀 Deployment Scripts

### **Deploy Script**
```bash
#!/bin/bash
# deploy.sh

echo "🚀 Deploying Vehicle Management System..."

# Pull latest changes
git pull origin main

# Install dependencies
npm install

# Build frontend
npm run build

# Restart services
pm2 restart all

# Reload nginx
sudo systemctl reload nginx

echo "✅ Deployment complete!"
echo "🌐 Frontend: https://yourdomain.com"
echo "🔧 Backend: https://yourdomain.com/api"
```

### **Server Setup Script**
```bash
#!/bin/bash
# server-setup.sh

echo "🖥️ Setting up server for Vehicle Management System..."

# Update system
sudo apt update && sudo apt upgrade -y

# Install required packages
sudo apt install -y nginx postgresql nodejs npm git curl

# Install Node.js 18+ (if not available)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2
sudo npm install -g pm2

# Setup firewall
sudo ufw allow 22
sudo ufw allow 80
sudo ufw allow 443
sudo ufw --force enable

# Setup nginx
sudo systemctl enable nginx
sudo systemctl start nginx

# Setup PostgreSQL
sudo systemctl enable postgresql
sudo systemctl start postgresql

echo "✅ Server setup complete!"
echo "🔧 Next steps:"
echo "1. Configure domain DNS"
echo "2. Setup SSL certificate"
echo "3. Configure nginx"
echo "4. Setup database"
echo "5. Deploy application"
```

## 📋 Deployment Checklist

### **Pre-Deployment**
- [ ] Domain name purchased and configured
- [ ] Server provisioned with public IP
- [ ] DNS records pointing to server IP
- [ ] SSH access configured
- [ ] Firewall rules configured

### **Server Setup**
- [ ] System updated and secured
- [ ] Nginx installed and configured
- [ ] PostgreSQL installed and configured
- [ ] Node.js 18+ installed
- [ ] PM2 installed globally
- [ ] SSL certificate obtained

### **Application Deployment**
- [ ] Code deployed to server
- [ ] Environment variables configured
- [ ] Database migrations run
- [ ] Frontend built and deployed
- [ ] Backend started with PM2
- [ ] Nginx reverse proxy configured

### **Testing & Verification**
- [ ] Frontend accessible via HTTPS
- [ ] Backend API responding
- [ ] Database connections working
- [ ] SSL certificate valid
- [ ] All features functional
- [ ] Performance acceptable

## 🔍 Monitoring & Maintenance

### **PM2 Monitoring**
```bash
# Monitor processes
pm2 monit

# View logs
pm2 logs

# Check status
pm2 status

# Restart services
pm2 restart all
```

### **Nginx Monitoring**
```bash
# Check nginx status
sudo systemctl status nginx

# View nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# Test nginx configuration
sudo nginx -t
```

### **Database Monitoring**
```bash
# Check PostgreSQL status
sudo systemctl status postgresql

# Monitor database connections
sudo -u postgres psql -c "SELECT * FROM pg_stat_activity;"

# Check database size
sudo -u postgres psql -c "SELECT pg_size_pretty(pg_database_size('vehicle_management'));"
```

## 🚨 Security Considerations

### **Essential Security Measures**
1. **Firewall**: Only allow necessary ports (22, 80, 443)
2. **SSH**: Use key-based authentication, disable root login
3. **Updates**: Regular system updates and security patches
4. **SSL**: Force HTTPS, use strong SSL configuration
5. **Database**: Strong passwords, limited network access
6. **Environment**: Secure environment variables, no secrets in code
7. **Monitoring**: Log monitoring, intrusion detection

### **Rate Limiting**
```nginx
# Add to nginx configuration
http {
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    
    server {
        location /api {
            limit_req zone=api burst=20 nodelay;
            # ... other proxy settings
        }
    }
}
```

## 📞 Support & Troubleshooting

### **Common Issues**
1. **Port conflicts**: Check if ports 80/443 are available
2. **SSL errors**: Verify domain DNS and certificate validity
3. **Database connection**: Check PostgreSQL status and credentials
4. **Permission errors**: Ensure proper file ownership and permissions
5. **Memory issues**: Monitor server resources and optimize

### **Useful Commands**
```bash
# Check server resources
htop
free -h
df -h

# Check service status
sudo systemctl status nginx postgresql

# View recent logs
sudo journalctl -u nginx -f
sudo journalctl -u postgresql -f

# Check open ports
sudo netstat -tlnp
sudo ss -tlnp
```

## 🎯 Next Steps

1. **Choose deployment option** (VPS, Docker, Cloud)
2. **Provision server** with required specifications
3. **Configure domain** and DNS records
4. **Run server setup script** to install dependencies
5. **Deploy application** using provided scripts
6. **Configure SSL** certificate for HTTPS
7. **Test all functionality** in production environment
8. **Set up monitoring** and alerting
9. **Configure backups** for database and files
10. **Document deployment** process for team

---

**Need help?** Check the logs, verify configuration files, and ensure all services are running properly.
