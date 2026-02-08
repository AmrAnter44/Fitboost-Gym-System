@echo off
REM Start X Gym System

title X Gym - Starting System
color 0B

cd /d "%~dp0"

echo.
echo ========================================
echo   X Gym System - Starting...
echo ========================================
echo.

echo Starting Main System (Port 4001)...
npm run dev

echo.
echo ========================================
echo   System Started!
echo ========================================
echo.
echo [*] Main System: http://localhost:4001
echo.
pause
