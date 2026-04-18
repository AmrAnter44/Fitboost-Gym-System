@echo off
echo ====================================
echo   Fix Database - Add pushToken field
echo ====================================
echo.

REM التأكد من وجود sqlite3
where sqlite3 >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] sqlite3 not found in PATH!
    echo Please install SQLite3 or run the SQL manually
    pause
    exit /b 1
)

REM العثور على قاعدة البيانات
set DB_PATH=

REM البحث في مجلد Program Files
if exist "C:\Program Files\Gym Management\resources\app.asar.unpacked\prisma\gym.db" (
    set DB_PATH=C:\Program Files\Gym Management\resources\app.asar.unpacked\prisma\gym.db
)

if "%DB_PATH%"=="" (
    echo [ERROR] Database not found!
    echo Please locate gym.db manually and run:
    echo sqlite3 gym.db "ALTER TABLE Member ADD COLUMN pushToken TEXT;"
    pause
    exit /b 1
)

echo Found database at: %DB_PATH%
echo.
echo Adding pushToken column...

sqlite3 "%DB_PATH%" "ALTER TABLE Member ADD COLUMN pushToken TEXT;"

if %ERRORLEVEL% EQU 0 (
    echo.
    echo [SUCCESS] pushToken field added successfully!
    echo Please restart the application.
) else (
    echo.
    echo [INFO] Column may already exist (this is OK)
    echo If you still see errors, please check the database manually.
)

echo.
pause
