// Linters rodados no pre-commit, só nos arquivos staged.
// PHP/Composer rodam no container, com caminhos relativos à raiz do projeto (montada em /var/www/html).
// O front roda no host, com o node_modules do host.
import path from 'node:path';
import { EXEC } from './.husky/scripts/docker.mjs';

// Mesmos caminhos de `paths` no phpstan.neon (dos testes, só tests/Support e o TestCase).
const ANALYSED_PATHS =
    /^(app|config|database|routes|tests\/Support)\/|^bootstrap\/app\.php$|^tests\/TestCase\.php$/;

const toRelative = (files) =>
    files.map((file) =>
        path.relative(process.cwd(), file).split(path.sep).join('/'),
    );

const quote = (files) => files.map((file) => `"${file}"`).join(' ');

export default {
    '*.php': (files) => {
        const relativeFiles = toRelative(files);
        const analysedFiles = relativeFiles.filter((file) =>
            ANALYSED_PATHS.test(file),
        );

        return [
            // Pint corrige o estilo e o lint-staged re-adiciona os arquivos ao commit; erro de sintaxe barra o commit.
            `${EXEC} vendor/bin/pint ${quote(relativeFiles)}`,
            // Larastan nível 10, sem baseline: o projeto inteiro passa limpo.
            ...(analysedFiles.length
                ? [
                      `${EXEC} vendor/bin/phpstan analyse --no-progress --memory-limit=1G ${quote(analysedFiles)}`,
                  ]
                : []),
        ];
    },
    'composer.json': () =>
        `${EXEC} composer validate --no-check-lock --no-check-publish`,
    // Formatação e lint do front (vite-plus); os arquivos ignorados em vite.config.ts não acusam erro.
    'resources/**/*.{ts,vue,css}': (files) =>
        `npx vp check --fix --no-error-on-unmatched-pattern ${quote(toRelative(files))}`,
};
