@echo off
echo Closing Gym Management app...
taskkill /F /IM "Gym Management.exe" 2>nul
timeout /t 2 >nul

echo Copying database...
copy /Y "prisma\prisma\gym.db" "C:\Users\amran\AppData\Roaming\gym-management\database\gym.db"

echo.
echo Database updated successfully!
echo You can now start the Gym Management app.
pause
