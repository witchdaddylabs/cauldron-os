@echo off
REM Cauldron OS — Windows Quick Start
REM Place this file in the cauldron-os folder and double-click to run

cd /d "%~dp0"

echo.
echo ========================================
echo    Cauldron OS 2.3.0 — Witch Daddy Labs
echo ========================================
echo.

REM Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js is not installed or not in PATH.
    echo         Download from https://nodejs.org
    echo.
    pause
    exit /b 1
)

REM Check if npm dependencies are installed
if not exist "node_modules" (
    echo [INFO] node_modules not found — running npm install...
    call npm install
    if %ERRORLEVEL% NEQ 0 (
        echo [ERROR] npm install failed. Check your internet connection.
        pause
        exit /b 1
    )
)

REM Set the model — change this if you have a different model
set OLLAMA_MODEL=qwen3.6:9b

echo [INFO] Starting Cauldron OS...
echo       Model: %OLLAMA_MODEL%
echo       URL:   http://localhost:3000
echo.
echo       Press Ctrl+C to stop the server.
echo ========================================
echo.

node server.js

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Server crashed. Make sure Ollama is running:
    echo         ollama serve
    echo.
)

pause
