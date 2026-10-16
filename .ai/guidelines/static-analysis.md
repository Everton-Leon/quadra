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
