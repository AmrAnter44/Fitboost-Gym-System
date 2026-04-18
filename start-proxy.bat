@echo off
REM Start Simple Proxy Server (replaces Caddy)

title X Gym - Proxy Server
color 0D

cd /d "%~dp0"

echo.
echo ========================================
echo   X Gym Proxy Server
echo ========================================
echo.

REM Check if node_modules exists
if not exist "node_modules" (
    echo [!] Installing dependencies...
    call npm install
)

echo [*] Starting proxy on port 80...
echo [*] Make sure port 4001 is running!
echo.
echo ========================================
echo   Routing:
echo   system.xgym.website → localhost:4001
echo ========================================
echo.

node simple-proxy.js

pause
