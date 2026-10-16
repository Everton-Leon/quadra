// Hook commit-msg: valida a mensagem contra a convenção em commit-convention.mjs.
// Uso: node .husky/scripts/commit-msg.mjs <arquivo-da-mensagem>
import { readFileSync } from 'node:fs';
import {
    MAX_HEADER_LENGTH,
    MIN_SUBJECT_LENGTH,
    SCOPES,
    TYPES,
} from './commit-convention.mjs';

const HEADER_PATTERN =
    /^(?<emoji>\p{Extended_Pictographic}\uFE0F?)(?<space>\s*)(?<type>[a-z]+)(?:\((?<scope>[^)]*)\))?(?<breaking>!)?(?<colon>:?)(?<separator>\s*)(?<subject>.*)$/u;

// Verbos em inglês que terminam como infinitivo em português e passariam pelo teste abaixo.
const ENGLISH_VERBS = new Set([
    'render',
    'register',
    'filter',
    'order',
    'trigger',
    'cover',
    'clear',
    'enter',
    'refactor',
    'monitor',
    'color',
    'error',
]);
const ENGLISH_WORDS =
    /\b(the|and|to|for|with|when|from|of|on|in|into|instead|should|add|fix|update|remove|create|implement|change)\b/gi;
const AI_ATTRIBUTION =
    /^\s*co-authored-by:.*(claude|anthropic|copilot|gemini|openai|chatgpt|cursor)|generated with .*claude/i;
const PORTUGUESE_WORDS =
    /\b(de|da|do|das|dos|para|com|ao|aos|na|no|nas|nos|em|e|que|um|uma|ou|por|pelo|pela)\b/gi;

const messageFile = process.argv[2];

if (!messageFile) {
    console.error('commit-msg: arquivo da mensagem não informado.');
    process.exit(1);
}

const lines = readFileSync(messageFile, 'utf8')
    .split(/\r?\n/)
    .filter((line) => !line.startsWith('#'));

while (lines.length && lines.at(-1).trim() === '') {
    lines.pop();
}

const header = (lines[0] ?? '').trim();

// Mensagens geradas pelo próprio git ficam de fora.
if (/^(Merge |Revert "|fixup! |squash! |amend! )/.test(header)) {
    process.exit(0);
}

const errors = [];
const match = header.match(HEADER_PATTERN);

if (!match) {
    errors.push(
        'O cabeçalho precisa começar com o emoji do tipo, ex.: "✨ feat(fila): Adicionar ...".',
    );
} else {
    const { emoji, space, type, scope, colon, separator, subject } =
        match.groups;
    const typeConfig = TYPES[type];

    if (!typeConfig) {
        errors.push(
            `Tipo "${type}" inválido. Use um destes: ${Object.keys(TYPES).join(', ')}.`,
        );
    } else if (
        emoji.replace('\uFE0F', '') !== typeConfig.emoji.replace('\uFE0F', '')
    ) {
        errors.push(
            `O tipo "${type}" usa o emoji ${typeConfig.emoji}, não ${emoji}.`,
        );
    }

    if (space !== ' ') {
        errors.push(
            'Use exatamente um espaço entre o emoji e o tipo: "✨ feat(...)".',
        );
    }

    if (scope === undefined || scope.trim() === '') {
        errors.push(
            `Informe o escopo entre parênteses, ex.: "${typeConfig?.emoji ?? '✨'} ${type}(fila): ...".`,
        );
    } else {
        const invalidScopes = scope
            .split(',')
            .map((item) => item.trim())
            .filter((item) => !(item in SCOPES));

        if (invalidScopes.length) {
            errors.push(
                `Escopo inválido: ${invalidScopes.join(', ')}. Escopos permitidos: ${Object.keys(SCOPES).join(', ')}.`,
            );
        }
    }

    if (colon !== ':' || separator !== ' ') {
        errors.push(
            'Depois do tipo/escopo use ": " (dois-pontos e um espaço).',
        );
    }

    const firstWord = subject.split(/\s+/)[0] ?? '';

    if (subject.length < MIN_SUBJECT_LENGTH) {
        errors.push(
            `A descrição precisa ter pelo menos ${MIN_SUBJECT_LENGTH} caracteres.`,
        );
    } else if (!/^\p{Lu}/u.test(subject)) {
        errors.push('A descrição deve começar com letra maiúscula.');
    } else if (
        !/^\p{L}+(ar|er|ir|or|ôr)$/iu.test(firstWord) ||
        ENGLISH_VERBS.has(firstWord.toLowerCase())
    ) {
        errors.push(
            `Comece a descrição com um verbo no infinitivo em português (Adicionar, Corrigir, Refatorar...). Recebido: "${firstWord}".`,
        );
    }

    const englishCount = (subject.match(ENGLISH_WORDS) ?? []).length;
    const portugueseCount = (subject.match(PORTUGUESE_WORDS) ?? []).length;

    if (englishCount >= 2 && englishCount > portugueseCount) {
        errors.push(
            'A mensagem parece estar em inglês. Escreva em português (pt-BR).',
        );
    }
}

if (header.length > MAX_HEADER_LENGTH) {
    errors.push(
        `O cabeçalho tem ${header.length} caracteres; o máximo é ${MAX_HEADER_LENGTH}. Detalhes vão no corpo.`,
    );
}

if (lines.length > 1 && lines[1].trim() !== '') {
    errors.push(
        'Deixe uma linha em branco entre o cabeçalho e o corpo da mensagem.',
    );
}

// Regra mandatória do projeto: assistentes de IA nunca entram como coautores.
if (lines.some((line) => AI_ATTRIBUTION.test(line))) {
    errors.push(
        'Remova a atribuição a IA (Co-Authored-By: Claude / "Generated with Claude Code"). Assistentes de IA nunca são coautores.',
    );
}

if (errors.length) {
    console.error('\n✖ Mensagem de commit fora do padrão:\n');
    console.error(`  ${header || '(vazia)'}\n`);
    errors.forEach((error) => console.error(`  • ${error}`));
    console.error(
        '\n  Formato: <emoji> <tipo>(<escopo>): <Descrição no infinitivo>',
    );
    console.error(
        '  Exemplo: ✨ feat(fila): Adicionar teto de mulheres por time.',
    );
    console.error('  Tipos e escopos: .husky/scripts/commit-convention.mjs\n');
    process.exit(1);
}
