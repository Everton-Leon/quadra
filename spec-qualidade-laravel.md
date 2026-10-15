# Kit de qualidade para projetos Laravel dockerizados

> Regras e workflow de qualidade replicáveis em **qualquer projeto Laravel que roda em Docker**: formatação, análise estática no nível máximo, refatoração automatizada, testes em Pest (Feature, arquitetura, cobertura e mutação), hooks de git e configuração de agentes de IA (Claude Code + Laravel Boost).
---

## 0. Como usar

1. Leia as seções 1 a 3 (princípios, camadas, o que você precisa decidir).
2. Siga a seção 5 na ordem, copiando cada arquivo. Os arquivos são genéricos: **só mudam os pontos da tabela abaixo**.
3. Faça a primeira passada (seção 6) e confira o checklist (seção 7).

### O que muda de um projeto para outro

| Ponto | Onde se muda | Padrão do kit |
|---|---|---|
| Nome do serviço PHP no `docker-compose.yml` | `.husky/scripts/docker.mjs` (`SERVICE`) + prefixos nos `.md` de guideline, `.mcp.json`, `pre-push` e `settings.json` | `app` |
| Banco dos testes | `phpunit.xml` (variante A ou B, seção 5.6) | SQLite em memória |
| Escopos de commit (domínios do produto) | `.husky/scripts/commit-convention.mjs` (`SCOPES`) | exemplos `pedidos`, `pagamentos` |
| Pisos de cobertura e mutação | scripts do `composer.json` | 90% e 85% |
| Gateways de serviços externos | `tests/Arch/GlobalsTest.php` | `App\Services` |
| Onde o app é publicado | `.ai/guidelines/deployment.md` | a preencher |

Nos exemplos de comando, `docker compose exec -T app` é o prefixo para rodar no container. Troque `app` pelo seu serviço.

---

## 1. Princípios

1. **Tudo que pode ser verificado por máquina é verificado por máquina.** Revisão humana fica para design e regra de negócio.
2. **Nível máximo desde o primeiro dia, sem baseline.** Larastan nível 10 + strict rules, piso de cobertura e de mutação.
3. **Corrigir na causa.** Proibidos `@phpstan-ignore`, baseline, `@var` para calar tipo, `--no-verify` e baixar piso para passar.
4. **Feedback em camadas.** Rápido no commit (só arquivos staged), completo no push.
5. **Um ambiente só.** PHP e Composer rodam no container, nunca no host, mesmo que o host tenha PHP.
6. **Agentes de IA seguem as mesmas regras**, reforçadas por hooks e guidelines versionadas. IA nunca é coautora de commit.

## 2. Camadas de verificação

| Momento | Onde roda | O que verifica |
|---|---|---|
| Claude Code edita um PHP (`PostToolUse`) | container | Pint no arquivo |
| Claude Code encerra o turno (`Stop`) | container | Larastan nos PHP alterados + testes espelho + `tests/Arch` |
| `pre-commit` | host + container | segredos, debug, conflitos, migrations já na `main`, arquivos > 1 MB; Pint e Larastan dos staged; `composer validate` |
| `commit-msg` | host | `<emoji> <tipo>(<escopo>): <Descrição no infinitivo>`, pt-BR, sem coautoria de IA |
| `pre-push` | host + container | nome da branch, PSR-4 estrito, Pint, Rector, Larastan completo, suíte com piso de cobertura |
| Antes de PR / ao mexer em regra de negócio | container | mutação |

## 3. Requisitos

- Docker + Docker Compose; Node 20+ no host (husky, lint-staged e hooks são scripts Node, portáveis entre Windows, macOS e Linux).
- Laravel 13+ e PHP 8.4+ (ajuste os atributos de classe e o Pest à sua versão).
- Repositório git com a branch principal `main` (`git init -b main`; o `master` padrão é rejeitado pelo check de branch).
- O código do Laravel montado em `/app` no container (bind mount da raiz do projeto).

## 4. Estrutura final

```
.
├── .ai/guidelines/           # regras do projeto (o Boost junta no CLAUDE.md)
├── .claude/
│   ├── hooks/                # pint-format.mjs, verify-on-stop.mjs
│   ├── settings.json
│   └── skills/commit/SKILL.md
├── .husky/
│   ├── pre-commit · commit-msg · pre-push
│   └── scripts/              # docker.mjs, check-staged, commit-convention, commit-msg, check-branch, ensure-container
├── scripts/vendor-sync.mjs
├── tests/
│   ├── Arch/                 # GlobalsTest.php, LayersTest.php
│   ├── Feature/              # espelho de app/
│   ├── Support/              # fakes e cenários (analisados pelo Larastan)
│   ├── Unit/
│   ├── Pest.php
│   └── TestCase.php
├── .mcp.json · boost.json
├── lint-staged.config.js
├── phpstan.neon · rector.php · pint.json · phpunit.xml
└── package.json · composer.json
```

---

## 5. Passo a passo

### 5.1 Docker

**`Dockerfile`** (acrescente à sua imagem de desenvolvimento):

```dockerfile
# Driver de cobertura dos testes (--coverage / --mutate). Só o compose de desenvolvimento liga
# este argumento; a imagem de produção fica sem a extensão.
ARG INSTALL_PCOV=false
RUN if [ "$INSTALL_PCOV" = "true" ]; then install-php-extensions pcov; fi

# PHPStan nível 10 e mutação com --parallel consomem memória.
RUN echo "memory_limit = 1G" > /usr/local/etc/php/conf.d/quality.ini
```

(`install-php-extensions` vem de `COPY --from=mlocati/php-extension-installer:2 /usr/bin/install-php-extensions /usr/local/bin/`; imagens FrankenPHP já trazem.)

**`docker-compose.yml`**, no serviço PHP:

```yaml
services:
  app:
    build:
      context: .
      args:
        INSTALL_PCOV: "true"
    volumes:
      - .:/app
      # vendor e node_modules próprios do container: o bind mount do Windows/macOS é lento para
      # PHPStan/Pest, e o node_modules do host tem binários nativos do host.
      - app-vendor:/app/vendor
      - app-node-modules:/app/node_modules

volumes:
  app-vendor:
  app-node-modules:
```

- O `entrypoint` roda `composer install` quando `vendor/autoload.php` não existe. Se vários serviços usam a mesma imagem (queue, scheduler, reverb), **só um** instala e os outros esperam o autoload, para não haver duas instalações concorrentes no mesmo volume:

```sh
if [ "${INSTALL_DEPENDENCIES:-0}" = "1" ]; then
    composer install --no-interaction --prefer-dist
else
    until [ -f vendor/autoload.php ]; do sleep 2; done
fi
```

- Com banco de testes separado (variante B da seção 5.6), crie-o na inicialização do banco montando um script em `/docker-entrypoint-initdb.d` (Postgres/MySQL rodam esses scripts só num volume vazio; num volume existente, crie o banco à mão uma vez):

```sql
-- docker/postgres/01-test-database.sql
CREATE DATABASE app_test OWNER app;
```

### 5.2 Dependências

```sh
docker compose exec -T app composer remove phpunit/phpunit --dev --no-update
docker compose exec -T app composer require --dev -W \
  pestphp/pest pestphp/pest-plugin-laravel \
  larastan/larastan phpstan/phpstan-strict-rules phpstan/phpstan-deprecation-rules \
  rector/rector driftingly/rector-laravel \
  laravel/boost
```

- O Pest fixa a versão do PHPUnit (Pest 4 → PHPUnit 12, Pest 5 → PHPUnit 13). Não force outra.
- Arquitetura (`arch()`), mutação (`--mutate`, `mutates()`) e presets estão no core do Pest 3+.
- Confira o `"php"` do `require` no `composer.json`: o Rector usa essa versão como alvo.

### 5.3 Pint — `pint.json`

````json
{
    "preset": "laravel",
    "rules": {
        "global_namespace_import": true,
        "is_null": true,
        "strict_comparison": true,
        "strict_param": true,
        "use_arrow_functions": true,
        "void_return": true
    }
}
````

`global_namespace_import` importa até aliases de facade (`\Log::` vira `use Log;`). Use sempre a facade completa (`Illuminate\Support\Facades\Log`).

### 5.4 Larastan nível 10 — `phpstan.neon`

````neon
includes:
    - vendor/larastan/larastan/extension.neon
    - vendor/phpstan/phpstan-strict-rules/rules.neon
    - vendor/phpstan/phpstan-deprecation-rules/rules.neon

parameters:
    level: 10

    # Lê os casts do corpo de casts(); sem isso o Larastan só usa o tipo da coluna na migration
    # (ex.: cast date de uma coluna date viraria string em vez de Carbon).
    parseModelCastsMethod: true

    paths:
        - app/
        - bootstrap/app.php
        - config/
        - database/
        - routes/
        # Só as classes de apoio dos testes: os arquivos do Pest são closures soltas com $this
        # ligado em tempo de execução, que o PHPStan não consegue tipar.
        - tests/Support/
        - tests/TestCase.php

    tmpDir: storage/framework/cache/phpstan

    strictRules:
        # Os stubs do Larastan declaram os métodos do Eloquent Builder e o Request::validate como
        # `@method static`; com esta regra, todo `$query->where()` idiomático seria acusado.
        dynamicCallOnStaticMethod: false
````

**Erros típicos do skeleton do Laravel na primeira passada, e a correção na causa:**

