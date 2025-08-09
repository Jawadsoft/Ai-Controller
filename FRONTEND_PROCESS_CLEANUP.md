# Frontend Process Cleanup System

This document describes the automated process cleanup system implemented for the Dealer-IQ application to prevent port conflicts and ensure clean frontend server startups.

## 🚀 Quick Start

To start the frontend with automatic cleanup:
```bash
npm run dev:frontend:clean
```

## 📋 Table of Contents

- [Overview](#overview)
- [Problem Solved](#problem-solved)
- [Implementation](#implementation)
- [Available Scripts](#available-scripts)
- [File Structure](#file-structure)
- [Usage Examples](#usage-examples)
- [Technical Details](#technical-details)
- [Troubleshooting](#troubleshooting)

## 🎯 Overview

The Frontend Process Cleanup System automatically terminates existing frontend processes before starting new ones, preventing the common "port already in use" error when developing with Vite.

### Key Features
- ✅ **Selective Process Termination**: Only kills frontend processes (ports 8080/8081)
- ✅ **Backend Preservation**: Keeps backend server running on port 3000
- ✅ **Multiple Interface Options**: NPM scripts, Batch files, PowerShell scripts
- ✅ **Cross-Platform Support**: Works on Windows with both CMD and PowerShell
- ✅ **User Feedback**: Clear console messages about cleanup progress
- ✅ **Error Handling**: Graceful handling when no processes exist

## 🔧 Problem Solved

### Before Implementation
```bash
npm run dev:frontend
# Error: Port 8080 is already in use
# Solution: Manually find and kill processes
```

### After Implementation
```bash
npm run dev:frontend:clean
# Stopping frontend server processes...
# Frontend processes cleanup completed.
# VITE v7.0.6 ready in 627 ms
# ➜ Local: http://localhost:8080/
```

## 🛠 Implementation

### Port Configuration
- **Frontend Server**: `http://localhost:8080` (Vite development server)
- **Backend Server**: `http://localhost:3000` (Express API server)
- **Alternative Frontend Port**: `http://localhost:8081` (fallback if 8080 is busy)

### Process Targeting Strategy
The cleanup system uses **port-based targeting** instead of killing all Node.js processes:

1. Identifies processes using ports 8080/8081 (Vite frontend)
2. Terminates only those specific processes
3. Preserves backend server on port 3000
4. Leaves other Node.js applications running

## 📦 Available Scripts

### NPM Scripts (Recommended)

| Script | Description | Usage |
|--------|-------------|-------|
| `npm run dev:frontend` | Start frontend (standard) | Basic Vite startup |
| `npm run dev:frontend:clean` | Start frontend with cleanup | **Recommended for development** |
| `npm run dev:full:clean` | Start both servers with cleanup | Full development environment |
| `npm run kill:frontend` | Kill frontend processes only | Manual cleanup |

### Direct Script Execution

| Script | Platform | Description |
|--------|----------|-------------|
| `start-frontend-clean.bat` | Windows CMD | Enhanced batch startup |
| `start-frontend-clean.ps1` | PowerShell | Modern PowerShell startup |
| `kill-frontend.bat` | Windows CMD | Batch cleanup only |
| `kill-frontend.ps1` | PowerShell | PowerShell cleanup only |
| `start-dev.bat` | Windows CMD | Full development environment |

## 📁 File Structure

```
Dealer-IQ/
├── package.json                 # Updated NPM scripts
├── start-dev.bat               # Main development startup (updated)
├── start-frontend-clean.bat    # Frontend startup with cleanup
├── start-frontend-clean.ps1    # PowerShell frontend startup
├── kill-frontend.bat           # Batch process cleanup
├── kill-frontend.ps1           # PowerShell process cleanup
└── FRONTEND_PROCESS_CLEANUP.md # This documentation
```

## 💡 Usage Examples

### Scenario 1: Starting Development Work
```bash
# Option A: Start both servers with cleanup
npm run dev:full:clean

# Option B: Start frontend only with cleanup
npm run dev:frontend:clean

# Option C: Use batch file
start-dev.bat
```

### Scenario 2: Frontend Already Running
```bash
# Kill existing frontend processes
npm run kill:frontend

# Then start fresh
npm run dev:frontend
```

### Scenario 3: Port Conflict Error
```bash
# If you see "Port 8080 is already in use"
npm run dev:frontend:clean
# This will automatically clean up and restart
```

### Scenario 4: PowerShell Users
```powershell
# Direct PowerShell execution
powershell -ExecutionPolicy Bypass -File start-frontend-clean.ps1
```

## 🔍 Technical Details

### Batch Script Implementation (`kill-frontend.bat`)
```batch
@echo off
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
```

### PowerShell Implementation (`kill-frontend.ps1`)
```powershell
# Kill processes using port 8080
$port8080Processes = Get-NetTCPConnection -LocalPort 8080 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess
if ($port8080Processes) {
    foreach ($pid in $port8080Processes) {
        Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
    }
}
```

### Package.json Scripts
```json
{
  "scripts": {
    "dev:frontend": "vite",
    "dev:frontend:clean": "call kill-frontend.bat && vite",
    "dev:full:clean": "call kill-frontend.bat && concurrently \"npm run dev\" \"npm run dev:frontend\"",
    "kill:frontend": "call kill-frontend.bat"
  }
}
```

## 🚨 Troubleshooting

### Common Issues

#### Issue: "Access Denied" when killing processes
**Solution**: Run terminal/command prompt as Administrator

#### Issue: PowerShell execution policy error
**Solution**: 
```powershell
# Temporary bypass
powershell -ExecutionPolicy Bypass -File start-frontend-clean.ps1

# Or set policy permanently (as Administrator)
Set-ExecutionPolicy RemoteSigned
```

#### Issue: Scripts not found
**Solution**: Ensure you're in the project root directory (`D:\sharefolder\Dealer-IQ`)

#### Issue: Backend accidentally killed
**Solution**: 
```bash
# Restart backend only
npm run dev
```

### Verification Commands

#### Check if frontend is running:
```bash
netstat -aon | findstr :8080
```

#### Check if backend is running:
```bash
netstat -aon | findstr :3000
```

#### List all Node.js processes:
```bash
tasklist | findstr node.exe
```

## 🔄 Workflow Integration

### Recommended Development Workflow

1. **Start Development Session**:
   ```bash
   npm run dev:full:clean
   ```

2. **Frontend-Only Development**:
   ```bash
   npm run dev:frontend:clean
   ```

3. **End Development Session**:
   ```bash
   # Press Ctrl+C in both terminal windows
   # Or close terminal windows directly
   ```

4. **Emergency Cleanup**:
   ```bash
   npm run kill:frontend
   ```

### Integration with IDE

#### VS Code Tasks
Add to `.vscode/tasks.json`:
```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "Start Frontend (Clean)",
      "type": "shell",
      "command": "npm run dev:frontend:clean",
      "group": "build",
      "presentation": {
        "echo": true,
        "reveal": "always",
        "focus": false,
        "panel": "new"
      }
    }
  ]
}
```

## 📊 Process Flow Diagram

```
┌─────────────────┐
│ User runs       │
│ npm run         │
│ dev:frontend:   │
│ clean           │
└─────┬───────────┘
      │
      ▼
┌─────────────────┐
│ Execute         │
│ kill-frontend.  │
│ bat             │
└─────┬───────────┘
      │
      ▼
┌─────────────────┐
│ Find processes  │
│ on ports        │
│ 8080/8081       │
└─────┬───────────┘
      │
      ▼
┌─────────────────┐
│ Terminate       │
│ found           │
│ processes       │
└─────┬───────────┘
      │
      ▼
┌─────────────────┐
│ Wait 2 seconds  │
│ for cleanup     │
└─────┬───────────┘
      │
      ▼
┌─────────────────┐
│ Start Vite      │
│ development     │
│ server          │
└─────┬───────────┘
      │
      ▼
┌─────────────────┐
│ Frontend ready  │
│ on              │
│ localhost:8080  │
└─────────────────┘
```

## 🔗 Related Configuration

### Vite Configuration (`vite.config.ts`)
```typescript
export default defineConfig({
  server: {
    host: "::",
    port: 8080,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false
      }
    }
  }
});
```

### Server Configuration (`src/server.js`)
```javascript
const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: [
    'http://localhost:8080',
    'http://localhost:8081',
    process.env.FRONTEND_URL
  ].filter(Boolean)
}));
```

## 📈 Benefits Summary

| Benefit | Description | Impact |
|---------|-------------|---------|
| **Zero Port Conflicts** | Automatic cleanup prevents "port in use" errors | High |
| **Faster Development** | No manual process management needed | High |
| **Selective Termination** | Only kills frontend, preserves other services | Medium |
| **Multiple Interfaces** | Batch, PowerShell, NPM options | Medium |
| **Clear Feedback** | Console messages show what's happening | Low |

## 🏷️ Version History

- **v1.0** - Initial implementation with batch scripts
- **v1.1** - Added PowerShell support and enhanced error handling
- **v1.2** - Integrated with NPM scripts and improved user feedback

## 📞 Support

If you encounter issues with the process cleanup system:

1. Check the [Troubleshooting](#troubleshooting) section
2. Verify you're in the correct directory
3. Try running as Administrator
4. Check if ports are actually in use with `netstat -aon | findstr :8080`

---

**Last Updated**: December 2024  
**Maintained by**: Dealer-IQ Development Team