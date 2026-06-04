# Cauldron OS - Windows PowerShell Quick Start

$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

function Stop-WithMessage {
    param([string]$Message)
    Write-Host ''
    Write-Host "[ERROR] $Message" -ForegroundColor Red
    Write-Host ''
    Read-Host 'Press Enter to close'
    exit 1
}

$nodeCommand = Get-Command node -ErrorAction SilentlyContinue
$npmCommand = Get-Command npm.cmd -ErrorAction SilentlyContinue
if (-not $npmCommand) {
    $npmCommand = Get-Command npm -ErrorAction SilentlyContinue
}

if (-not $nodeCommand -or -not $npmCommand) {
    Stop-WithMessage 'Node.js 18 or newer is required. Download the LTS version from https://nodejs.org, then run this launcher again.'
}

$nodeMajor = [int](& node -p "Number(process.versions.node.split('.')[0])")
if ($nodeMajor -lt 18) {
    Stop-WithMessage "Node.js 18 or newer is required. Your installed version is $(& node --version)."
}

$version = & node -p "require('./package.json').version"

Write-Host ''
Write-Host '========================================' -ForegroundColor Magenta
Write-Host "   Cauldron OS $version - Witch Daddy Labs" -ForegroundColor Magenta
Write-Host '========================================' -ForegroundColor Magenta
Write-Host ''

& $npmCommand.Source ls --depth=0 *> $null
if ($LASTEXITCODE -ne 0) {
    Write-Host '[SETUP] Installing or repairing dependencies. This may take a minute...' -ForegroundColor Cyan
    & $npmCommand.Source install --no-audit --no-fund
    if ($LASTEXITCODE -ne 0) {
        Stop-WithMessage 'Dependency installation failed. Check your internet connection, then run this launcher again.'
    }
}

Write-Host '[READY] Starting Cauldron OS at http://localhost:3000' -ForegroundColor Green
Write-Host '        Keep this window open. Press Ctrl+C to stop.' -ForegroundColor Gray
Write-Host ''
Write-Host 'Use an OpenAI or Gemini API key in Settings, or run Ollama locally.' -ForegroundColor Gray
Write-Host ''

& $npmCommand.Source start

if ($LASTEXITCODE -ne 0) {
    Stop-WithMessage 'Cauldron OS stopped unexpectedly. Review the error above, then run this launcher again.'
}