| Erro | Arquivo | Correção |
|---|---|---|
| `array_filter()` sem callback | `config/app.php`, `config/database.php` | passar o critério: `fn (string $key): bool => $key !== ''`, `fn (mixed $value): bool => $value !== null` |
| `rtrim`/`explode`/`Str::slug` recebe `bool\|string` | `config/filesystems.php`, `config/sanctum.php`, `config/horizon.php` | `(string) env(...)` |
| Ternário curto `?:` | `config/broadcasting.php` | `filled(env('X')) ? env('X') : ...` |
| `$user` mixed no canal | `routes/channels.php` | `fn (User $user, string $id): bool => $user->id === (int) $id` |
| Gate do Horizon com `$user` mixed | `app/Providers/HorizonServiceProvider.php` | `fn (?User $user = null): bool => ...` |
| `config('x')` devolve `mixed` | qualquer lugar | `Config::string()`, `Config::integer()`, `Config::boolean()`, `Config::array()` |

### 5.5 Rector — `rector.php`

````php
<?php

use Rector\Config\RectorConfig;
use RectorLaravel\Rector\FuncCall\AppToResolveRector;
use RectorLaravel\Rector\StaticCall\CarbonToDateFacadeRector;
use RectorLaravel\Set\LaravelSetList;

return RectorConfig::configure()
    ->withPaths([
        __DIR__.'/app',
        __DIR__.'/bootstrap/app.php',
        __DIR__.'/config',
        __DIR__.'/database',
        __DIR__.'/routes',
        __DIR__.'/tests',
    ])
    ->withCache(__DIR__.'/storage/framework/cache/rector')
    // Gera `use` em vez de nomes totalmente qualificados; o Pint ordena os imports depois.
    ->withImportNames(importShortClasses: false, removeUnusedImports: true)
    // A versão alvo do PHP vem do require.php do composer.json.
    ->withPhpSets()
    ->withPreparedSets(
        deadCode: true,
        codeQuality: true,
        typeDeclarations: true,
    )
    // Regras de upgrade do Laravel até a versão instalada.
    ->withComposerBased(laravel: true)
    ->withSets([
        LaravelSetList::LARAVEL_CODE_QUALITY,
        LaravelSetList::LARAVEL_COLLECTION,
        LaravelSetList::LARAVEL_FACADE_ALIASES_TO_FULL_NAMES,
        LaravelSetList::LARAVEL_TESTING,
        LaravelSetList::LARAVEL_TYPE_DECLARATIONS,
    ])
    ->withSkip([
        // app() e resolve() são o mesmo helper; o projeto padroniza em app().
        AppToResolveRector::class,
        // Sem Date::use() configurado, a facade Date devolve o mesmo Carbon; o projeto usa Carbon e now() direto.
        CarbonToDateFacadeRector::class,
    ]);
````

- **Rode até o dry-run sair limpo** e revise cada diff: uma passada destrava regras novas (ex.: depois de tipar casts, o `SafeDeclareStrictTypesRector` consegue provar `strict_types` seguro em mais arquivos).
- `declare(strict_types=1)` entra só pelo `SafeDeclareStrictTypesRector`, nunca à mão.

### 5.6 Pest — `phpunit.xml`

Testsuites `Unit`, `Arch` e `Feature`. Escolha a variante do banco:

- **Variante A — SQLite em memória:** mais rápida; serve quando o projeto não usa recursos específicos do banco.
- **Variante B — banco de testes separado (Postgres/MySQL):** obrigatória quando o projeto usa extensões ou tipos do banco (`pg_trgm`, `unaccent`, `jsonb`, full-text). O `--parallel` cria cópias (`app_test_test_1`, ...).

> **Regra crítica:** se o compose carrega o `.env` como variáveis reais do container (`env_file:` ou `environment:`), todo valor de teste precisa de `force="true"` em `<env>` **e** `<server>`, porque o Laravel lê `$_SERVER` antes de `$_ENV`. Sem isso os testes rodam contra o banco, o cache e o storage de desenvolvimento. O kit já traz os dois com `force`.

````xml
<?xml version="1.0" encoding="UTF-8"?>
<phpunit xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:noNamespaceSchemaLocation="vendor/phpunit/phpunit/phpunit.xsd"
         bootstrap="vendor/autoload.php"
         colors="true"
>
    <testsuites>
        <testsuite name="Unit">
            <directory>tests/Unit</directory>
        </testsuite>
        <testsuite name="Arch">
            <directory>tests/Arch</directory>
        </testsuite>
        <testsuite name="Feature">
            <directory>tests/Feature</directory>
        </testsuite>
    </testsuites>
    <source>
        <include>
            <directory>app</directory>
        </include>
    </source>
    <php>
        <!--
            O docker-compose carrega o .env como variáveis reais do container, e o Laravel lê
            $_SERVER antes de $_ENV. Por isso cada valor de teste usa force="true" em <env> e <server>;
            sem isso os testes rodariam contra o banco, o cache e o storage de desenvolvimento.
        -->
        <env name="APP_ENV" value="testing" force="true"/>
        <server name="APP_ENV" value="testing" force="true"/>
        <env name="APP_DEBUG" value="false" force="true"/>
        <server name="APP_DEBUG" value="false" force="true"/>
        <env name="APP_MAINTENANCE_DRIVER" value="file" force="true"/>
        <env name="BCRYPT_ROUNDS" value="4" force="true"/>
        <server name="BROADCAST_CONNECTION" value="null" force="true"/>
        <env name="BROADCAST_CONNECTION" value="null" force="true"/>
        <server name="CACHE_STORE" value="array" force="true"/>
        <env name="CACHE_STORE" value="array" force="true"/>
        <!-- Variante A: SQLite em memória. Para banco separado, ver a variante B na seção 5.6. -->
        <server name="DB_CONNECTION" value="sqlite" force="true"/>
        <env name="DB_CONNECTION" value="sqlite" force="true"/>
        <server name="DB_DATABASE" value=":memory:" force="true"/>
        <env name="DB_DATABASE" value=":memory:" force="true"/>
        <server name="DB_URL" value="" force="true"/>
        <env name="DB_URL" value="" force="true"/>
        <server name="FILESYSTEM_DISK" value="local" force="true"/>
        <env name="FILESYSTEM_DISK" value="local" force="true"/>
        <server name="MAIL_MAILER" value="array" force="true"/>
        <env name="MAIL_MAILER" value="array" force="true"/>
        <server name="QUEUE_CONNECTION" value="sync" force="true"/>
        <env name="QUEUE_CONNECTION" value="sync" force="true"/>
        <server name="SESSION_DRIVER" value="array" force="true"/>
        <env name="SESSION_DRIVER" value="array" force="true"/>
        <env name="PULSE_ENABLED" value="false" force="true"/>
        <env name="TELESCOPE_ENABLED" value="false" force="true"/>
        <env name="NIGHTWATCH_ENABLED" value="false" force="true"/>
    </php>
</phpunit>
````

Para a variante B, troque as linhas de `DB_CONNECTION`/`DB_DATABASE` por:

```xml
<server name="DB_CONNECTION" value="pgsql" force="true"/>
<env name="DB_CONNECTION" value="pgsql" force="true"/>
<server name="DB_DATABASE" value="app_test" force="true"/>
<env name="DB_DATABASE" value="app_test" force="true"/>
<server name="DB_URL" value="" force="true"/>
<env name="DB_URL" value="" force="true"/>
```

### 5.7 Pest — `tests/Pest.php` e `tests/TestCase.php`

````php
<?php

declare(strict_types=1);

use Tests\TestCase;

/*
|--------------------------------------------------------------------------
| Test Case
|--------------------------------------------------------------------------
|
| Testes de Feature rodam sobre o Tests\TestCase (aplicação Laravel inicializada).
| Testes de Unit não sobem o framework. Use `uses(RefreshDatabase::class)` no arquivo
| de teste que precisar de banco (ver phpunit.xml).
|
*/

pest()->extend(TestCase::class)->in('Feature');
````

````php
<?php

declare(strict_types=1);

namespace Tests;

use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Illuminate\Support\Facades\Http;

abstract class TestCase extends BaseTestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        // Nenhum teste chama serviço externo: requisição sem fake correspondente
        // (Http::fake) lança exceção em vez de sair para a rede.
        Http::preventStrayRequests();
    }
}
````

Regras dos testes:
- O teste fica no **mesmo caminho relativo da classe**: `app/Http/Controllers/OrderController.php` → `tests/Feature/Http/Controllers/OrderControllerTest.php`. O hook `Stop` do Claude Code usa esse espelho.
- `tests/Support/` guarda fakes, cenários e builders (é analisado pelo Larastan).
- `uses(RefreshDatabase::class);` em cada arquivo que usa banco.
- Clientes de SDK são resolvidos pelo container (bind no `AppServiceProvider`) para serem trocados por mock com `$this->app->instance(...)`.
- Datas fixas com `$this->travelTo(...)`.

### 5.8 Testes de arquitetura — `tests/Arch/`

````php
<?php

use Illuminate\Support\Facades\Http;

arch('php')->preset()->php();

arch('security')->preset()->security();

arch('sem funções de depuração')
    ->expect(['dd', 'ddd', 'dump', 'ray', 'exit', 'die', 'var_dump'])
    ->not->toBeUsed();

// Com config:cache em produção, env() fora de config/ devolve null.
arch('env() só em config/')
    ->expect('env')
    ->not->toBeUsed();

// Serviços externos só são chamados pelos gateways em App\Services, que concentram autenticação,
// timeout e normalização. Nos testes, o Http é usado para os fakes. Ajuste a lista se o projeto
// tiver gateways em outro namespace.
arch('Http só nos gateways de serviços externos')
    ->expect(Http::class)
    ->toOnlyBeUsedIn([
        'App\Services',
        'Tests',
    ]);
````

````php
<?php

use Illuminate\Console\Command;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Notifications\Notification;
use Illuminate\Support\ServiceProvider;

arch('controllers')
    ->expect('App\Http\Controllers')
    ->classes()
    ->toHaveSuffix('Controller');

arch('form requests')
    ->expect('App\Http\Requests')
    ->classes()
    ->toHaveSuffix('Request')
    ->toExtend(FormRequest::class)
    ->toHaveMethod('rules');

