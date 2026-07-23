@echo off
echo Pulling Ai-Controller into current project...
echo Current directory: %CD%
echo.

REM Check current git status
echo Checking current git repository status...
git remote -v
echo.

REM Option 1: If this is already the Ai-Controller repo, just pull
echo Attempting to pull from Ai-Controller repository...
git pull https://github.com/Jawadsoft/Ai-Controller.git main
echo.

REM Check if pull was successful
if %ERRORLEVEL% EQU 0 (
    echo SUCCESS: Latest changes pulled from Ai-Controller!
) else (
    echo Pull failed. Trying alternative method...
    echo.
    echo Adding Ai-Controller as remote...
    git remote add ai-controller https://github.com/Jawadsoft/Ai-Controller.git
    echo.
    echo Fetching from Ai-Controller...
    git fetch ai-controller
    echo.
    echo Merging changes...
    git merge ai-controller/main --allow-unrelated-histories
)

echo.
echo Current directory contents:
dir

echo.
echo Checking for package.json...
if exist "package.json" (
    echo Found package.json - installing/updating dependencies...
    npm install
    echo Dependencies updated!
) else (
    echo No package.json found in current directory
)

pause
