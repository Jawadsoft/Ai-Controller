Write-Host "Starting Vehicle Management System in Production Mode..." -ForegroundColor Green
Write-Host ""

Write-Host "Building frontend..." -ForegroundColor Yellow
npm run build

Write-Host ""
Write-Host "Starting backend server..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "npm start" -WindowStyle Normal

Write-Host ""
Write-Host "Starting frontend server..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "npx serve -s dist -l 8080" -WindowStyle Normal

Write-Host ""
Write-Host "Production servers are starting..." -ForegroundColor Green
Write-Host "Backend: http://localhost:3000" -ForegroundColor Cyan
Write-Host "Frontend: http://localhost:8080" -ForegroundColor Cyan
Write-Host ""
Write-Host "Press any key to exit this launcher..." -ForegroundColor Yellow
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
