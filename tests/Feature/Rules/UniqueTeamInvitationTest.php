<?php

use App\Enums\TeamRole;
use App\Models\Team;
use App\Models\TeamInvitation;
use App\Models\User;
use App\Rules\UniqueTeamInvitation;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Validator;

uses(RefreshDatabase::class);

mutates(UniqueTeamInvitation::class);

test('members are found ignoring the email case', function (): void {
    $team = Team::factory()->create();
    $member = User::factory()->create(['email' => 'membro@example.com']);
    $team->members()->attach($member, ['role' => TeamRole::Member->value]);

    $validator = Validator::make(['email' => 'Membro@Example.com'], ['email' => [new UniqueTeamInvitation($team)]]);

    expect($validator->errors()->get('email'))->toBe(['This user is already a member of the team.']);
});

test('pending invitations are found ignoring the email case', function (): void {
    $team = Team::factory()->create();
    TeamInvitation::factory()->create(['team_id' => $team->id, 'email' => 'convidado@example.com']);

    $validator = Validator::make(['email' => 'Convidado@Example.com'], ['email' => [new UniqueTeamInvitation($team)]]);

    expect($validator->errors()->get('email'))->toBe(['An invitation has already been sent to this email address.']);
});

test('accepted and expired invitations do not block a new invitation', function (): void {
    $team = Team::factory()->create();
    TeamInvitation::factory()->accepted()->create(['team_id' => $team->id, 'email' => 'aceito@example.com']);
    TeamInvitation::factory()->expired()->create(['team_id' => $team->id, 'email' => 'expirado@example.com']);

    $validator = Validator::make(
        ['accepted' => 'aceito@example.com', 'expired' => 'expirado@example.com'],
        ['accepted' => [new UniqueTeamInvitation($team)], 'expired' => [new UniqueTeamInvitation($team)]],
    );

    expect($validator->passes())->toBeTrue();
});

test('invitations to other teams do not block a new invitation', function (): void {
    $team = Team::factory()->create();
    TeamInvitation::factory()->create(['email' => 'convidado@example.com']);

    $validator = Validator::make(['email' => 'convidado@example.com'], ['email' => [new UniqueTeamInvitation($team)]]);

    expect($validator->passes())->toBeTrue();
});

test('non string emails are left to the email rule', function (): void {
    $team = Team::factory()->create();

    $validator = Validator::make(['email' => ['convidado@example.com']], ['email' => [new UniqueTeamInvitation($team)]]);

    expect($validator->passes())->toBeTrue();
});
