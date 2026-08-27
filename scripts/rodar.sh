#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
PROJECT_ROOT="$SCRIPT_DIR/.."
ROOT_ENV="$PROJECT_ROOT/.env"

if [ ! -f "$ROOT_ENV" ] && [ -f "$PROJECT_ROOT/.env.example" ]; then
    cp "$PROJECT_ROOT/.env.example" "$ROOT_ENV"
fi

run_without_docker() {
    set -a
    [ -f "$ROOT_ENV" ] && . "$ROOT_ENV"
    set +a

    PB_VERSION="${PB_VERSION:-0.39.4}"
    PB_DIR="$PROJECT_ROOT/apps/pocketbase"
    PB_BIN="$PB_DIR/pocketbase"

    if [ ! -d "$PROJECT_ROOT/apps/web/node_modules" ]; then
        echo "Primeira execucao detectada. Instalando dependencias..."
        (cd "$PROJECT_ROOT/apps/web" && npm install)
    fi

    if [ ! -f "$PB_BIN" ]; then
        echo "Baixando PocketBase v$PB_VERSION..."
        OS="$(uname -s | tr '[:upper:]' '[:lower:]')"
        ARCH="$(uname -m)"
        [ "$ARCH" = "x86_64" ] && ARCH="amd64"
        { [ "$ARCH" = "aarch64" ] || [ "$ARCH" = "arm64" ]; } && ARCH="arm64"
        ZIP_PATH="$PB_DIR/pocketbase.zip"
        URL="https://github.com/pocketbase/pocketbase/releases/download/v$PB_VERSION/pocketbase_${PB_VERSION}_${OS}_${ARCH}.zip"
        curl -fsSL "$URL" -o "$ZIP_PATH"
        unzip -o "$ZIP_PATH" -d "$PB_DIR"
        rm -f "$ZIP_PATH" "$PB_DIR/CHANGELOG.md" "$PB_DIR/LICENSE.md"
        chmod +x "$PB_BIN"
    fi

    echo "Iniciando PocketBase localmente..."
    "$PB_BIN" serve --dir="$PB_DIR/pb_data" --migrationsDir="$PB_DIR/pb_migrations" &
    PB_PID=$!
    trap 'echo "Encerrando PocketBase..."; kill "$PB_PID" 2>/dev/null || true' EXIT

    echo "Iniciando SvelteKit..."
    cd "$PROJECT_ROOT/apps/web"
    npm run dev
}

case "${1:-}" in
    --cd) MODE="docker" ;;
    --sd) MODE="without-docker" ;;
    "")
        echo
        echo "Como deseja iniciar o projeto?"
        echo "  1) Com Docker"
        echo "  2) Sem Docker"
        read -r -p "Escolha 1 ou 2: " CHOICE
        case "$CHOICE" in
            1) MODE="docker" ;;
            2) MODE="without-docker" ;;
            *) echo "Opcao invalida."; exit 2 ;;
        esac
        ;;
    *)
        echo "Flag invalida. Use --cd ou --sd."
        exit 2
        ;;
esac

if [ "$MODE" = "without-docker" ]; then
    run_without_docker
    exit $?
fi

echo "Subindo PocketBase e SvelteKit via Docker Compose..."
if ! (cd "$PROJECT_ROOT" && docker compose up --build); then
    echo
    echo "Docker falhou ou nao esta ativo."
    read -r -p "Deseja tentar o modo sem Docker? (S/N): " RESPOSTA
    if [[ "$RESPOSTA" =~ ^[Ss]$ ]]; then
        run_without_docker
    else
        exit 1
    fi
fi
