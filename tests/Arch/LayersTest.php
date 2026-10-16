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
    ->toHaveSuffix('Action')
    // As actions do Fortify implementam os contratos do pacote (CreatesNewUsers, ResetsUserPasswords)
    // e mantêm os nomes da documentação do Fortify, referenciados no FortifyServiceProvider.
    ->ignoring('App\Actions\Fortify');

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
