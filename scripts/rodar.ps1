param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$Options
)

$ComDocker = $false
$SemDocker = $false

$ProjectRoot = Resolve-Path "$PSScriptRoot\.."
$RootEnv = "$ProjectRoot\.env"
$RootEnvExample = "$ProjectRoot\.env.example"

if (-not (Test-Path $RootEnv) -and (Test-Path $RootEnvExample)) {
    Copy-Item $RootEnvExample $RootEnv
}

function Start-WithDocker {
    Write-Host "`nSubindo PocketBase e SvelteKit via Docker Compose..." -ForegroundColor Cyan
    Push-Location $ProjectRoot
    try {
        docker compose up --build | Out-Host
        return $LASTEXITCODE
    } finally {
        Pop-Location
    }
}

function Start-WithoutDocker {
    $PbVersion = "0.39.4"
    $PbExe = "$ProjectRoot\apps\pocketbase\pocketbase.exe"
    $PbData = "$ProjectRoot\apps\pocketbase\pb_data"
    $PbMigrations = "$ProjectRoot\apps\pocketbase\pb_migrations"

    if (Test-Path $RootEnv) {
        Get-Content $RootEnv | ForEach-Object {
            if ($_ -match '^\s*([^#=]+)\s*=\s*(.*)\s*$') {
                [System.Environment]::SetEnvironmentVariable($matches[1].Trim(), $matches[2].Trim(), "Process")
            }
        }
    }

    if ($env:PB_VERSION) { $PbVersion = $env:PB_VERSION }

    if (-not (Test-Path "$ProjectRoot\apps\web\node_modules")) {
        Write-Host "Primeira execucao detectada. Instalando dependencias..." -ForegroundColor Yellow
        Push-Location "$ProjectRoot\apps\web"
        try { npm install } finally { Pop-Location }
        if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    }

    if (-not (Test-Path $PbExe)) {
        Write-Host "Baixando PocketBase v$PbVersion..." -ForegroundColor Yellow
        $ZipPath = "$ProjectRoot\apps\pocketbase\pocketbase.zip"
        $Url = "https://github.com/pocketbase/pocketbase/releases/download/v$PbVersion/pocketbase_${PbVersion}_windows_amd64.zip"

        try {
            Invoke-WebRequest -Uri $Url -OutFile $ZipPath
            Expand-Archive -Path $ZipPath -DestinationPath "$ProjectRoot\apps\pocketbase" -Force
            Remove-Item $ZipPath -Force
            Remove-Item "$ProjectRoot\apps\pocketbase\CHANGELOG.md", "$ProjectRoot\apps\pocketbase\LICENSE.md" -ErrorAction SilentlyContinue
        } catch {
            Write-Host "Falha ao baixar o PocketBase: $_" -ForegroundColor Red
            exit 1
        }
    }

    Write-Host "Iniciando PocketBase localmente..." -ForegroundColor Cyan
    $PbProcess = Start-Process -FilePath $PbExe -ArgumentList "serve --dir=`"$PbData`" --migrationsDir=`"$PbMigrations`"" -PassThru

    Write-Host "Iniciando SvelteKit..." -ForegroundColor Green
    Push-Location "$ProjectRoot\apps\web"
    try {
        npm run dev
    } finally {
        Pop-Location
        if ($PbProcess -and -not $PbProcess.HasExited) {
            Write-Host "Encerrando PocketBase..." -ForegroundColor Yellow
            Stop-Process -Id $PbProcess.Id -Force
        }
    }
}

if ($Options.Count -gt 1) {
    Write-Host "Use apenas uma flag: --cd ou --sd." -ForegroundColor Red
    exit 2
}

if ($Options.Count -eq 1) {
    switch ($Options[0]) {
        "--cd" { $ComDocker = $true }
        "--sd" { $SemDocker = $true }
        default {
            Write-Host "Flag invalida. Use --cd ou --sd." -ForegroundColor Red
            exit 2
        }
    }
}

if (-not $ComDocker -and -not $SemDocker) {
    Write-Host "`nComo deseja iniciar o projeto?" -ForegroundColor Cyan
    Write-Host "  1) Com Docker"
    Write-Host "  2) Sem Docker"
    $Modo = Read-Host "Escolha 1 ou 2"

    switch ($Modo) {
        "1" { $ComDocker = $true }
        "2" { $SemDocker = $true }
        default {
            Write-Host "Opcao invalida." -ForegroundColor Red
            exit 2
        }
    }
}

if ($SemDocker) {
    Start-WithoutDocker
    exit $LASTEXITCODE
}

$DockerExitCode = Start-WithDocker
if ($DockerExitCode -ne 0) {
    Write-Host "`nDocker falhou ou nao esta ativo." -ForegroundColor Red
    $Resposta = Read-Host "Deseja tentar o modo sem Docker? (S/N)"
    if ($Resposta -match '^[Ss]$') {
        Start-WithoutDocker
    } else {
        exit $DockerExitCode
    }
}
