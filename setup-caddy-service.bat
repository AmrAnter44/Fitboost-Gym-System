@echo off
REM ================================
REM Caddy Windows Service Setup
REM Requires NSSM and Administrator
REM ================================

echo.
echo ====================================
echo   Caddy Service Setup
echo   X Gym System
echo ====================================
echo.

REM Check Administrator privileges
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo ❌ ERROR: This script must be run as Administrator!
    echo.
    echo Right-click this file and select "Run as administrator"
    pause
    exit /b 1
)

REM Get the directory where this script is located
set "SCRIPT_DIR=%~dp0"
set "CADDY_DIR=%SCRIPT_DIR%caddy"

REM Check if Caddy is installed
if not exist "%CADDY_DIR%\caddy.exe" (
    echo ❌ ERROR: Caddy not found!
    echo Please run setup-caddy.bat first
    pause
    exit /b 1
)

echo [1/4] Looking for NSSM...
set "NSSM_FOUND=0"
set "NSSM_PATH="

REM Check if NSSM already exists in Caddy directory
if exist "%CADDY_DIR%\nssm.exe" (
    echo ✓ Found NSSM in Caddy directory
    set "NSSM_PATH=%CADDY_DIR%\nssm.exe"
    set "NSSM_FOUND=1"
)

REM Search in Desktop
if %NSSM_FOUND%==0 (
    if exist "%USERPROFILE%\Desktop\nssm.exe" (
        echo ✓ Found NSSM in Desktop
        copy "%USERPROFILE%\Desktop\nssm.exe" "%CADDY_DIR%\nssm.exe" >nul
        set "NSSM_PATH=%CADDY_DIR%\nssm.exe"
        set "NSSM_FOUND=1"
    )
)

REM Search in Downloads
if %NSSM_FOUND%==0 (
    if exist "%USERPROFILE%\Downloads\nssm.exe" (
        echo ✓ Found NSSM in Downloads
        copy "%USERPROFILE%\Downloads\nssm.exe" "%CADDY_DIR%\nssm.exe" >nul
        set "NSSM_PATH=%CADDY_DIR%\nssm.exe"
        set "NSSM_FOUND=1"
    )
)

REM Search in Downloads\nssm-*\win64
if %NSSM_FOUND%==0 (
    for /d %%D in ("%USERPROFILE%\Downloads\nssm-*") do (
        if exist "%%D\win64\nssm.exe" (
            echo ✓ Found NSSM in Downloads\%%~nxD\win64
            copy "%%D\win64\nssm.exe" "%CADDY_DIR%\nssm.exe" >nul
            set "NSSM_PATH=%CADDY_DIR%\nssm.exe"
            set "NSSM_FOUND=1"
            goto NSSM_FOUND_LABEL
        )
    )
)
:NSSM_FOUND_LABEL

if %NSSM_FOUND%==0 (
    echo ❌ ERROR: NSSM not found!
    echo.
    echo Please download NSSM from: https://nssm.cc/download
    echo Extract and place nssm.exe in Desktop or Downloads folder
    echo Then run this script again.
    pause
    exit /b 1
)
echo.

echo [2/4] Removing old service (if exists)...
"%NSSM_PATH%" stop CaddyServer >nul 2>&1
"%NSSM_PATH%" remove CaddyServer confirm >nul 2>&1
echo ✓ Cleaned up old service
echo.

echo [3/4] Installing Caddy as Windows Service...
"%NSSM_PATH%" install CaddyServer "%CADDY_DIR%\caddy.exe" run --config "%CADDY_DIR%\Caddyfile"
if %errorLevel% neq 0 (
    echo ❌ ERROR: Service installation failed!
    pause
    exit /b 1
)
echo ✓ Service installed
echo.

echo [4/4] Configuring service...
"%NSSM_PATH%" set CaddyServer AppDirectory "%CADDY_DIR%"
"%NSSM_PATH%" set CaddyServer DisplayName "Caddy Web Server"
"%NSSM_PATH%" set CaddyServer Description "Reverse proxy for X Gym System"
"%NSSM_PATH%" set CaddyServer Start SERVICE_AUTO_START
echo ✓ Service configured
echo.

echo Starting service...
"%NSSM_PATH%" start CaddyServer
if %errorLevel% neq 0 (
    echo ❌ ERROR: Service failed to start!
    echo.
    echo Check logs at: %CADDY_DIR%\logs
    pause
    exit /b 1
)
echo.

REM Wait a bit for service to start
timeout /t 3 /nobreak >nul

echo Checking service status...
"%NSSM_PATH%" status CaddyServer
echo.

echo ====================================
echo   Service Setup Complete!
echo ====================================
echo.
echo Service Name: CaddyServer
echo Service Path: %CADDY_DIR%
echo.
echo Useful commands:
echo   Start:   "%NSSM_PATH%" start CaddyServer
echo   Stop:    "%NSSM_PATH%" stop CaddyServer
echo   Restart: "%NSSM_PATH%" restart CaddyServer
echo   Status:  "%NSSM_PATH%" status CaddyServer
echo.
echo Logs location: %CADDY_DIR%\logs
echo.
echo The service will automatically start when Windows boots.
echo.
pause
