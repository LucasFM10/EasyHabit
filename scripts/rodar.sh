#!/usr/bin/env bash

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"

if [ "$1" == "--sem-docker" ]; then
    "$DIR/rodar-sem-docker.sh"
    exit 0
fi

if ! "$DIR/rodar-com-docker.sh"; then
    echo ""
    echo "⚠️ Docker falhou ou não está ativo."
    read -p "Deseja tentar rodar no modo SEM Docker agora? (s/n): " RESPOSTA
    if [[ "$RESPOSTA" =~ ^[Ss]$ ]]; then
        "$DIR/rodar-sem-docker.sh"
    else
        echo "Execução encerrada."
    fi
fi
