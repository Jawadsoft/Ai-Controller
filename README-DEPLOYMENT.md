# 🚀 Quick Deploy to Render.com

Deploy your Vehicle Management System to Render.com in minutes!

## ⚡ Quick Start

### Option 1: Automated Script (Recommended)
```bash
# Linux/Mac
chmod +x deploy-render.sh
./deploy-render.sh

# Windows
deploy-render.bat
```

### Option 2: Manual Steps
1. **Push your code** to a Git repository
2. **Go to [render.com](https://render.com)** and sign in
3. **Click "New +" → "Blueprint"**
4. **Connect your repository**
5. **Render auto-detects** your `render.yaml` configuration
6. **Set environment variables** in the dashboard
7. **Deploy!** 🎉

## 🔧 Required Environment Variables

Set these in your Render.com dashboard:

```
DATABASE_URL=postgresql://username:password@host:port/database
JWT_SECRET=your-super-secret-jwt-key-here
OPENAI_API_KEY=your-openai-api-key-here
DEEPGRAM_API_KEY=your-deepgram-api-key-here
```

## 📁 Deployment Files

- `render.yaml` - Service configuration
- `Dockerfile` - Container setup
- `.dockerignore` - Build optimization
- `src/routes/health.js` - Health monitoring

## 🌐 After Deployment

Your services will be available at:
- **Frontend**: `https://vehicle-management-frontend.onrender.com`
- **Backend**: `https://vehicle-management-backend.onrender.com`
- **Health Check**: `/api/health`

## 📖 Full Guide

See `RENDER_DEPLOYMENT_GUIDE.md` for detailed instructions.

## 🆘 Need Help?

- Check the health endpoint: `/api/health/detailed`
- View logs in Render.com dashboard
- See common issues in the deployment guide

---

**Your CrewAI-powered car dealership system will be live on the internet! 🚗✨**
