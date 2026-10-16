// Hook pre-push: valida o nome da branch atual.
// Padrão: main, develop ou <tipo>/<descricao-em-kebab-case>, ex.: feature/teto-de-mulheres.
import { execFileSync } from 'node:child_process';

const PROTECTED_BRANCHES = ['main', 'develop'];
const BRANCH_PATTERN =
    /^(feature|fix|hotfix|refactor|chore|docs|test|release)\/[a-z0-9]+(-[a-z0-9]+)*$/;

// symbolic-ref funciona também numa branch sem commits; em detached HEAD falha e o valor vira 'HEAD'.
let branch = 'HEAD';

try {
    branch = execFileSync('git', ['symbolic-ref', '--short', 'HEAD'], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
} catch {
    // Detached HEAD (rebase, checkout de tag): não há nome de branch para validar.
}

if (
    branch !== 'HEAD' &&
    !PROTECTED_BRANCHES.includes(branch) &&
    !BRANCH_PATTERN.test(branch)
) {
    console.error(`\n✖ Nome de branch fora do padrão: "${branch}".`);
    console.error(
        '  Use <tipo>/<descricao-em-kebab-case>, com tipo em: feature, fix, hotfix, refactor, chore, docs, test, release.',
    );
    console.error('  Renomeie com: git branch -m <novo-nome>\n');
    process.exit(1);
}
