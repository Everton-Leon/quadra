<laravel-boost-guidelines>
=== .ai/code-style rules ===

# Estilo e refatoração automatizada (Pint e Rector)

## Pint

- O estilo é o preset `laravel` com regras extras em `pint.json`: `strict_param` e `strict_comparison` (`in_array(..., true)`, `===`), `void_return`, `global_namespace_import`, `use_arrow_functions` e `is_null`. O pre-commit formata os arquivos staged; `docker compose exec -T laravel.test composer lint:check` confere o projeto inteiro.
- Comparações estritas com valores do banco dependem do tipo que o driver devolve. Colunas inteiras sem cast chegam como `int` no pdo_pgsql; uma coluna que chegue como string precisa de cast no model antes de entrar num `in_array(..., true)`.
- O `global_namespace_import` importa o que estiver com `\` na frente, inclusive aliases de facade (`\Log::` vira `use Log;`). Use sempre a facade completa (`Illuminate\Support\Facades\Log`).

## Rector

- Configurado em `rector.php` com `driftingly/rector-laravel`: sets de PHP (versão do `require.php` do `composer.json`), `deadCode`, `codeQuality`, `typeDeclarations`, as regras de upgrade do Laravel até a versão instalada e alguns sets de qualidade do Laravel.
- `composer refactor` aplica o Rector e o Pint; `composer refactor:check` só mostra o diff (sai com erro se houver mudança). Rode o check antes de abrir PR e depois de atualizar o Laravel ou o PHP.
- Revise o diff do Rector antes de commitar: ele pode juntar chamadas encadeadas numa linha, achatar arrays e gerar tipos imprecisos em accessors convertidos para `Attribute` (declare `@return Attribute<TGet, TSet>` com o tipo real). Aplicar duas vezes pode destravar regras novas; rode o check até sair limpo.
- Models e comandos usam os atributos de classe do Laravel 13 (`#[Fillable]`, `#[Hidden]`, `#[Table]`, `#[RouteKey]`, `#[Signature]`, `#[Description]`), não as propriedades (`$fillable`, `$primaryKey`, `$keyType`, `$signature`...). O Rector converte `$fillable`, `$hidden`, `$table`, `getRouteKeyName()`, `$signature` e `$description`; `$primaryKey`, `$keyType`, `$incrementing` e `$timestamps` vão à mão para `#[Table(...)]`. Um atributo sem o `use` vira uma classe inexistente no namespace do model e é ignorado sem erro; o Larastan acusa, os testes não.
- `declare(strict_types=1)` entra pelo `SafeDeclareStrictTypesRector`, só nos arquivos em que o Rector prova que nenhuma chamada depende de conversão de tipo. Não o adicione à mão nos demais: dados externos e do banco são tipados por PHPDoc, e um valor real diferente do declarado viraria `TypeError` em vez de conversão.
- Regras desligadas em `withSkip()`: `app()` para `resolve()` (o projeto usa `app()`, só troca de forma) e `Carbon` para a facade `Date` (o `AppServiceProvider` configura `Date::use(CarbonImmutable::class)`, então a troca mudaria a classe devolvida de mutável para imutável).

=== .ai/comments rules ===

# Comentários no código

- **Todo comentário é em português (pt-BR)**: comentários de linha, PHPDoc, comentários em Blade, JS, shell, YAML e configs. Termos técnicos e nomes de código ficam como estão (`toBase()`, `Collection`, `Stripe`).
- Comentários são escritos por um desenvolvedor do projeto para quem vai manter o código depois, seja pessoa ou agente. Nunca no tom de um assistente conversando com quem pediu a mudança.

## Quando comentar

- Comente o **porquê**, não o quê: uma restrição externa (limite de uma API, comportamento de um SDK), um bug contornado, uma decisão não óbvia, um efeito colateral (ex.: um observer que atualiza estatísticas), uma invariante que, se quebrada, causa erro.
- Se o nome do método e o código já dizem o que acontece, não comente. Prefira renomear a explicar um nome ruim.
- Use PHPDoc para o que o tipo nativo não expressa (array shapes, generics, `@throws` relevante) e para contratos públicos. Não repita a assinatura em prosa (`@param User $user O usuário`).
- Seções em arquivos longos (`// --- Amizades ---`) são aceitáveis quando ajudam a navegar, em seeders e cenários de teste.

## Como escrever

