# ============================================================
# PocketBase — Container leve com binário oficial
# ============================================================
FROM alpine:3.20

# Versão do PocketBase e Arquitetura do sistema
ARG PB_VERSION=0.39.4
ARG TARGETARCH=amd64

# Instala dependências essenciais do sistema
RUN apk add --no-cache \
    ca-certificates \
    unzip \
    wget \
    tzdata

# Baixa e descompacta o binário oficial do PocketBase para Linux
RUN wget -q "https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_${TARGETARCH}.zip" \
    -O /tmp/pocketbase.zip \
    && unzip /tmp/pocketbase.zip -d /usr/local/bin/ \
    && rm /tmp/pocketbase.zip \
    && chmod +x /usr/local/bin/pocketbase

# Define a pasta de trabalho principal dentro do contêiner
WORKDIR /app

# Copia os arquivos de migrações e hooks do projeto
COPY pb_migrations/ ./pb_migrations/
COPY pb_hooks/ ./pb_hooks/

# Cria o diretório para armazenamento do banco de dados SQLite (pb_data)
RUN mkdir -p /app/pb_data

# Expõe a porta 8090 do contêiner
EXPOSE 8090

# Executa o servidor PocketBase com migrações automáticas
# Nota: Redireciona a saída (2>&1) e substitui 0.0.0.0 por 127.0.0.1 nos logs do terminal
CMD pocketbase migrate up --dir=/app/pb_data --migrationsDir=/app/pb_migrations && \
    pocketbase serve \
        --http=0.0.0.0:8090 \
        --dir=/app/pb_data \
        --migrationsDir=/app/pb_migrations \
        --hooksDir=/app/pb_hooks 2>&1 | sed 's/0\.0\.0\.0/127.0.0.1/g'
