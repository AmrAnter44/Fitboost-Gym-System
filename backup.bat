@echo off
chcp 65001 >nul
echo ========================================
echo نسخ احتياطي لنظام X Gym
echo X Gym System Backup
echo ========================================
echo.

REM إنشاء مجلد النسخ الاحتياطي إذا لم يكن موجوداً
set BACKUP_DIR=C:\Users\amran\Desktop\x gym\prisma\backups
if not exist "%BACKUP_DIR%" mkdir "%BACKUP_DIR%"

REM إنشاء النسخة الاحتياطية
set TIMESTAMP=%date:~-4,4%%date:~-10,2%%date:~-7,2%-%time:~0,2%%time:~3,2%%time:~6,2%
set TIMESTAMP=%TIMESTAMP: =0%
set BACKUP_FILE=%BACKUP_DIR%\gym-backup-%TIMESTAMP%.db

echo جاري إنشاء النسخة الاحتياطية...
echo Creating backup...
echo.

copy "C:\Users\amran\Desktop\x gym\prisma\gym.db" "%BACKUP_FILE%"

if %errorlevel% equ 0 (
    echo ✅ تم إنشاء النسخة الاحتياطية بنجاح
    echo ✅ Backup created successfully
    echo.
    echo الملف: %BACKUP_FILE%
    echo File: %BACKUP_FILE%
    echo.

    REM عرض حجم الملف
    for %%A in ("%BACKUP_FILE%") do (
        set SIZE=%%~zA
        echo الحجم: !SIZE! بايت
        echo Size: !SIZE! bytes
    )

    REM حذف النسخ الاحتياطية القديمة (أكثر من 30 يوم)
    echo.
    echo جاري حذف النسخ القديمة (أكثر من 30 يوم)...
    echo Deleting old backups (older than 30 days)...
    forfiles /P "%BACKUP_DIR%" /S /M gym-backup-*.db /D -30 /C "cmd /c del @path" 2>nul

    echo.
    echo عدد النسخ الاحتياطية الحالية:
    echo Current number of backups:
    dir /b "%BACKUP_DIR%\gym-backup-*.db" | find /c ".db"
) else (
    echo ❌ فشل إنشاء النسخة الاحتياطية
    echo ❌ Backup failed
    echo.
    echo تحقق من:
    echo Check:
    echo 1. وجود ملف القاعدة الأصلي
    echo    Original database file exists
    echo 2. الأذونات الكافية للكتابة
    echo    Write permissions
    echo 3. المساحة المتاحة على القرص
    echo    Available disk space
)

echo.
echo ========================================
pause
