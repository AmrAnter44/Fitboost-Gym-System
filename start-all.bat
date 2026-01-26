@echo off
chcp 65001 >nul
echo ========================================
echo تشغيل نظام X Gym الكامل
echo Starting Complete X Gym System
echo ========================================
echo.

REM التحقق من PM2
where pm2 >nul 2>&1
if %errorlevel% neq 0 (
    echo ⚠️ PM2 غير مثبت - PM2 not installed
    echo جاري التثبيت... Installing...
    call npm install -g pm2
    if %errorlevel% neq 0 (
        echo ❌ فشل تثبيت PM2 - Failed to install PM2
        echo.
        echo جاري استخدام الطريقة البديلة...
        echo Using alternative method...
        goto :manual_start
    )
)

echo [1/4] إيقاف التطبيقات القديمة... Stopping old apps...
call pm2 delete xgym-system 2>nul
call pm2 delete xgym-client 2>nul
echo ✅ تم
echo.

echo [2/4] بناء النظام الرئيسي... Building main system...
cd "C:\Users\amran\Desktop\x gym"
call npm run build
if %errorlevel% neq 0 (
    echo ❌ فشل البناء - Build failed
    pause
    exit /b 1
)
echo ✅ تم
echo.

echo [3/4] بناء بوابة العملاء... Building client portal...
cd "C:\Users\amran\Desktop\x gym\client-portal"
call npm run build
if %errorlevel% neq 0 (
    echo ❌ فشل البناء - Build failed
    pause
    exit /b 1
)
echo ✅ تم
echo.

echo [4/4] تشغيل التطبيقات... Starting applications...
cd "C:\Users\amran\Desktop\x gym"
call pm2 start npm --name "xgym-system" -- start
cd client-portal
call pm2 start npm --name "xgym-client" -- start
cd ..

call pm2 save
echo ✅ تم
echo.

goto :show_status

:manual_start
echo ========================================
echo تشغيل يدوي - Manual Start
echo ========================================
echo.
echo سيتم فتح نافذتين منفصلتين...
echo Two separate windows will open...
echo.

start "X Gym - النظام الرئيسي" cmd /k "cd /d C:\Users\amran\Desktop\x gym && npm run dev"
timeout /t 3 >nul
start "X Gym - بوابة العملاء" cmd /k "cd /d C:\Users\amran\Desktop\x gym\client-portal && npm run dev"

echo ✅ تم فتح النوافذ
echo.
goto :end

:show_status
echo ========================================
echo حالة التطبيقات - Applications Status
echo ========================================
call pm2 status
echo.
echo الروابط - Links:
echo   النظام الرئيسي - Main System: http://localhost:4001
echo   بوابة العملاء - Client Portal: http://localhost:3002
echo.
echo للمراقبة - To monitor: pm2 monit
echo للإيقاف - To stop: pm2 stop all
echo.

:end
pause
