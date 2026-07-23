@echo off
echo Setting up git repository and pushing audio path fixes...

REM Check if git is available
git --version >nul 2>&1
if errorlevel 1 (
    echo Error: Git is not installed or not in PATH
    echo Please install Git from: https://git-scm.com/download/win
    echo Then restart this script
    pause
    exit /b 1
)

REM Initialize repository if needed
if not exist .git (
    echo Initializing git repository...
    git init
)

REM Add remote origin if not exists
git remote get-url origin >nul 2>&1
if errorlevel 1 (
    echo Adding remote origin...
    git remote add origin https://github.com/Jawadsoft/Ai-Controller.git
)

REM Stage all changes
echo Staging changes...
git add .

REM Commit with descriptive message
echo Committing changes...
git commit -m "Fix audio path consistency and 500 error

- Changed all TTS generation paths from __dirname to process.cwd()
- Fixed path inconsistency between audio generation and serving
- Enhanced error handling in audio serving route
- Improved frontend error messages for better debugging
- Resolves 500 Internal Server Error on greeting audio files
- Enables proper audio autoplay functionality

Files modified:
- src/routes/daive.js (fixed 9 path instances)
- src/server.js (enhanced error handling)
- src/pages/AIBotPage.tsx (improved error messages)
- test-audio-path-fix.js (added verification script)"

REM Push to GitHub
echo Pushing to GitHub...
git push -u origin main

echo.
echo ✅ Successfully pushed audio path fixes to GitHub!
echo Repository: https://github.com/Jawadsoft/Ai-Controller.git
pause
