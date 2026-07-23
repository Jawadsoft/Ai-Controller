@echo off
echo ========================================
echo    SQL Migration Tool Launcher
echo ========================================
echo.

REM Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Node.js is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org/
    echo.
    pause
    exit /b 1
)

echo Node.js version: 
node --version
echo.

REM Check if dependencies are installed
if not exist "node_modules" (
    echo Installing dependencies...
    npm install
    if %errorlevel% neq 0 (
        echo ERROR: Failed to install dependencies
        pause
        exit /b 1
    )
    echo.
)

echo Starting SQL Migration Tool...
echo.
echo Frontend will be available at: http://localhost:3001/sql-migration-tool.html
echo.
echo Press Ctrl+C to stop the server
echo.

REM Start the migration server
npm start

pause
