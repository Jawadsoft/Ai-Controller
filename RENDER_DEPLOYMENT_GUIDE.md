# 🚀 Render.com Deployment Guide

This guide will walk you through deploying your Vehicle Management System on Render.com.

## 📋 Prerequisites

- A Render.com account
- Your project code pushed to a Git repository (GitHub, GitLab, or Bitbucket)
- API keys for OpenAI and Deepgram (if using AI features)

## 🏗️ Project Structure

Your project will be deployed as three separate services on Render.com:

1. **Backend API Service** - Node.js Express server
2. **Frontend Service** - React static site
3. **PostgreSQL Database** - Managed database service

## 🚀 Step-by-Step Deployment

### 1. Prepare Your Repository

Ensure your repository contains these files:
- `render.yaml` - Service configuration
- `Dockerfile` - Container configuration
- `package.json` - Dependencies and scripts
- `src/server.js` - Backend server
- `src/` - Frontend source code

### 2. Connect to Render.com

1. Go to [render.com](https://render.com) and sign in
2. Click "New +" and select "Blueprint"
3. Connect your Git repository
4. Render will automatically detect the `render.yaml` file

### 3. Configure Environment Variables

In your Render.com dashboard, set these environment variables for the backend service:

#### Required Variables:
```
DATABASE_URL=postgresql://username:password@host:port/database
JWT_SECRET=your-super-secret-jwt-key-here
NODE_ENV=production
PORT=10000
```

#### Optional Variables (if using AI features):
```
OPENAI_API_KEY=your-openai-api-key-here
DEEPGRAM_API_KEY=your-deepgram-api-key-here
```

#### Frontend/Backend URLs:
```
FRONTEND_URL=https://your-frontend-service.onrender.com
BACKEND_URL=https://your-backend-service.onrender.com
```

### 4. Deploy Services

Render will automatically:
1. Build your backend service using the Dockerfile
2. Build your frontend service using Vite
3. Provision a PostgreSQL database
4. Deploy all services

### 5. Verify Deployment

Check each service:
- **Backend**: Visit `/api/health` endpoint
- **Frontend**: Visit the frontend service URL
- **Database**: Check connection in backend logs

## 🔧 Service Configuration Details

### Backend Service
- **Type**: Web Service
- **Environment**: Node.js
- **Build Command**: `npm install && npm run build:backend`
- **Start Command**: `npm start`
- **Port**: 10000
- **Health Check**: `/api/health`

### Frontend Service
- **Type**: Static Site
- **Build Command**: `npm install && npm run build`
- **Publish Directory**: `./dist`
- **Environment Variables**: `VITE_API_BASE_URL`

### Database Service
- **Type**: PostgreSQL
- **Plan**: Starter (free tier)
- **Auto-deploy**: Enabled

## 🌐 URLs and Endpoints

After deployment, you'll have:

- **Frontend**: `https://vehicle-management-frontend.onrender.com`
- **Backend API**: `https://vehicle-management-backend.onrender.com`
- **Health Check**: `https://vehicle-management-backend.onrender.com/api/health`
- **API Base**: `https://vehicle-management-backend.onrender.com/api`

## 🔍 Monitoring and Debugging

### Health Checks
- Basic health: `/api/health`
- Detailed health: `/api/health/detailed`

### Logs
- View logs in Render.com dashboard
- Check build logs for any errors
- Monitor service health status

### Common Issues
1. **Build Failures**: Check Node.js version compatibility
2. **Database Connection**: Verify DATABASE_URL format
3. **CORS Issues**: Check FRONTEND_URL configuration
4. **API Key Errors**: Verify environment variables

## 🔄 Continuous Deployment

- **Auto-deploy**: Enabled by default
- **Manual Deploy**: Available in dashboard
- **Rollback**: Previous deployments can be restored

## 💰 Cost Considerations

- **Free Tier**: Includes starter plans for all services
- **Database**: 1GB storage, 90 days retention
- **Bandwidth**: 750GB/month included
- **Upgrades**: Available for higher limits

## 🛠️ Customization

### Environment-Specific Configs
- Modify `render.yaml` for different environments
- Use environment variables for configuration
- Adjust build commands as needed

### Scaling
- Upgrade service plans for higher performance
- Add more instances for load balancing
- Configure auto-scaling rules

## 📞 Support

- **Render Documentation**: [docs.render.com](https://docs.render.com)
- **Community**: [community.render.com](https://community.render.com)
- **Status Page**: [status.render.com](https://status.render.com)

## ✅ Deployment Checklist

- [ ] Repository connected to Render.com
- [ ] Environment variables configured
- [ ] Services building successfully
- [ ] Health checks passing
- [ ] Frontend accessible
- [ ] API endpoints responding
- [ ] Database connected
- [ ] SSL certificates active

## 🎉 Success!

Once deployed, your Vehicle Management System will be available at:
- **Frontend**: `https://vehicle-management-frontend.onrender.com`
- **Backend API**: `https://vehicle-management-backend.onrender.com`

Your CrewAI-powered car dealership system is now live on the internet! 🚗✨
