# Fix Puppeteer Chrome Error on Render

## ❌ Error You're Seeing

```
Could not find Chrome (ver. 131.0.6778.204)
Cache path: /opt/render/.cache/puppeteer
```

This happens because Puppeteer needs Chrome/Chromium browser, which isn't installed on Render by default.

---

## ✅ Solutions (Choose One)

### Solution 1: Use Render's Chrome Buildpack (Recommended)

This is the easiest method for Render deployments.

#### Step 1: Add Environment Variables

In your Render dashboard:

1. Go to your service → **Environment**
2. Add these variables:

```
PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable
NODE_ENV=production
```

#### Step 2: Create `render-build.sh`

Create this file in your project root:

```bash
#!/usr/bin/env bash
# render-build.sh

echo "📦 Installing Chrome dependencies..."

# Install Chrome
apt-get update
apt-get install -y wget gnupg
wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add -
echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google-chrome.list
apt-get update
apt-get install -y google-chrome-stable

# Verify Chrome installation
google-chrome-stable --version

# Install npm dependencies
echo "📦 Installing npm packages..."
npm install

# Build frontend
echo "🔨 Building frontend..."
npm run build

echo "✅ Build complete!"
```

#### Step 3: Make it executable

```bash
chmod +x render-build.sh
```

#### Step 4: Update Render Build Command

In Render dashboard → **Settings** → **Build Command**:

```
./render-build.sh
```

---

### Solution 2: Use Dockerfile (Alternative)

Create a `Dockerfile` in project root:

```dockerfile
FROM node:18-bullseye

# Install Chrome
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    ca-certificates \
    && wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google-chrome.list' \
    && apt-get update \
    && apt-get install -y google-chrome-stable fonts-liberation \
    && rm -rf /var/lib/apt/lists/*

# Set Chrome path
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy project files
COPY . .

# Build frontend
RUN npm run build

# Expose port
EXPOSE 3000

# Start server
CMD ["npm", "start"]
```

Then in Render:
1. Select **Docker** as environment
2. It will automatically use the Dockerfile

---

### Solution 3: Use Puppeteer-Extra with Stealth (Lightweight)

If Chrome installation is too heavy, use a lighter approach:

#### Install alternative package:

```bash
npm uninstall puppeteer
npm install puppeteer-core chromium
```

#### Update `websiteScrapingService.js`:

```javascript
import chromium from 'chromium';
import puppeteer from 'puppeteer-core';

// In launch options:
browser = await puppeteer.launch({
  executablePath: chromium.path,
  headless: true,
  args: [/* ... */]
});
```

---

### Solution 4: Use External Scraping Service (Production-Ready)

For production, consider using a managed service:

#### Option A: ScrapingBee / ScraperAPI
- Handles browser management
- No Chrome needed on your server
- Paid service but reliable

#### Option B: Browserless.io
- Managed Chrome instances
- REST API for scraping
- Free tier available

---

## 🔧 Quick Fix for Your Current Error

### Immediate Fix (Use System Chrome if Available):

Your code is already updated to handle this! Just need to:

1. **Set environment variable** in Render:
   ```
   PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable
   ```

2. **Install Chrome** using one of the methods above

3. **Redeploy** your service

---

## 📋 Step-by-Step: Render Deployment

### Complete Setup Process:

1. **Create `render-build.sh`** (see Solution 1)

2. **Add to your `package.json`**:
   ```json
   {
     "scripts": {
       "render-build": "./render-build.sh"
     }
   }
   ```

3. **In Render Dashboard**:
   - Build Command: `./render-build.sh`
   - Start Command: `npm start`

4. **Add Environment Variables**:
   ```
   NODE_ENV=production
   PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
   PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable
   ```

5. **Commit and push** to trigger rebuild

---

## 🧪 Test After Deployment

### Test the Scraping Endpoint:

```bash
curl -X POST https://your-app.onrender.com/api/scraping/dealers/DEALER_ID/scrape \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

Expected response:
```json
{
  "success": true,
  "data": {
    "entriesStored": 15,
    "categoriesFound": ["about", "services", "hours"],
    "profileData": {...}
  }
}
```

---

## 🐛 Troubleshooting

### Issue: Chrome still not found

**Check**:
```bash
# In Render Shell
which google-chrome-stable
# Should output: /usr/bin/google-chrome-stable

