@echo off
setlocal
set ADB=
where adb >nul 2>nul && set ADB=adb
if not defined ADB if exist "%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe" set ADB=%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe
if not defined ADB if exist "%ProgramFiles%\Android\platform-tools\adb.exe" set ADB=%ProgramFiles%\Android\platform-tools\adb.exe
if not defined ADB if exist "E:\Android Studio\platform-tools\adb.exe" set ADB=E:\Android Studio\platform-tools\adb.exe
if not defined ADB if exist "%~dp0tools\platform-tools\adb.exe" set ADB=%~dp0tools\platform-tools\adb.exe
if not defined ADB echo adb.exe not found. Install Android platform-tools or put it in tools\platform-tools. & pause & exit /b 1
echo Using adb: %ADB%
echo.
echo [1/3] Checking phone - accept the USB debugging prompt on the phone if it appears
"%ADB%" devices
echo.
echo [2/3] Forwarding phone localhost:3000 to this PC
"%ADB%" reverse tcp:3000 tcp:3000
echo.
echo [3/3] Opening the site in the phone browser
"%ADB%" shell am start -a android.intent.action.VIEW -d http://localhost:3000/
echo.
echo On the phone: Chrome menu - "Install app" or "Add to Home screen".
echo Keep the USB cable connected while using the app. Run this file again after reconnecting.
pause
