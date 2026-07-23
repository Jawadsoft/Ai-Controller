@echo off
echo 🚀 Starting Production Deployment...

REM Clean previous build
echo 🧹 Cleaning previous build...
if exist dist rmdir /s /q dist

REM Install dependencies
echo 📦 Installing dependencies...
call npm install

REM Build the application
echo 🔨 Building application...
call npm run build:production

REM Check if build was successful
if not exist dist (
    echo ❌ Build failed - dist folder not found
    pause
    exit /b 1
)

if not exist dist\server (
    echo ❌ Build failed - server folder not found in dist
    pause
    exit /b 1
)

echo ✅ Build completed successfully!
echo 📁 Build output:
echo    - Frontend: dist\
echo    - Backend: dist\server\
echo    - Server file: dist\server\server.js

REM Copy environment file if it exists
if exist .env (
    echo 🔐 Copying environment file...
    copy .env dist\server\
) else (
    echo ⚠️  No .env file found - please create one in dist\server\
)

echo.
echo 🚀 To start production server:
echo    cd dist\server
echo    npm install --production
echo    node server.js
echo.
echo    Or from root: npm run start:production
pause
