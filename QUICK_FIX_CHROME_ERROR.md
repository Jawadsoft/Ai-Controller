# Quick Fix: Chrome Not Found Error on Render

## ❌ Current Error
```
Could not find Chrome (ver. 131.0.6778.204)
```

## ✅ Quick Fix (3 Steps)

### Step 1: Set Environment Variables in Render

Go to your Render dashboard → Service → **Environment** tab

Add these 3 variables:

```
NODE_ENV = production
PUPPETEER_SKIP_CHROMIUM_DOWNLOAD = true
PUPPETEER_EXECUTABLE_PATH = /usr/bin/google-chrome-stable
```

### Step 2: Update Build Command

In Render dashboard → **Settings** → Build & Deploy

Change **Build Command** to:
```
./render-build.sh
```

### Step 3: Commit and Deploy

```bash
# Make build script executable (run once locally)
chmod +x render-build.sh

# Commit the new files
git add .
git commit -m "Add Chrome support for Render deployment"
git push origin main
```

Render will automatically rebuild with Chrome installed!

---

## 🧪 Test After Deployment

Try analyzing a website again. You should now get:

```json
{
  "success": true,
  "data": {
    "categoriesFound": ["about", "services", "hours"],
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

## 📁 Files I Created

1. ✅ `.puppeteerrc.cjs` - Puppeteer configuration
2. ✅ `render-build.sh` - Build script that installs Chrome
3. ✅ `render.yaml` - Render service configuration
4. ✅ Updated `websiteScrapingService.js` - Chrome path detection

---

## 🔍 How It Works

**Before**:
- Puppeteer tries to use bundled Chrome
- Render doesn't have Chrome installed
- Scraping fails ❌

**After**:
- Build script installs Chrome on Render
- Code uses system Chrome (`/usr/bin/google-chrome-stable`)
- Scraping works! ✅

---

## ⚠️ Important Notes

### Memory Requirements:
Chrome needs at least **512 MB RAM**. 

- Render Starter plan (512MB): Might work, but tight
- Render Standard (2GB): Comfortable ✅
- Render Pro (4GB+): Ideal ✅

### If You Get Out of Memory:
Add these args in `websiteScrapingService.js` (already added):
```javascript
'--single-process',
'--no-zygote',
'--disable-dev-shm-usage'
```

---

## 🚨 Troubleshooting

### Still getting error after deploy?

**Check build logs**:
1. Go to Render dashboard
2. Click on your service
3. Go to "Logs" tab
4. Look for: `✅ Verifying Chrome installation...`
5. Should show Chrome version

**If Chrome not installed**:
- Build command might not be set correctly
- Check: Settings → Build Command = `./render-build.sh`
- Try manual redeploy

### Browser crashes?

Upgrade to larger Render plan (more RAM needed).

---

## ✅ Success Indicators

You'll know it's working when:

1. ✅ Build logs show: `✅ Chrome is ready at /usr/bin/google-chrome-stable`
2. ✅ No "Could not find Chrome" errors
3. ✅ Scraping endpoint returns `success: true`
4. ✅ Profile fields auto-update from website

---

## 🎯 What to Do Now

1. **Set environment variables** in Render (Step 1)
2. **Update build command** in Render (Step 2)
3. **Commit and push** code (Step 3)
4. **Wait for rebuild** (~5-10 minutes)
5. **Test scraping** feature
6. **Done!** ✅

---

**Need Help?** See `RENDER_CHROME_SETUP.md` for detailed instructions and alternative solutions.
