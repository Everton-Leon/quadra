# Deployment

- Este app é publicado num VPS próprio com nginx e TLS, DNS no Cloudflare (SPEC.md, seção 3). Não é Laravel Cloud: ignore as instruções de Laravel Cloud.
- O banco de produção é PostgreSQL 18, com backup diário fora do servidor; logos vão para um object storage S3-compatível (provedor em aberto na SPEC.md, seção 14). Nunca aponte comandos locais de escrita para credenciais de produção sem pedir.
- A produção instala com `--no-dev`: nunca dependa de pacotes de desenvolvimento (Boost, Pail, Pint, Pest, Rector, Larastan) em código de runtime.
- Comandos agendados ficam em `routes/console.php` e precisam de `schedule:run` (ou `schedule:work`) no ambiente.
