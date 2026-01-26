@echo off
REM ================================
REM Portable Caddy Setup Script
REM Works on any Windows machine
REM ================================

echo.
echo ====================================
echo   Caddy Setup Script
echo   X Gym System
echo ====================================
echo.

REM Get the directory where this script is located
set "SCRIPT_DIR=%~dp0"
set "CADDY_DIR=%SCRIPT_DIR%caddy"

echo [1/6] Creating Caddy directories...
if not exist "%CADDY_DIR%" mkdir "%CADDY_DIR%"
if not exist "%CADDY_DIR%\logs" mkdir "%CADDY_DIR%\logs"
echo ✓ Directories created: %CADDY_DIR%
echo.

echo [2/6] Looking for Caddy executable...
set "CADDY_FOUND=0"

REM Search in Desktop
if exist "%USERPROFILE%\Desktop\caddy_windows_amd64.exe" (
    echo ✓ Found Caddy in Desktop
    copy "%USERPROFILE%\Desktop\caddy_windows_amd64.exe" "%CADDY_DIR%\caddy.exe" >nul
    set "CADDY_FOUND=1"
)

REM Search in Downloads if not found in Desktop
if %CADDY_FOUND%==0 (
    if exist "%USERPROFILE%\Downloads\caddy_windows_amd64.exe" (
        echo ✓ Found Caddy in Downloads
        copy "%USERPROFILE%\Downloads\caddy_windows_amd64.exe" "%CADDY_DIR%\caddy.exe" >nul
        set "CADDY_FOUND=1"
    )
)

if %CADDY_FOUND%==0 (
    echo ❌ ERROR: caddy_windows_amd64.exe not found!
    echo.
    echo Please download Caddy from: https://caddyserver.com/download
    echo Place it in Desktop or Downloads folder
    echo Then run this script again.
    pause
    exit /b 1
)
echo.

echo [3/6] Copying Caddyfile...
if exist "%SCRIPT_DIR%Caddyfile" (
    copy "%SCRIPT_DIR%Caddyfile" "%CADDY_DIR%\Caddyfile" >nul
    echo ✓ Caddyfile copied successfully
) else (
    echo ❌ ERROR: Caddyfile not found in script directory!
    echo Please ensure Caddyfile exists in: %SCRIPT_DIR%
    pause
    exit /b 1
)
echo.

echo [4/6] Validating Caddyfile...
cd /d "%CADDY_DIR%"
caddy.exe validate --config Caddyfile
if %errorLevel% neq 0 (
    echo ❌ ERROR: Caddyfile validation failed!
    pause
    exit /b 1
)
echo ✓ Caddyfile is valid
echo.

echo [5/6] Setting up Windows Firewall rules...
echo Checking Administrator privileges...
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo ⚠️  WARNING: Not running as Administrator
    echo Firewall rules will NOT be created
    echo Please run this script as Administrator to configure firewall
    echo.
    goto SKIP_FIREWALL
)

echo Creating firewall rules...
netsh advfirewall firewall delete rule name="Caddy HTTP" >nul 2>&1
netsh advfirewall firewall delete rule name="Caddy HTTPS" >nul 2>&1
netsh advfirewall firewall add rule name="Caddy HTTP" dir=in action=allow protocol=TCP localport=80 >nul
netsh advfirewall firewall add rule name="Caddy HTTPS" dir=in action=allow protocol=TCP localport=443 >nul
echo ✓ Firewall rules created (ports 80 and 443)
echo.

:SKIP_FIREWALL

echo [6/6] Testing Caddy...
echo Starting Caddy in test mode (will run for 5 seconds)...
start /B caddy.exe run --config Caddyfile
timeout /t 5 /nobreak >nul
taskkill /F /IM caddy.exe >nul 2>&1
echo ✓ Test completed
echo.

echo ====================================
echo   Setup Complete!
echo ====================================
echo.
echo Caddy installed at: %CADDY_DIR%
echo.
echo Next steps:
echo 1. Configure your router to forward ports 80 and 443
echo 2. Add DNS records in Cloudflare:
echo    - system.xgym.website -^> YOUR_PUBLIC_IP
echo    - client.xgym.website -^> YOUR_PUBLIC_IP
echo 3. Run setup-caddy-service.bat to install as Windows Service
echo    OR run manually: cd "%CADDY_DIR%" ^&^& caddy.exe run
echo.
echo For more info, see: CADDY_SETUP.md
echo.
pause
