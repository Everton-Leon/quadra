<?php

use App\Http\Controllers\DashboardController;
use App\Http\Controllers\Teams\TeamInvitationController;
use App\Http\Middleware\EnsureTeamMembership;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;
use Inertia\Response;

// Route::inertia() é uma macro sem tipo de retorno (o Larastan a vê como mixed); a closure
// tipada faz o mesmo e mantém o ->name() analisável.
Route::get('/', fn (): Response => Inertia::render('Welcome'))->name('home');

Route::prefix('{current_team}')
    ->middleware(['auth', 'verified', EnsureTeamMembership::class])
    ->group(function (): void {
        Route::get('dashboard', DashboardController::class)->name('dashboard');
    });

Route::middleware(['auth'])->group(function (): void {
    Route::post('invitations/{invitation}/accept', [TeamInvitationController::class, 'accept'])->name('invitations.accept');
    Route::delete('invitations/{invitation}', [TeamInvitationController::class, 'decline'])->name('invitations.decline');
});

require __DIR__.'/settings.php';