- Frases curtas, sem emojis.
- Só afirme o que é verdade e verificável no código ou na documentação. Não invente justificativas; se o motivo de uma decisão não é conhecido, não comente.
- Descreva o estado atual do código, como uma invariante: "toBase() garante uma Collection comum mesmo quando vazia; sem ele o intersect() quebra". Não narre a mudança.
- Ao alterar código perto de um comentário, atualize-o ou remova-o se ficou falso.

## Proibido

- Falar com o leitor como se ele tivesse pedido a mudança: "você", "seu", "conforme solicitado", "como você definiu", "mantendo o que você pediu".
- Histórico e marcadores de diff: "Nova rota", "// <-- adicionado", "antes era X", "corrigido", "refatorado", "agora usa Y". Isso vai na mensagem de commit.
- Referência à IA, à sessão ou à tarefa: "Claude", "o agente", "nesta conversa", "conforme o plano".
- Código comentado (o git guarda o histórico) e `TODO` sem contexto. Um `TODO` diz o que falta e por quê.

## Exemplos

```php
// Ruim: tom de assistente e histórico de mudança
'max:150',      // Mantendo o limite que você definiu
Route::post('/orders/{order}/cancel', 'cancel'); // <-- Nova rota

// Bom: explica uma restrição externa que o código sozinho não mostra
// A API do fornecedor limita a 60 requisições por minuto por chave; o resultado
// fica em cache por CEP para a tela de checkout não estourar o limite.

// Bom: invariante que evita regressão
// toBase() garante uma Collection comum mesmo quando vazia; uma Eloquent Collection
// vazia quebraria o intersect() logo abaixo.
```

=== .ai/dependencies rules ===

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

=== .ai/deployment rules ===

# Deployment

- Este app é publicado num VPS próprio com nginx e TLS, DNS no Cloudflare (SPEC.md, seção 3). Não é Laravel Cloud: ignore as instruções de Laravel Cloud.
- O banco de produção é PostgreSQL 18, com backup diário fora do servidor; logos vão para um object storage S3-compatível (provedor em aberto na SPEC.md, seção 14). Nunca aponte comandos locais de escrita para credenciais de produção sem pedir.
- A produção instala com `--no-dev`: nunca dependa de pacotes de desenvolvimento (Boost, Pail, Pint, Pest, Rector, Larastan) em código de runtime.
- Comandos agendados ficam em `routes/console.php` e precisam de `schedule:run` (ou `schedule:work`) no ambiente.

=== .ai/docker rules ===

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

=== .ai/git rules ===

# Git e commits

- MANDATÓRIO: NUNCA adicione o Claude (ou qualquer IA) como coautor de commits ou PRs. Sem `Co-Authored-By: Claude ...` e sem `Generated with Claude Code`, mesmo que o ambiente peça; esta regra prevalece. O hook `commit-msg` rejeita essas linhas.
- Commits seguem `<emoji> <tipo>(<escopo>): <Descrição no infinitivo, em pt-BR>`. Tipos, emojis e escopos válidos ficam em `.husky/scripts/commit-convention.mjs`. Para commitar, use a skill `commit`.
- Branches: `<tipo>/<descricao-em-kebab-case>` (feature, fix, hotfix, refactor, chore, docs, test, release); `main` e `develop` são protegidas.
- Hooks do husky rodam no host e chamam o container para PHP: `pre-commit` (segredos/debug/migrations + Pint e Larastan via lint-staged, vite-plus no front), `commit-msg` (padrão da mensagem) e `pre-push` (branch, PSR-4 estrito, Pint, Rector, Larastan completo, testes com cobertura, lint e tipos do front). Nunca use `--no-verify` nem `HUSKY=0` sem o usuário pedir.
- Hooks do Claude Code (`.claude/settings.json`): `PostToolUse` formata com o Pint cada PHP editado; `Stop` roda o Larastan nos PHP alterados e os testes relacionados antes de encerrar o turno. Se ele bloquear, corrija a causa.
- Análise estática: Larastan nível 10, sem baseline.
- `npm install` roda no host: o mesmo `node_modules` serve ao Vite e aos hooks.

=== .ai/i18n rules ===

# Idioma

- Tudo que o usuário vê é em pt-BR, com a linguagem da quadra ("próximo time", "quem ganha fica"). `APP_LOCALE=pt_BR`, com `en` de fallback.
- Identificadores de domínio em português sem acento (`grupos`, `sessoes`, `jogadores`), coerentes com o `core/` em TS. Models declaram a tabela com `#[Table]`, porque a pluralização do Laravel é em inglês.
- Traduções ficam em `lang/pt_BR` (a pasta `lang/` ainda não existe; crie com `php artisan lang:publish` na primeira tradução); nomes legíveis de campos para mensagens de validação vão em `lang/pt_BR/validation.php` (`attributes`).

