@echo off
REM Start All Services with Simple Proxy (No Caddy needed!)

title X Gym - Starting All Services
color 0B

cd /d "%~dp0"

echo.
echo ========================================
echo   X Gym System - Starting...
echo ========================================
echo.

REM Check if all scripts exist
if not exist "start-system.bat" (
    echo [ERROR] start-system.bat not found!
    pause
    exit /b 1
)

if not exist "start-client.bat" (
    echo [ERROR] start-client.bat not found!
    pause
    exit /b 1
)

echo [1/3] Starting Main System (Port 4001)...
start "X Gym - Main System" cmd /k "start-system.bat"
timeout /t 5 >nul

echo [2/3] Starting Client Portal (Port 3002)...
start "X Gym - Client Portal" cmd /k "start-client.bat"
timeout /t 5 >nul

echo [3/3] Starting Proxy Server (Port 80)...
start "X Gym - Proxy" cmd /k "start-proxy.bat"
timeout /t 2 >nul

echo.
echo ========================================
echo   All Services Started!
echo ========================================
echo.
echo [*] Main System:    http://localhost:4001
echo [*] Client Portal:  http://localhost:3002
echo.
echo [*] Production URLs:
echo     http://system.xgym.website
echo     http://client.xgym.website
echo.
echo [*] Check the opened windows for logs
echo.
pause
