// Ponto único de configuração do Docker para os hooks do git e do Claude Code.
// SERVICE é o nome do serviço PHP no compose.yaml (o padrão do Sail).
import { execFileSync } from 'node:child_process';

export const SERVICE = 'laravel.test';

/** Argumentos para rodar um comando no container: docker compose exec -T <service> ... */
export const execArgs = (...command) => [
    'compose',
    'exec',
    '-T',
    SERVICE,
    ...command,
];

/** Prefixo em texto, para comandos montados como string (lint-staged). */
export const EXEC = `docker compose exec -T ${SERVICE}`;

export const isServiceRunning = (cwd = process.cwd()) => {
    try {
        const services = execFileSync(
            'docker',
            ['compose', 'ps', '--status', 'running', '--services'],
            {
                cwd,
                encoding: 'utf8',
                stdio: ['ignore', 'pipe', 'ignore'],
            },
        );

        return services.split(/\r?\n/).includes(SERVICE);
    } catch {
        return false;
    }
};
