# Deploy no Coolify (servidor Debian local)

## Por que não o `nixpacks.toml` sugerido

O projeto é um **monorepo com duas linguagens** (frontend Node/React e backend
Python/FastAPI) que precisam virar **um único processo**: o FastAPI serve a API
em `/api` **e** os arquivos estáticos compilados do React (ver
`backend/server.py`). O Nixpacks builda um app por vez e não tem um passo
nativo para "compilar o Node e depois colocar o resultado dentro do runtime do
Python" — por isso a Coolify/Railway recomendam **Docker Compose** para esse
tipo de stack combinada, não nixpacks.toml. Os arquivos abaixo (`Dockerfile` +
`docker-compose.yaml`, na raiz do projeto) já fazem isso num build multi-stage;
não é necessário criar o `nixpacks.toml`.

## O que já está pronto

- **`Dockerfile`** (raiz): builda o frontend (`yarn build`), depois copia o
  resultado para dentro da imagem Python e inicia `uvicorn` servindo tudo na
  porta `8001` (API em `/api/*`, resto é a SPA React). A imagem também instala
  `iputils-ping` para as sondas ICMP da aba Mapa de rede / NOC.
- **`docker-compose.yaml`** (raiz): serviço `app` (a imagem acima) + serviço
  `mysql` (MariaDB com volume persistente). Pronto para usar o build pack
  **Docker Compose** do Coolify. **O nome do arquivo importa**: o Coolify, por
  padrão, só procura `docker-compose.yaml` (extensão `.yaml`) na raiz do repo
  — por isso o arquivo tem esse nome exato, não `.yml`.

## Passo a passo no Coolify

1. **New Resource → Docker Compose**, apontando para este repositório
   (branch/commit). Deixe o campo **"Docker Compose Location"** com o valor
   padrão (`/docker-compose.yaml`) — não precisa digitar nada.
2. Em **Environment Variables**, defina (gera valores fortes — não use os
   defaults do arquivo em produção):
   - `MYSQL_PASSWORD`, `MYSQL_ROOT_PASSWORD`
   - `ADMIN_USERNAME`, `ADMIN_PASSWORD` (login inicial do painel admin)
   - `JWT_SECRET` → string aleatória longa (ex.: `openssl rand -hex 32`); sem
     ela o backend não inicia
   - `CORS_ORIGINS` → o domínio/IP que você vai acessar o portal (ex.:
     `http://10.35.94.20:8001,http://192.168.1.202:8001`)
   - `STATUS_HOST` → **veja a seção abaixo**, é o ponto mais importante
   - `DISK_PATH` → ponto de montagem do seu RAID a ser exibido no card
     "Disco" (ex.: `/srv/samba`); padrão já é esse no compose
3. Deploy. O Coolify builda a imagem (passo `frontend-build` + `runtime`),
   sobe o `mysql` e o `app`, e expõe a porta `8001` pelo proxy dele (defina o
   domínio/porta pública na aba **Domains** do serviço `app`).
4. Acesse a URL que o Coolify gerou/configurar → portal carrega, e
   `/admin` → login com `ADMIN_USERNAME`/`ADMIN_PASSWORD`.

## `STATUS_HOST` — o ponto crítico deste deploy

Os serviços que o portal monitora (SCE :8080, SGL :8082, CUPS :631, Webmin
:10000, etc.) rodam **no próprio servidor Debian**, fora do container. Dentro
do container, `127.0.0.1` significa "o próprio container" — por isso a
checagem de status (TCP) precisa de um host que aponte para a **máquina
física**:

- `docker-compose.yaml` já mapeia `host.docker.internal` para o host via
  `extra_hosts: host-gateway` (funciona no Docker recente para Linux) e usa
  isso como `STATUS_HOST` por padrão.
- Se o status aparecer sempre "offline" depois do deploy, troque `STATUS_HOST`
  para o IP real do servidor na rede interna (ex.: `10.35.94.20`) — funciona
  sempre, independente da versão do Docker.

O NOC usa o host/IP informado em cada equipamento. ICMP, TCP e HTTP/HTTPS saem do
container; portanto firewall, rota e regras de saída do host Docker precisam permitir
esses testes. Quando ICMP não for permitido, prefira TCP ou HTTP no cadastro.

## Banco de dados: usar o MySQL do compose ou o seu já existente

- **Padrão (mais simples):** deixe o serviço `mysql` do `docker-compose.yaml`
  rodando — ele já cria o banco `portal27bpmm` e o usuário `portal` sozinho.
- **Se preferir reaproveitar o MySQL que você já tem no servidor:** apague o
  serviço `mysql` do compose e troque a env `DATABASE_URL` do serviço `app`
  para apontar para ele, ex.:
  `mysql+aiomysql://usuario:senha@10.35.94.20:3306/portal27bpmm?charset=utf8mb4`
  (crie o banco/usuário manualmente antes do primeiro deploy).

## Alternativa sem Coolify/Docker

Se preferir instalar direto no Debian com Apache (sem containers), use
`deploy/install.sh` + `deploy/README-DEBIAN.md` — caminho equivalente, só que
sem Docker.

## Cards de disco: NVME (sistema) e Disco (RAID)

O portal mostra dois cartões de armazenamento, cada um clicável para ver as
partições que o compõem:

- **NVME**: todo o disco do sistema (ex.: 512GB), somando o uso real de
  `/`, `/home`, `/var`, `/tmp`, `/boot/efi`, etc. — não só a partição raiz.
- **Disco**: o volume configurado em `DISK_PATH` (RAID1, por padrão
  `/srv/samba`).

Isso só funciona porque `docker-compose.yaml` monta a raiz do host inteira,
somente leitura, em `/host` dentro do container (`volumes: - /:/host:ro`) —
o backend lê os caminhos reais do servidor por ali, não o filesystem interno
do container. Não remova esse volume nem a env `HOST_FS_PREFIX=/host`.
