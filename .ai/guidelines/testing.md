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