google-chrome-stable --version
# Should show version number
```

**If not found**: Build didn't install Chrome properly
- Check build logs
- Ensure render-build.sh has execute permissions
- Try Dockerfile approach instead

### Issue: Chrome crashes on startup

**Solution**: Add more memory-saving args:

```javascript
args: [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
  '--disable-accelerated-2d-canvas',
  '--disable-gpu',
  '--single-process',  // Add this
  '--no-zygote'        // Add this
]
```

### Issue: Timeout errors

**Solution**: Increase timeout and add retry logic:

```javascript
timeout: 60000, // 60 seconds
navigationTimeout: 60000
```

---

## 💰 Resource Considerations

### Chrome Memory Usage:
- **Minimum**: 512 MB RAM
- **Recommended**: 1 GB+ RAM
- Each browser instance: ~100-200 MB

### Render Plans:
- **Starter**: 512 MB RAM (might be tight)
- **Standard**: 2 GB RAM (comfortable)
- **Pro**: 4 GB+ RAM (ideal for concurrent scraping)

**Tip**: Close browser instances immediately after use:

```javascript
finally {
  if (browser) {
    await browser.close();
  }
}
```

---

## 📦 Alternative: Render.yaml Configuration

Create `render.yaml` in root:

```yaml
services:
  - type: web
    name: dealerig-backend
    env: node
    plan: starter
    buildCommand: ./render-build.sh
    startCommand: npm start
    envVars:
      - key: NODE_ENV
        value: production
      - key: PUPPETEER_SKIP_CHROMIUM_DOWNLOAD
        value: "true"
      - key: PUPPETEER_EXECUTABLE_PATH
        value: /usr/bin/google-chrome-stable
```

---

## ✅ Verification Checklist

After deployment:

- [ ] Environment variables set in Render
- [ ] render-build.sh created and executable
- [ ] Build command updated in Render
- [ ] Chrome installed (check build logs)
- [ ] Service redeployed successfully
- [ ] Test scraping endpoint works
- [ ] No Chrome errors in logs
- [ ] Profile updates working

---

## 🎯 Expected Result

After implementing Solution 1:

```json
{
  "success": true,
  "data": {
    "dealerId": "9b11f1af-6bb3-442a-af23-7e5a7e75fb46",
    "dealerName": "Dealersync",
    "websiteUrl": "https://www.hilinemotorsinc.com/",
    "scrapedAt": "2026-08-07T10:03:17.235Z",
    "categoriesFound": ["about", "services", "hours", "contact"],
    "entriesStored": 15,
    "profileData": {
      "suggestions": {
        "description": "...",
        "established_year": 1995
      }
    }
  }
}
```

---

## 📚 Additional Resources

- [Puppeteer Troubleshooting](https://pptr.dev/troubleshooting)
- [Render Build Script Guide](https://render.com/docs/native-environments)
- [Chrome on Linux Servers](https://github.com/puppeteer/puppeteer/blob/main/docs/troubleshooting.md#running-puppeteer-on-heroku)

---

## 🚀 Quick Start (TL;DR)

```bash
# 1. Create build script
cat > render-build.sh << 'EOF'
#!/usr/bin/env bash
apt-get update && apt-get install -y wget gnupg
wget -qO- https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add -
echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google-chrome.list
apt-get update && apt-get install -y google-chrome-stable
npm install && npm run build
EOF

# 2. Make executable
chmod +x render-build.sh

# 3. Commit
git add render-build.sh render.yaml .puppeteerrc.cjs
git commit -m "Add Chrome support for Render"
git push

# 4. In Render Dashboard:
#    - Set Build Command: ./render-build.sh
#    - Add env vars (see above)
#    - Redeploy
```

Done! Chrome will be installed and scraping will work! ✅

---

**Last Updated**: August 7, 2026  
**Status**: Production-Ready Solution
