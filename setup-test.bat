@echo off
echo 🚀 Setting up CrewAI Test Suite...

REM Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js is not installed. Please install Node.js first.
    pause
    exit /b 1
)

echo ✅ Node.js version: 
node --version

REM Check if npm is installed
npm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ npm is not installed. Please install npm first.
    pause
    exit /b 1
)

echo ✅ npm version:
npm --version

REM Install dependencies
echo 📦 Installing dependencies...
npm install

REM Check if the server is running
echo 🔍 Checking if the server is running...
curl -s http://localhost:3000/api/daive/health >nul 2>&1
if %errorlevel% equ 0 (
    echo ✅ Server is running on http://localhost:3000
) else (
    echo ⚠️  Server is not running on http://localhost:3000
    echo    Please start your server first with: npm run dev
    echo    Then run the tests with: npm test
    pause
    exit /b 1
)

REM Run the basic test suite
echo 🧪 Running CrewAI test suite...
npm test

echo ✅ Test setup complete!
echo.
echo 📋 Available commands:
echo   npm test        - Run basic test suite
echo   npm run test-full - Run full test suite
echo.
echo 🔧 Configuration:
echo   Edit simple-crewai-test.js to change test settings
echo   Update TEST_CONFIG.testDealerId to match your database
pause
