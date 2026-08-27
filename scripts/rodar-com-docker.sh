#!/usr/bin/env bash
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
PROJECT_ROOT="$DIR/.."

[ ! -f "$PROJECT_ROOT/.env" ] && [ -f "$PROJECT_ROOT/.env.example" ] && cp "$PROJECT_ROOT/.env.example" "$PROJECT_ROOT/.env"

echo "🐳 Subindo PocketBase e SvelteKit via Docker Compose..."
cd "$PROJECT_ROOT"
docker compose up --build
