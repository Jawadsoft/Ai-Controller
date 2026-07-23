@echo off
chcp 65001 >nul
echo 🚀 Preparing Vehicle Management System for Render.com deployment...

REM Check if git is initialized
if not exist ".git" (
    echo ❌ Git repository not found. Please initialize git first:
    echo    git init
    echo    git add .
    echo    git commit -m "Initial commit"
    pause
    exit /b 1
)

REM Check if remote origin is set
git remote get-url origin >nul 2>&1
if errorlevel 1 (
    echo ❌ Git remote origin not set. Please add your repository:
    echo    git remote add origin ^<your-repo-url^>
    pause
    exit /b 1
)

REM Check if all required files exist
echo 🔍 Checking required deployment files...

set "missing_files="
if not exist "render.yaml" set "missing_files=1"
if not exist "Dockerfile" set "missing_files=1"
if not exist ".dockerignore" set "missing_files=1"
if not exist "package.json" set "missing_files=1"
if not exist "src\server.js" set "missing_files=1"

if defined missing_files (
    echo ❌ Missing required files:
    if not exist "render.yaml" echo    - render.yaml
    if not exist "Dockerfile" echo    - Dockerfile
    if not exist ".dockerignore" echo    - .dockerignore
    if not exist "package.json" echo    - package.json
    if not exist "src\server.js" echo    - src\server.js
    pause
    exit /b 1
)

echo ✅ All required files found!

REM Check if health route exists
findstr /C:"healthRoutes" "src\server.js" >nul 2>&1
if errorlevel 1 (
    echo ⚠️  Health route not found in server.js. Please add it manually.
)

REM Check environment variables
echo 🔧 Checking environment configuration...

if not exist ".env" (
    if not exist "env.example" (
        echo ⚠️  No environment file found. Please create .env or check env.example
    )
)

REM Build the project to check for errors
echo 🔨 Building project to check for errors...

call npm run build:production
if errorlevel 1 (
    echo ❌ Build failed! Please fix the errors before deploying.
    pause
    exit /b 1
)
echo ✅ Build successful!

REM Check git status
echo 📊 Checking git status...

git status --porcelain >nul 2>&1
if not errorlevel 1 (
    echo ⚠️  You have uncommitted changes. Consider committing them:
    git status --short
    echo.
    set /p "commit_changes=Do you want to commit these changes? (y/n): "
    if /i "%commit_changes%"=="y" (
        git add .
        git commit -m "Prepare for Render.com deployment"
        echo ✅ Changes committed!
    )
)

REM Push to remote
echo 🚀 Pushing to remote repository...

git push origin main
if errorlevel 1 (
    echo ❌ Failed to push code. Please check your git configuration.
    pause
    exit /b 1
)
echo ✅ Code pushed successfully!

echo.
echo 🎉 Your project is ready for Render.com deployment!
echo.
echo 📋 Next steps:
echo 1. Go to https://render.com and sign in
echo 2. Click "New +" and select "Blueprint"
echo 3. Connect your Git repository
echo 4. Render will automatically detect render.yaml and deploy your services
echo.
echo 🔧 Don't forget to set environment variables in Render.com dashboard:
echo    - DATABASE_URL
echo    - JWT_SECRET
echo    - OPENAI_API_KEY (if using AI features)
echo    - DEEPGRAM_API_KEY (if using voice features)
echo.
echo 📖 For detailed instructions, see: RENDER_DEPLOYMENT_GUIDE.md
echo.
echo 🚗 Your CrewAI-powered car dealership system will be live soon!
pause
