@echo off
echo Cleaning up previous frontend processes...
echo.

REM Kill processes using port 8080 (Vite frontend)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8080') do (
    echo Killing process using port 8080: %%a
    taskkill /f /pid %%a 2>nul
)

REM Kill processes using port 8081 (alternative Vite port)  
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8081') do (
    echo Killing process using port 8081: %%a
    taskkill /f /pid %%a 2>nul
)

REM Small delay to ensure processes are fully terminated
timeout /t 2 /nobreak >nul

echo.
echo Starting Frontend Server on http://localhost:8080...
echo.
echo Press Ctrl+C to stop the server
echo.

REM Start the frontend server
npm run dev:frontend

pause