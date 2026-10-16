<?php

namespace App\Actions\Fortify;

use App\Actions\Teams\CreateTeamAction;
use App\Concerns\PasswordValidationRules;
use App\Concerns\ProfileValidationRules;
use App\Models\User;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Laravel\Fortify\Contracts\CreatesNewUsers;

class CreateNewUser implements CreatesNewUsers
{
    use PasswordValidationRules, ProfileValidationRules;

    public function __construct(private CreateTeamAction $createTeam)
    {
        //
    }

    /**
     * Validate and create a newly registered user.
     *
     * @param  array<mixed>  $input
     */
    public function create(array $input): User
    {
        Validator::make($input, [
            ...$this->profileRules(),
            'password' => $this->passwordRules(),
        ])->validate();

        return DB::transaction(function () use ($input): User {
            $user = User::create([
                'name' => Arr::string($input, 'name'),
                'email' => Arr::string($input, 'email'),
                'password' => Arr::string($input, 'password'),
            ]);

            $this->createTeam->handle($user, $user->name."'s Team", isPersonal: true);

            return $user;
        });
    }
}
