@echo off
REM This script sets up X Gym to start automatically with Windows
REM Run this ONCE as Administrator

title X Gym - Auto Startup Setup
color 0B

echo.
echo ========================================
echo   X Gym Auto Startup Setup
echo ========================================
echo.

REM Get current directory
set SCRIPT_DIR=%~dp0

echo This will make X Gym start automatically when Windows starts.
echo.
echo Press any key to continue or Ctrl+C to cancel...
pause >nul

REM Create startup script in project directory
echo @echo off > "%SCRIPT_DIR%startup-xgym.bat"
echo cd /d "%SCRIPT_DIR%" >> "%SCRIPT_DIR%startup-xgym.bat"
echo start /min "" cmd /c "npm start" >> "%SCRIPT_DIR%startup-xgym.bat"

REM Create scheduled task
echo.
echo [*] Creating scheduled task...
schtasks /create /tn "X Gym Auto Start" /tr "\"%SCRIPT_DIR%startup-xgym.bat\"" /sc onstart /ru SYSTEM /rl HIGHEST /f

if errorlevel 1 (
    echo.
    echo [ERROR] Failed to create scheduled task!
    echo Please run this script as Administrator
    pause
    exit /b 1
)

echo.
echo ========================================
echo   Setup Complete!
echo ========================================
echo.
echo X Gym will now start automatically when Windows starts.
echo.
echo To disable auto-start, run:
echo   schtasks /delete /tn "X Gym Auto Start" /f
echo.
pause
