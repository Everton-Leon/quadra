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
// timeout e normalização. Nos testes, o Http é usado para os fakes.
arch('Http só nos gateways de serviços externos')
    ->expect(Http::class)
    ->toOnlyBeUsedIn([
        'App\Services',
        'Tests',
    ]);