arch('form requests só em App\Http\Requests')
    ->expect('App')
    ->not->toExtend(FormRequest::class)
    ->ignoring('App\Http\Requests');

arch('resources')
    ->expect('App\Http\Resources')
    ->classes()
    ->toHaveSuffix('Resource')
    ->toExtend(JsonResource::class);

arch('models')
    ->expect('App\Models')
    ->classes()
    ->toExtend(Model::class)
    ->not->toHaveSuffix('Model');

arch('models só em App\Models')
    ->expect('App')
    ->not->toExtend(Model::class)
    ->ignoring('App\Models');

arch('enums com valor string em App\Enums')
    ->expect('App\Enums')
    ->toBeStringBackedEnums();

arch('enums só em App\Enums')
    ->expect('App')
    ->not->toBeEnums()
    ->ignoring('App\Enums');

arch('notificações')
    ->expect('App\Notifications')
    ->classes()
    ->toExtend(Notification::class);

arch('comandos')
    ->expect('App\Console\Commands')
    ->classes()
    ->toExtend(Command::class)
    ->toHaveMethod('handle');

arch('jobs')
    ->expect('App\Jobs')
    ->classes()
    ->toHaveMethod('handle');

arch('actions')
    ->expect('App\Actions')
    ->classes()
    ->toHaveSuffix('Action');

arch('providers')
    ->expect('App\Providers')
    ->classes()
    ->toHaveSuffix('ServiceProvider')
    ->toExtend(ServiceProvider::class);

arch('middleware')
    ->expect('App\Http\Middleware')
    ->classes()
    ->toHaveMethod('handle');

arch('camada HTTP não é usada por services, models, actions e jobs')
    ->expect('App\Http')
    ->toOnlyBeUsedIn(['App\Http', 'App\Providers']);
````

- Regras sobre namespaces que ainda não existem passam sem erro: deixe-as prontas, elas valem quando a camada surgir.
- O preset `laravel` do Pest **não** é usado: exige controllers só com métodos REST e sufixo `Command`.
- Exceção legítima: `->ignoring()` com comentário explicando o motivo.

### 5.9 Modelos em modo estrito — `app/Providers/AppServiceProvider.php`

```php
public function boot(): void
{
    // Lazy loading, atributo inexistente e atribuição em massa descartada viram exceção
    // fora de produção. Em produção ficam desligados para um N+1 não derrubar a requisição.
    Model::shouldBeStrict(! $this->app->isProduction());
}
```

### 5.10 Scripts do Composer

```json
"scripts": {
    "test": ["@php artisan config:clear --ansi", "@php artisan test"],
    "test:coverage": ["@php artisan config:clear --ansi", "@php artisan test --compact --coverage --min=90"],
    "test:mutate": ["Composer\\Config::disableProcessTimeout", "@php artisan config:clear --ansi", "pest --mutate --parallel --min=85"],
    "analyse": ["Composer\\Config::disableProcessTimeout", "phpstan analyse --no-progress --memory-limit=1G"],
    "refactor": ["Composer\\Config::disableProcessTimeout", "rector process", "pint"],
    "refactor:check": ["Composer\\Config::disableProcessTimeout", "rector process --dry-run"],
    "lint:check": ["pint --test"],
    "quality": ["@lint:check", "@refactor:check", "@analyse", "@test:coverage"]
}
```

- **Mutação:** cada arquivo de teste declara `mutates(Classe::class)` das classes de regra de negócio que exercita (Actions, Services, Jobs, comandos). Só elas são mutadas.
- **Pisos:** projeto novo começa com 90% de cobertura e 85% de mutação. Projeto existente começa no valor atual arredondado para baixo e sobe com o tempo. Nunca baixe o piso para um commit passar.
- **Mutantes equivalentes aceitos** (não exigem teste): TTL de cache, `?? 0` sobre coluna com default no banco, limite `>=`/`>` em que os dois ramos dão o mesmo resultado, valores aleatórios. O resto é lacuna de teste.

### 5.11 Hooks de git — husky e lint-staged

```sh
npm install -D husky lint-staged
npx husky init   # cria .husky/ e o script "prepare": "husky"
```

**`package.json`** (no host; o container tem seu próprio `node_modules`):

```json
{
    "private": true,
    "type": "module",
    "scripts": {
        "prepare": "husky",
        "vendor:sync": "node scripts/vendor-sync.mjs"
    },
    "devDependencies": {
        "husky": "^9.1.7",
        "lint-staged": "^17.6.0"
    }
}
```

**`.husky/pre-commit`**

```sh
# Verificações locais (arquivos sensíveis, debug, conflitos, migrations).
node .husky/scripts/check-staged.mjs

# Linters no container (Pint e Larastan em PHP, composer validate).
node .husky/scripts/ensure-container.mjs --if-staged
npx --no -- lint-staged
```

**`.husky/commit-msg`**

```sh
node .husky/scripts/commit-msg.mjs "$1"
```

**`.husky/pre-push`** (troque `app` pelo seu serviço):

```sh
node .husky/scripts/check-branch.mjs
node .husky/scripts/ensure-container.mjs

# A imagem de produção usa --classmap-authoritative: classe cujo arquivo não segue o PSR-4
# (ex.: diferença de maiúsculas no nome) fica fora do classmap e não carrega. Windows e macOS não acusam.
docker compose exec -T app composer dump-autoload --optimize --strict-psr
docker compose exec -T app composer lint:check
docker compose exec -T app composer refactor:check
docker compose exec -T app composer analyse
# Suíte completa com piso de cobertura (pcov, só na imagem de desenvolvimento).
docker compose exec -T app composer test:coverage
```

**`.husky/scripts/docker.mjs`**: o único lugar com o nome do serviço, usado por todos os scripts:

````js
// Ponto único de configuração do Docker para os hooks do git e do Claude Code.
// Troque SERVICE pelo nome do serviço PHP no docker-compose.yml.
import { execFileSync } from 'node:child_process';

export const SERVICE = 'app';

/** Argumentos para rodar um comando no container: docker compose exec -T <service> ... */
export const execArgs = (...command) => ['compose', 'exec', '-T', SERVICE, ...command];

/** Prefixo em texto, para comandos montados como string (lint-staged). */
export const EXEC = `docker compose exec -T ${SERVICE}`;

export const isServiceRunning = (cwd = process.cwd()) => {
    try {
        const services = execFileSync('docker', ['compose', 'ps', '--status', 'running', '--services'], {
            cwd,
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'ignore'],
        });

        return services.split(/\r?\n/).includes(SERVICE);
    } catch {
        return false;
    }
};
````

**`.husky/scripts/check-staged.mjs`**:

````js
// Hook pre-commit: verificações rápidas nos arquivos staged que não dependem do container.
// - arquivos sensíveis (.env, chaves, keystores) e arquivos grandes
// - marcadores de conflito, chamadas de debug e segredos nas linhas adicionadas
// - edição/remoção de migrations que já existem na main
import { execFileSync } from 'node:child_process';

const MAX_FILE_SIZE_BYTES = 1024 * 1024;
const MAIN_BRANCH = 'main';
const MIGRATIONS_DIR = 'database/migrations/';

const FORBIDDEN_FILES = [
    { pattern: /(^|\/)\.env(\.(?!example$)[^/]+)?$/, reason: 'arquivo de ambiente com credenciais' },
    { pattern: /\.(pem|key|p8|p12|pfx|jks|keystore|mobileprovision)$/i, reason: 'chave/certificado/keystore' },
    { pattern: /(^|\/)auth\.json$/, reason: 'credenciais do Composer' },
    { pattern: /(^|\/)(google-services\.json|GoogleService-Info\.plist)$/, reason: 'credenciais do Firebase' },
    { pattern: /\.sqlite(-journal)?$/, reason: 'banco SQLite local' },
    { pattern: /\.(pt|pth|onnx|safetensors|ckpt)$/i, reason: 'pesos de modelo (ficam fora do git)' },
];

