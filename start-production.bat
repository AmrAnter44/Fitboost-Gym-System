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

REM Copy .env file to standalone folder (CRITICAL for JWT_SECRET)
if exist .next\standalone (
    echo [INFO] Copying .env to standalone folder...
    copy /Y .env .next\standalone\.env >nul 2>&1
    if errorlevel 1 (
        echo [WARN] Could not copy .env file
    ) else (
        echo [OK] .env copied to standalone folder
    )
)

REM Copy database to standalone folder if needed
if exist prisma\prisma\gym.db (
    if not exist .next\standalone\prisma\prisma (
        mkdir .next\standalone\prisma\prisma
    )
    echo [INFO] Copying database to standalone folder...
    copy /Y prisma\prisma\gym.db .next\standalone\prisma\prisma\gym.db >nul 2>&1
)

REM Start the application
echo [INFO] Starting Gym System in production mode...
echo.

REM Check if standalone-server.js exists in standalone folder
if exist .next\standalone\standalone-server.js (
    echo [INFO] Using standalone-server.js wrapper to load .env...
    cd .next\standalone
    node standalone-server.js
) else (
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
)
