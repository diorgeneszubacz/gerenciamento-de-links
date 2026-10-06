# Portal 27º BPM/M — Hub de Serviços Internos

Portal web para centralizar o acesso aos serviços internos do servidor Debian do
27º Batalhão de Polícia Militar Metropolitano, substituindo a antiga página em PHP.
Reúne em uma única tela os links para sistemas locais (SCE, SGL, CUPS, Webmin,
phpMyAdmin, downloads, etc.), com status online/offline em tempo real, busca e
métricas de saúde do servidor (CPU, memória, disco, uptime). Inclui painel
administrativo autenticado para gerenciar categorias, serviços, logos e usuários.

## Stack

```
backend/   FastAPI (async) + SQLAlchemy[asyncio] — MySQL/MariaDB em produção,
           SQLite para desenvolvimento local — python, /root/.venv
frontend/  Vite + React 19 + Tailwind v4 + shadcn/ui (TypeScript strict)
deploy/    Scripts de instalação para Debian + Apache + MySQL (produção)
```

- **Backend**: `backend/server.py` monta `api_router` (prefixo `/api`), registrado
  por `app.include_router(api_router)`. Rotas organizadas em `backend/routers/`
  (`auth`, `portal`, `admin`, `users`, `system`). Modelos Pydantic v2 em
  `backend/models/`. Acesso a dados via `lib/db.py` (tabelas `users`, `categories`,
  `services`), sem ORM de objetos — `sqlalchemy.Table` + `select`/`insert`/`update`.
- **Frontend**: `src/pages/Portal.tsx` (página pública) e `src/pages/Admin.tsx`
  (painel administrativo). Chamadas de API sempre via `src/lib/api.ts`
  (`apiGet`/`apiPost`/`apiPut`/`apiPatch`/`apiDelete`), dados carregados com
  TanStack Query.
- **Status dos serviços**: checagem TCP (`routers/portal.py`) na combinação
  host:porta de cada serviço cadastrado — não depende de HTTP, funciona para
  qualquer serviço TCP (MySQL, SSH, impressão, etc.).

## Rodando localmente (dev)

```bash
cd backend && uvicorn server:app --host 0.0.0.0 --port 8001 --reload   # http://localhost:8001
cd frontend && yarn dev                                                # http://localhost:3000
```

No pod Emergent, os dois processos já rodam via supervisor (`backend` e
`frontend`); o frontend expõe `/api/*` via proxy do Vite para a porta 8001.

Config em `backend/.env`: `DATABASE_URL` (SQLite local por padrão; aponte para
MySQL em produção — ver `deploy/README-DEBIAN.md`), `CORS_ORIGINS`,
`ADMIN_USERNAME`/`ADMIN_PASSWORD` (usados no seed inicial).

## Deploy em produção (Debian + Apache + MySQL)

Veja `deploy/README-DEBIAN.md` — scripts prontos (`install.sh`,
`apache-portal-27bpmm.conf`, `portal-27bpmm.service`) para instalar o portal no
servidor real, usando o MySQL/MariaDB existente e o Apache já configurado.

## Login padrão (seed)

- Usuário: `admin`
- Senha: `admin123`

**Troque a senha no painel admin após o primeiro acesso em produção.**

## Testes

```bash
cd backend && pytest              # testes de API
cd frontend && yarn typecheck     # checagem de tipos (yarn dev não typecheck)
```
