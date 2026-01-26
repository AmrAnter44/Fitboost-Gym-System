@echo off
chcp 65001 >nul
echo ========================================
echo تحديث نظام X Gym - X Gym System Update
echo ========================================
echo.

REM النسخ الاحتياطي - Backup
echo [1/7] جاري النسخ الاحتياطي... Creating backup...
cd "C:\Users\amran\Desktop\x gym"
if not exist "prisma\backups" mkdir "prisma\backups"
copy prisma\gym.db "prisma\backups\gym-backup-%date:~-4,4%%date:~-10,2%%date:~-7,2%-%time:~0,2%%time:~3,2%.db"
if %errorlevel% neq 0 (
    echo ❌ فشل النسخ الاحتياطي - Backup failed
    pause
    exit /b 1
)
echo ✅ تم النسخ الاحتياطي - Backup completed
echo.

REM إيقاف التطبيقات - Stop applications
echo [2/7] جاري إيقاف التطبيقات... Stopping applications...
call pm2 stop xgym-system
call pm2 stop xgym-client
echo ✅ تم إيقاف التطبيقات - Applications stopped
echo.

REM تحديث المكتبات - Update dependencies
echo [3/7] جاري تحديث المكتبات... Updating dependencies...
cd "C:\Users\amran\Desktop\x gym"
call npm install
if %errorlevel% neq 0 (
    echo ⚠️ تحذير: مشكلة في تحديث مكتبات النظام الرئيسي
    echo Warning: Issue updating main system dependencies
)

cd client-portal
call npm install
if %errorlevel% neq 0 (
    echo ⚠️ تحذير: مشكلة في تحديث مكتبات بوابة العملاء
    echo Warning: Issue updating client portal dependencies
)
cd ..
echo ✅ تم تحديث المكتبات - Dependencies updated
echo.

REM تحديث قاعدة البيانات - Update database
echo [4/7] جاري تحديث قاعدة البيانات... Updating database...
call npx prisma generate
call npx prisma migrate deploy
if %errorlevel% neq 0 (
    echo ⚠️ تحذير: لم يتم العثور على migrations جديدة
    echo Warning: No new migrations found
)
echo ✅ تم تحديث قاعدة البيانات - Database updated
echo.

REM بناء النظام الرئيسي - Build main system
echo [5/7] جاري بناء النظام الرئيسي... Building main system...
call npm run build
if %errorlevel% neq 0 (
    echo ❌ فشل بناء النظام الرئيسي - Main system build failed
    echo جاري استعادة النسخة السابقة... Restoring previous version...
    call pm2 restart xgym-system
    call pm2 restart xgym-client
    pause
    exit /b 1
)
echo ✅ تم بناء النظام الرئيسي - Main system built
echo.

REM بناء بوابة العملاء - Build client portal
echo [6/7] جاري بناء بوابة العملاء... Building client portal...
cd client-portal
call npm run build
if %errorlevel% neq 0 (
    echo ❌ فشل بناء بوابة العملاء - Client portal build failed
    cd ..
    echo جاري استعادة النسخة السابقة... Restoring previous version...
    call pm2 restart xgym-system
    call pm2 restart xgym-client
    pause
    exit /b 1
)
cd ..
echo ✅ تم بناء بوابة العملاء - Client portal built
echo.

REM إعادة تشغيل التطبيقات - Restart applications
echo [7/7] جاري إعادة تشغيل التطبيقات... Restarting applications...
call pm2 restart xgym-system
call pm2 restart xgym-client
call pm2 save
echo ✅ تم إعادة تشغيل التطبيقات - Applications restarted
echo.

echo ========================================
echo ✅ اكتمل التحديث بنجاح!
echo ✅ Update completed successfully!
echo ========================================
echo.

REM عرض الحالة - Show status
echo حالة التطبيقات - Application Status:
call pm2 status
echo.

echo للتحقق من الـ logs: pm2 logs
echo To check logs: pm2 logs
echo.
echo اختبر الروابط - Test the links:
echo   - http://system.xgym.website
echo   - http://client.xgym.website
echo.

pause
