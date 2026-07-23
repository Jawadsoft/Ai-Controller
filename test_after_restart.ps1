# Test Script - Run After Restarting Frontend
# This will verify the Vite proxy fix is working

Write-Host "╔════════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  PDF Generation & Signature Request - Proxy Fix Verification  ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

Write-Host "⚠️  IMPORTANT: Make sure you've restarted the frontend server!" -ForegroundColor Yellow
Write-Host "   Run: npm run dev (in a separate terminal)" -ForegroundColor Yellow
Write-Host ""
Write-Host "Press Enter to continue with tests..." -ForegroundColor Yellow
Read-Host

Write-Host "`n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "TEST 1: Backend Health Check (Port 3000)" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan

try {
    $response = Invoke-WebRequest -Uri "http://localhost:3000/health" -UseBasicParsing
    Write-Host "✅ Backend is running on port 3000" -ForegroundColor Green
    Write-Host "   Status: $($response.StatusCode)" -ForegroundColor Gray
} catch {
    Write-Host "❌ Backend NOT running on port 3000!" -ForegroundColor Red
    Write-Host "   Please start it: node src/server.js" -ForegroundColor Yellow
    exit 1
}

Write-Host "`n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "TEST 2: Frontend Health Check (Port 8080)" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan

try {
    $response = Invoke-WebRequest -Uri "http://localhost:8080/" -UseBasicParsing
    Write-Host "✅ Frontend is running on port 8080" -ForegroundColor Green
    Write-Host "   Status: $($response.StatusCode)" -ForegroundColor Gray
} catch {
    Write-Host "❌ Frontend NOT running on port 8080!" -ForegroundColor Red
    Write-Host "   Please start it: npm run dev" -ForegroundColor Yellow
    exit 1
}

Write-Host "`n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "TEST 3: GET Request Through Proxy (Should Work)" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan

try {
    $response = Invoke-WebRequest -Uri "http://localhost:8080/api/finance/programs" -Method GET -UseBasicParsing
    Write-Host "✅ GET requests are proxied correctly" -ForegroundColor Green
    Write-Host "   Status: $($response.StatusCode)" -ForegroundColor Gray
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    if ($statusCode -eq 401 -or $statusCode -eq 403) {
        Write-Host "✅ GET requests are proxied (got auth error, which is OK)" -ForegroundColor Green
        Write-Host "   Status: $statusCode" -ForegroundColor Gray
    } else {
        Write-Host "❌ GET request failed with status: $statusCode" -ForegroundColor Red
    }
}

Write-Host "`n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "TEST 4: POST Request Through Proxy (THE CRITICAL TEST)" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan

try {
    $response = Invoke-WebRequest -Uri "http://localhost:8080/api/finance/deals/test-id/generate-sheet" -Method POST -ContentType "application/json" -UseBasicParsing
    Write-Host "✅ POST request succeeded!" -ForegroundColor Green
    Write-Host "   Status: $($response.StatusCode)" -ForegroundColor Gray
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    Write-Host "   Request URL: http://localhost:8080/api/finance/deals/test-id/generate-sheet" -ForegroundColor Gray
    Write-Host "   Method: POST" -ForegroundColor Gray
    Write-Host "   Status Code: $statusCode" -ForegroundColor Gray
    
    if ($statusCode -eq 404) {
        Write-Host "`n❌ STILL GETTING 404!" -ForegroundColor Red
        Write-Host "   This means the proxy fix didn't apply." -ForegroundColor Red
        Write-Host "" 
        Write-Host "   Solutions:" -ForegroundColor Yellow
        Write-Host "   1. Make sure you RESTARTED the frontend (npm run dev)" -ForegroundColor Yellow
        Write-Host "   2. Check for errors in the Vite terminal" -ForegroundColor Yellow
        Write-Host "   3. Try stopping and starting again" -ForegroundColor Yellow
        Write-Host "   4. Clear cache: rm -rf node_modules/.vite" -ForegroundColor Yellow
    } elseif ($statusCode -eq 401 -or $statusCode -eq 403) {
        Write-Host "`n✅ POST REQUESTS ARE NOW WORKING!" -ForegroundColor Green
        Write-Host "   Got auth error ($statusCode), which means the route exists!" -ForegroundColor Green
        Write-Host "   The proxy is correctly forwarding POST requests!" -ForegroundColor Green
    } elseif ($statusCode -eq 400) {
        Write-Host "`n✅ POST REQUESTS ARE NOW WORKING!" -ForegroundColor Green
        Write-Host "   Got validation error (400), which means the route exists!" -ForegroundColor Green
        Write-Host "   The proxy is correctly forwarding POST requests!" -ForegroundColor Green
    } else {
        Write-Host "`n⚠️  POST request returned: $statusCode" -ForegroundColor Yellow
        Write-Host "   The proxy appears to be working, but check the backend logs" -ForegroundColor Yellow
    }
}

Write-Host "`n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "TEST 5: Direct Backend POST (For Comparison)" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan

try {
    $response = Invoke-WebRequest -Uri "http://localhost:3000/api/finance/deals/test-id/generate-sheet" -Method POST -ContentType "application/json" -UseBasicParsing
    Write-Host "✅ Backend POST succeeded" -ForegroundColor Green
    Write-Host "   Status: $($response.StatusCode)" -ForegroundColor Gray
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    Write-Host "   Status Code: $statusCode" -ForegroundColor Gray
    if ($statusCode -eq 401 -or $statusCode -eq 403) {
        Write-Host "✅ Backend is responding correctly (auth error expected)" -ForegroundColor Green
    }
}

Write-Host "`n╔════════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║                        RESULTS SUMMARY                         ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""
Write-Host "If TEST 4 shows:" -ForegroundColor White
Write-Host "  ❌ 404 = Proxy still not working (restart frontend again)" -ForegroundColor Red
Write-Host "  ✅ 401/403/400 = PROXY IS FIXED! Routes are working!" -ForegroundColor Green
Write-Host ""
Write-Host "Next Step: Test in your browser!" -ForegroundColor Yellow
Write-Host "  1. Go to http://localhost:8080/finance" -ForegroundColor Gray
Write-Host "  2. Click 'Generate PDF' button" -ForegroundColor Gray
Write-Host "  3. Should work now!" -ForegroundColor Gray
Write-Host ""

