@echo off
echo ========================================
echo   Gym System - Production Startup
echo ========================================
echo.

REM Check if .env file exists
if not exist .env (
    echo [ERROR] .env file not found!
    echo Please copy .env.example to .env and configure it.
    pause
    exit /b 1
)

REM Check if build exists
if not exist .next (
    echo [INFO] Build not found. Running build...
    call npm run build
    if errorlevel 1 (
        echo [ERROR] Build failed!
        pause
        exit /b 1
    )
)

REM Start the application
echo [INFO] Starting Gym System in production mode...
echo.

REM If PM2 is installed, use it
where pm2 >nul 2>nul
if %errorlevel% equ 0 (
    echo [INFO] Starting with PM2...
    pm2 start ecosystem.config.js
    pm2 logs gym-system
) else (
    echo [INFO] PM2 not found. Starting with npm...
    echo [TIP] Install PM2 for better process management: npm install -g pm2
    echo.
    call npm start
)
