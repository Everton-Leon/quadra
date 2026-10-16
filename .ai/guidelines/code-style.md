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
