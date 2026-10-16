# Dependências e atualizações

- O `composer.lock` e o `package-lock.json` são versionados: toda mudança de dependência entra no mesmo commit que o `composer.json`/`package.json`.
- Composer sempre dentro do container (`docker compose exec -T laravel.test composer ...`). Depois de qualquer `require`/`update`/`remove`: rode `composer audit` e o pre-push (`sh .husky/pre-push`).
- Adicionar ou remover pacote exige aprovação do usuário. Pacotes com licença AGPL/GPL exigem aprovação explícita.
- O `require.php` do `composer.json` acompanha o PHP mais antigo em uso (host do editor e container). O Rector usa essa versão como alvo.
- O Pest fixa a versão exata do PHPUnit; não force outra.
- O Laravel não tem LTS: cada major recebe 18 meses de correções e 2 anos de segurança.

## Checklist de atualização (major ou muitas versões)

Guarde a saída de cada item antes e compare depois:

1. `composer quality` limpo.
2. `php artisan route:list --json`: mesmas rotas, actions e middlewares.
3. `php artisan schedule:list`: mesmos agendamentos.
4. Docs da API (Scramble ou similar): mesmos endpoints, parâmetros e status.
5. Build de produção com `config:cache`, `route:cache` e `view:cache`.
6. Guia de upgrade oficial (`https://raw.githubusercontent.com/laravel/docs/<versão>/upgrade.md`) conferido item a item. O `search-docs` do Boost só cobre a versão instalada.
