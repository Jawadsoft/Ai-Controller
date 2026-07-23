@echo off
echo ========================================
echo GitHub Configuration Setup
echo ========================================
echo.

REM Check if git is available
git --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Git is not installed on this system
    echo.
    echo Please follow these steps to install Git:
    echo 1. Go to: https://git-scm.com/download/win
    echo 2. Download Git for Windows
    echo 3. Install with default settings
    echo 4. Restart this terminal
    echo 5. Run this script again
    echo.
    echo Alternative: Use GitHub Desktop from https://desktop.github.com/
    pause
    exit /b 1
)

echo ✅ Git is installed
echo.

REM Get user information
set /p USERNAME="Enter your GitHub username: "
set /p EMAIL="Enter your GitHub email: "

echo.
echo Configuring Git with your information...

REM Configure git globally
git config --global user.name "%USERNAME%"
git config --global user.email "%EMAIL%"

REM Set default branch to main
git config --global init.defaultBranch main

REM Set up some useful git aliases
git config --global alias.st status
git config --global alias.co checkout
git config --global alias.br branch
git config --global alias.ci commit
git config --global alias.unstage "reset HEAD --"

echo ✅ Git configured successfully!
echo.

REM Initialize repository if not exists
if not exist .git (
    echo Initializing Git repository...
    git init
    echo ✅ Repository initialized
) else (
    echo ✅ Git repository already exists
)

REM Add remote origin
git remote get-url origin >nul 2>&1
if errorlevel 1 (
    echo Adding remote origin...
    git remote add origin https://github.com/Jawadsoft/Ai-Controller.git
    echo ✅ Remote origin added
) else (
    echo ✅ Remote origin already exists
    git remote -v
)

echo.
echo ========================================
echo Configuration Summary:
echo ========================================
echo Username: %USERNAME%
echo Email: %EMAIL%
echo Repository: https://github.com/Jawadsoft/Ai-Controller.git
echo Default branch: main
echo.

REM Show current status
echo Current repository status:
git status

echo.
echo ========================================
echo Next Steps:
echo ========================================
echo 1. Your Git is now configured
echo 2. Your repository is connected to GitHub
echo 3. Ready to commit and push your audio path fixes
echo.
echo To push your changes, run: push-changes.bat
echo.
pause
