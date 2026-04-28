# Cauldron OS — PowerShell Quick Start
# Run this script from the cauldron-os folder

$ErrorActionPreference = 'Stop'

Write-Host ''
Write-Host '========================================' -ForegroundColor Magenta
Write-Host '   Cauldron OS 2.3.0 — Witch Daddy Labs' -ForegroundColor Magenta
Write-Host '========================================' -ForegroundColor Magenta
Write-Host ''

# Check Node.js
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host '[ERROR] Node.js is not installed or not in PATH.' -ForegroundColor Red
    Write-Host '        Download from https://nodejs.org' -ForegroundColor Yellow
    Write-Host ''
    Pause
    exit 1
}

# Install deps if missing
if (-not (Test-Path 'node_modules')) {
    Write-Host '[INFO] node_modules not found — running npm install...' -ForegroundColor Cyan
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host '[ERROR] npm install failed.' -ForegroundColor Red
        Pause
        exit 1
    }
}

# Set model and start
$env:OLLAMA_MODEL = 'qwen3.6:9b'

Write-Host '[INFO] Starting Cauldron OS...' -ForegroundColor Green
Write-Host "       Model: `$env:OLLAMA_MODEL"
Write-Host "       URL:   http://localhost:3000"
Write-Host ''
Write-Host '       Press Ctrl+C to stop the server.' -ForegroundColor Gray
Write-Host '========================================' -ForegroundColor Magenta
Write-Host ''

node server.js

if ($LASTEXITCODE -ne 0) {
    Write-Host ''
    Write-Host '[ERROR] Server crashed. Make sure Ollama is running:' -ForegroundColor Red
    Write-Host '        ollama serve' -ForegroundColor Yellow
    Write-Host ''
}

Pause
