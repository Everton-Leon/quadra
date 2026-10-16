<?php

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

test('the settings page redirects to the profile settings', function (): void {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->get('/settings')
        ->assertRedirect(route('profile.edit'));
});

test('guests are redirected to the login page from the settings page', function (): void {
    $this->get('/settings')->assertRedirect(route('login'));
});
