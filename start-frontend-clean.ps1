Write-Host "=== Dealer-IQ Frontend Startup ===" -ForegroundColor Cyan
Write-Host ""

Write-Host "Cleaning up previous frontend processes..." -ForegroundColor Yellow

# Kill processes using port 8080 (Vite frontend)
$port8080Processes = Get-NetTCPConnection -LocalPort 8080 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess
if ($port8080Processes) {
    foreach ($pid in $port8080Processes) {
        Write-Host "Killing process using port 8080: $pid" -ForegroundColor Red
        Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
    }
} else {
    Write-Host "No processes found on port 8080" -ForegroundColor Gray
}

# Kill processes using port 8081 (alternative Vite port)
$port8081Processes = Get-NetTCPConnection -LocalPort 8081 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess
if ($port8081Processes) {
    foreach ($pid in $port8081Processes) {
        Write-Host "Killing process using port 8081: $pid" -ForegroundColor Red
        Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
    }
} else {
    Write-Host "No processes found on port 8081" -ForegroundColor Gray
}

# Small delay to ensure processes are fully terminated
Start-Sleep -Seconds 2

Write-Host ""
Write-Host "Starting Frontend Server on http://localhost:8080..." -ForegroundColor Green
Write-Host ""
Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Yellow
Write-Host ""

# Start the frontend server
npm run dev:frontend