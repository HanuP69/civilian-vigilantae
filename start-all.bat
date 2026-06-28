@echo off
cls
echo ========================================
echo  Community Hero - Starting All Servers
echo ========================================
echo.

echo [1/3] Starting Backend Server...
cd server
start "Community Hero Backend" cmd /k "npm start"
echo     Backend starting on http://localhost:3001
timeout /t 3 /nobreak >nul
cd ..

echo.
echo [2/3] Starting Frontend Dev Server...
cd client
start "Community Hero Frontend" cmd /k "npm run dev"
echo     Frontend starting on http://localhost:5173
cd ..

echo.
echo [3/3] All Done!
echo ========================================
echo  Backend:  http://localhost:3001
echo  Frontend: http://localhost:5173
echo ========================================
echo.
echo Press any key to close this window...
pause >nul
