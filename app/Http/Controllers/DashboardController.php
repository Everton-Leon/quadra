<?php

namespace App\Http\Controllers;

use App\Models\TeamInvitation;
use App\Models\User;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Contracts\Database\Query\Builder;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    public function __invoke(#[CurrentUser] User $user): Response
    {
        $email = strtolower($user->email);

        $pendingInvitations = TeamInvitation::query()
            ->with(['inviter', 'team'])
            ->whereRaw('LOWER(email) = ?', [$email])
            ->whereNull('accepted_at')
            ->where(fn (Builder $query) => $query
                ->whereNull('expires_at')
                ->orWhere('expires_at', '>=', now()))
            ->latest()
            ->get()
            ->map(fn (TeamInvitation $invitation): array => [
                'code' => $invitation->code,
                'inviterName' => $invitation->inviter->name,
                'team' => [
                    'name' => $invitation->team->name,
                    'slug' => $invitation->team->slug,
                ],
            ]);

        return Inertia::render('Dashboard', [
            'pendingInvitations' => $pendingInvitations,
        ]);
    }
}
