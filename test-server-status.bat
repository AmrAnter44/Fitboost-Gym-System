@echo off
title X Gym - Server Status Check
color 0B

echo.
echo ========================================
echo   X Gym Server Status Check
echo ========================================
echo.

REM Check Port 80
echo [1/3] Checking Port 80 (Reverse Proxy)...
netstat -ano | findstr ":80" >nul 2>&1
if errorlevel 1 (
    echo     [X] Port 80 NOT running
    echo     ^!^!^! Reverse Proxy is NOT started
) else (
    echo     [OK] Port 80 is running
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":80"') do (
        echo     PID: %%a
        goto next1
    )
    :next1
)
echo.

REM Check Port 4001
echo [2/3] Checking Port 4001 (Main System)...
netstat -ano | findstr ":4001" >nul 2>&1
if errorlevel 1 (
    echo     [X] Port 4001 NOT running
    echo     ^!^!^! Main System is NOT started
) else (
    echo     [OK] Port 4001 is running
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":4001"') do (
        echo     PID: %%a
        goto next2
    )
    :next2
)
echo.

REM Check Port 3002
echo [3/3] Checking Port 3002 (Client Portal)...
netstat -ano | findstr ":3002" >nul 2>&1
if errorlevel 1 (
    echo     [X] Port 3002 NOT running
    echo     ^!^!^! Client Portal is NOT started
) else (
    echo     [OK] Port 3002 is running
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3002"') do (
        echo     PID: %%a
        goto next3
    )
    :next3
)
echo.

echo ========================================
echo   Network Information
echo ========================================
echo.

REM Get local IP
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr "IPv4"') do (
    echo Local IP: %%a
    goto gotip
)
:gotip
echo.

echo ========================================
echo   Test URLs
echo ========================================
echo.
echo From Server (localhost):
echo   http://localhost
echo   http://localhost:4001
echo   http://localhost:3002
echo.
echo From Internet:
echo   http://system.xgym.website
echo   http://client.xgym.website
echo.
echo With HTTPS:
echo   https://system.xgym.website
echo   https://client.xgym.website
echo.

pause
