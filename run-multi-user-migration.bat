@echo off
echo ========================================
echo Multi-User Migration Runner
echo ========================================
echo.

REM Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Node.js is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

REM Check if .env file exists
if not exist .env (
    echo WARNING: .env file not found
    echo Please create a .env file with your DATABASE_URL
    echo Example: DATABASE_URL=postgresql://username:password@host:port/database
    echo.
)

REM Check if package.json exists
if not exist package.json (
    echo ERROR: package.json not found
    echo Please run this script from your project root directory
    pause
    exit /b 1
)

echo Starting Multi-User Migration...
echo.

REM Run the migration
node run-multi-user-migration.js %*

echo.
echo Migration completed!
pause
