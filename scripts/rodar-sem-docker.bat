@echo off
chcp 65001 >nul
cd /d "%~dp0.."

if not exist ".env" if exist ".env.example" copy ".env.example" ".env" >nul

if exist ".env" (
    for /f "usebackq eol=# tokens=1,* delims==" %%A in (".env") do set "%%A=%%B"
)
if not exist "apps\web\node_modules" (
    echo 📦 Primeira execucao detectada! Instalando dependencias do SvelteKit...
    cd apps\web
    call npm install
    cd /d "%~dp0.."
)

if not exist "apps\pocketbase\pocketbase.exe" (
    echo 📥 Executavel do PocketBase nao encontrado em apps\pocketbase. Baixando versao oficial v0.39.4...
    powershell -Command "Invoke-WebRequest -Uri https://github.com/pocketbase/pocketbase/releases/download/v0.39.4/pocketbase_0.39.4_windows_amd64.zip -OutFile apps\pocketbase\pocketbase.zip; Expand-Archive -Path apps\pocketbase\pocketbase.zip -DestinationPath apps\pocketbase -Force; Remove-Item apps\pocketbase\pocketbase.zip -Force; Remove-Item apps\pocketbase\CHANGELOG.md -ErrorAction SilentlyContinue; Remove-Item apps\pocketbase\LICENSE.md -ErrorAction SilentlyContinue"
    echo ✅ PocketBase baixado com sucesso!
)

echo 🚀 Iniciando PocketBase localmente...
start "" "apps\pocketbase\pocketbase.exe" serve --dir="apps\pocketbase\pb_data" --migrationsDir="apps\pocketbase\pb_migrations"

echo ⚡ Iniciando SvelteKit - apps/web...
cd apps\web
npm run dev
