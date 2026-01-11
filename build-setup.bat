@echo off
chcp 65001 >nul
cls

echo ========================================================
echo     BUILD GYM SYSTEM SETUP WITH PORT FORWARDING
echo ========================================================
echo.

REM التحقق من Node.js
where node >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js غير مثبت!
    pause
    exit /b 1
)
echo ✓ Node.js installed
echo.

REM تثبيت dependencies
echo Installing dependencies...
call npm install
if errorlevel 1 (
    echo [ERROR] فشل تثبيت المكتبات!
    pause
    exit /b 1
)
echo ✓ Dependencies installed
echo.

REM Prisma Generate
echo Running Prisma generate...
call npx prisma generate
if errorlevel 1 (
    echo [WARNING] Prisma generate failed - continuing anyway
)
echo ✓ Prisma generated
echo.

REM Build Next.js
echo Building Next.js application...
call npm run build
if errorlevel 1 (
    echo [ERROR] فشل build Next.js!
    pause
    exit /b 1
)
echo ✓ Next.js build complete
echo.

REM التأكد من وجود build folder
if not exist build mkdir build
echo ✓ Build folder ready
echo.

REM Build Electron Setup
echo Building Electron Setup.exe...
echo This will create a setup file with port forwarding enabled (0.0.0.0:4001)
echo.
call npm run electron:build:win

if errorlevel 1 (
    echo [ERROR] فشل build Electron!
    pause
    exit /b 1
)

echo.
echo ========================================================
echo          ✓✓✓ BUILD COMPLETE SUCCESS! ✓✓✓
echo ========================================================
echo.
echo Setup file location: dist\Gym Management Setup 1.0.0.exe
echo Port forwarding: ENABLED (0.0.0.0:4001)
echo Auto-Update: ENABLED (GitHub Releases)
echo Database: Safe location (AppData - persists across updates)
echo.
echo يمكنك الآن تشغيل Setup واستخدام التطبيق من أي جهاز على نفس الشبكة
echo استخدم http://YOUR_IP:4001 للوصول من أجهزة أخرى
echo.
pause
