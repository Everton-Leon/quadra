<?php

use App\Actions\Fortify\CreateNewUser;
use App\Enums\TeamRole;
use App\Models\Team;
use App\Models\TeamInvitation;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;

uses(RefreshDatabase::class);

mutates(CreateNewUser::class);

test('registration screen can be rendered', function (): void {
    $response = $this->get(route('register'));

    $response->assertOk();
});

test('registration screen includes team invitation context', function (): void {
    $owner = User::factory()->create();
    $team = Team::factory()->create(['name' => 'Laravel Team']);
    $team->members()->attach($owner, ['role' => TeamRole::Owner->value]);

    $invitation = TeamInvitation::factory()->create([
        'team_id' => $team->id,
        'email' => 'invited@example.com',
        'invited_by' => $owner->id,
    ]);

    $response = $this->get(route('register', ['invitation' => $invitation->code]));

    $response->assertOk();
    $response->assertInertia(fn (Assert $page): Assert => $page
        ->component('auth/Register')
        ->where('teamInvitation.code', $invitation->code)
        ->where('teamInvitation.teamName', 'Laravel Team'),
    );
});

test('new users can register', function (): void {
    $response = $this->post(route('register.store'), [
        'name' => 'Test User',
        'email' => 'test@example.com',
        'password' => 'password',
        'password_confirmation' => 'password',
    ]);

    $this->assertAuthenticated();

    $user = User::where('email', 'test@example.com')->first();
    $response->assertRedirect(route('dashboard'));
});

test('registration creates a personal team owned by the new user', function (): void {
    $this->post(route('register.store'), [
        'name' => 'Ana Souza',
        'email' => 'ana@example.com',
        'password' => 'password',
        'password_confirmation' => 'password',
    ]);

    $user = User::where('email', 'ana@example.com')->firstOrFail();
    $team = $user->currentTeam;

    expect($team->name)->toBe("Ana Souza's Team")
        ->and($team->is_personal)->toBeTrue()
        ->and($user->teamRole($team))->toBe(TeamRole::Owner);
});

test('registration is rejected with invalid data', function (array $overrides, string $field): void {
    User::factory()->create(['email' => 'existente@example.com']);

    $response = $this->post(route('register.store'), [
        'name' => 'Ana Souza',
        'email' => 'ana@example.com',
        'password' => 'password',
        'password_confirmation' => 'password',
        ...$overrides,
    ]);

    $response->assertSessionHasErrors($field);
    $this->assertGuest();
})->with([
    'nome vazio' => [['name' => ''], 'name'],
    'e-mail já cadastrado' => [['email' => 'existente@example.com'], 'email'],
    'confirmação diferente' => [['password_confirmation' => 'outra-senha'], 'password'],
]);
