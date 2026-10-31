@echo off
title FingerGate Access Control System
color 0A
echo ========================================================
echo       GreenValley / FingerGate Access Control System
echo ========================================================
echo.

:: Check Node.js
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js is not found on PATH!
    echo Please install Node.js (v18 or v20+) from https://nodejs.org
    pause
    exit /b 1
)

:: Check if local embedded MariaDB exists and start if needed
if exist ".localdb\mariadb-10.11.8-winx64\bin\mysqld.exe" (
    echo [INFO] Detected embedded MariaDB. Checking database service...
    tasklist /FI "IMAGENAME eq mysqld.exe" 2>NUL | find /I /N "mysqld.exe">NUL
    if "%ERRORLEVEL%"=="1" (
        echo [INFO] Starting embedded MariaDB...
        start "FingerGate MariaDB" /min ".localdb\mariadb-10.11.8-winx64\bin\mysqld.exe" --datadir="%CD%\.localdb\data" --port=3306 --console
        timeout /t 2 /nobreak >nul
    )
)

:: Start the FingerGate Server (Serves API + Built React Frontend on port 3000)
echo [INFO] Starting FingerGate Server on port 3000...
cd /d "%~dp0backend"
start "FingerGate Server (port 3000)" cmd /k "node server.js"

:: Wait 3 seconds for server boot, then open browser
timeout /t 3 /nobreak >nul
echo [INFO] Opening Web Dashboard at http://localhost:3000...
start http://localhost:3000

echo.
echo ========================================================
echo  System is LIVE at: http://localhost:3000
echo  Default Login:
echo    Username: Admin
echo    Password: Admin123!
echo ========================================================
echo.
exit /b 0

