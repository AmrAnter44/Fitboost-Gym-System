@echo off
chcp 65001 >nul
echo ========================================
echo تشغيل النظام الكامل (Development)
echo Starting Complete System (Development)
echo ========================================
echo.

echo [1/2] تشغيل النظام الرئيسي - Starting Main System (Port 4001)...
start "X Gym - Main System" cmd /k "cd /d C:\Users\amran\Desktop\x gym && npm run dev"

echo.
echo ⏳ انتظار 5 ثواني... Waiting 5 seconds...
timeout /t 5 >nul

echo.
echo [2/2] تشغيل بوابة العملاء - Starting Client Portal (Port 3002)...
start "X Gym - Client Portal" cmd /k "cd /d C:\Users\amran\Desktop\x gym\client-portal && npm run dev"

echo.
echo ========================================
echo ✅ تم تشغيل الاتنين!
echo ✅ Both systems started!
echo ========================================
echo.
echo الروابط - Links:
echo   النظام الرئيسي - Main System: http://localhost:4001
echo   بوابة العملاء - Client Portal: http://localhost:3002
echo.
echo لإيقاف التطبيقات، أغلق النوافذ
echo To stop, close the windows
echo.

pause