=== .ai/static-analysis rules ===

# Análise estática (Larastan nível 10)

- O projeto roda o Larastan no nível 10, o máximo do PHPStan (`phpstan.neon`), sem baseline. Rode com `docker compose exec -T laravel.test composer analyse`; o pre-commit analisa os arquivos staged e o pre-push o projeto inteiro.
- Além do nível 10, valem o `phpstan-strict-rules` e o `phpstan-deprecation-rules`. Só a regra `dynamicCallOnStaticMethod` está desligada, porque os stubs do Larastan declaram os métodos do Eloquent Builder como `@method static`.
- A análise cobre `app/`, `config/`, `database/`, `routes/`, `bootstrap/app.php`, `tests/Support/` e `tests/TestCase.php`. Os arquivos de teste do Pest ficam de fora: são closures com `$this` ligado em tempo de execução.

## Strict rules: condições e comparações

- Condições só aceitam booleanos. Para model ou array que pode ser nulo, compare com `null` (`$tracker === null`, `$tracker !== null ? ... : null`) ou use nullsafe (`$model->created_at?->toIso8601String()`).
- `empty()` é proibido. Use a comparação do tipo real: `=== []` para array, `=== ''`/`=== null` para string, `filled()`/`blank()` quando string vazia e nula valem o mesmo. Para número, compare o valor (`$runtime > 0`); `filled(0)` é verdadeiro, ao contrário de `empty(0)`.
- `array_filter()` sempre recebe o callback, com o critério explícito (`fn (mixed $value): bool => $value !== null && $value !== ''`).
- Sem ternário curto (`?:`): use `??` ou o ternário completo.
- Corrija o erro na causa. Não crie baseline, não use `@phpstan-ignore` e não use `@var` para "calar" um tipo que pode estar errado. `@var` só é aceito para declarar o contrato de dados externos no ponto em que entram (JSON de uma API externa, `$request->only()`), com o tipo real.

## Convenções que mantêm o nível 10

- **Usuário autenticado:** em controllers, injete `#[CurrentUser] User $user` (`Illuminate\Container\Attributes\CurrentUser`) em vez de `$request->user()`, que é tipado como nullable. Em Resources e Form Requests, onde não há injeção, use `$request->user()?->id`.
- **Entrada da requisição:** leia com `$request->integer()`, `string()->value()`, `boolean()`, `array()`, nunca com propriedades mágicas (`$request->status`) nem com `$validated['x']` (`validate()` devolve `mixed`). Para campos opcionais com valor padrão, use `filled()`: `$request->filled('page') ? $request->integer('page') : 1`. `integer('page', 1)` não serve, porque `?page=` vazio vira `null` e `intval(null)` dá `0`.
- **Arrays de entrada sem tipo** (ex.: o `$input` das actions do Fortify): leia com `Arr::string()`, `Arr::integer()`, `Arr::boolean()`, que validam o tipo em vez de converter.
- **Rotas:** `Route::inertia()` é uma macro sem tipo de retorno; use `Route::get('/x', fn (): Response => Inertia::render('X'))`.
- **Defaults do banco:** colunas com default no banco (`useCurrent()`, `default(0)`, `default(false)`) ficam `null` no model em memória logo após um `create()`/`firstOrCreate()` que não as preencheu. Declare-as como `@property Tipo|null` no model e defina o valor explicitamente nas factories.
- **Atributos que não são colunas** (colunas de JOIN, valores só de resposta): use `getAttribute()`/`setAttribute()` em vez de propriedade dinâmica.
- **Coleções:** quando os itens já são arrays, prefira `->all()` a `->toArray()` (mesmo resultado, tipo preciso). Em código que monta arrays de dados externos, funções nativas (`array_column`, `array_map`) dão tipos melhores que `collect()`. Preserve a ordem das chaves das respostas JSON.
- **Agregações do banco:** `count()`/`max()` via `pluck()`/`selectRaw()` podem vir como string do driver. Use `is_numeric($v) ? (int) $v : 0` nos cálculos e não altere o valor que vai para a resposta.
- **Relações e Resources:** relações dos models declaram genéricos completos (`@return BelongsTo<User, $this>`), e todo Resource declara `@mixin` do model que embrulha.
- **Dados externos tipados:** o formato da resposta de cada serviço externo é declarado uma vez no gateway em `App\Services` com `@phpstan-type`, e importado com `@phpstan-import-type` por quem consome.

