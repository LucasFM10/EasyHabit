@echo off
chcp 65001 >nul
cd /d "%~dp0.."
if not exist ".env" if exist ".env.example" copy ".env.example" ".env" >nul

echo 🐳 Subindo PocketBase e SvelteKit via Docker Compose...
docker compose up --build
