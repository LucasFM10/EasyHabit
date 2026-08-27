#!/usr/bin/env bash
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
PROJECT_ROOT="$DIR/.."

[ ! -f "$PROJECT_ROOT/.env" ] && [ -f "$PROJECT_ROOT/.env.example" ] && cp "$PROJECT_ROOT/.env.example" "$PROJECT_ROOT/.env"

set -a
[ -f "$PROJECT_ROOT/.env" ] && . "$PROJECT_ROOT/.env"
set +a

if [ ! -d "$PROJECT_ROOT/apps/web/node_modules" ]; then
    echo "📦 Primeira execução detectada! Instalando dependências..."
    cd "$PROJECT_ROOT/apps/web" && npm install
fi

PB_BIN="$PROJECT_ROOT/apps/pocketbase/pocketbase"
PB_DATA="$PROJECT_ROOT/apps/pocketbase/pb_data"
PB_MIGRATIONS="$PROJECT_ROOT/apps/pocketbase/pb_migrations"

if [ ! -f "$PB_BIN" ]; then
    echo "📥 Executável do PocketBase não encontrado em $PB_BIN. Baixando versão oficial v0.39.4..."
    OS="$(uname -s | tr '[:upper:]' '[:lower:]')"
    ARCH="$(uname -m)"
    if [ "$ARCH" = "x86_64" ]; then ARCH="amd64"; fi
    if [ "$ARCH" = "aarch64" ] || [ "$ARCH" = "arm64" ]; then ARCH="arm64"; fi
    URL="https://github.com/pocketbase/pocketbase/releases/download/v0.39.4/pocketbase_0.39.4_${OS}_${ARCH}.zip"
    curl -sL "$URL" -o "$PROJECT_ROOT/apps/pocketbase/pocketbase.zip"
    unzip -o "$PROJECT_ROOT/apps/pocketbase/pocketbase.zip" -d "$PROJECT_ROOT/apps/pocketbase"
    rm -f "$PROJECT_ROOT/apps/pocketbase/pocketbase.zip"
    rm -f "$PROJECT_ROOT/apps/pocketbase/CHANGELOG.md"
    rm -f "$PROJECT_ROOT/apps/pocketbase/LICENSE.md"
    chmod +x "$PB_BIN"
    echo "✅ PocketBase baixado com sucesso!"
fi

echo "🚀 Iniciando PocketBase localmente..."
"$PB_BIN" serve --dir="$PB_DATA" --migrationsDir="$PB_MIGRATIONS" &
PB_PID=$!

cleanup() {
    echo "🛑 Encerrando PocketBase..."
    kill $PB_PID 2>/dev/null || true
}
trap cleanup EXIT

echo "⚡ Iniciando SvelteKit - apps/web..."
cd "$PROJECT_ROOT/apps/web"
npm run dev
