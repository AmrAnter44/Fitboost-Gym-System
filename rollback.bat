@echo off
chcp 65001 >nul
echo ========================================
echo استعادة نسخة سابقة - Rollback System
echo ========================================
echo.

set BACKUP_DIR=C:\Users\amran\Desktop\x gym\prisma\backups

REM التحقق من وجود مجلد النسخ الاحتياطي
if not exist "%BACKUP_DIR%" (
    echo ❌ لا يوجد نسخ احتياطية
    echo ❌ No backups found
    pause
    exit /b 1
)

REM عرض النسخ الاحتياطية المتاحة
echo النسخ الاحتياطية المتاحة - Available backups:
echo.
dir /b /o-d "%BACKUP_DIR%\gym-backup-*.db" | findstr /n "^"
echo.

REM طلب رقم النسخة
set /p BACKUP_NUM="أدخل رقم النسخة الاحتياطية (Enter backup number): "

REM الحصول على اسم الملف المطلوب
set COUNT=0
for /f "delims=" %%f in ('dir /b /o-d "%BACKUP_DIR%\gym-backup-*.db"') do (
    set /a COUNT+=1
    if !COUNT! equ %BACKUP_NUM% set BACKUP_FILE=%%f
)

if not defined BACKUP_FILE (
    echo ❌ رقم غير صحيح
    echo ❌ Invalid number
    pause
    exit /b 1
)

echo.
echo سيتم استعادة النسخة: %BACKUP_FILE%
echo Will restore backup: %BACKUP_FILE%
echo.
set /p CONFIRM="هل أنت متأكد؟ (y/n) Are you sure? (y/n): "

if /i not "%CONFIRM%"=="y" (
    echo تم الإلغاء - Cancelled
    pause
    exit /b 0
)

echo.
echo ========================================
echo جاري استعادة النسخة الاحتياطية...
echo Restoring backup...
echo ========================================
echo.

REM إيقاف التطبيقات
echo [1/4] إيقاف التطبيقات... Stopping applications...
call pm2 stop xgym-system
call pm2 stop xgym-client
echo ✅ تم إيقاف التطبيقات
echo.

REM نسخ احتياطي للنسخة الحالية قبل الاستعادة
echo [2/4] نسخ احتياطي للنسخة الحالية... Backing up current version...
set TIMESTAMP=%date:~-4,4%%date:~-10,2%%date:~-7,2%-%time:~0,2%%time:~3,2%%time:~6,2%
set TIMESTAMP=%TIMESTAMP: =0%
copy "C:\Users\amran\Desktop\x gym\prisma\gym.db" "%BACKUP_DIR%\gym-before-rollback-%TIMESTAMP%.db"
echo ✅ تم النسخ الاحتياطي
echo.

REM استعادة النسخة المختارة
echo [3/4] استعادة النسخة... Restoring backup...
copy "%BACKUP_DIR%\%BACKUP_FILE%" "C:\Users\amran\Desktop\x gym\prisma\gym.db" /y
if %errorlevel% equ 0 (
    echo ✅ تم استعادة النسخة بنجاح
    echo ✅ Backup restored successfully
) else (
    echo ❌ فشلت الاستعادة
    echo ❌ Restore failed
    echo جاري إعادة النسخة الأصلية... Restoring original...
    copy "%BACKUP_DIR%\gym-before-rollback-%TIMESTAMP%.db" "C:\Users\amran\Desktop\x gym\prisma\gym.db" /y
    pause
    exit /b 1
)
echo.

REM إعادة تشغيل التطبيقات
echo [4/4] إعادة تشغيل التطبيقات... Restarting applications...
call pm2 restart xgym-system
call pm2 restart xgym-client
echo ✅ تم إعادة التشغيل
echo.

echo ========================================
echo ✅ اكتملت الاستعادة بنجاح!
echo ✅ Rollback completed successfully!
echo ========================================
echo.

REM عرض الحالة
echo حالة التطبيقات - Application Status:
call pm2 status
echo.

echo اختبر النظام الآن - Test the system now:
echo   - http://system.xgym.website
echo   - http://client.xgym.website
echo.

pause