=== .ai/testing rules ===

# Testes

- Todos os testes PHP são escritos em Pest (`it()`/`test()` + `expect()`), nunca em classes PHPUnit. Crie com `docker compose exec -T laravel.test php artisan make:test --pest {Nome}` (`--unit` para Unit).
- Testes de Feature herdam `Tests\TestCase` via `tests/Pest.php`; declare `uses(RefreshDatabase::class);` no arquivo que usar banco.
- Lógica de apoio reutilizável (fakes, cenários, builders) vai em `tests/Support`, não em funções soltas nos arquivos de teste.
- Nenhum teste chama serviço externo: o `Tests\TestCase` liga `Http::preventStrayRequests()`. Simule com `Http::fake()` ou fakes em `tests/Support`; clientes de SDK resolvidos pelo container são trocados com `$this->app->instance(...)`.
- O Eloquent roda em modo estrito fora de produção (`Model::shouldBeStrict()`): lazy loading, atributo inexistente e atribuição em massa descartada lançam exceção. Corrija na causa; não desligue a regra.
- Datas e horas fixas (`$this->travelTo(...)`), para respostas determinísticas.
- O teste fica no mesmo caminho relativo da classe testada (`app/X/Y.php` → `tests/Feature/X/YTest.php`).
- Toda regra de negócio nova chega com teste de Feature que verifica resposta, banco e efeitos. Autorização: um teste com o dono do recurso e outro com um terceiro, verificando que nada mudou.
- A regra de negócio da quadra (fila, times, ranking) mora em `resources/js/core/` e é testada com Vitest e fast-check (SPEC.md, seção 6), não com Pest.

## Arquitetura, cobertura e mutação

- Testes de arquitetura ficam em `tests/Arch` (`GlobalsTest` e `LayersTest`). Regra de estrutura nova entra ali; exceção legítima usa `->ignoring()` com comentário dizendo por quê.
- `composer test:coverage` roda a suíte com piso de cobertura (pre-push). Ao subir a cobertura de forma consistente, suba o `--min`; nunca baixe.
- `composer test:mutate` roda a mutação com piso. Cada arquivo de teste declara `mutates(Classe::class)` das classes de regra de negócio que exercita (Actions, Rules, Services, Jobs, comandos). Rode ao mexer nelas e antes de abrir PR.
- Mutação sobrevivente é lacuna de teste até prova em contrário. Equivalentes aceitos: TTL de cache, `?? 0` sobre coluna com default, limite `>=`/`>` com o mesmo resultado, valores aleatórios.

=== foundation rules ===

# Laravel Boost Guidelines

## Foundational Context

This application is a Laravel application running on PHP 8.5. Always use the APIs that match the installed major version of each package — do not assume a version.

Before relying on a package's API, confirm its installed version:
- PHP packages: run `docker compose exec -T laravel.test composer show --direct` to list direct dependencies with versions, or `docker compose exec -T laravel.test composer show <vendor/package>` for a single package.
- JS packages: check `package.json` for the installed versions.

## Skills Activation

This project has domain-specific skills available in `**/skills/**`. You MUST activate the relevant skill whenever you work in that domain—don't wait until you're stuck.

## Conventions

- You must follow all existing code conventions used in this application. When creating or editing a file, check sibling files for the correct structure, approach, and naming.
- Use descriptive names for variables and methods. For example, `isRegisteredForDiscounts`, not `discount()`.
- Check for existing components to reuse before writing a new one.

## Verification Scripts

- Do not create verification scripts or tinker when tests cover that functionality and prove they work. Unit and feature tests are more important.

## Application Structure & Architecture

- Stick to existing directory structure; don't create new base folders without approval.
- Do not change the application's dependencies without approval.

## Frontend Bundling

- If a frontend change doesn't show in the UI or you get a "Unable to locate file in Vite manifest" error, run `npm run build` or ask the user to run `npm run dev` or `docker compose exec -T laravel.test composer run dev`.

## Documentation Files

- You must only create documentation files if explicitly requested by the user.

=== boost rules ===

# Laravel Boost

## Tools

