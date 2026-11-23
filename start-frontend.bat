@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0frontend"
if errorlevel 1 goto failed
where node >nul 2>nul
if errorlevel 1 goto missing_node
where npm >nul 2>nul
if errorlevel 1 goto missing_node
node -e "const v=process.versions.node.split('.').map(Number); process.exit(v[0]>20 || v[0]===20 && v[1]>=9 ? 0 : 1)"
if errorlevel 1 goto missing_node
if /i "%~1"=="--verify" goto verify
if /i "%~1"=="--run" goto run

echo Installing frontend dependencies...
if not exist package-lock.json goto install_without_lock
call npm ci --no-audit --no-fund
if errorlevel 1 goto failed
goto installed
:install_without_lock
call npm install --no-audit --no-fund
if errorlevel 1 goto failed
:installed
if /i "%~1"=="--prepare" exit /b 0

:run
call :verify_environment
if errorlevel 1 goto failed
echo.
echo Customer: http://localhost:3000   Staff: http://localhost:3000/staff
call npm run dev -- --hostname 127.0.0.1 --port 3000
if errorlevel 1 goto failed
exit /b 0

:verify
call :verify_environment
if errorlevel 1 goto failed
echo Frontend verification passed. No installation or server was started.
exit /b 0

:verify_environment
node -e "require.resolve('next/package.json'); require.resolve('react/package.json')"
if errorlevel 1 exit /b 1
exit /b 0

:missing_node
echo Node.js 20.9 or newer and npm are required. Install Node.js and retry.
exit /b 1
:failed
echo Frontend setup or execution failed. Review the error above; the server was not continued.
exit /b 1
