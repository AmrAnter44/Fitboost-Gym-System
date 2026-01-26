@echo off
chcp 65001 >nul
echo ========================================
echo فحص صحة النظام - System Health Check
echo ========================================
echo.

REM تسجيل الوقت
echo التاريخ والوقت - Date/Time: %date% %time%
echo.

REM 1. حالة التطبيقات
echo ========================================
echo [1] حالة التطبيقات - Application Status
echo ========================================
call pm2 status
echo.

REM 2. المنافذ المستخدمة
echo ========================================
echo [2] المنافذ المستخدمة - Port Usage
echo ========================================
echo Port 4001 (النظام الرئيسي - Main System):
netstat -ano | findstr ":4001" | findstr "LISTENING"
echo.
echo Port 3002 (بوابة العملاء - Client Portal):
netstat -ano | findstr ":3002" | findstr "LISTENING"
echo.
echo Port 80 (Nginx):
netstat -ano | findstr ":80" | findstr "LISTENING"
echo.

REM 3. آخر الـ logs
echo ========================================
echo [3] آخر رسائل النظام - Recent Logs
echo ========================================
echo.
echo --- النظام الرئيسي - Main System ---
call pm2 logs xgym-system --lines 5 --nostream
echo.
echo --- بوابة العملاء - Client Portal ---
call pm2 logs xgym-client --lines 5 --nostream
echo.

REM 4. استهلاك الموارد
echo ========================================
echo [4] استهلاك الموارد - Resource Usage
echo ========================================
echo.
for /f "tokens=1-4" %%a in ('pm2 jlist ^| findstr "name\|cpu\|memory"') do echo %%a %%b %%c %%d
echo.

REM 5. قاعدة البيانات
echo ========================================
echo [5] قاعدة البيانات - Database
echo ========================================
if exist "C:\Users\amran\Desktop\x gym\prisma\gym.db" (
    echo ✅ قاعدة البيانات موجودة - Database exists
    for %%A in ("C:\Users\amran\Desktop\x gym\prisma\gym.db") do (
        echo الحجم - Size: %%~zA bytes
        echo آخر تعديل - Last Modified: %%~tA
    )
) else (
    echo ❌ قاعدة البيانات غير موجودة! - Database not found!
)
echo.

REM 6. النسخ الاحتياطية
echo ========================================
echo [6] النسخ الاحتياطية - Backups
echo ========================================
if exist "C:\Users\amran\Desktop\x gym\prisma\backups" (
    echo عدد النسخ الاحتياطية - Number of backups:
    dir /b "C:\Users\amran\Desktop\x gym\prisma\backups\gym-backup-*.db" 2>nul | find /c ".db"
    echo.
    echo آخر 3 نسخ احتياطية - Last 3 backups:
    dir /b /o-d "C:\Users\amran\Desktop\x gym\prisma\backups\gym-backup-*.db" 2>nul | findstr /n "^" | findstr "^[1-3]:"
) else (
    echo ⚠️ لا يوجد مجلد للنسخ الاحتياطية
    echo ⚠️ No backup folder found
)
echo.

REM 7. المساحة المتاحة
echo ========================================
echo [7] المساحة المتاحة - Disk Space
echo ========================================
for /f "tokens=3" %%a in ('dir /-c C:\ 2^>nul ^| findstr /i "bytes free"') do echo المساحة المتاحة - Free Space: %%a bytes
echo.

REM 8. اختبار الاتصال
echo ========================================
echo [8] اختبار الاتصال - Connectivity Test
echo ========================================
echo.
echo اختبار المنفذ المحلي 4001 - Testing local port 4001:
powershell -Command "try { $response = Invoke-WebRequest -Uri 'http://localhost:4001' -TimeoutSec 5 -UseBasicParsing; Write-Host '✅ النظام الرئيسي يعمل - Main system is responding' } catch { Write-Host '❌ النظام الرئيسي لا يستجيب - Main system not responding' }"
echo.
echo اختبار المنفذ المحلي 3002 - Testing local port 3002:
powershell -Command "try { $response = Invoke-WebRequest -Uri 'http://localhost:3002' -TimeoutSec 5 -UseBasicParsing; Write-Host '✅ بوابة العملاء تعمل - Client portal is responding' } catch { Write-Host '❌ بوابة العملاء لا تستجيب - Client portal not responding' }"
echo.

REM 9. تقييم الصحة العامة
echo ========================================
echo [9] تقييم الصحة العامة - Overall Health
echo ========================================
echo.

REM التحقق من حالة التطبيقات
call pm2 status | findstr "online" >nul
if %errorlevel% equ 0 (
    echo ✅ التطبيقات: تعمل بشكل جيد
    echo ✅ Applications: Running well
) else (
    echo ❌ التطبيقات: يوجد مشكلة
    echo ❌ Applications: Issues detected
)
echo.

REM التحقق من قاعدة البيانات
if exist "C:\Users\amran\Desktop\x gym\prisma\gym.db" (
    echo ✅ قاعدة البيانات: موجودة
    echo ✅ Database: Present
) else (
    echo ❌ قاعدة البيانات: غير موجودة
    echo ❌ Database: Missing
)
echo.

REM التوصيات
echo ========================================
echo التوصيات - Recommendations
echo ========================================
echo.

REM التحقق من النسخ الاحتياطية
dir "C:\Users\amran\Desktop\x gym\prisma\backups\gym-backup-*.db" >nul 2>&1
if %errorlevel% neq 0 (
    echo ⚠️ قم بإنشاء نسخة احتياطية: backup.bat
    echo ⚠️ Create a backup: backup.bat
)

REM التحقق من آخر إعادة تشغيل
for /f "tokens=*" %%a in ('pm2 jlist ^| findstr "pm_uptime"') do (
    echo ⚠️ فكر في إعادة تشغيل أسبوعية: pm2 restart all
    echo ⚠️ Consider weekly restart: pm2 restart all
    goto :skip_uptime
)
:skip_uptime

echo.
echo للمزيد من الأوامر، راجع: QUICK_REFERENCE.md
echo For more commands, see: QUICK_REFERENCE.md
echo.

echo ========================================
echo الفحص مكتمل - Check Complete
echo ========================================
echo.

pause
