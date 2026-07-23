@echo off
echo Stopping frontend server processes...

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

echo Frontend processes cleanup completed.