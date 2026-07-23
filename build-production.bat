@echo off
echo 🚀 Building DAIVE Application for Production...

REM Check if Node.js is installed
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ Node.js is not installed. Please install Node.js first.
    pause
    exit /b 1
)

REM Check if npm is installed
where npm >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ npm is not installed. Please install npm first.
    pause
    exit /b 1
)

echo ✅ Node.js and npm found

REM Clean previous build
if exist dist (
    echo 🗑️ Cleaning previous build...
    rmdir /s /q dist
)

REM Install production dependencies
echo 📦 Installing production dependencies...
call npm ci --only=production
if %errorlevel% neq 0 (
    echo ❌ Failed to install dependencies
    pause
    exit /b 1
)

REM Build frontend
echo 🔨 Building frontend...
call npm run build:frontend
if %errorlevel% neq 0 (
    echo ❌ Frontend build failed
    pause
    exit /b 1
)

REM Create production bundle
echo 📁 Creating production bundle...
mkdir dist
xcopy /E /I /Y src dist\src
copy package*.json dist\
copy ecosystem.config.js dist\
if exist uploads xcopy /E /I /Y uploads dist\uploads

REM Create production package.json
echo 📝 Creating production package.json...
copy package.production.json dist\package.json

echo.
echo 🎉 Production build completed successfully!
echo.
echo 📁 Build output is in the 'dist' folder
echo 📋 Next steps:
echo    1. Upload the 'dist' folder to your production server
echo    2. Follow the deployment guide in PRODUCTION_DEPLOYMENT.md
echo    3. Configure environment variables on your server
echo    4. Start the application with PM2
echo.
echo 📖 For detailed deployment instructions, see: PRODUCTION_DEPLOYMENT.md
echo.
pause
