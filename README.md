# EasyHabit 📅

Agenda pessoal simples, moderna e segura, desenvolvida com **SvelteKit 5 (Svelte 5 Runes)** no frontend e **PocketBase** no backend. O sistema oferece cadastro protegido por código de acesso e verificação via **WhatsApp (Evolution API/OTP)**, login por e-mail, usuário ou telefone, isolamento estrito de dados por usuário, calendário responsivo, eventos de dia inteiro/múltiplos dias, gestão de tarefas com prazos e tags personalizadas.

---

## 🚀 Tecnologias Utilizadas

- **Frontend**: [SvelteKit 5](https://svelte.dev/) (Svelte 5 Runes `$state`), [Vite 8](https://vitejs.dev/), [TypeScript](https://www.typescriptlang.org/), [PocketBase JS SDK](https://github.com/pocketbase/js-sdk).
- **Backend / BaaS**: [PocketBase v0.39.4](https://pocketbase.io/) (Go + SQLite) com suporte a migrações automáticas em JavaScript (`pb_migrations`) e hooks JS (`pb_hooks`).
- **Integração WhatsApp**: [Evolution API](https://github.com/EvolutionAPI/evolution-api) (Envio de códigos OTP de 6 dígitos diretamente no WhatsApp).
- **DevOps & Infraestrutura**: [Docker](https://www.docker.com/), [Docker Compose](https://docs.docker.com/compose/), [NGINX](https://www.nginx.com/) (servindo a build estática do SvelteKit em container) e suporte nativo a deploy no [Coolify](https://coolify.io/).
- **Automação**: Scripts de execução em PowerShell (`rodar.ps1`), Batch (`rodar.bat`) e Shell Script (`rodar.sh`).

---

## ✨ Funcionalidades Principais

- 💬 **Autenticação por WhatsApp (OTP)**: Receba um código de 6 dígitos diretamente no seu celular via Evolution API para login/cadastro automático instantâneo.
- 🔐 **Login Flexível**: Acesso por e-mail, nome de usuário ou telefone e senha; novas contas são criadas exclusivamente pelo fluxo protegido do WhatsApp.
- 🎟️ **Cadastro Protegido por Código de Acesso**: O envio do OTP de cadastro via WhatsApp exige um código de convite validado no servidor.
- 📅 **Calendário Mensal Responsivo**: Visualização e navegação intuitiva de compromissos no mês com chips coloridos e indicadores de tarefas.
- ⏰ **Eventos de Dia Inteiro e Múltiplos Dias**: Suporte a compromissos com horários marcados ou de dia inteiro (viagens, aniversários, eventos multi-dias).
- ☑️ **Gestão de Tarefas com Prazos**: Criação de tarefas com prazos vinculados ao calendário e alternância rápida (1-clique) de conclusão na tela principal.
- 🏷️ **Tags Personalizadas em HEX**: Gerenciador de tags cadastráveis com nome e cor HEX personalizada (Color Picker + paleta de sugestões), associáveis a compromissos e tarefas.
- 📊 **Painel do Dia Organizado**: Separação clara por seções no painel lateral (*Dia inteiro*, *Compromissos*, *Tarefas com prazo*).
- ⚡ **Menu de Criação Rápida (`+` FAB)**: Ação rápida para criação instantânea de eventos ou tarefas no desktop e celular.
- 🛡️ **Isolamento de Dados em Nível de Banco**: Regras de API no PocketBase garantem que cada usuário acesse e gerencie estritamente os seus próprios registros (`user = @request.auth.id`).

---

## 📂 Estrutura do Projeto

```text
EasyHabit/
├── apps/
│   ├── pocketbase/             # Serviço Backend (PocketBase BaaS)
│   │   ├── pb_migrations/      # Migrações automáticas em JS (coleções, superusuário e OTP)
│   │   ├── pb_hooks/           # Custom JS Hooks (otp.pb.js para disparo via Evolution API)
│   │   ├── pb_data/            # Dados locais / banco SQLite (gerado no boot)
│   │   └── Dockerfile          # Containerfile do serviço PocketBase
│   └── web/                    # Serviço Frontend (SvelteKit 5)
│       ├── src/
│       │   ├── lib/            # Estado reativo (auth.svelte.ts), tipos (types.ts), cliente PocketBase (pocketbase.ts)
│       │   └── routes/         # Páginas e rotas da aplicação (+page.svelte)
│       ├── static/             # Recursos estáticos e template env.js.template
│       ├── default.conf        # Configuração NGINX para produção
│       └── Dockerfile          # Containerfile multi-stage da aplicação Web
├── scripts/                    # Scripts universais de inicialização rápida
│   ├── rodar.ps1               # Script para Windows PowerShell
│   ├── rodar.bat               # Script para Windows Prompt de Comando (CMD)
│   └── rodar.sh                # Script para Linux / macOS
├── .env.example                # Modelo de variáveis de ambiente
├── docker-compose.yml          # Orquestração local e produção (Coolify)
└── README.md                   # Documentação do projeto
```

---

## ⚙️ Configuração e Variáveis de Ambiente

Crie um arquivo `.env` na raiz do projeto com base no arquivo `.env.example`:

```env
# ============================================================
# Configurações do Frontend (SvelteKit)
# ============================================================
SERVICE_FQDN_POCKETBASE=127.0.0.1:8090

# ============================================================
# Configurações do Backend (PocketBase)
# ============================================================
PB_SUPERUSER_EMAIL=admin@admin.com
PB_SUPERUSER_PASSWORD=admin123456

# ============================================================
# Integração WhatsApp (Evolution API)
# ============================================================
# Preencha com os dados da sua Evolution API no Coolify para ativar login por WhatsApp.
EVOLUTION_API_URL=https://whatsapp.seu-dominio.com
EVOLUTION_API_KEY=sua_api_key
EVOLUTION_INSTANCE_NAME=sua_instancia
```

---

## 💬 Configuração da Autenticação por WhatsApp

Para que o login por WhatsApp funcione:

1. Preencha as três variáveis da Evolution API no seu arquivo `.env` local ou nas variáveis do Coolify:
   - `EVOLUTION_API_URL`: URL da sua Evolution API (ex: `https://whatsapp.meudominio.com`).
   - `EVOLUTION_API_KEY`: Chave da API (Global API Key ou Instance Key).
   - `EVOLUTION_INSTANCE_NAME`: Nome da instância conectada ao seu número.
2. No aplicativo, abra **"Criar conta"**, informe os dados, o código de acesso e o número do WhatsApp.
3. Confirme o código numérico de 6 dígitos recebido para concluir o cadastro e entrar na agenda.

---

## 🏁 Como Executar o Projeto

- **PowerShell (Windows)**:
  ```powershell
  .\scripts\rodar.ps1
  ```
  *(Flags: `.\scripts\rodar.ps1 --cd` com Docker ou `.\scripts\rodar.ps1 --sd` sem Docker)*

- **Docker Compose**:
  ```bash
  docker compose up --build
  ```

---

## 🌐 Endereços Locais

| Serviço | Endereço | Descrição |
| :--- | :--- | :--- |
| **Frontend Web (Dev)** | [http://localhost:5173](http://localhost:5173) | Interface do usuário (Vite) |
| **Frontend Web (Docker)** | [http://localhost](http://localhost) | Interface do usuário (Docker Compose / NGINX) |
| **API PocketBase** | [http://localhost:8090](http://localhost:8090) | Endpoint base da API REST |
| **Painel Admin PocketBase** | [http://localhost:8090/_/](http://localhost:8090/_/) | Painel administrativo do PocketBase |
