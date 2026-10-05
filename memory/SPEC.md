# Server Hub — spec
Portal (pt-BR) listing services hosted on the user's Debian server, plus authenticated admin panel.

## Routes
- `/` public portal: categories (ordered) → service cards (logo, name, description, port chip, live status dot), search (Ctrl+K), category filter chips, metrics, refresh status (auto every 30s).
- `/login` admin login. `/admin` tabs: Serviços, Categorias, Usuários (admin only), Minha conta.

## Data (Mongo)
- users {id, username, role: admin|operator, created_at, password_hash(pbkdf2)}
- categories {id, name, icon(lucide key), order}
- services {id, name, description, category_id, url_mode: port|url, protocol, port, path, url, logo(data URL or http url), visible, order}

## Link building
- url_mode=port → `${protocol}://${window.location.hostname}:${port}${path}` (host = what the visitor typed).
- url_mode=url → fixed URL.
- Status: backend TCP connect to STATUS_HOST(127.0.0.1):port, or URL host:port. In preview pod all are offline (expected).

## API (all /api)
- POST /auth/login, /auth/logout, GET /auth/me, POST /auth/change-password (httpOnly cookie `hub_session`, JWT)
- GET /portal (visible services), GET /status
- /admin/* (any logged user): categories CRUD + /reorder, services CRUD + /reorder, POST /admin/logos/suggest (favicon of service + dashboard-icons/selfh.st CDN by name → data URLs)
- /users (admin only): list, create (operator), PUT /{id}/password, DELETE /{id} (not admin)
- Category delete blocked (400) when it has services.

## Seed (startup, idempotent)
admin/admin123; 4 categories (Gerenciamento do Servidor, Banco de Dados & Web, Impressão, Downloads & Arquivos); services Webmin(https 10000), phpMyAdmin(80 /phpmyadmin), CUPS(631), Downloads(80 /downloads).
