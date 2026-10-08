# Instalação no Debian + Apache + MySQL (servidor 10.35.94.20)

## Tecnologias
- **Backend (API):** Python 3 + FastAPI, banco **MySQL/MariaDB** (o mesmo que você já usa;
  as tabelas `users`, `categories` e `services` aparecem no phpMyAdmin, banco `portal27bpmm`).
- **Interface:** React + TypeScript, compilada em arquivos estáticos (HTML/JS/CSS).

Não é PHP: **só copiar para /var/www/html não funciona**. O Apache entrega a interface
e repassa `/api` para o serviço Python (porta 8001), que roda como serviço do sistema.

## Instalação
```bash
# na pasta do projeto, no servidor
sudo bash deploy/install.sh
# se o root do MySQL usa senha:
sudo MYSQL_ROOT_PASSWORD='sua_senha' bash deploy/install.sh
```
O script:
1. usa o MySQL/MariaDB existente (ou instala o MariaDB), cria o banco `portal27bpmm` e o usuário `portal`;
2. cria o ambiente Python e o serviço `portal-27bpmm` (systemd);
3. compila a interface (Node.js 22, só usado na compilação);
4. configura o Apache: **http://10.35.94.20/** abre o portal, e tudo que já existe em
   `/var/www/html` (`/NOVO/`, `/Downloads/`, `/27bpmm/`, `admin.php`) e `/phpmyadmin/`
   continua funcionando normalmente.

O instalador também coloca `iputils-ping`, usado pela aba **Mapa de rede / NOC** para
sondas ICMP. Se a rede bloquear ICMP, cadastre o equipamento com monitoramento TCP ou
HTTP/HTTPS no painel administrativo.

> Se a sua página antiga tem `index.php` na raiz, ela continua acessível em `http://10.35.94.20/index.php`.

## Comandos úteis
- Status da API: `systemctl status portal-27bpmm`
- Logs: `journalctl -u portal-27bpmm -f`
- Atualizar: copie a nova versão e rode o instalador de novo (o `.env` e o banco são mantidos).
