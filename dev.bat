@echo off
setlocal
cd /d "%~dp0"

echo === Greenroom dev launcher ===

echo.
echo [1/3] Freeing port 3000 (if anything is on it)...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000" ^| findstr "LISTENING"') do (
    echo   Killing PID %%a
    taskkill /PID %%a /F >nul 2>&1
)

echo.
echo [2/3] Clearing .next build cache...
if exist ".next" (
    rmdir /s /q ".next"
    echo   .next removed.
) else (
    echo   .next not present, skipping.
)

echo.
echo [3/3] Starting Next.js on http://localhost:3000 ...
echo   (Ctrl+C in this window stops the server.)
echo.
call npm run dev

endlocal
