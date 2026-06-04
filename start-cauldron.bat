@echo off
setlocal
REM Cauldron OS - Windows double-click launcher

cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 goto :node_missing

where npm >nul 2>nul
if errorlevel 1 goto :node_missing

for /f %%v in ('node -p "Number(process.versions.node.split('.')[0])"') do set NODE_MAJOR=%%v
if %NODE_MAJOR% LSS 18 goto :node_old

for /f %%v in ('node -p "require('./package.json').version"') do set CAULDRON_VERSION=%%v

echo.
echo ========================================
echo    Cauldron OS %CAULDRON_VERSION% - Witch Daddy Labs
echo ========================================
echo.

call npm ls --depth=0 >nul 2>nul
if errorlevel 1 (
    echo [SETUP] Installing or repairing dependencies. This may take a minute...
    call npm install --no-audit --no-fund
    if errorlevel 1 goto :install_failed
)

echo [READY] Starting Cauldron OS at http://localhost:3000
echo         Keep this window open. Press Ctrl+C to stop.
echo.
echo Use an OpenAI or Gemini API key in Settings, or run Ollama locally.
echo.

call npm start
if errorlevel 1 goto :server_failed
goto :end

:node_missing
echo.
echo [ERROR] Node.js 18 or newer is required.
echo         Download the LTS version from https://nodejs.org
goto :pause_error

:node_old
echo.
echo [ERROR] Node.js 18 or newer is required. Installed version:
node --version
goto :pause_error

:install_failed
echo.
echo [ERROR] Dependency installation failed.
echo         Check your internet connection, then run this launcher again.
goto :pause_error

:server_failed
echo.
echo [ERROR] Cauldron OS stopped unexpectedly.
echo         Review the error above, then run this launcher again.

:pause_error
echo.
pause
exit /b 1

:end
endlocal
