@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0.."

if not exist ".env" if exist ".env.example" copy ".env.example" ".env" >nul

if "%~1"=="" goto escolher
if /i "%~1"=="--cd" goto docker
if /i "%~1"=="--sd" goto semdocker
echo Flag invalida. Use --cd ou --sd.
exit /b 2

:escolher
echo.
echo Como deseja iniciar o projeto?
echo   1^) Com Docker
echo   2^) Sem Docker
set /p MODO="Escolha 1 ou 2: "
if "%MODO%"=="1" goto docker
if "%MODO%"=="2" goto semdocker
echo Opcao invalida.
exit /b 2

:docker
echo Subindo PocketBase e SvelteKit via Docker Compose...
docker compose up --build
if %errorlevel% equ 0 exit /b 0

echo.
echo Docker falhou ou nao esta ativo.
set /p RESPOSTA="Deseja tentar o modo sem Docker? (S/N): "
if /i not "%RESPOSTA%"=="S" exit /b 1

:semdocker
if exist ".env" (
    for /f "usebackq eol=# tokens=1,* delims==" %%A in (".env") do set "%%A=%%B"
)
if not defined PB_VERSION set "PB_VERSION=0.39.4"

if not exist "apps\web\node_modules" (
    echo Primeira execucao detectada. Instalando dependencias...
    pushd "apps\web"
    call npm install
    if errorlevel 1 exit /b 1
    popd
)

if not exist "apps\pocketbase\pocketbase.exe" (
    echo Baixando PocketBase v%PB_VERSION%...
    powershell -NoProfile -Command "$v=$env:PB_VERSION; $d='apps\pocketbase'; $z=Join-Path $d 'pocketbase.zip'; Invoke-WebRequest -Uri ('https://github.com/pocketbase/pocketbase/releases/download/v'+$v+'/pocketbase_'+$v+'_windows_amd64.zip') -OutFile $z; Expand-Archive $z -DestinationPath $d -Force; Remove-Item $z; Remove-Item (Join-Path $d 'CHANGELOG.md'),(Join-Path $d 'LICENSE.md') -ErrorAction SilentlyContinue"
    if errorlevel 1 exit /b 1
)

echo Iniciando PocketBase localmente...
start "PocketBase" "apps\pocketbase\pocketbase.exe" serve --dir="apps\pocketbase\pb_data" --migrationsDir="apps\pocketbase\pb_migrations"

echo Iniciando SvelteKit...
cd "apps\web"
call npm run dev
