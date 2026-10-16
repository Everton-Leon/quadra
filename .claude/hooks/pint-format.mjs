// Hook PostToolUse do Claude Code: formata com o Pint, dentro do container, os arquivos PHP editados.
// Falha em silêncio quando o container está parado, para nunca bloquear a edição.
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { execArgs } from '../../.husky/scripts/docker.mjs';

let raw = '';
process.stdin.on('data', (chunk) => (raw += chunk));
process.stdin.on('end', () => {
    try {
        const input = JSON.parse(raw);
        const filePath = input?.tool_input?.file_path;
        const projectDir = process.env.CLAUDE_PROJECT_DIR || input?.cwd;

        if (!filePath || !projectDir || !filePath.endsWith('.php')) {
            return;
        }

        const relative = path
            .relative(projectDir, filePath)
            .split(path.sep)
            .join('/');

        if (relative.startsWith('..') || relative.startsWith('vendor/')) {
            return;
        }

        execFileSync(
            'docker',
            execArgs('vendor/bin/pint', relative, '--quiet'),
            {
                cwd: projectDir,
                stdio: 'ignore',
                timeout: 30000,
            },
        );
    } catch {
        // Container parado ou erro do Pint: ignora; o pre-commit roda o Pint de novo.
    }
});
