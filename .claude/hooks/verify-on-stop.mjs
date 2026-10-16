// Hook Stop do Claude Code: antes de a sessão encerrar o turno, roda o Larastan e os testes
// relacionados aos arquivos PHP alterados no working tree. Em falha, bloqueia o encerramento e
// devolve o erro ao agente. A suíte completa e a cobertura continuam no pre-push.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { stripVTControlCharacters } from 'node:util';
import { execArgs, isServiceRunning } from '../../.husky/scripts/docker.mjs';

// Mesmos caminhos de `paths` no phpstan.neon (e do lint-staged.config.js).
const ANALYSED_PATHS =
    /^(app|config|database|routes|tests\/Support)\/|^bootstrap\/app\.php$|^tests\/TestCase\.php$/;
const MAX_OUTPUT_LINES = 80;

const inContainer = (projectDir, args, timeout) =>
    execFileSync('docker', execArgs(...args), {
        cwd: projectDir,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout,
    });

const tail = (text) =>
    stripVTControlCharacters(text)
        .trim()
        .split(/\r?\n/)
        .slice(-MAX_OUTPUT_LINES)
        .join('\n');

const failureOutput = (error) =>
    tail(`${error.stdout ?? ''}\n${error.stderr ?? ''}`) ||
    String(error.message);

/** Arquivos PHP alterados, staged ou não, incluindo os não rastreados. */
const changedPhpFiles = (projectDir) => {
    const status = execFileSync(
        'git',
        [
            '-c',
            'core.quotepath=false',
            'status',
            '--porcelain',
            '--untracked-files=all',
        ],
        {
            cwd: projectDir,
            encoding: 'utf8',
        },
    );

    return status
        .split(/\r?\n/)
        .filter(
            (line) =>
                line.length > 3 &&
                !line.startsWith(' D') &&
                !line.startsWith('D '),
        )
        .map((line) => line.slice(3).split(' -> ').pop().replace(/^"|"$/g, ''))
        .filter(
            (file) =>
                file.endsWith('.php') &&
                !file.startsWith('vendor/') &&
                existsSync(path.join(projectDir, file)),
        );
};

/** Testes alterados, testes espelho das classes de app/ (guideline de testes) e os de arquitetura. */
const relatedTests = (projectDir, files) => {
    const tests = new Set(
        files.filter((file) =>
            /^tests\/(Feature|Unit|Arch)\/.+Test\.php$/.test(file),
        ),
    );

    for (const file of files.filter((file) => file.startsWith('app/'))) {
        const mirrored = file
            .replace(/^app\//, 'tests/Feature/')
            .replace(/\.php$/, 'Test.php');

        if (existsSync(path.join(projectDir, mirrored))) {
            tests.add(mirrored);
        }
    }

    if (files.some((file) => file.startsWith('app/'))) {
        tests.add('tests/Arch');
    }

    return [...tests];
};

const stateHash = (projectDir, files) => {
    const hash = createHash('sha256');

    for (const file of [...files].sort((a, b) => a.localeCompare(b))) {
        hash.update(file).update(readFileSync(path.join(projectDir, file)));
    }

    return hash.digest('hex');
};

const block = (reason) => {
    process.stdout.write(JSON.stringify({ decision: 'block', reason }));
};

let raw = '';
process.stdin.on('data', (chunk) => (raw += chunk));
process.stdin.on('end', () => {
    const input = JSON.parse(raw || '{}');
    const projectDir =
        process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();

    // Já bloqueado uma vez neste encerramento: não insiste, para não prender a sessão em loop.
    if (input.stop_hook_active === true) {
        return;
    }

    let files;

    try {
        files = changedPhpFiles(projectDir);
    } catch {
        // Fora de um repositório git: nada a verificar.
        return;
    }

    if (files.length === 0) {
        return;
    }

    // Sem container não há como verificar; o pre-commit e o pre-push cobrem depois.
    if (!isServiceRunning(projectDir)) {
        return;
    }

    // Estado já aprovado numa verificação anterior: nada mudou desde então.
    const cacheFile = path.join(
        os.tmpdir(),
        `claude-verify-${createHash('sha256').update(projectDir).digest('hex').slice(0, 12)}`,
    );
    const hash = stateHash(projectDir, files);

    if (existsSync(cacheFile) && readFileSync(cacheFile, 'utf8') === hash) {
        return;
    }

    const analysedFiles = files.filter((file) => ANALYSED_PATHS.test(file));

    if (analysedFiles.length > 0) {
        try {
            inContainer(
                projectDir,
                [
                    'vendor/bin/phpstan',
                    'analyse',
                    '--no-progress',
                    '--memory-limit=1G',
                    ...analysedFiles,
                ],
                240000,
            );
        } catch (error) {
            block(
                `O Larastan acusou erros nos arquivos alterados. Corrija na causa, seguindo a guideline de análise estática:\n\n${failureOutput(error)}`,
            );

            return;
        }
    }

    const tests = relatedTests(projectDir, files);

    if (tests.length > 0) {
        try {
            inContainer(
                projectDir,
                ['php', 'artisan', 'test', '--compact', ...tests],
                240000,
            );
        } catch (error) {
            block(
                `Testes relacionados aos arquivos alterados falharam (${tests.join(', ')}):\n\n${failureOutput(error)}`,
            );

            return;
        }
    }

    writeFileSync(cacheFile, hash);
});
