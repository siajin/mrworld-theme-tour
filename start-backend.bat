@echo off
setlocal
chcp 65001 >nul
set "PYTHONUTF8=1"
set "PYTHONIOENCODING=utf-8"
cd /d "%~dp0backend"
if errorlevel 1 goto failed
set "VENV_PY=%CD%\.venv\Scripts\python.exe"

if /i "%~1"=="--verify" goto verify
if /i "%~1"=="--run" goto run
if exist "%VENV_PY%" goto install

echo [1/3] Creating a Python virtual environment...
where py >nul 2>nul
if errorlevel 1 goto use_python
py -3 -m venv .venv
if errorlevel 1 goto failed
goto install
:use_python
where python >nul 2>nul
if errorlevel 1 goto missing_python
python -m venv .venv
if errorlevel 1 goto failed

:install
"%VENV_PY%" -c "import sys; sys.exit(0 if sys.version_info >= (3, 11) else 1)"
if errorlevel 1 goto unsupported_python
echo [2/3] Installing backend dependencies...
"%VENV_PY%" -m pip install --disable-pip-version-check -r requirements.txt
if errorlevel 1 goto failed
echo [3/3] Preparing the configured database without resetting existing data...
"%VENV_PY%" scripts\prepare_demo.py
if errorlevel 1 goto failed
if /i "%~1"=="--prepare" exit /b 0

:run
call :verify_environment
if errorlevel 1 goto failed
echo.
echo Backend: http://127.0.0.1:8000/docs
"%VENV_PY%" -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
if errorlevel 1 goto failed
exit /b 0

:verify
call :verify_environment
if errorlevel 1 goto failed
echo Backend verification passed. No database or server was started.
exit /b 0

:verify_environment
if not exist "%VENV_PY%" exit /b 1
"%VENV_PY%" -c "import sys; sys.exit(0 if sys.version_info >= (3, 11) else 1)"
if errorlevel 1 exit /b 1
"%VENV_PY%" -c "import fastapi, sqlalchemy, pydantic_settings, uvicorn"
if errorlevel 1 exit /b 1
exit /b 0

:missing_python
echo Python 3.11 or newer is required. Install Python and retry.
exit /b 1
:unsupported_python
echo Python 3.11 or newer is required. The existing virtual environment is incompatible.
exit /b 1
:failed
echo Backend setup or execution failed. Review the error above; the server was not continued.
exit /b 1
