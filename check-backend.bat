@echo off
cls
echo ========================================
echo   Backend Status Check
echo ========================================
echo.

echo [1] Checking if backend is running on port 3001...
netstat -ano | findstr :3001
if %ERRORLEVEL% EQU 0 (
    echo ✅ Backend is RUNNING
) else (
    echo ❌ Backend is NOT RUNNING!
    echo.
    echo You need to start the backend first:
    echo   1. cd server
    echo   2. npm start
    echo.
    echo OR just run: start-all.bat
)

echo.
echo [2] Testing backend health endpoint...
curl -s http://localhost:3001/api/health 2>nul
if %ERRORLEVEL% EQU 0 (
    echo ✅ Backend responding
) else (
    echo ❌ Backend not responding
)

echo.
echo [3] Checking server directory...
if exist "server\server.js" (
    echo ✅ Server files found
) else (
    echo ❌ Server files missing!
)

echo.
echo [4] Checking .env file...
if exist "server\.env" (
    echo ✅ .env file exists
) else (
    echo ❌ .env file missing! Copy .env.example to .env
)

echo.
echo ========================================
echo   Quick Fix:
echo   Just run: start-all.bat
echo ========================================
pause
