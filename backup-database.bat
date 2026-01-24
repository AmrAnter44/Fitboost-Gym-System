@echo off
REM Database Backup Script
REM يعمل نسخة احتياطية من قاعدة البيانات

echo ========================================
echo   Database Backup Script
echo ========================================
echo.

REM Create backups directory if not exists
if not exist "backups" mkdir backups

REM Generate timestamp
for /f "tokens=2 delims==" %%I in ('wmic os get localdatetime /value') do set datetime=%%I
set datetime=%datetime:~0,8%-%datetime:~8,6%

REM Backup filename
set BACKUP_FILE=backups\gym-backup-%datetime%.db

REM Check if database exists
if not exist "prisma\prisma\gym.db" (
    echo [ERROR] Database not found at prisma\prisma\gym.db
    pause
    exit /b 1
)

REM Create backup
echo [INFO] Creating backup: %BACKUP_FILE%
copy "prisma\prisma\gym.db" "%BACKUP_FILE%"

if errorlevel 1 (
    echo [ERROR] Backup failed!
    pause
    exit /b 1
) else (
    echo [SUCCESS] Backup created successfully!
    echo.
    echo File: %BACKUP_FILE%

    REM Show backup size
    for %%A in ("%BACKUP_FILE%") do echo Size: %%~zA bytes
    echo.

    REM Delete backups older than 30 days
    echo [INFO] Cleaning old backups (older than 30 days)...
    forfiles /p "backups" /s /m *.db /d -30 /c "cmd /c del @path" 2>nul

    echo.
    echo [INFO] Backup complete!
)

pause
