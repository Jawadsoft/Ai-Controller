#!/bin/bash

# 🚀 Render.com Deployment Script
# This script helps prepare your project for deployment on Render.com

echo "🚀 Preparing Vehicle Management System for Render.com deployment..."

# Check if git is initialized
if [ ! -d ".git" ]; then
    echo "❌ Git repository not found. Please initialize git first:"
    echo "   git init"
    echo "   git add ."
    echo "   git commit -m 'Initial commit'"
    exit 1
fi

# Check if remote origin is set
if ! git remote get-url origin > /dev/null 2>&1; then
    echo "❌ Git remote origin not set. Please add your repository:"
    echo "   git remote add origin <your-repo-url>"
    exit 1
fi

# Check if all required files exist
echo "🔍 Checking required deployment files..."

required_files=("render.yaml" "Dockerfile" ".dockerignore" "package.json" "src/server.js")
missing_files=()

for file in "${required_files[@]}"; do
    if [ ! -f "$file" ]; then
        missing_files+=("$file")
    fi
done

if [ ${#missing_files[@]} -ne 0 ]; then
    echo "❌ Missing required files:"
    for file in "${missing_files[@]}"; do
        echo "   - $file"
    done
    exit 1
fi

echo "✅ All required files found!"

# Check if health route exists
if ! grep -q "healthRoutes" "src/server.js"; then
    echo "⚠️  Health route not found in server.js. Please add it manually."
fi

# Check environment variables
echo "🔧 Checking environment configuration..."

if [ ! -f ".env" ] && [ ! -f "env.example" ]; then
    echo "⚠️  No environment file found. Please create .env or check env.example"
fi

# Build the project to check for errors
echo "🔨 Building project to check for errors..."

if npm run build:production; then
    echo "✅ Build successful!"
else
    echo "❌ Build failed! Please fix the errors before deploying."
    exit 1
fi

# Check git status
echo "📊 Checking git status..."

if [ -n "$(git status --porcelain)" ]; then
    echo "⚠️  You have uncommitted changes. Consider committing them:"
    git status --short
    echo ""
    read -p "Do you want to commit these changes? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        git add .
        git commit -m "Prepare for Render.com deployment"
        echo "✅ Changes committed!"
    fi
fi

# Push to remote
echo "🚀 Pushing to remote repository..."

if git push origin main; then
    echo "✅ Code pushed successfully!"
else
    echo "❌ Failed to push code. Please check your git configuration."
    exit 1
fi

echo ""
echo "🎉 Your project is ready for Render.com deployment!"
echo ""
echo "📋 Next steps:"
echo "1. Go to [render.com](https://render.com) and sign in"
echo "2. Click 'New +' and select 'Blueprint'"
echo "3. Connect your Git repository"
echo "4. Render will automatically detect render.yaml and deploy your services"
echo ""
echo "🔧 Don't forget to set environment variables in Render.com dashboard:"
echo "   - DATABASE_URL"
echo "   - JWT_SECRET"
echo "   - OPENAI_API_KEY (if using AI features)"
echo "   - DEEPGRAM_API_KEY (if using voice features)"
echo ""
echo "📖 For detailed instructions, see: RENDER_DEPLOYMENT_GUIDE.md"
echo ""
echo "🚗 Your CrewAI-powered car dealership system will be live soon!"
