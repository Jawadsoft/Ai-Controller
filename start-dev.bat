@echo off
echo Starting Dealer-iq Development Environment...
echo.

echo Cleaning up previous processes...
REM Kill any existing node.exe processes
taskkill /f /im node.exe /t 2>nul
if %errorlevel% equ 0 (
    echo Previous Node.js processes terminated.
) else (
    echo No previous Node.js processes found.
)

REM Small delay to ensure processes are fully terminated
timeout /t 2 /nobreak >nul

echo.
echo Backend will run on: http://localhost:3000
echo Frontend will run on: http://localhost:8080
echo.
echo Press Ctrl+C to stop both servers
echo.

start "Backend Server" cmd /k "npm run dev"
timeout /t 3 /nobreak >nul
start "Frontend Server" cmd /k "npm run dev:frontend"

echo Both servers are starting...
echo Backend: http://localhost:3000
echo Frontend: http://localhost:8080
echo.
pause 