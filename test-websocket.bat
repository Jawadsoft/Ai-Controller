@echo off
echo ========================================
echo    WebSocket Connection Test Suite
echo ========================================
echo.

echo Testing PRIMARY connection to /streaming-voice...
node websocket-test.js primary
echo.

echo Testing FALLBACK connection to root...
node websocket-test.js fallback
echo.

echo ========================================
echo    All tests completed!
echo ========================================
echo.
echo You can also open websocket-test.html in your browser
echo for interactive testing.
echo.
pause
