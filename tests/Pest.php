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
