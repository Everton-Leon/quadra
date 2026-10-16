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
        // O AppServiceProvider configura Date::use(CarbonImmutable::class): trocar Carbon pela facade
        // Date mudaria a classe devolvida (mutável para imutável) e o comportamento de quem a modifica.
        CarbonToDateFacadeRector::class,
    ]);
