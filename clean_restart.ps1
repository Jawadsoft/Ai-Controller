# Clean Restart Script
# Kills all node processes and provides clean startup instructions

Write-Host "╔══════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║     Clean Restart - Kill All Node Processes     ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# Find all node processes
$nodeProcesses = Get-Process node -ErrorAction SilentlyContinue

if ($nodeProcesses) {
    Write-Host "Found $($nodeProcesses.Count) node process(es) running:" -ForegroundColor Yellow
    $nodeProcesses | ForEach-Object {
        Write-Host "  - PID: $($_.Id), CPU: $($_.CPU), Memory: $([math]::Round($_.WS/1MB, 2))MB" -ForegroundColor Gray
    }
    
    Write-Host "`nKilling all node processes..." -ForegroundColor Yellow
    $nodeProcesses | Stop-Process -Force
    Start-Sleep -Seconds 2
    
    # Verify they're killed
    $remaining = Get-Process node -ErrorAction SilentlyContinue
    if ($remaining) {
        Write-Host "⚠️  Some processes still running, trying again..." -ForegroundColor Yellow
        $remaining | Stop-Process -Force -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 1
    }
    
    Write-Host "✅ All node processes killed!" -ForegroundColor Green
} else {
    Write-Host "✅ No node processes found running" -ForegroundColor Green
}

Write-Host ""
Write-Host "╔══════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║              Restart Instructions                ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

Write-Host "STEP 1: Start Backend (Port 3000)" -ForegroundColor Yellow
Write-Host "  Open a NEW terminal and run:" -ForegroundColor White
Write-Host "  cd C:\db8088" -ForegroundColor Gray
Write-Host "  node src/server.js" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Wait for: 'Server running on port 3000'" -ForegroundColor Gray
Write-Host ""

Write-Host "STEP 2: Start Frontend (Port 8080)" -ForegroundColor Yellow
Write-Host "  Open ANOTHER NEW terminal and run:" -ForegroundColor White
Write-Host "  cd C:\db8088" -ForegroundColor Gray
Write-Host "  npm run dev" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Wait for: 'Local: http://localhost:8080/'" -ForegroundColor Gray
Write-Host ""

Write-Host "STEP 3: Test the Fix" -ForegroundColor Yellow
Write-Host "  Run the verification script:" -ForegroundColor White
Write-Host "  .\test_after_restart.ps1" -ForegroundColor Cyan
Write-Host ""

Write-Host "STEP 4: Test in Browser" -ForegroundColor Yellow
Write-Host "  1. Go to: http://localhost:8080/finance" -ForegroundColor White
Write-Host "  2. Click 'Generate PDF' button" -ForegroundColor White
Write-Host "  3. Should work! ✅" -ForegroundColor Green
Write-Host ""

Write-Host "═══════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "Press Enter to exit..." -ForegroundColor Gray
Read-Host

