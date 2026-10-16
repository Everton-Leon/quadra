// Hook pre-commit: verificações rápidas nos arquivos staged que não dependem do container.
// - arquivos sensíveis (.env, chaves, keystores) e arquivos grandes
// - marcadores de conflito, chamadas de debug e segredos nas linhas adicionadas
// - edição/remoção de migrations que já existem na main
import { execFileSync } from 'node:child_process';

const MAX_FILE_SIZE_BYTES = 1024 * 1024;
const MAIN_BRANCH = 'main';
const MIGRATIONS_DIR = 'database/migrations/';

const FORBIDDEN_FILES = [
    {
        pattern: /(^|\/)\.env(\.(?!example$)[^/]+)?$/,
        reason: 'arquivo de ambiente com credenciais',
    },
    {
        pattern: /\.(pem|key|p8|p12|pfx|jks|keystore|mobileprovision)$/i,
        reason: 'chave/certificado/keystore',
    },
    { pattern: /(^|\/)auth\.json$/, reason: 'credenciais do Composer' },
    {
        pattern: /(^|\/)(google-services\.json|GoogleService-Info\.plist)$/,
        reason: 'credenciais do Firebase',
    },
    { pattern: /\.sqlite(-journal)?$/, reason: 'banco SQLite local' },
    {
        pattern: /\.(pt|pth|onnx|safetensors|ckpt)$/i,
        reason: 'pesos de modelo (ficam fora do git)',
    },
];

const LINE_CHECKS = [
    {
        files: /./,
        pattern: /^(<{7}|>{7})( |$)|^={7}$/,
        reason: 'marcador de conflito de merge',
    },
    {
        files: /\.php$/,
        pattern: /(?:^|[^\w$>:])(dd|ddd|dump|var_dump|ray)\s*\(/,
        reason: 'chamada de debug (dd/dump/var_dump/ray)',
    },
    {
        files: /\.php$/,
        pattern: /->\s*(dd|ddd|dump|ray)\s*\(/,
        reason: 'chamada de debug encadeada (->dd()/->dump())',
    },
    {
        files: /\.blade\.php$/,
        pattern: /@(dd|dump)\b/,
        reason: 'diretiva de debug no Blade',
    },
    {
        files: /\.(js|mjs|cjs|ts|tsx|jsx|vue)$/,
        pattern: /\bconsole\.log\s*\(|\bdebugger\b/,
        reason: 'console.log/debugger',
        skip: /^(\.husky|scripts|\.claude)\//,
    },
    {
        files: /./,
        pattern: /AKIA[0-9A-Z]{16}/,
        reason: 'possível chave de acesso AWS',
    },
    {
        files: /./,
        pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
        reason: 'chave privada',
    },
];

const git = (...args) =>
    execFileSync('git', ['-c', 'core.quotepath=false', ...args], {
        encoding: 'utf8',
        maxBuffer: 64 * 1024 * 1024,
    });

const errors = [];

const stagedEntries = git(
    'diff',
    '--cached',
    '--name-status',
    '--diff-filter=ACMRD',
)
    .split('\n')
    .filter(Boolean)
    .map((line) => {
        const [status, ...paths] = line.split('\t');

        return {
            status: status[0],
            path: paths.at(-1),
            originalPath: paths[0],
        };
    });

for (const { status, path } of stagedEntries) {
    if (status === 'D') {
        continue;
    }

    const forbidden = FORBIDDEN_FILES.find(({ pattern }) => pattern.test(path));

    if (forbidden) {
        errors.push(`${path}: ${forbidden.reason} não deve ser commitado.`);
    }

    const size = Number(git('cat-file', '-s', `:${path}`).trim());

    if (size > MAX_FILE_SIZE_BYTES) {
        errors.push(
            `${path}: ${(size / 1024 / 1024).toFixed(1)} MB (limite de 1 MB). Use o storage S3 para arquivos grandes.`,
        );
    }
}

let currentFile = null;
let currentLine = 0;

for (const line of git(
    'diff',
    '--cached',
    '-U0',
    '--diff-filter=ACMR',
    '--no-color',
).split('\n')) {
    if (line.startsWith('+++ ')) {
        currentFile = line.startsWith('+++ b/') ? line.slice(6) : null;
        continue;
    }

    const hunk = line.match(/^@@ -\S+ \+(\d+)/);

    if (hunk) {
        currentLine = Number(hunk[1]);
        continue;
    }

    if (!currentFile || !line.startsWith('+')) {
        continue;
    }

    const content = line.slice(1);

    for (const check of LINE_CHECKS) {
        if (
            check.files.test(currentFile) &&
            !check.skip?.test(currentFile) &&
            check.pattern.test(content)
        ) {
            errors.push(`${currentFile}:${currentLine}: ${check.reason}.`);
        }
    }

    currentLine++;
}

if (process.env.ALLOW_MIGRATION_EDIT !== '1') {
    for (const { status, originalPath } of stagedEntries) {
        if (
            !['M', 'D', 'R'].includes(status) ||
            !originalPath.startsWith(MIGRATIONS_DIR)
        ) {
            continue;
        }

        try {
            git('cat-file', '-e', `${MAIN_BRANCH}:${originalPath}`);
        } catch {
            continue;
        }

        errors.push(
            `${originalPath}: migration que já está na ${MAIN_BRANCH} foi alterada/removida. ` +
                'Crie uma migration nova (ou use ALLOW_MIGRATION_EDIT=1 se tiver certeza de que ela nunca rodou fora da sua máquina).',
        );
    }
}

if (errors.length) {
    console.error('\n✖ Verificações do pre-commit falharam:\n');
    errors.forEach((error) => console.error(`  • ${error}`));
    console.error(
        '\n  Corrija e tente de novo. Em último caso: git commit --no-verify\n',
    );
    process.exit(1);
}
