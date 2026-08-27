# 🚀 Monorepo Template — SvelteKit + PocketBase

Este é um **Template Monorepo** completo e pronto para uso ("plug-and-play") combinando **SvelteKit 5** no frontend e **PocketBase** no backend.

---

## ⚡ Como Iniciar um Novo Projeto a partir deste Template

### 1. Clonar o Repositório
```bash
git clone https://github.com/LucasFM10/Template-PocketBase-SveltKit.git meu-novo-projeto
cd meu-novo-projeto
```

### 2. Rodar a Aplicação (O setup é 100% automático no 1º boot!)

#### Opção A — Método Padrão (Orquestrador Inteligente):
```powershell
.\scripts\rodar.ps1
```
*(No Prompt de Comando do Windows, use `.\scripts\rodar.bat` ou no Linux/macOS `./scripts/rodar.sh`)*

#### Opção B — Forçar Docker 🐳:
```powershell
.\scripts\rodar-com-docker.ps1
```

#### Opção C — Forçar Sem Docker 🚀:
```powershell
.\scripts\rodar-sem-docker.ps1
```

---

## 🌐 URLs do Projeto

- **Frontend SvelteKit:** [http://localhost:5173](http://localhost:5173)
- **API do PocketBase:** [http://localhost:8090](http://localhost:8090)
- **Dashboard Admin do PocketBase:** [http://localhost:8090/_/](http://localhost:8090/_/)

### 🔐 Credenciais Padrão do Admin
O PocketBase já cria um superusuário automático no primeiro boot (configurável no `.env` da raiz):
- **E-mail:** `admin@admin.com`
- **Senha:** `admin123456`

---

## 🔑 Variáveis de Ambiente (`.env` na Raiz)

Todas as variáveis do projeto ficam centralizadas no arquivo **`.env`** (e **`.env.example`**) localizado na **raiz do projeto**:

* **`SERVICE_FQDN_POCKETBASE`**: hostname público do PocketBase, disponibilizado pelo Coolify em runtime. Localmente, use `127.0.0.1:8090`.
* **`PB_SUPERUSER_EMAIL`**: e-mail do superusuário inicial do PocketBase.
* **`PB_SUPERUSER_PASSWORD`**: senha do superusuário inicial do PocketBase.

## 🚀 Deploy em Produção (Coolify)

O projeto suporta **duas abordagens de deploy** no Coolify:

#### 🟢 Abordagem 1: 1 Único Recurso (Docker Compose — Recomendado ⭐)
Cria **1 único recurso do tipo "Docker Compose"** apontando para a raiz do repositório.

1. No Coolify, selecione **+ New Resource** → **Docker Compose** → Conecte ao seu repositório Git.
2. O Coolify detectará o arquivo `docker-compose.yml` automaticamente.
3. Na aba **Environment Variables**, adicione apenas `PB_SUPERUSER_EMAIL` e `PB_SUPERUSER_PASSWORD`. Os domínios dos serviços `web` e `pocketbase` são gerados automaticamente pelas variáveis mágicas do Compose.
4. Se desejar, substitua os domínios automáticos por domínios próprios na configuração de cada serviço.
5. Clique em **Deploy**. Ambas as aplicações sobem juntas em uma única Stack!

> [!IMPORTANT]
> **🌐 Lembrete de Domínios & URLs no Coolify:**
> * **URL pública do PocketBase:** O Coolify fornece `SERVICE_FQDN_POCKETBASE` ao container `web`. Quando o Nginx inicia, seu mecanismo nativo de templates gera `/env.js`. O frontend usa o mesmo protocolo da página (`http` localmente e `https` em produção).

#### 🔵 Abordagem 2: Serviços Separados (Public Dockerfile)
Cria **2 recursos individuais** no Coolify:

1. **Recurso `pocketbase` (Backend):**
   * Tipo: **Public Dockerfile** → Base Directory: `/apps/pocketbase`.
   * Environment Variables: `PB_SUPERUSER_EMAIL` e `PB_SUPERUSER_PASSWORD`.
2. **Recurso `web` (SvelteKit Frontend):**
   * Tipo: **Public Dockerfile** → Base Directory: `/apps/web`.
   * Informe `SERVICE_FQDN_POCKETBASE` como variável de runtime com o hostname público do PocketBase.

---

## 📁 Estrutura do Repositório

```text
.
├── .env.example            # Exemplo centralizado de variáveis de ambiente
├── docker-compose.yml      # Configuração Docker para desenvolvimento local
├── apps/
│   ├── pocketbase/         # Backend PocketBase
│   │   ├── Dockerfile
│   │   └── pb_migrations/  # Migrações automáticas em JS
│   └── web/                # Frontend SvelteKit
│       ├── Dockerfile
│       ├── default.conf    # Configuração Nginx para rotas SPA
│       ├── package.json
│       └── src/
│           ├── lib/
│           │   └── pocketbase.ts # Cliente do PocketBase pré-configurado
│           └── routes/
│               └── +page.svelte  # Gerenciador de Batatas 🥔
├── scripts/
│   ├── rodar.ps1 / .bat / .sh             # Script orquestrador principal
│   ├── rodar-com-docker.ps1 / .bat / .sh  # Execução via Docker
│   └── rodar-sem-docker.ps1 / .bat / .sh  # Execução local direta (sem Docker)
└── README.md
```
