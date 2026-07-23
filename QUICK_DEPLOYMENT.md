# 🚀 Quick Public Server Deployment

## ⚡ Fast Setup (5 minutes)

### **Option 1: Docker (Recommended for beginners)**

```bash
# 1. Install Docker and Docker Compose
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
sudo systemctl enable docker
sudo systemctl start docker

# 2. Clone your project
git clone <your-repo-url>
cd vehicle-management

# 3. Create environment file
cp .env.example .env.production
# Edit .env.production with your actual values

# 4. Deploy
docker-compose up -d

# 5. Check status
docker-compose ps
```

### **Option 2: Traditional VPS**

```bash
# 1. SSH to your server
ssh root@your-server-ip

# 2. Run setup script
curl -fsSL https://raw.githubusercontent.com/your-repo/main/server-setup.sh | bash

# 3. Copy your code
scp -r . user@your-server:/var/www/vehicle-management/

# 4. Deploy
cd /var/www/vehicle-management
./deploy.sh
```

## 🌐 Domain Setup

### **DNS Configuration**
```
Type: A
Name: @
Value: your-server-ip

Type: A  
Name: www
Value: your-server-ip
```

### **SSL Certificate**
```bash
# Automatic SSL with Let's Encrypt
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Auto-renewal
sudo crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet
```

## 🔑 Environment Variables

Create `.env.production` file:

```env
NODE_ENV=production
PORT=3000

# Database
DATABASE_URL=postgresql://vehicle_user:your_password@localhost:5432/vehicle_management

# Security
JWT_SECRET=your-64-character-secret-here
SESSION_SECRET=your-64-character-secret-here

# URLs
FRONTEND_URL=https://yourdomain.com
BACKEND_URL=https://yourdomain.com

# API Keys
OPENAI_API_KEY=sk-your-openai-key
DEEPGRAM_API_KEY=your-deepgram-key
ELEVENLABS_API_KEY=your-elevenlabs-key

# Security
CORS_ORIGIN=https://yourdomain.com
FORCE_HTTPS=true
```

## 📊 Monitoring

### **Check Status**
```bash
# Docker
docker-compose ps
docker-compose logs -f

# Traditional
pm2 status
pm2 monit
systemctl status nginx postgresql
```

### **View Logs**
```bash
# Application logs
pm2 logs

# Nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# Database logs
sudo journalctl -u postgresql -f
```

## 🚨 Common Issues

### **Port 80/443 blocked**
```bash
# Check firewall
sudo ufw status
sudo ufw allow 80
sudo ufw allow 443
```

### **Database connection failed**
```bash
# Check PostgreSQL
sudo systemctl status postgresql
sudo -u postgres psql -c "SELECT version();"
```

### **SSL certificate issues**
```bash
# Check domain DNS
nslookup yourdomain.com

# Renew certificate
sudo certbot renew --dry-run
```

## 🔄 Updates

### **Docker**
```bash
git pull
docker-compose down
docker-compose up -d --build
```

### **Traditional**
```bash
git pull
npm install
npm run build
pm2 restart all
sudo systemctl reload nginx
```

## 📞 Support

- **Logs**: Check application and system logs
- **Status**: Verify all services are running
- **Network**: Ensure ports are open and accessible
- **DNS**: Confirm domain points to correct IP
- **SSL**: Verify certificate is valid and not expired

---

**Need help?** Check the full `PUBLIC_SERVER_SETUP.md` for detailed instructions.
