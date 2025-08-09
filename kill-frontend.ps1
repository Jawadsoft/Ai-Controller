Write-Host "Stopping frontend server processes..." -ForegroundColor Yellow

# Kill processes using port 8080 (Vite frontend)
$port8080Processes = Get-NetTCPConnection -LocalPort 8080 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess
if ($port8080Processes) {
    foreach ($pid in $port8080Processes) {
        Write-Host "Killing process using port 8080: $pid" -ForegroundColor Red
        Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
    }
}

# Kill processes using port 8081 (alternative Vite port)
$port8081Processes = Get-NetTCPConnection -LocalPort 8081 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess
if ($port8081Processes) {
    foreach ($pid in $port8081Processes) {
        Write-Host "Killing process using port 8081: $pid" -ForegroundColor Red
        Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
    }
}

# Also kill any Vite processes by name
$viteProcesses = Get-Process -Name "*vite*" -ErrorAction SilentlyContinue
if ($viteProcesses) {
    foreach ($process in $viteProcesses) {
        Write-Host "Killing Vite process: $($process.Id)" -ForegroundColor Red
        Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
    }
}

Write-Host "Frontend processes cleanup completed." -ForegroundColor Green