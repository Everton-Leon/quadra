<?php

use App\Rules\TeamName;
use Illuminate\Support\Facades\Validator;

mutates(TeamName::class);

/**
 * Nomes reservados fixos. A lista é repetida aqui de propósito: cada nome removido da regra
 * precisa quebrar um caso deste teste.
 */
const RESERVED_TEAM_NAMES = [
    '300', '302', '400', '401', '402', '403', '404', '405', '406', '407', '408', '409', '410',
    '411', '412', '413', '414', '415', '416', '417', '418', '419', '420', '421', '422', '423',
    '424', '425', '426', '427', '428', '429', '430', '431', '500', '501', '502', '503', '504',
    '505', '506', '507', '508', '509', '510', '511', '693', '694', '695', '900', 'about', 'account',
    'accounts', 'accountspayable', 'accounts-payable', 'accountsreceivable', 'accounts-receivable',
    'admin', 'advisories', 'anonymous', 'any', 'api', 'app', 'apps', 'attributes', 'auth',
    'billing', 'bills', 'blob', 'blog', 'bounty', 'branches', 'business', 'businesses', 'cache',
    'careers', 'case-studies', 'categories', 'central', 'certification', 'changelog', 'chat', 'cla',
    'claim', 'claims', 'cloud', 'codereview', 'code-review', 'code-reviews', 'collection',
    'collections', 'comments', 'commit', 'commits', 'companies', 'compare', 'contact',
    'contributing', 'cookbook', 'copilot', 'coupons', 'customer', 'customer-stories', 'customers',
    'dashboard', 'dashboard-feed', 'dashboards', 'delete', 'deploy', 'design', 'develop',
    'developer', 'diff', 'discover', 'discussions', 'downloads', 'downtime', 'editor', 'editors',
    'edu', 'education', 'enterprise', 'events', 'explore', 'featured', 'features', 'files',
    'fixtures', 'forked', 'fraud', 'garage', 'gist', 'gists', 'graphs', 'groups', 'guide', 'guides',
    'help', 'help-wanted', 'home', 'hooks', 'hosting', 'hovercards', 'identity', 'images', 'inbox',
    'index', 'individual', 'info', 'integration', 'interfaces', 'introduction',
    'invalid-email-address', 'investors', 'invoice', 'invoices', 'issues', 'jobs', 'join',
    'journal', 'journals', 'lab', 'labs', 'languages', 'launch', 'layouts', 'learn', 'legal',
    'library', 'linux', 'listings', 'lists', 'livewire', 'login', 'logos', 'logout', 'mac',
    'maintenance', 'malware', 'man', 'mariadb', 'marketing', 'marketplace', 'mention', 'mentioned',
    'mentioning', 'mentions', 'migrating', 'milestones', 'mine', 'mirrors', 'mobile', 'mysql',
    'n8n', 'navigation', 'network', 'network-rules', 'new', 'news', 'none', 'nonprofit',
    'nonprofits', 'notices', 'notifications', 'oauth', 'offer', 'open-source', 'org',
    'organisations', 'organizations', 'orgs', 'pages', 'partners', 'pay', 'payable', 'payments',
    'percona', 'personal', 'plans', 'plugins', 'popular', 'popularity', 'posts', 'postgres',
    'postgresql', 'press', 'preview', 'pricing', 'professional', 'projects', 'pulls', 'raw',
    'readme', 'recommendations', 'receivable', 'redeem', 'register', 'releases', 'render', 'reply',
    'repositories', 'resources', 'restore', 'revert', 'review', 'reviews', 'save-net-neutrality',
    'saved', 'scraping', 'search', 'security', 'services', 'sessions', 'settings', 'shareholders',
    'shop', 'showcases', 'signin', 'sign-in', 'signup', 'sign-up', 'site', 'socials', 'spam',
    'sponsors', 'ssh', 'staff', 'starred', 'stars', 'start', 'static', 'status', 'statuses',
    'storage', 'store', 'stories', 'stripe', 'styleguide', 'subscriptions', 'suggest', 'suggestion',
    'suggestions', 'support', 'suspended', 'suspension', 'talks', 'teach', 'teacher', 'teachers',
    'teaching', 'team', 'teams', 'ten', 'terms', 'timeline', 'topic', 'topics', 'tos', 'tour',
    'train', 'training', 'translations', 'tree', 'trending', 'undefined', 'update', 'updates',
    'upstash', 'username', 'users', 'visualization', 'watching', 'wiki', 'wikis', 'windows',
    'works-with', 'www', 'www0', 'www1', 'www2', 'www3', 'www4', 'www5', 'www6', 'www7', 'www8',
    'www9', 'zones',
];

test('team names are rejected when reserved', function (): void {
    $acceptedNames = array_values(array_filter(
        RESERVED_TEAM_NAMES,
        fn (string $name): bool => Validator::make(['name' => $name], ['name' => [new TeamName]])->passes(),
    ));

    expect($acceptedNames)->toBe([]);
});

test('team names are rejected when they match a route prefix', function (string $name): void {
    $validator = Validator::make(['name' => $name], ['name' => [new TeamName]]);

    expect($validator->fails())->toBeTrue();
})->with(['settings', 'login', 'invitations']);

test('team names are compared ignoring case and surrounding spaces', function (): void {
    $validator = Validator::make(['name' => '  Settings  '], ['name' => [new TeamName]]);

    expect($validator->fails())->toBeTrue();
});

test('team names that only look like route parameters are accepted', function (): void {
    $validator = Validator::make(['name' => '{current_team}'], ['name' => [new TeamName]]);

    expect($validator->passes())->toBeTrue();
});

test('empty team names are left to the required rule', function (): void {
    $failed = false;

    (new TeamName)->validate('name', '', function () use (&$failed): void {
        $failed = true;
    });

    expect($failed)->toBeFalse();
});

test('ordinary team names are accepted', function (): void {
    $validator = Validator::make(['name' => 'Vôlei de Quinta'], ['name' => [new TeamName]]);

    expect($validator->passes())->toBeTrue();
});

test('non string team names are left to the string rule', function (): void {
    $validator = Validator::make(['name' => ['settings']], ['name' => [new TeamName]]);

    expect($validator->passes())->toBeTrue();
});
