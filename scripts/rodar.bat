@echo off
chcp 65001 >nul
if "%1"=="--sem-docker" goto semdocker

call "%~dp0rodar-com-docker.bat"
if %errorlevel% neq 0 (
    echo.
    echo ⚠️ Ocorreu uma falha ao rodar com Docker (ex: Docker indisponivel ou encerramento manual).
    set /p RESPOSTA="Deseja tentar rodar no modo SEM Docker agora? (S/N): "
    if /i "%RESPOSTA%"=="S" (
        call "%~dp0rodar-sem-docker.bat"
    ) else (
        echo Execucao encerrada.
    )
)
exit /b

:semdocker
call "%~dp0rodar-sem-docker.bat"