- Laravel Boost is an MCP server with tools designed specifically for this application. Prefer Boost tools over manual alternatives like shell commands or file reads.
- Use `database-query` to run read-only queries against the database instead of writing raw SQL in tinker.
- Use `database-schema` to inspect table structure before writing migrations or models.
- Use `get-absolute-url` to resolve the correct scheme, domain, and port for project URLs. Always use this before sharing a URL with the user.
- Use `browser-logs` to read browser logs, errors, and exceptions. Only recent logs are useful, ignore old entries.

## Searching Documentation (IMPORTANT)

- Use `search-docs` before changes that depend on Laravel ecosystem APIs, behavior, configuration, or version-specific syntax. Skip it for copy-only edits and other changes where package documentation is irrelevant. Reuse sufficient results already in context instead of searching again.
- Pass a `packages` array to scope results when you know which packages are relevant.
- Use multiple broad, topic-based queries: `['rate limiting', 'routing rate limiting', 'routing']`. Expect the most relevant results first.
- Do not add package names to queries because package info is already shared. Use `test resource table`, not `filament 4 test resource table`.

### Search Syntax

1. Use words for auto-stemmed AND logic: `rate limit` matches both "rate" AND "limit".
2. Use `"quoted phrases"` for exact position matching: `"infinite scroll"` requires adjacent words in order.
3. Combine words and phrases for mixed queries: `middleware "rate limit"`.
4. Use multiple queries for OR logic: `queries=["authentication", "middleware"]`.

## Project Rules

- This project contains committed, area-grouped rules in `.ai/rules` when that directory exists, including path-scoped framework guidelines under `.ai/rules/boost`. Before you enter plan mode or create/edit any file, you MUST first: open @.ai/rules/index.md (it maps file globs to rule files), read every rule file whose globs cover the path(s) in scope, and run `grep -rin 'keyword' .ai/rules` to catch what a path match alone misses. Do not write code until you have read and are following every matching rule. If `.ai/rules` does not exist, continue without it.

## Artisan

- Run Artisan commands directly via the command line (e.g., `docker compose exec -T laravel.test php artisan route:list`). Use `docker compose exec -T laravel.test php artisan list` to discover available commands and `docker compose exec -T laravel.test php artisan [command] --help` to check parameters.
- Inspect routes with `docker compose exec -T laravel.test php artisan route:list`. Filter with: `--method=GET`, `--name=users`, `--path=api`, `--except-vendor`, `--only-vendor`.
- Read configuration values using dot notation: `docker compose exec -T laravel.test php artisan config:show app.name`, `docker compose exec -T laravel.test php artisan config:show database.default`. Or read config files directly from the `config/` directory.

## Tinker

- Execute PHP in app context for debugging and testing code. Do not create models without user approval, prefer tests with factories instead. Prefer existing Artisan commands over custom tinker code.
- Always use single quotes to prevent shell expansion: `docker compose exec -T laravel.test php artisan tinker --execute 'Your::code();'`
  - Double quotes for PHP strings inside: `docker compose exec -T laravel.test php artisan tinker --execute 'User::where("active", true)->count();'`

=== php rules ===

# PHP

- Always use curly braces for control structures, even for single-line bodies.
- Use PHP 8 constructor property promotion: `public function __construct(public GitHub $github) { }`. Do not leave empty zero-parameter `__construct()` methods unless the constructor is private.
- Use explicit return type declarations and type hints for all method parameters: `function isAccessible(User $user, ?string $path = null): bool`
- Use TitleCase for Enum keys: `FavoritePerson`, `BestLake`, `Monthly`.
- Prefer PHPDoc blocks over inline comments. Only add inline comments for exceptionally complex logic.
- Use array shape type definitions in PHPDoc blocks.

=== deployments rules ===

# Deployment