const LINE_CHECKS = [
    { files: /./, pattern: /^(<{7}|>{7})( |$)|^={7}$/, reason: 'marcador de conflito de merge' },
    { files: /\.php$/, pattern: /(?:^|[^\w$>:])(dd|ddd|dump|var_dump|ray)\s*\(/, reason: 'chamada de debug (dd/dump/var_dump/ray)' },
    { files: /\.php$/, pattern: /->\s*(dd|ddd|dump|ray)\s*\(/, reason: 'chamada de debug encadeada (->dd()/->dump())' },
    { files: /\.blade\.php$/, pattern: /@(dd|dump)\b/, reason: 'diretiva de debug no Blade' },
    {
        files: /\.(js|mjs|cjs|ts|tsx|jsx)$/,
        pattern: /\bconsole\.log\s*\(|\bdebugger\b/,
        reason: 'console.log/debugger',
        skip: /^(\.husky|scripts|\.claude)\//,
    },
    { files: /\.py$/, pattern: /^\s*(breakpoint\(\)|import pdb|pdb\.set_trace\(\))/, reason: 'depurador do Python' },
    { files: /./, pattern: /AKIA[0-9A-Z]{16}/, reason: 'possível chave de acesso AWS' },
    { files: /./, pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/, reason: 'chave privada' },
];

const git = (...args) => execFileSync('git', ['-c', 'core.quotepath=false', ...args], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

const errors = [];

const stagedEntries = git('diff', '--cached', '--name-status', '--diff-filter=ACMRD')
    .split('\n')
    .filter(Boolean)
    .map((line) => {
        const [status, ...paths] = line.split('\t');

        return { status: status[0], path: paths.at(-1), originalPath: paths[0] };
    });

for (const { status, path } of stagedEntries) {
    if (status === 'D') {
        continue;
    }

    const forbidden = FORBIDDEN_FILES.find(({ pattern }) => pattern.test(path));

    if (forbidden) {
        errors.push(`${path}: ${forbidden.reason} não deve ser commitado.`);
    }

    const size = Number(git('cat-file', '-s', `:${path}`).trim());

    if (size > MAX_FILE_SIZE_BYTES) {
        errors.push(`${path}: ${(size / 1024 / 1024).toFixed(1)} MB (limite de 1 MB). Use o storage S3 para arquivos grandes.`);
    }
}

let currentFile = null;
let currentLine = 0;

for (const line of git('diff', '--cached', '-U0', '--diff-filter=ACMR', '--no-color').split('\n')) {
    if (line.startsWith('+++ ')) {
        currentFile = line.startsWith('+++ b/') ? line.slice(6) : null;
        continue;
    }

    const hunk = line.match(/^@@ -\S+ \+(\d+)/);

    if (hunk) {
        currentLine = Number(hunk[1]);
        continue;
    }

    if (!currentFile || !line.startsWith('+')) {
        continue;
    }

    const content = line.slice(1);

    for (const check of LINE_CHECKS) {
        if (check.files.test(currentFile) && !check.skip?.test(currentFile) && check.pattern.test(content)) {
            errors.push(`${currentFile}:${currentLine}: ${check.reason}.`);
        }
    }

    currentLine++;
}

if (process.env.ALLOW_MIGRATION_EDIT !== '1') {
    for (const { status, originalPath } of stagedEntries) {
        if (!['M', 'D', 'R'].includes(status) || !originalPath.startsWith(MIGRATIONS_DIR)) {
            continue;
        }

        try {
            git('cat-file', '-e', `${MAIN_BRANCH}:${originalPath}`);
        } catch {
            continue;
        }

        errors.push(
            `${originalPath}: migration que já está na ${MAIN_BRANCH} foi alterada/removida. ` +
                'Crie uma migration nova (ou use ALLOW_MIGRATION_EDIT=1 se tiver certeza de que ela nunca rodou fora da sua máquina).',
        );
    }
}

if (errors.length) {
    console.error('\n✖ Verificações do pre-commit falharam:\n');
    errors.forEach((error) => console.error(`  • ${error}`));
    console.error('\n  Corrija e tente de novo. Em último caso: git commit --no-verify\n');
    process.exit(1);
}
````

**`.husky/scripts/commit-convention.mjs`**: fonte da verdade de tipos e escopos (o hook e a skill `commit` leem daqui):

````js
// Convenção de commits do projeto.
// Formato: <emoji> <tipo>(<escopo>): <Descrição no infinitivo, em pt-BR>
// Exemplo: ✨ feat(pedidos): Adicionar cancelamento de pedidos pelo cliente.
//
// Para criar um tipo ou escopo novo, edite as listas abaixo: o hook commit-msg e a skill /commit leem daqui.

/** Tipo de commit => emoji obrigatório. */
export const TYPES = {
    feat: { emoji: '✨', description: 'Nova funcionalidade' },
    fix: { emoji: '🐛', description: 'Correção de bug' },
    hotfix: { emoji: '🚑', description: 'Correção urgente em produção' },
    refactor: { emoji: '🔨', description: 'Refatoração sem mudar comportamento' },
    perf: { emoji: '⚡', description: 'Melhoria de performance' },
    style: { emoji: '🎨', description: 'Formatação/estilo de código, sem mudar lógica' },
    test: { emoji: '✅', description: 'Adição ou ajuste de testes' },
    docs: { emoji: '📝', description: 'Documentação' },
    build: { emoji: '📦', description: 'Dependências, Docker ou build' },
    ci: { emoji: '👷', description: 'Pipelines de CI/CD' },
    chore: { emoji: '🔧', description: 'Configuração e tarefas de manutenção' },
    revert: { emoji: '⏪', description: 'Reverter commit anterior' },
};

/**
 * Escopos permitidos. Os de domínio são do produto (troque pelos do seu projeto); os transversais servem
 * a qualquer projeto. Use vários separados por vírgula: (pedidos,pagamentos).
 */
export const SCOPES = {
    // --- Domínio (exemplos: substitua pelos módulos do seu produto) ---
    auth: 'Login, cadastro, Sanctum, papéis',
    pedidos: 'Exemplo de domínio: pedidos',
    pagamentos: 'Exemplo de domínio: pagamentos',
    notificacoes: 'Notificações, e-mail e push',
    // --- Transversais ---
    api: 'Rotas, versionamento e docs da API',
    db: 'Migrations, models, factories e seeders',
    config: 'Arquivos de config e .env.example',
    docker: 'Dockerfile, docker-compose, entrypoint',
    deps: 'Dependências do Composer/npm',
    testes: 'Infraestrutura de testes',
    git: 'Hooks, husky, lint-staged',
    ia: 'Configuração de agentes de IA (.ai, .claude, Boost)',
    docs: 'Documentação e decisões',
};

export const MAX_HEADER_LENGTH = 100;
export const MIN_SUBJECT_LENGTH = 10;
````

**`.husky/scripts/commit-msg.mjs`**:

````js
// Hook commit-msg: valida a mensagem contra a convenção em commit-convention.mjs.
// Uso: node .husky/scripts/commit-msg.mjs <arquivo-da-mensagem>
import { readFileSync } from 'node:fs';
import { MAX_HEADER_LENGTH, MIN_SUBJECT_LENGTH, SCOPES, TYPES } from './commit-convention.mjs';

const HEADER_PATTERN =
    /^(?<emoji>\p{Extended_Pictographic}\uFE0F?)(?<space>\s*)(?<type>[a-z]+)(?:\((?<scope>[^)]*)\))?(?<breaking>!)?(?<colon>:?)(?<separator>\s*)(?<subject>.*)$/u;

// Verbos em inglês que terminam como infinitivo em português e passariam pelo teste abaixo.
const ENGLISH_VERBS = new Set(['render', 'register', 'filter', 'order', 'trigger', 'cover', 'clear', 'enter', 'refactor', 'monitor', 'color', 'error']);
const ENGLISH_WORDS = /\b(the|and|to|for|with|when|from|of|on|in|into|instead|should|add|fix|update|remove|create|implement|change)\b/gi;
const AI_ATTRIBUTION = /^\s*co-authored-by:.*(claude|anthropic|copilot|gemini|openai|chatgpt|cursor)|generated with .*claude/i;
const PORTUGUESE_WORDS =/\b(de|da|do|das|dos|para|com|ao|aos|na|no|nas|nos|em|e|que|um|uma|ou|por|pelo|pela)\b/gi;

const messageFile = process.argv[2];

if (!messageFile) {
    console.error('commit-msg: arquivo da mensagem não informado.');
    process.exit(1);
}

const lines = readFileSync(messageFile, 'utf8')
    .split(/\r?\n/)
    .filter((line) => !line.startsWith('#'));

while (lines.length && lines.at(-1).trim() === '') {
    lines.pop();
}

const header = (lines[0] ?? '').trim();

// Mensagens geradas pelo próprio git ficam de fora.
if (/^(Merge |Revert "|fixup! |squash! |amend! )/.test(header)) {
    process.exit(0);
}

const errors = [];
const match = header.match(HEADER_PATTERN);

if (!match) {
    errors.push('O cabeçalho precisa começar com o emoji do tipo, ex.: "✨ feat(pedidos): Adicionar ...".');
} else {
    const { emoji, space, type, scope, colon, separator, subject } = match.groups;
    const typeConfig = TYPES[type];

    if (!typeConfig) {
        errors.push(`Tipo "${type}" inválido. Use um destes: ${Object.keys(TYPES).join(', ')}.`);
    } else if (emoji.replace('\uFE0F', '') !== typeConfig.emoji.replace('\uFE0F', '')) {
        errors.push(`O tipo "${type}" usa o emoji ${typeConfig.emoji}, não ${emoji}.`);
    }

    if (space !== ' ') {
        errors.push('Use exatamente um espaço entre o emoji e o tipo: "✨ feat(...)".');
    }

    if (scope === undefined || scope.trim() === '') {
        errors.push(`Informe o escopo entre parênteses, ex.: "${typeConfig?.emoji ?? '✨'} ${type}(pedidos): ...".`);
    } else {
        const invalidScopes = scope.split(',').map((item) => item.trim()).filter((item) => !(item in SCOPES));

        if (invalidScopes.length) {
            errors.push(`Escopo inválido: ${invalidScopes.join(', ')}. Escopos permitidos: ${Object.keys(SCOPES).join(', ')}.`);
        }
    }

    if (colon !== ':' || separator !== ' ') {
        errors.push('Depois do tipo/escopo use ": " (dois-pontos e um espaço).');
    }

    const firstWord = subject.split(/\s+/)[0] ?? '';

    if (subject.length < MIN_SUBJECT_LENGTH) {
        errors.push(`A descrição precisa ter pelo menos ${MIN_SUBJECT_LENGTH} caracteres.`);
    } else if (!/^\p{Lu}/u.test(subject)) {
        errors.push('A descrição deve começar com letra maiúscula.');
    } else if (!/^\p{L}+(ar|er|ir|or|ôr)$/iu.test(firstWord) || ENGLISH_VERBS.has(firstWord.toLowerCase())) {
        errors.push(`Comece a descrição com um verbo no infinitivo em português (Adicionar, Corrigir, Refatorar...). Recebido: "${firstWord}".`);
    }

    const englishCount = (subject.match(ENGLISH_WORDS) ?? []).length;
    const portugueseCount = (subject.match(PORTUGUESE_WORDS) ?? []).length;

    if (englishCount >= 2 && englishCount > portugueseCount) {
        errors.push('A mensagem parece estar em inglês. Escreva em português (pt-BR).');
    }
}

if (header.length > MAX_HEADER_LENGTH) {
    errors.push(`O cabeçalho tem ${header.length} caracteres; o máximo é ${MAX_HEADER_LENGTH}. Detalhes vão no corpo.`);
}

if (lines.length > 1 && lines[1].trim() !== '') {
    errors.push('Deixe uma linha em branco entre o cabeçalho e o corpo da mensagem.');
}

// Regra mandatória do projeto: assistentes de IA nunca entram como coautores.
if (lines.some((line) => AI_ATTRIBUTION.test(line))) {
    errors.push('Remova a atribuição a IA (Co-Authored-By: Claude / "Generated with Claude Code"). Assistentes de IA nunca são coautores.');
}

if (errors.length) {
    console.error('\n✖ Mensagem de commit fora do padrão:\n');
    console.error(`  ${header || '(vazia)'}\n`);
    errors.forEach((error) => console.error(`  • ${error}`));
    console.error('\n  Formato: <emoji> <tipo>(<escopo>): <Descrição no infinitivo>');
    console.error('  Exemplo: ✨ feat(pedidos): Adicionar cancelamento de pedidos pelo cliente.');
    console.error('  Tipos e escopos: .husky/scripts/commit-convention.mjs\n');
    process.exit(1);
}
````

**`.husky/scripts/check-branch.mjs`**:

````js
// Hook pre-push: valida o nome da branch atual.
// Padrão: main, develop ou <tipo>/<descricao-em-kebab-case>, ex.: feature/cancelamento-de-pedidos.
import { execFileSync } from 'node:child_process';

const PROTECTED_BRANCHES = ['main', 'develop'];
const BRANCH_PATTERN = /^(feature|fix|hotfix|refactor|chore|docs|test|release)\/[a-z0-9]+(-[a-z0-9]+)*$/;

// symbolic-ref funciona também numa branch sem commits; em detached HEAD falha e o valor vira 'HEAD'.
let branch = 'HEAD';

try {
    branch = execFileSync('git', ['symbolic-ref', '--short', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
} catch {
    // Detached HEAD (rebase, checkout de tag): não há nome de branch para validar.
}

if (branch !== 'HEAD' && !PROTECTED_BRANCHES.includes(branch) && !BRANCH_PATTERN.test(branch)) {
    console.error(`\n✖ Nome de branch fora do padrão: "${branch}".`);
    console.error('  Use <tipo>/<descricao-em-kebab-case>, com tipo em: feature, fix, hotfix, refactor, chore, docs, test, release.');
    console.error('  Renomeie com: git branch -m <novo-nome>\n');
    process.exit(1);
}
````

**`.husky/scripts/ensure-container.mjs`**:

````js
// Garante que o container PHP está rodando antes de chamar Pint/Composer/Pest nos hooks.
// Com --if-staged, só exige o container quando há arquivos PHP ou composer.json staged.
import { execFileSync } from 'node:child_process';
import { SERVICE, isServiceRunning } from './docker.mjs';

if (process.argv.includes('--if-staged')) {
    const staged = execFileSync('git', ['diff', '--cached', '--name-only', '--diff-filter=ACMR'], { encoding: 'utf8' });

    if (!/(\.php|(^|\/)composer\.json)$/m.test(staged)) {
        process.exit(0);
    }
}

if (!isServiceRunning()) {
    console.error(`\n✖ O container "${SERVICE}" não está rodando, e os linters PHP (Pint, Larastan, Pest) rodam dentro dele.`);
    console.error('  Suba com: docker compose up -d\n');
    process.exit(1);
}
````

**`lint-staged.config.js`**:

````js
// Linters rodados no pre-commit, só nos arquivos staged.
// PHP/Composer rodam no container, com caminhos relativos à raiz do projeto (montada em /app).
import path from 'node:path';
import { EXEC } from './.husky/scripts/docker.mjs';

// Mesmos caminhos de `paths` no phpstan.neon (dos testes, só tests/Support e o TestCase).
const ANALYSED_PATHS = /^(app|config|database|routes|tests\/Support)\/|^bootstrap\/app\.php$|^tests\/TestCase\.php$/;

const toRelative = (files) => files.map((file) => path.relative(process.cwd(), file).split(path.sep).join('/'));

const quote = (files) => files.map((file) => `"${file}"`).join(' ');

export default {
    '*.php': (files) => {
        const relativeFiles = toRelative(files);
        const analysedFiles = relativeFiles.filter((file) => ANALYSED_PATHS.test(file));

        return [
            // Pint corrige o estilo e o lint-staged re-adiciona os arquivos ao commit; erro de sintaxe barra o commit.
            `${EXEC} vendor/bin/pint ${quote(relativeFiles)}`,
            // Larastan nível 10, sem baseline: o projeto inteiro passa limpo.
            ...(analysedFiles.length
                ? [`${EXEC} vendor/bin/phpstan analyse --no-progress --memory-limit=1G ${quote(analysedFiles)}`]
                : []),
        ];
    },
    'composer.json': () => `${EXEC} composer validate --no-check-lock --no-check-publish`,
};
````

**Convenção de commits, resumo:**

- Formato: `<emoji> <tipo>(<escopo>): <Descrição no infinitivo, em pt-BR>`. Ex.: `✨ feat(pedidos): Adicionar cancelamento de pedidos pelo cliente.`
- Vários escopos: `(pedidos,pagamentos)`. Quebra de contrato da API: `!` depois do escopo.
- Escopo é **o domínio afetado**, não a camada.
- Branches: `main`, `develop` ou `<tipo>/<descricao-em-kebab-case>`.

### 5.12 Sincronizar o `vendor` para o editor — `scripts/vendor-sync.mjs`

````js
// Copia o vendor do container para o host. O container usa um volume próprio em /app/vendor;
// o vendor do host serve só ao editor (autocomplete, Intelephense). Rode depois de mudar dependências.
// Usa tar num caminho do bind mount: `docker cp` e pipes binários do `docker compose exec` falham no Windows.
import { execFileSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { execArgs } from '../.husky/scripts/docker.mjs';

const archive = 'storage/framework/cache/vendor.tar';

const run = (command, args, options = {}) => execFileSync(command, args, { stdio: 'inherit', ...options });

// MSYS_NO_PATHCONV impede o Git Bash de converter /app em caminho do Windows.
run('docker', execArgs('tar', '-C', '/app', '-cf', `/app/${archive}`, 'vendor'), {
    env: { ...process.env, MSYS_NO_PATHCONV: '1' },
});

rmSync('vendor', { recursive: true, force: true });
run('tar', ['-xf', archive]);
rmSync(archive, { force: true });

console.log('✔ vendor sincronizado com o container.');
````

Rode `npm run vendor:sync` depois de qualquer `composer require/update/remove` e ao trocar de branch com `composer.lock` diferente. Coloque `storage/framework/cache/vendor.tar` no `.gitignore` por segurança.

### 5.13 Arquivos de apoio do repositório

**`.gitattributes`** (hooks e scripts com LF; sem isso o `sh` do container quebra com `\r`):

```gitattributes
* text=auto eol=lf
*.bat text eol=crlf
*.ps1 text eol=crlf
```

**`.editorconfig`**: o do skeleton do Laravel já atende (4 espaços, LF, UTF-8).

### 5.14 Claude Code — `.claude/settings.json` e hooks

````json
{
    "$schema": "https://json.schemastore.org/claude-code-settings.json",
    "attribution": {
        "commit": "",
        "pr": ""
    },
    "includeCoAuthoredBy": false,
    "enabledMcpjsonServers": [
        "laravel-boost"
    ],
    "permissions": {
        "allow": [
            "mcp__laravel-boost__application-info",
            "mcp__laravel-boost__browser-logs",
            "mcp__laravel-boost__database-connections",
            "mcp__laravel-boost__database-schema",
            "mcp__laravel-boost__get-absolute-url",
            "mcp__laravel-boost__last-error",
            "mcp__laravel-boost__read-log-entries",
            "mcp__laravel-boost__search-docs",
            "Bash(docker compose exec -T app php artisan test:*)",
            "Bash(docker compose exec -T app php artisan route:list:*)",
            "Bash(docker compose exec -T app php artisan config:show:*)",
            "Bash(docker compose exec -T app php artisan list:*)",
            "Bash(docker compose exec -T app php artisan make:*)",
            "Bash(docker compose exec -T app php artisan migrate:status:*)",
            "Bash(docker compose exec -T app php artisan schedule:list:*)",
            "Bash(docker compose exec -T app php artisan about:*)",
            "Bash(docker compose exec -T app vendor/bin/pint:*)",
            "Bash(docker compose exec -T app composer analyse:*)",
            "Bash(docker compose exec -T app composer refactor:check:*)",
            "Bash(docker compose exec -T app composer test:*)",
            "Bash(docker compose ps:*)",
            "Bash(docker compose logs:*)"
        ],
        "deny": [
            "Bash(docker compose exec -T app php artisan migrate:fresh:*)",
            "Bash(docker compose exec -T app php artisan migrate:reset:*)",
            "Bash(docker compose exec -T app php artisan db:wipe:*)",
            "Bash(docker compose down -v:*)"
        ]
    },
    "hooks": {
        "PostToolUse": [
            {
                "matcher": "Edit|Write|MultiEdit",
                "hooks": [
                    {
                        "type": "command",
                        "command": "node \"$CLAUDE_PROJECT_DIR/.claude/hooks/pint-format.mjs\"",
                        "timeout": 40
                    }
                ]
            }
        ],
        "Stop": [
            {
                "hooks": [
                    {
                        "type": "command",
                        "command": "node \"$CLAUDE_PROJECT_DIR/.claude/hooks/verify-on-stop.mjs\"",
                        "timeout": 540
                    }
                ]
            }
        ]
    }
}
````

**`.claude/hooks/pint-format.mjs`**:

````js
// Hook PostToolUse do Claude Code: formata com o Pint, dentro do container, os arquivos PHP editados.
// Falha em silêncio quando o container está parado, para nunca bloquear a edição.
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { execArgs } from '../../.husky/scripts/docker.mjs';

let raw = '';
process.stdin.on('data', (chunk) => (raw += chunk));
process.stdin.on('end', () => {
    try {
        const input = JSON.parse(raw);
        const filePath = input?.tool_input?.file_path;
        const projectDir = process.env.CLAUDE_PROJECT_DIR || input?.cwd;

        if (!filePath || !projectDir || !filePath.endsWith('.php')) {
            return;
        }

        const relative = path.relative(projectDir, filePath).split(path.sep).join('/');

        if (relative.startsWith('..') || relative.startsWith('vendor/')) {
            return;
        }

        execFileSync('docker', execArgs('vendor/bin/pint', relative, '--quiet'), {
            cwd: projectDir,
            stdio: 'ignore',
            timeout: 30000,
        });
    } catch {
        // Container parado ou erro do Pint: ignora; o pre-commit roda o Pint de novo.
    }
});
````

**`.claude/hooks/verify-on-stop.mjs`**:

````js
// Hook Stop do Claude Code: antes de a sessão encerrar o turno, roda o Larastan e os testes
// relacionados aos arquivos PHP alterados no working tree. Em falha, bloqueia o encerramento e
// devolve o erro ao agente. A suíte completa e a cobertura continuam no pre-push.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execArgs, isServiceRunning } from '../../.husky/scripts/docker.mjs';

// Mesmos caminhos de `paths` no phpstan.neon (e do lint-staged.config.js).
const ANALYSED_PATHS = /^(app|config|database|routes|tests\/Support)\/|^bootstrap\/app\.php$|^tests\/TestCase\.php$/;
const MAX_OUTPUT_LINES = 80;

const inContainer = (projectDir, args, timeout) =>
    execFileSync('docker', execArgs(...args), {
        cwd: projectDir,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout,
    });

const tail = (text) => text.replace(/\x1b\[[0-9;]*m/g, '').trim().split(/\r?\n/).slice(-MAX_OUTPUT_LINES).join('\n');

const failureOutput = (error) => tail(`${error.stdout ?? ''}\n${error.stderr ?? ''}`) || String(error.message);

/** Arquivos PHP alterados, staged ou não, incluindo os não rastreados. */
const changedPhpFiles = (projectDir) => {
    const status = execFileSync('git', ['-c', 'core.quotepath=false', 'status', '--porcelain', '--untracked-files=all'], {
        cwd: projectDir,
        encoding: 'utf8',
    });

    return status
        .split(/\r?\n/)
        .filter((line) => line.length > 3 && !line.startsWith(' D') && !line.startsWith('D '))
        .map((line) => line.slice(3).split(' -> ').pop().replace(/^"|"$/g, ''))
        .filter((file) => file.endsWith('.php') && !file.startsWith('vendor/') && existsSync(path.join(projectDir, file)));
};

/** Testes alterados, testes espelho das classes de app/ (guideline de testes) e os de arquitetura. */
const relatedTests = (projectDir, files) => {
    const tests = new Set(files.filter((file) => /^tests\/(Feature|Unit|Arch)\/.+Test\.php$/.test(file)));

    for (const file of files.filter((file) => file.startsWith('app/'))) {
        const mirrored = file.replace(/^app\//, 'tests/Feature/').replace(/\.php$/, 'Test.php');

        if (existsSync(path.join(projectDir, mirrored))) {
            tests.add(mirrored);
        }
    }

    if (files.some((file) => file.startsWith('app/'))) {
        tests.add('tests/Arch');
    }

    return [...tests];
};

const stateHash = (projectDir, files) => {
    const hash = createHash('sha256');

    for (const file of [...files].sort()) {
        hash.update(file).update(readFileSync(path.join(projectDir, file)));
    }

    return hash.digest('hex');
};

const block = (reason) => {
    process.stdout.write(JSON.stringify({ decision: 'block', reason }));
};

let raw = '';
process.stdin.on('data', (chunk) => (raw += chunk));
process.stdin.on('end', () => {
    const input = JSON.parse(raw || '{}');
    const projectDir = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();

    // Já bloqueado uma vez neste encerramento: não insiste, para não prender a sessão em loop.
    if (input.stop_hook_active === true) {
        return;
    }

    let files;

    try {
        files = changedPhpFiles(projectDir);
    } catch {
        // Fora de um repositório git: nada a verificar.
        return;
    }

    if (files.length === 0) {
        return;
    }

    // Sem container não há como verificar; o pre-commit e o pre-push cobrem depois.
    if (!isServiceRunning(projectDir)) {
        return;
    }

    // Estado já aprovado numa verificação anterior: nada mudou desde então.
    const cacheFile = path.join(os.tmpdir(), `claude-verify-${createHash('sha256').update(projectDir).digest('hex').slice(0, 12)}`);
    const hash = stateHash(projectDir, files);

    if (existsSync(cacheFile) && readFileSync(cacheFile, 'utf8') === hash) {
        return;
    }

    const analysedFiles = files.filter((file) => ANALYSED_PATHS.test(file));

    if (analysedFiles.length > 0) {
        try {
            inContainer(projectDir, ['vendor/bin/phpstan', 'analyse', '--no-progress', '--memory-limit=1G', ...analysedFiles], 240000);
        } catch (error) {
            block(`O Larastan acusou erros nos arquivos alterados. Corrija na causa, seguindo a guideline de análise estática:\n\n${failureOutput(error)}`);

            return;
        }
    }

    const tests = relatedTests(projectDir, files);

    if (tests.length > 0) {
        try {
            inContainer(projectDir, ['php', 'artisan', 'test', '--compact', ...tests], 240000);
        } catch (error) {
            block(`Testes relacionados aos arquivos alterados falharam (${tests.join(', ')}):\n\n${failureOutput(error)}`);

            return;
        }
    }

    writeFileSync(cacheFile, hash);
});
````

Comportamento do `Stop`: não roda sem o container de pé, não repete um estado já aprovado (hash em arquivo temporário) e não bloqueia duas vezes seguidas o mesmo encerramento (`stop_hook_active`), para nunca prender a sessão em loop.

### 5.15 Laravel Boost

```sh
docker compose exec -T app php artisan boost:install --guidelines --skills --mcp --no-interaction
```

**`.mcp.json`**: o Boost gera `php artisan boost:mcp`, que rodaria no PHP do host e não alcançaria o banco. Aponte para o container:

```json
{
    "mcpServers": {
        "laravel-boost": {
            "command": "docker",
            "args": ["compose", "exec", "-T", "app", "php", "artisan", "boost:mcp"]
        }
    }
}
```

**`boost.json`**: só os agentes que você usa, `cloud: false` se não publicar no Laravel Cloud, só as skills relevantes:

```json
{
    "agents": ["claude_code"],
    "cloud": false,
    "guidelines": true,
    "mcp": true,
    "nightwatch": false,
    "sail": false,
    "skills": ["infer-conventions", "laravel-best-practices", "testing-best-practices"]
}
```

**Regenerar o `CLAUDE.md`** com os comandos já prefixados para o Docker (rode sempre que mudar uma guideline):

```sh
docker compose exec -T \
  -e BOOST_PHP_EXECUTABLE_PATH="docker compose exec -T app php" \
  -e BOOST_COMPOSER_EXECUTABLE_PATH="docker compose exec -T app composer" \
  -e BOOST_NPM_EXECUTABLE_PATH="docker compose exec -T app npm" \
  -e BOOST_VENDOR_BIN_EXECUTABLE_PATH="docker compose exec -T app vendor/bin/" \
  app php artisan boost:update --no-interaction
```

- Depois de mudar `agents`/`skills`, apague as pastas de skills e os arquivos de agentes que sobraram (ex.: `.cursor/`, `AGENTS.md`), porque o `boost:update` não remove o que deixou de ser usado.
- No Windows, se o Boost criar symlinks em `.claude/skills`, troque por cópias.

### 5.16 Guidelines do projeto — `.ai/guidelines/`

O Boost junta cada arquivo no `CLAUDE.md`. Copie e ajuste os trechos marcados.

**`.ai/guidelines/docker.md`**

```markdown
# Docker Compose Exec

- NUNCA utilize `sail` ou `vendor/bin/sail`. O ambiente roda no serviço `app` do `docker-compose.yml`. Mesmo que o host tenha PHP/Composer, nunca os use neste projeto.
- Todo comando de PHP, Composer, artisan ou tinker roda no container: `docker compose exec -T app <comando>`. Exemplos:
    - `docker compose exec -T app php artisan migrate`
    - `docker compose exec -T app composer require <pacote>`
    - `docker compose exec -T app vendor/bin/pint`
- Serviços que usam a mesma imagem (queue, scheduler, reverb) só leem o `.env` na criação: depois de mudá-lo, recrie com `docker compose up -d --force-recreate`.
- O `vendor` do container fica num volume próprio; o `vendor` do host serve só ao editor. Depois de mudar dependências, rode `npm run vendor:sync`.
- Se o container não estiver rodando, suba com `docker compose up -d` e aguarde o `composer install` do entrypoint (`docker compose logs -f app`).

## Armadilhas do ambiente

- Em comandos não interativos (scripts, hooks, agentes), use `docker compose exec -T`; sem o `-T` o comando falha por falta de TTY.
- No Git Bash (Windows), argumentos que começam com `/` viram caminhos do Windows. Prefixe com `MSYS_NO_PATHCONV=1` ao passar caminhos do container ao `docker`.
- O compose carrega o `.env` como variáveis reais do container. O `phpunit.xml` força os valores de teste com `force="true"` em `<env>` e `<server>`; não remova isso.
- Nunca rode comandos de escrita (`migrate`, `db:seed`, tinker com escrita) contra um banco remoto ou de produção sem pedir. Confira `config:show database.default` antes.
```

**`.ai/guidelines/testing.md`**

```markdown
# Testes

- Todos os testes são escritos em Pest (`it()`/`test()` + `expect()`), nunca em classes PHPUnit. Crie com `docker compose exec -T app php artisan make:test --pest {Nome}` (`--unit` para Unit).
- Testes de Feature herdam `Tests\TestCase` via `tests/Pest.php`; declare `uses(RefreshDatabase::class);` no arquivo que usar banco.
- Lógica de apoio reutilizável (fakes, cenários, builders) vai em `tests/Support`, não em funções soltas nos arquivos de teste.
- Nenhum teste chama serviço externo: o `Tests\TestCase` liga `Http::preventStrayRequests()`. Simule com `Http::fake()` ou fakes em `tests/Support`; clientes de SDK resolvidos pelo container são trocados com `$this->app->instance(...)`.
- O Eloquent roda em modo estrito fora de produção (`Model::shouldBeStrict()`): lazy loading, atributo inexistente e atribuição em massa descartada lançam exceção. Corrija na causa; não desligue a regra.
- Datas e horas fixas (`$this->travelTo(...)`), para respostas determinísticas.
- O teste fica no mesmo caminho relativo da classe testada (`app/X/Y.php` → `tests/Feature/X/YTest.php`).
- Toda regra de negócio nova chega com teste de Feature que verifica resposta, banco e efeitos. Autorização: um teste com o dono do recurso e outro com um terceiro, verificando que nada mudou.

## Arquitetura, cobertura e mutação

- Testes de arquitetura ficam em `tests/Arch` (`GlobalsTest` e `LayersTest`). Regra de estrutura nova entra ali; exceção legítima usa `->ignoring()` com comentário dizendo por quê.
- `composer test:coverage` roda a suíte com piso de cobertura (pre-push). Ao subir a cobertura de forma consistente, suba o `--min`; nunca baixe.
- `composer test:mutate` roda a mutação com piso. Cada arquivo de teste declara `mutates(Classe::class)` das classes de regra de negócio que exercita. Rode ao mexer nelas e antes de abrir PR.
- Mutação sobrevivente é lacuna de teste até prova em contrário. Equivalentes aceitos: TTL de cache, `?? 0` sobre coluna com default, limite `>=`/`>` com o mesmo resultado, valores aleatórios.
```

**`.ai/guidelines/static-analysis.md`**

````markdown
# Análise estática (Larastan nível 10)

- O projeto roda o Larastan no nível 10, o máximo do PHPStan (`phpstan.neon`), sem baseline. Rode com `docker compose exec -T app composer analyse`; o pre-commit analisa os arquivos staged e o pre-push o projeto inteiro.
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
- **Defaults do banco:** colunas com default no banco (`useCurrent()`, `default(0)`, `default(false)`) ficam `null` no model em memória logo após um `create()`/`firstOrCreate()` que não as preencheu. Declare-as como `@property Tipo|null` no model e defina o valor explicitamente nas factories.
- **Atributos que não são colunas** (colunas de JOIN, valores só de resposta): use `getAttribute()`/`setAttribute()` em vez de propriedade dinâmica.
- **Coleções:** quando os itens já são arrays, prefira `->all()` a `->toArray()` (mesmo resultado, tipo preciso). Em código que monta arrays de dados externos, funções nativas (`array_column`, `array_map`) dão tipos melhores que `collect()`. Preserve a ordem das chaves das respostas JSON.
- **Agregações do banco:** `count()`/`max()` via `pluck()`/`selectRaw()` podem vir como string do driver. Use `is_numeric($v) ? (int) $v : 0` nos cálculos e não altere o valor que vai para a resposta.
- **Relações e Resources:** relações dos models declaram genéricos completos (`@return BelongsTo<User, $this>`), e todo Resource declara `@mixin` do model que embrulha.
- **Dados externos tipados:** o formato da resposta de cada serviço externo é declarado uma vez no gateway em `App\Services` com `@phpstan-type`, e importado com `@phpstan-import-type` por quem consome.
````

**`.ai/guidelines/code-style.md`**

````markdown
# Estilo e refatoração automatizada (Pint e Rector)

## Pint

- O estilo é o preset `laravel` com regras extras em `pint.json`: `strict_param` e `strict_comparison` (`in_array(..., true)`, `===`), `void_return`, `global_namespace_import`, `use_arrow_functions` e `is_null`. O pre-commit formata os arquivos staged; `docker compose exec -T app composer lint:check` confere o projeto inteiro.
- Comparações estritas com valores do banco dependem do tipo que o driver devolve. Colunas inteiras sem cast chegam como `int` no pdo_pgsql; uma coluna que chegue como string precisa de cast no model antes de entrar num `in_array(..., true)`.
- O `global_namespace_import` importa o que estiver com `\` na frente, inclusive aliases de facade (`\Log::` vira `use Log;`). Use sempre a facade completa (`Illuminate\Support\Facades\Log`).

## Rector

- Configurado em `rector.php` com `driftingly/rector-laravel`: sets de PHP (versão do `require.php` do `composer.json`), `deadCode`, `codeQuality`, `typeDeclarations`, as regras de upgrade do Laravel até a versão instalada e alguns sets de qualidade do Laravel.
- `composer refactor` aplica o Rector e o Pint; `composer refactor:check` só mostra o diff (sai com erro se houver mudança). Rode o check antes de abrir PR e depois de atualizar o Laravel ou o PHP.
- Revise o diff do Rector antes de commitar: ele pode juntar chamadas encadeadas numa linha, achatar arrays e gerar tipos imprecisos em accessors convertidos para `Attribute` (declare `@return Attribute<TGet, TSet>` com o tipo real). Aplicar duas vezes pode destravar regras novas; rode o check até sair limpo.
- Models e comandos usam os atributos de classe do Laravel 13 (`#[Fillable]`, `#[Hidden]`, `#[Table]`, `#[Signature]`, `#[Description]`), não as propriedades (`$fillable`, `$primaryKey`, `$keyType`, `$signature`...). O Rector converte `$fillable`, `$hidden`, `$signature` e `$description`; `$table`, `$primaryKey`, `$keyType`, `$incrementing` e `$timestamps` vão à mão para `#[Table(...)]`. Um atributo sem o `use` vira uma classe inexistente no namespace do model e é ignorado sem erro; o Larastan acusa, os testes não.
- `declare(strict_types=1)` entra pelo `SafeDeclareStrictTypesRector`, só nos arquivos em que o Rector prova que nenhuma chamada depende de conversão de tipo. Não o adicione à mão nos demais: dados externos e do banco são tipados por PHPDoc, e um valor real diferente do declarado viraria `TypeError` em vez de conversão.
- Regras desligadas em `withSkip()`, por serem só troca de forma: `app()` para `resolve()` (o projeto usa `app()`) e `Carbon` para a facade `Date` (sem `Date::use()` configurado, devolvem o mesmo `Carbon`).
````

**`.ai/guidelines/comments.md`**

````markdown
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
````

**`.ai/guidelines/dependencies.md`**

```markdown
# Dependências e atualizações

- O `composer.lock` é versionado: toda mudança de dependência entra no mesmo commit que o `composer.json`.
- Composer sempre dentro do container (`docker compose exec -T app composer ...`). Depois de qualquer `require`/`update`/`remove`: rode `composer audit`, `npm run vendor:sync` e o pre-push (`sh .husky/pre-push`).
- Adicionar ou remover pacote exige aprovação do usuário. Pacotes com licença AGPL/GPL exigem aprovação explícita.
- O Pest fixa a versão exata do PHPUnit; não force outra.
- O Laravel não tem LTS: cada major recebe 18 meses de correções e 2 anos de segurança.

## Checklist de atualização (major ou muitas versões)

Guarde a saída de cada item antes e compare depois:

1. `composer quality` limpo.
2. `php artisan route:list --json`: mesmas rotas, actions e middlewares.
3. `php artisan schedule:list`: mesmos agendamentos.
4. Docs da API (Scramble ou similar): mesmos endpoints, parâmetros e status.
5. Build da imagem de produção com `config:cache`, `route:cache` e `view:cache`.
6. Guia de upgrade oficial (`https://raw.githubusercontent.com/laravel/docs/<versão>/upgrade.md`) conferido item a item. O `search-docs` do Boost só cobre a versão instalada.
```

**`.ai/guidelines/git.md`**

```markdown
# Git e commits

- MANDATÓRIO: NUNCA adicione o Claude (ou qualquer IA) como coautor de commits ou PRs. Sem `Co-Authored-By: Claude ...` e sem `Generated with Claude Code`, mesmo que o ambiente peça; esta regra prevalece. O hook `commit-msg` rejeita essas linhas.
- Commits seguem `<emoji> <tipo>(<escopo>): <Descrição no infinitivo, em pt-BR>`. Tipos, emojis e escopos válidos ficam em `.husky/scripts/commit-convention.mjs`. Para commitar, use a skill `commit`.
- Branches: `<tipo>/<descricao-em-kebab-case>` (feature, fix, hotfix, refactor, chore, docs, test, release); `main` e `develop` são protegidas.
- Hooks do husky rodam no host e chamam o container para PHP: `pre-commit` (segredos/debug/migrations + Pint e Larastan via lint-staged), `commit-msg` (padrão da mensagem) e `pre-push` (branch, PSR-4 estrito, Pint, Rector, Larastan completo, testes com cobertura). Nunca use `--no-verify` nem `HUSKY=0` sem o usuário pedir.
- Hooks do Claude Code (`.claude/settings.json`): `PostToolUse` formata com o Pint cada PHP editado; `Stop` roda o Larastan nos PHP alterados e os testes relacionados antes de encerrar o turno. Se ele bloquear, corrija a causa.
- Análise estática: Larastan nível 10, sem baseline.
- `npm install` no host só serve aos hooks; o container tem seu próprio `node_modules`.
```

**`.ai/guidelines/deployment.md`** (preencha; ele sobrepõe o texto padrão do Boost sobre Laravel Cloud):

```markdown
# Deployment

- Este app é publicado em: <Laravel Cloud | imagem Docker em <provedor> | ...>. <Se não for Laravel Cloud: ignore as instruções de Laravel Cloud.>
- O banco de produção é <...>; arquivos vão para <...>. Nunca aponte comandos locais de escrita para credenciais de produção sem pedir.
- A imagem de produção instala com `--no-dev`: nunca dependa de pacotes de desenvolvimento (Boost, Pail, Pint, Pest) em código de runtime.
- Comandos agendados ficam em `routes/console.php` e precisam de `schedule:run` (ou `schedule:work`) no ambiente.
```

Se o projeto usa outro idioma além do pt-BR para o usuário, acrescente um `i18n.md` (locale padrão, onde ficam as traduções, nomes legíveis de campos em `lang/<locale>/validation.php`).

### 5.17 Skill de commit — `.claude/skills/commit/SKILL.md`

Em projeto com Boost, coloque a skill em `.ai/skills/commit/SKILL.md` e acrescente `"commit"` em `skills` do `boost.json`: o `boost:update` a copia para `.claude/skills`.

````markdown
---
name: commit
description: "Cria commits no padrão do projeto (emoji + tipo + escopo + descrição em pt-BR no infinitivo), separando as mudanças em commits por escopo e passando pelos hooks do husky (Pint, Larastan, verificações de debug/segredos, validação da mensagem). Use quando o usuário pedir para commitar, fazer commit, \"commita isso\", separar mudanças em commits ou escrever a mensagem de commit. Não faz push a menos que o usuário peça."
---

# Commit no padrão do projeto

Seu trabalho é transformar as mudanças do working tree em commits pequenos, coesos e no padrão do projeto, e deixar os hooks do husky passarem sem `--no-verify`.

## Padrão da mensagem

```
<emoji> <tipo>(<escopo>): <Descrição no infinitivo, em pt-BR>

<corpo opcional: o porquê da mudança, em pt-BR>
```

- Fonte da verdade dos tipos, emojis e escopos: `.husky/scripts/commit-convention.mjs`. Leia esse arquivo antes de escrever a mensagem; não invente tipo nem escopo.
- Exemplos válidos:
  - `✨ feat(pedidos): Adicionar cancelamento de pedidos pelo cliente.`
  - `🐛 fix(pedidos,pagamentos): Corrigir estorno duplicado ao cancelar pedido pago.`
  - `🔨 refactor(api)!: Renomear campos de valor na resposta de pedidos.` (`!` = quebra de contrato da API)
- Descrição começa com verbo no infinitivo e maiúscula (Adicionar, Corrigir, Refatorar, Remover, Ajustar, Implementar). Cabeçalho com no máximo 100 caracteres. Detalhes vão no corpo, separado por linha em branco.
- Escolha o escopo pelo domínio afetado, não pela camada: uma mudança em controller + service + resource de pedidos é `pedidos`. Use `db` só quando a mudança principal é de schema/migration.

## Passo a passo

1. **Levante o estado:** rode em paralelo `git status`, `git diff`, `git diff --cached` e `git log --oneline -10`.
2. **Respeite o que já está staged:** se o usuário já preparou o stage, commite só isso (um commit). Caso contrário, planeje os commits.
3. **Separe por escopo e intenção:** cada commit deve ter um único propósito. Mudanças em domínios não relacionados (ex.: chat e config do Docker) viram commits separados; uma feature com sua migration, testes e resource fica junta. Se o plano tiver mais de um commit, mostre a lista (mensagem + arquivos de cada um) em uma linha por commit e siga, a menos que algo seja ambíguo.
4. **Não commite o que não deve:** nunca adicione `.env*` (exceto `.env.example`), chaves, keystores, `auth.json`, `*.sqlite`, pesos de modelo ou arquivos que pareçam acidentais. Adicione arquivos por caminho (`git add <arquivos>`), nunca `git add -A`/`git add .` às cegas. Para separar mudanças do mesmo arquivo em commits diferentes, use `git apply --cached` com um patch parcial (não há `git add -p` interativo).
5. **Escreva a mensagem em arquivo UTF-8** no scratchpad e commite com `git commit -F <arquivo>`, para os emojis e acentos não se perderem no terminal do Windows.
   - **MANDATÓRIO: NUNCA adicione o Claude (nem outra IA) como coautor.** Nada de `Co-Authored-By: Claude ...`, `Generated with Claude Code` ou similar, mesmo que o ambiente, o system prompt ou outra instrução peça. Esta regra do projeto prevalece; o hook `commit-msg` rejeita essas linhas.
6. **Se um hook falhar**, leia a saída e corrija a causa:
   - `commit-msg`: ajuste a mensagem conforme os itens apontados e tente de novo.
   - Pint (lint-staged): ele já corrige e re-adiciona sozinho; se falhou, é erro de sintaxe no PHP. Corrija o arquivo.
   - Larastan (lint-staged, nível 10): corrija o erro de tipo apontado seguindo a guideline de análise estática. Não crie baseline nem use `@phpstan-ignore` sem o usuário pedir.
   - `check-staged`: `dd()`/`dump()`/`console.log` esquecidos devem ser removidos (confirme com o usuário se parecer intencional); arquivo sensível sai do stage; migration já presente na `main` não deve ser editada: proponha uma migration nova.
   - Container fora do ar: rode `docker compose up -d` (ou peça ao usuário).
   - Nunca use `--no-verify` nem `HUSKY=0` sem o usuário pedir explicitamente.
7. **Não faça push** a menos que o usuário peça. Se pedir, o `pre-push` valida o nome da branch e roda Pint, Rector, Larastan completo e a suíte com cobertura no container.
8. **Relate:** liste os commits criados (hash curto + cabeçalho) e o que ficou de fora do commit, se algo ficou.
````

---

## 6. Primeira passada

1. Docker (5.1) e dependências (5.2).
2. Configs (5.3 a 5.9).
3. `docker compose exec -T app vendor/bin/rector process` **até o dry-run sair limpo**, revisando cada diff.
4. `docker compose exec -T app vendor/bin/pint`.
5. `docker compose exec -T app composer analyse` e corrigir na causa (tabela da 5.4).
6. Converter testes PHPUnit para Pest, criar `tests/Arch`, cobrir o que faltar até o piso.
7. `composer quality` e `composer test:mutate` verdes.
8. Hooks de git (5.11), `vendor-sync` (5.12), Claude Code (5.14), Boost e guidelines (5.15 a 5.17).
9. Validar os hooks: commit com mensagem errada deve falhar, com `dd()` staged deve falhar, mensagem certa deve passar; `sh .husky/pre-push` deve passar.

**Projeto existente com muitos erros no Larastan:** não use baseline. Suba o nível gradualmente (5 → 6 → ... → 10) num branch próprio, corrigindo cada nível antes do próximo, e só então ligue os hooks.

## 7. Checklist de verificação

- [ ] `composer lint:check` → PASS
- [ ] `composer refactor:check` → sem mudanças
- [ ] `composer analyse` → No errors, sem `phpstan-baseline.neon`
- [ ] `composer test:coverage` → acima do piso
- [ ] `composer test:mutate` → acima do piso
- [ ] Os testes não usam o banco de desenvolvimento
- [ ] Commit com mensagem fora do padrão é rejeitado
- [ ] Commit com `dd()` ou `.env` staged é rejeitado
- [ ] `sh .husky/pre-push` passa do zero com o container de pé
- [ ] O MCP do Boost responde (`database-schema`)
- [ ] O `CLAUDE.md` gerado contém as guidelines do projeto, com comandos prefixados para o Docker
- [ ] `.claude/settings.json` com `includeCoAuthoredBy: false` e `attribution` vazio

## 8. Manutenção

- **Pisos:** suba os de cobertura e mutação quando o valor real ficar acima por algumas semanas.
- **Escopo novo de commit:** edite `commit-convention.mjs`.
- **Regra de estrutura nova:** entra em `tests/Arch`.
- **Guideline nova ou alterada:** edite `.ai/guidelines/*.md` e regenere com o `boost:update` prefixado.
- **Upgrade de Laravel/PHP:** checklist de `dependencies.md` + `composer refactor` (o `withComposerBased(laravel: true)` aplica as regras de upgrade da versão instalada).

## 9. Variações

| Situação | Ajuste |
|---|---|
| Serviço com outro nome (`api`, `php`, `laravel`) | `SERVICE` em `docker.mjs`, prefixos do `pre-push`, `.mcp.json`, `settings.json` e guidelines |
| Container que exige usuário root para escrever | acrescente `'-u', 'root'` em `execArgs` e `-u root` nos prefixos em texto |
| Monorepo (Laravel numa subpasta) | husky e lint-staged na raiz do git; o lint-staged remove o prefixo da pasta antes de mandar ao container; os hooks do Claude filtram por `<pasta>/` e removem o prefixo; o `Stop` lê o `git status` só da pasta. Exemplo completo em `qualidade-nutria.md` |
| Frontend no mesmo repositório | lint do front no lint-staged (com `cwd` no subprojeto, para achar a config) e typecheck no `pre-push` |
| Sem Laravel Boost | ignore 5.15 e escreva as guidelines direto no `CLAUDE.md` |
| Sem Claude Code | ignore 5.14, 5.15 e 5.17; o resto vale para qualquer equipe |
