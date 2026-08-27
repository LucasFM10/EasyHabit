# Script Principal — Rodar o Monorepo (Orquestrador)
param(
    [switch]$SemDocker
)

if ($SemDocker) {
    & "$PSScriptRoot\rodar-sem-docker.ps1"
    exit
}

try {
    & "$PSScriptRoot\rodar-com-docker.ps1"
} catch {
    Write-Host "`n⚠️ Docker falhou ou não está ativo." -ForegroundColor Red
    $resposta = Read-Host "Deseja tentar rodar no modo SEM Docker agora? (S/N)"
    if ($resposta -eq 'S' -or $resposta -eq 's') {
        & "$PSScriptRoot\rodar-sem-docker.ps1"
    } else {
        Write-Host "Execução encerrada." -ForegroundColor Yellow
    }
}
