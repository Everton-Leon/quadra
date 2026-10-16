# Docker Compose Exec

- O ambiente roda no serviço `laravel.test` do `compose.yaml` (imagem do Sail). NUNCA use `sail` nem `vendor/bin/sail`, e nunca use o PHP/Composer do host, mesmo que existam: a versão do host é outra.
- Todo comando de PHP, Composer, artisan ou tinker roda no container: `docker compose exec -T laravel.test <comando>`. Exemplos:
    - `docker compose exec -T laravel.test php artisan migrate`
    - `docker compose exec -T laravel.test composer require <pacote>`
    - `docker compose exec -T laravel.test vendor/bin/pint`
- O front (Vite, vite-plus, vue-tsc) roda no host com `npm run ...`; o `node_modules` é o do host.
- O `vendor` é o mesmo no host e no container (bind mount); não há sincronização a fazer depois de mudar dependências.
- O `.env` é lido pelo Laravel; depois de mudá-lo, rode `docker compose exec -T laravel.test php artisan config:clear`. Mudanças de porta ou de serviço pedem `docker compose up -d`.
- Se o container não estiver rodando, suba com `docker compose up -d`.

## Armadilhas do ambiente

- Em comandos não interativos (scripts, hooks, agentes), use `docker compose exec -T`; sem o `-T` o comando falha por falta de TTY.
- No Git Bash (Windows), argumentos que começam com `/` viram caminhos do Windows. Prefixe com `MSYS_NO_PATHCONV=1` ao passar caminhos do container ao `docker`.
- O php.ini do Sail usa `variables_order=EGPCS`. O `phpunit.xml` força os valores de teste com `force="true"` em `<env>` e `<server>`; não remova isso.
- Os testes usam o banco `testing` do Postgres, criado pelo Sail na primeira subida do volume. Nunca rode comandos de escrita (`migrate`, `db:seed`, tinker com escrita) contra um banco remoto ou de produção sem pedir. Confira `config:show database.default` antes.
