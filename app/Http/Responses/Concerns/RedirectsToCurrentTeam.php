<?php

namespace App\Http\Responses\Concerns;

use App\Models\Team;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\URL;

trait RedirectsToCurrentTeam
{
    protected function redirectPathForCurrentTeam(Request $request, string $redirect): string
    {
        $team = $this->currentTeam($request);

        URL::defaults(['current_team' => $team->slug]);

        return "/{$team->slug}{$redirect}";
    }

    protected function currentTeam(Request $request): Team
    {
        $user = $request->user();

        abort_if(! $user instanceof User, 403);

        $team = $user->currentTeam ?? $user->personalTeam();

        abort_if(! $team instanceof Team, 403);

        return $team;
    }
}
