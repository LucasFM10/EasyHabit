# EasyHabit

Agenda pessoal simples feita com SvelteKit 5 e PocketBase. Cada conta possui sua própria agenda privada e pode criar, editar e excluir compromissos no calendário.

## Funcionalidades

- Login e criação de conta
- Cadastro protegido por código de acesso
- Calendário mensal responsivo
- Criação, edição e exclusão de compromissos
- Isolamento dos dados por usuário nas regras do PocketBase
- Criação automática do superusuário do PocketBase

## Executar o projeto

No PowerShell:

```powershell
.\scripts\rodar.ps1
```

O script pergunta qual modo deve ser usado. Para escolher diretamente, use `--cd` (com Docker) ou `--sd` (sem Docker):

```powershell
.\scripts\rodar.ps1 --cd
.\scripts\rodar.ps1 --sd
```

As mesmas flags funcionam com `rodar.bat` no Prompt de Comando e `rodar.sh` no Linux/macOS.

## Endereços locais

- Frontend: [http://localhost:5173](http://localhost:5173)
- API PocketBase: [http://localhost:8090](http://localhost:8090)
- Painel PocketBase: [http://localhost:8090/_/](http://localhost:8090/_/)

## Configuração

As variáveis ficam no arquivo `.env` da raiz. Use `.env.example` como referência:

- `SERVICE_FQDN_POCKETBASE`: hostname do PocketBase; localmente, `127.0.0.1:8090`.
- `PB_SUPERUSER_EMAIL`: e-mail do superusuário criado no primeiro boot.
- `PB_SUPERUSER_PASSWORD`: senha do superusuário criado no primeiro boot.

O código de acesso para novos cadastros está validado pela regra de criação da coleção `users`, na migração da agenda. Enquanto o projeto estiver em validação, altere o código no frontend e na migração em conjunto caso queira rotacioná-lo.

## PocketBase

A migração configura:

- `users`: cadastro por e-mail e senha, protegido por código de acesso.
- `appointments`: compromissos privados vinculados ao usuário autenticado.

Ao atualizar uma instalação anterior, a migração faz um reset único das coleções da aplicação e das contas comuns. As coleções internas e o superusuário configurado são preservados.

## Deploy no Coolify

O projeto pode ser publicado como um recurso Docker Compose apontando para a raiz do repositório. Configure `PB_SUPERUSER_EMAIL` e `PB_SUPERUSER_PASSWORD`; o hostname público do PocketBase é repassado ao frontend pelo Compose.

Também é possível publicar os serviços separadamente usando os Dockerfiles em `apps/web` e `apps/pocketbase`.

## Estrutura

```text
.
├── apps/
│   ├── pocketbase/
│   │   ├── Dockerfile
│   │   └── pb_migrations/
│   └── web/
│       ├── src/lib/
│       └── src/routes/
├── scripts/
│   └── rodar.ps1 / .bat / .sh
├── docker-compose.yml
└── .env.example
```
