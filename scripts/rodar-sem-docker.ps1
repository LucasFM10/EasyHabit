# Script para rodar o projeto sem Docker (PocketBase.exe local + SvelteKit)

$ProjectRoot = Resolve-Path "$PSScriptRoot\.."
$PbExe = "$ProjectRoot\apps\pocketbase\pocketbase.exe"
$PbData = "$ProjectRoot\apps\pocketbase\pb_data"
$PbMigrations = "$ProjectRoot\apps\pocketbase\pb_migrations"
$RootEnvFile = "$ProjectRoot\.env"
$RootEnvEx = "$ProjectRoot\.env.example"

# Auto-setup .env se necessário
if (-not (Test-Path $RootEnvFile) -and (Test-Path $RootEnvEx)) { Copy-Item $RootEnvEx $RootEnvFile }

# Auto-setup node_modules se necessário
$NodeModules = "$ProjectRoot\apps\web\node_modules"
if (-not (Test-Path $NodeModules)) {
    Write-Host "📦 Primeira execução detectada! Instalando dependências..." -ForegroundColor Yellow
    Set-Location "$ProjectRoot\apps\web"
    npm install
    Set-Location $ProjectRoot
}

# Carrega variáveis de ambiente do .env na raiz se existir
if (Test-Path $RootEnvFile) {
    Get-Content $RootEnvFile | ForEach-Object {
        if ($_ -match '^\s*([^#=]+)\s*=\s*(.*)\s*$') {
            [System.Environment]::SetEnvironmentVariable($matches[1].Trim(), $matches[2].Trim(), "Process")
        }
    }
}

if (-not (Test-Path $PbExe)) {
    Write-Host "📥 pocketbase.exe não encontrado em apps/pocketbase. Baixando versão v0.39.4..." -ForegroundColor Yellow
    $ZipPath = "$ProjectRoot\apps\pocketbase\pocketbase.zip"
    $Url = "https://github.com/pocketbase/pocketbase/releases/download/v0.39.4/pocketbase_0.39.4_windows_amd64.zip"
    
    try {
        Invoke-WebRequest -Uri $Url -OutFile $ZipPath
        Expand-Archive -Path $ZipPath -DestinationPath "$ProjectRoot\apps\pocketbase" -Force
        Remove-Item $ZipPath -Force
        Remove-Item "$ProjectRoot\apps\pocketbase\CHANGELOG.md" -ErrorAction SilentlyContinue
        Remove-Item "$ProjectRoot\apps\pocketbase\LICENSE.md" -ErrorAction SilentlyContinue
        Write-Host "✅ PocketBase baixado com sucesso!" -ForegroundColor Green
    } catch {
        Write-Host "⚠️ Falha ao baixar o PocketBase automaticamente. Baixe de pocketbase.io e coloque em apps/pocketbase/pocketbase.exe" -ForegroundColor Red
        exit 1
    }
}

Write-Host "🚀 Iniciando PocketBase localmente..." -ForegroundColor Cyan
$pbProcess = Start-Process -FilePath $PbExe -ArgumentList "serve --dir=`"$PbData`" --migrationsDir=`"$PbMigrations`"" -PassThru

Write-Host "⚡ Iniciando SvelteKit - apps/web..." -ForegroundColor Green
Set-Location "$ProjectRoot\apps\web"

try {
    npm run dev
} finally {
    Write-Host "🛑 Encerrando PocketBase..." -ForegroundColor Yellow
    if ($pbProcess -and -not $pbProcess.HasExited) {
        Stop-Process -Id $pbProcess.Id -Force
    }
}
