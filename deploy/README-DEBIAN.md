# Instalação no Debian + Apache (servidor 10.35.94.20)

## Em que linguagem é feito?
- **Backend (API):** Python 3 + FastAPI, banco **MongoDB**.
- **Interface:** React + TypeScript, compilada em arquivos estáticos (HTML/JS/CSS).

Não é PHP, então **não basta copiar para /var/www/html**. O Apache serve a interface
compilada e repassa (proxy) as chamadas `/api` para o serviço Python na porta 8001.

## Instalação automática
```bash
# na pasta do projeto, no servidor Debian 12
sudo bash deploy/install.sh
```
O script instala Python, Node.js 22 (só para compilar), MongoDB 8, cria o serviço
`portal-27bpmm` (systemd), configura o Apache e desativa o site padrão — assim
**http://10.35.94.20/** abre direto no portal.

> Sua página PHP antiga em `/var/www/html` deixa de ser a inicial. Faça backup antes.
> `/phpmyadmin` continua funcionando (Alias do Apache). Para a pasta de downloads,
> descomente o bloco `Alias /downloads` em `deploy/apache-portal-27bpmm.conf`.

> MongoDB 5+ exige CPU com suporte a AVX. Verifique com `grep avx /proc/cpuinfo`.

## Comandos úteis
- Status da API: `systemctl status portal-27bpmm`
- Logs: `journalctl -u portal-27bpmm -f`
- Atualizar: copie a nova versão e rode `sudo bash deploy/install.sh` de novo (o `.env` é mantido).
