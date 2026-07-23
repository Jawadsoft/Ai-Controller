# GitHub Configuration Guide

## 🚀 Quick Setup (3 Steps)

### Step 1: Install Git
1. Go to: https://git-scm.com/download/win
2. Download "Git for Windows"
3. Install with **default settings** (important!)
4. Restart your terminal/PowerShell

### Step 2: Configure GitHub
Run the setup script:
```batch
setup-github.bat
```
This will:
- Configure your Git username and email
- Initialize the repository
- Connect to your GitHub repository
- Set up useful aliases

### Step 3: Push Your Changes
Run the push script:
```batch
push-changes.bat
```
This will:
- Stage all your audio path fixes
- Create a detailed commit message
- Push to your GitHub repository

## 🔧 What Gets Configured

### Git Settings
- **Username**: Your GitHub username
- **Email**: Your GitHub email
- **Default branch**: `main`
- **Repository**: https://github.com/Jawadsoft/Ai-Controller.git

### Git Aliases (Shortcuts)
- `git st` = `git status`
- `git co` = `git checkout`
- `git br` = `git branch`
- `git ci` = `git commit`

## 📁 Files Being Pushed

Your audio path fixes include:

### Core Fixes
- **src/routes/daive.js**: Fixed 9 instances of path inconsistency
- **src/server.js**: Enhanced error handling for audio serving
- **src/pages/AIBotPage.tsx**: Improved frontend error messages

### Testing & Verification
- **test-audio-path-fix.js**: Path consistency verification script
- **setup-github.bat**: This configuration script
- **push-changes.bat**: Automated push script

## 🎯 Problem Being Solved

**Before Fix:**
- TTS generation: `__dirname + '../../uploads/daive-audio'`
- Audio serving: `process.cwd() + 'uploads/daive-audio'`
- **Result**: 500 Internal Server Error (file not found)

**After Fix:**
- TTS generation: `process.cwd() + 'uploads/daive-audio'`
- Audio serving: `process.cwd() + 'uploads/daive-audio'`
- **Result**: ✅ Audio files served correctly

## 🔐 Authentication Options

If you get authentication errors when pushing:

### Option 1: GitHub Desktop (Easiest)
1. Download: https://desktop.github.com/
2. Sign in with your GitHub account
3. Add your local repository
4. Push changes through the GUI

### Option 2: Personal Access Token
1. Go to GitHub → Settings → Developer settings → Personal access tokens
2. Generate new token with `repo` permissions
3. Use token as password when prompted

### Option 3: SSH Keys
1. Generate SSH key: `ssh-keygen -t ed25519 -C "your-email@example.com"`
2. Add to GitHub: Settings → SSH and GPG keys
3. Clone with SSH URL instead of HTTPS

## ✅ Verification

After pushing, verify your changes at:
https://github.com/Jawadsoft/Ai-Controller.git

Look for the commit message starting with:
"Fix audio path consistency and resolve 500 Internal Server Error"

## 🆘 Troubleshooting

### Git Not Found Error
- Install Git from: https://git-scm.com/download/win
- Restart terminal after installation
- Run `git --version` to verify

### Authentication Failed
- Use GitHub Desktop for easier auth
- Or set up personal access token
- Or configure SSH keys

### Push Rejected
- Repository might have newer changes
- Run: `git pull origin main` first
- Then: `git push origin main`

## 📞 Need Help?

If you encounter issues:
1. Check the error messages in the terminal
2. Refer to GitHub's documentation: https://docs.github.com/
3. The scripts provide detailed error messages and solutions
