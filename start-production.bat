@echo off
echo Starting Vehicle Management System in Production Mode...
echo.

echo Building frontend...
call npm run build

echo.
echo Starting backend server...
start "Backend Server" cmd /k "npm start"

echo.
echo Starting frontend server...
start "Frontend Server" cmd /k "npx serve -s dist -l 8080"

echo.
echo Production servers are starting...
echo Backend: http://localhost:3000
echo Frontend: http://localhost:8080
echo.
echo Press any key to exit this launcher...
pause >nul
