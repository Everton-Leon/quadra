<?php

use App\Models\TeamInvitation;
use App\Models\User;
use App\Rules\ValidTeamInvitation;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Validator;

uses(RefreshDatabase::class);

mutates(ValidTeamInvitation::class);

test('invitations are accepted when the email matches ignoring case', function (string $invitationEmail, string $userEmail): void {
    $user = User::factory()->create(['email' => $userEmail]);
    $invitation = TeamInvitation::factory()->create(['email' => $invitationEmail]);

    $validator = Validator::make(['invitation' => $invitation], ['invitation' => [new ValidTeamInvitation($user)]]);

    expect($validator->passes())->toBeTrue();
})->with([
    'convite em maiúsculas' => ['Convidado@Example.com', 'convidado@example.com'],
    'usuário em maiúsculas' => ['convidado@example.com', 'Convidado@Example.com'],
]);

test('invitations sent to another email are rejected', function (): void {
    $user = User::factory()->create(['email' => 'outro@example.com']);
    $invitation = TeamInvitation::factory()->create(['email' => 'convidado@example.com']);

    $validator = Validator::make(['invitation' => $invitation], ['invitation' => [new ValidTeamInvitation($user)]]);

    expect($validator->errors()->first('invitation'))->toBe('This invitation was sent to a different email address.');
});

test('invitations are rejected without an authenticated user', function (): void {
    $invitation = TeamInvitation::factory()->create();

    $validator = Validator::make(['invitation' => $invitation], ['invitation' => [new ValidTeamInvitation(null)]]);

    expect($validator->errors()->first('invitation'))->toBe('This invitation was sent to a different email address.');
});

test('values that are not invitations are rejected', function (): void {
    $user = User::factory()->create();

    $validator = Validator::make(['invitation' => 'codigo-inexistente'], ['invitation' => [new ValidTeamInvitation($user)]]);

    expect($validator->errors()->first('invitation'))->toBe('This invitation was sent to a different email address.');
});

test('accepted invitations are rejected only for being accepted', function (): void {
    $user = User::factory()->create(['email' => 'convidado@example.com']);
    $invitation = TeamInvitation::factory()->accepted()->expired()->create(['email' => 'convidado@example.com']);

    $validator = Validator::make(['invitation' => $invitation], ['invitation' => [new ValidTeamInvitation($user)]]);

    expect($validator->errors()->get('invitation'))->toBe(['This invitation has already been accepted.']);
});

test('expired invitations are rejected', function (): void {
    $user = User::factory()->create(['email' => 'convidado@example.com']);
    $invitation = TeamInvitation::factory()->expired()->create(['email' => 'convidado@example.com']);

    $validator = Validator::make(['invitation' => $invitation], ['invitation' => [new ValidTeamInvitation($user)]]);

    expect($validator->errors()->get('invitation'))->toBe(['This invitation has expired.']);
});
