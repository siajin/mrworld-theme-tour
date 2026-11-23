@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
if errorlevel 1 goto failed
if /i "%~1"=="--verify" goto verify

echo Preparing backend before opening server windows...
call "%~dp0start-backend.bat" --prepare
if errorlevel 1 goto failed
echo Preparing frontend before opening server windows...
call "%~dp0start-frontend.bat" --prepare
if errorlevel 1 goto failed

start "MrWorld Backend" cmd /d /k ""%~dp0start-backend.bat" --run"
if errorlevel 1 goto failed
start "MrWorld Frontend" cmd /d /k ""%~dp0start-frontend.bat" --run"
if errorlevel 1 goto failed
echo Both server windows were opened. Customer: http://localhost:3000
exit /b 0

:verify
call "%~dp0start-backend.bat" --verify
if errorlevel 1 goto failed
call "%~dp0start-frontend.bat" --verify
if errorlevel 1 goto failed
echo All startup checks passed. No installation, database connection or server was started.
exit /b 0

:failed
echo Startup stopped because a required step failed. Review the error above.
exit /b 1