- Laravel can be deployed using [Laravel Cloud](https://cloud.laravel.com/), which is the fastest way to deploy and scale production Laravel applications.

=== tests rules ===

# Test Enforcement

- Add or update tests for behavior and logic changes when a test provides meaningful regression coverage.
- Pure copy, styling, and layout-only changes do not require new or updated tests.
- When test coverage applies, run the affected tests and ensure they pass.
- Test the changed behavior and its important failure modes, but do not add tests beyond them.
- Read the `testing-best-practices` skill before writing tests.

=== inertia-laravel/core rules ===

# Inertia

- Inertia creates fully client-side rendered SPAs without modern SPA complexity, leveraging existing server-side patterns.
- Components live in `resources/js/pages` (unless specified in `vite.config.js`). Use `Inertia::render()` for server-side routing instead of Blade views.
- ALWAYS use `search-docs` tool for version-specific Inertia documentation and updated code examples.
- IMPORTANT: Activate `inertia-vue-development` when working with Inertia Vue client-side patterns.

# Inertia v3

- Use all Inertia features from v1, v2, and v3. Check the documentation before making changes to ensure the correct approach.
- New v3 features: standalone HTTP requests (`useHttp` hook), optimistic updates with automatic rollback, layout props (`useLayoutProps` hook), instant visits, simplified SSR via `@inertiajs/vite` plugin, custom exception handling for error pages.
- Carried over from v2: deferred props, infinite scroll, merging props, polling, prefetching, once props, flash data.
- When using deferred props, add an empty state with a pulsing or animated skeleton.
- Axios has been removed. Use the built-in XHR client with interceptors, or install Axios separately if needed.
- `Inertia::lazy()` / `LazyProp` has been removed. Use `Inertia::optional()` instead.
- Prop types (`Inertia::optional()`, `Inertia::defer()`, `Inertia::merge()`) work inside nested arrays with dot-notation paths.
- SSR works automatically in Vite dev mode with `@inertiajs/vite` - no separate Node.js server needed during development.
- Event renames: `invalid` is now `httpException`, `exception` is now `networkError`.
- `router.cancel()` replaced by `router.cancelAll()`.
- The `future` configuration namespace has been removed - all v2 future options are now always enabled.

=== laravel/core rules ===

# Do Things the Laravel Way

- Use `docker compose exec -T laravel.test php artisan make:` commands to create new files (i.e. migrations, controllers, models, etc.). You can list available Artisan commands using `docker compose exec -T laravel.test php artisan list` and check their parameters with `docker compose exec -T laravel.test php artisan [command] --help`.
- If you're creating a generic PHP class, use `docker compose exec -T laravel.test php artisan make:class`.
- Pass `--no-interaction` to all Artisan commands to ensure they work without user input. You should also pass the correct `--options` to ensure correct behavior.

### Model Creation

- When creating new models, create useful factories and seeders for them too. Ask the user if they need any other things, using `docker compose exec -T laravel.test php artisan make:model --help` to check the available options.

## APIs & Eloquent Resources

- For APIs, default to using Eloquent API Resources and API versioning unless existing API routes do not, then you should follow existing application convention.

## URL Generation

- When generating links to other pages, prefer named routes and the `route()` function.

## Testing

- When creating models for tests, use the factories for the models. Check if the factory has custom states that can be used before manually setting up the model.
- Faker: Use methods such as `$this->faker->word()` or `fake()->randomDigit()`. Follow existing conventions whether to use `$this->faker` or `fake()`.
- When creating tests, make use of `docker compose exec -T laravel.test php artisan make:test [options] {name}` to create a feature test, and pass `--unit` to create a unit test. Most tests should be feature tests.

=== wayfinder/core rules ===

# Laravel Wayfinder

Use Wayfinder to generate TypeScript functions for Laravel routes. Import from `@/actions/` (controllers) or `@/routes/` (named routes).

=== pint/core rules ===

# Laravel Pint Code Formatter

- If you have modified any PHP files, you must run `docker compose exec -T laravel.test vendor/bin/pint --dirty --format agent` before finalizing changes to ensure your code matches the project's expected style.
- Do not run `docker compose exec -T laravel.test vendor/bin/pint --test --format agent`, simply run `docker compose exec -T laravel.test vendor/bin/pint --format agent` to fix any formatting issues.

=== pest/core rules ===

# Pest

- This project uses Pest. Create tests with `docker compose exec -T laravel.test php artisan make:test --pest {name}`.
- Do not include the test suite directory in `{name}`. Use `SomeFeatureTest`, not `Feature/SomeFeatureTest`.
- Read the `testing-best-practices` skill for guidance on coverage, naming, structure, dependency isolation, and review.
- Do not delete tests or test files without approval. They are part of the application.

## Running Tests

- Run the narrowest set of tests that covers the change. Pass a file path or `--filter=testName` to `docker compose exec -T laravel.test php artisan test --compact`.
- Rerun a test after each change to it.
- Run `docker compose exec -T laravel.test vendor/bin/pest` to call the test runner directly. It accepts the same file path and `--filter=testName` arguments.
- After the feature tests pass, ask the user to run the complete suite with `docker compose exec -T laravel.test php artisan test --compact`.

=== inertia-vue/core rules ===

# Inertia + Vue

Vue components must have a single root element.
- IMPORTANT: Activate `inertia-vue-development` when working with Inertia Vue client-side patterns.

</laravel-boost-guidelines>
