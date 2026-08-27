# Script para rodar o projeto via Docker Compose (Com auto-setup)

$ProjectRoot = Resolve-Path "$PSScriptRoot\.."

# Auto-setup .env
$RootEnv = "$ProjectRoot\.env"
$RootEnvEx = "$ProjectRoot\.env.example"
if (-not (Test-Path $RootEnv) -and (Test-Path $RootEnvEx)) { Copy-Item $RootEnvEx $RootEnv }

Write-Host "`n🐳 Subindo PocketBase e SvelteKit via Docker Compose..." -ForegroundColor Cyan
Set-Location $ProjectRoot
docker compose up --build
