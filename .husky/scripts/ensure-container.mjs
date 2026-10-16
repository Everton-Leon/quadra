// Garante que o container PHP está rodando antes de chamar Pint/Composer/Pest nos hooks.
// Com --if-staged, só exige o container quando há arquivos PHP ou composer.json staged.
import { execFileSync } from 'node:child_process';
import { SERVICE, isServiceRunning } from './docker.mjs';

if (process.argv.includes('--if-staged')) {
    const staged = execFileSync(
        'git',
        ['diff', '--cached', '--name-only', '--diff-filter=ACMR'],
        { encoding: 'utf8' },
    );

    if (!/(\.php|(^|\/)composer\.json)$/m.test(staged)) {
        process.exit(0);
    }
}

if (!isServiceRunning()) {
    console.error(
        `\n✖ O container "${SERVICE}" não está rodando, e os linters PHP (Pint, Larastan, Pest) rodam dentro dele.`,
    );
    console.error('  Suba com: docker compose up -d\n');
    process.exit(1);
}
