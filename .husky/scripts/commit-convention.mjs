// Convenção de commits do projeto.
// Formato: <emoji> <tipo>(<escopo>): <Descrição no infinitivo, em pt-BR>
// Exemplo: ✨ feat(fila): Adicionar teto de mulheres por time.
//
// Para criar um tipo ou escopo novo, edite as listas abaixo: o hook commit-msg e a skill /commit leem daqui.

/** Tipo de commit => emoji obrigatório. */
export const TYPES = {
    feat: { emoji: '✨', description: 'Nova funcionalidade' },
    fix: { emoji: '🐛', description: 'Correção de bug' },
    hotfix: { emoji: '🚑', description: 'Correção urgente em produção' },
    refactor: {
        emoji: '🔨',
        description: 'Refatoração sem mudar comportamento',
    },
    perf: { emoji: '⚡', description: 'Melhoria de performance' },
    style: {
        emoji: '🎨',
        description: 'Formatação/estilo de código, sem mudar lógica',
    },
    test: { emoji: '✅', description: 'Adição ou ajuste de testes' },
    docs: { emoji: '📝', description: 'Documentação' },
    build: { emoji: '📦', description: 'Dependências, Docker ou build' },
    ci: { emoji: '👷', description: 'Pipelines de CI/CD' },
    chore: { emoji: '🔧', description: 'Configuração e tarefas de manutenção' },
    revert: { emoji: '⏪', description: 'Reverter commit anterior' },
};

/**
 * Escopos permitidos. Os de domínio são as áreas do produto (SPEC.md); os transversais servem
 * a qualquer projeto. Use vários separados por vírgula: (fila,eventos).
 */
export const SCOPES = {
    // --- Domínio ---
    auth: 'Login, cadastro, Fortify, Sanctum, papéis',
    grupos: 'Grupos, membros (dono e organizadores) e convites',
    elenco: 'Jogadores do grupo',
    sessoes: 'Sessões de quadra, bastão e snapshot',
    eventos: 'Registro de eventos, sincronização e API de eventos',
    fila: 'Regra de negócio da fila e dos times (core/)',
    placar: 'Placar por quadra, QR e marcador',
    'ao-vivo': 'Página ao vivo, Reverb e link fixo do grupo',
    ranking: 'Ranking, lanterninhas e imagem do ranking',
    estatistica: 'Histórico e estatística por jogador',
    assinatura: 'Planos, teste grátis, gateway e webhooks',
    pwa: 'PWA da quadra: service worker, IndexedDB, offline',
    painel: 'Painel do grupo (Inertia)',
    landing: 'Landing page e SEO',
    notificacoes: 'Notificações, e-mail e push',
    // --- Transversais ---
    api: 'Rotas, versionamento e docs da API',
    db: 'Migrations, models, factories e seeders',
    ui: 'Componentes visuais compartilhados e design system',
    config: 'Arquivos de config e .env.example',
    docker: 'compose.yaml, imagens e serviços',
    deps: 'Dependências do Composer/npm',
    testes: 'Infraestrutura de testes',
    git: 'Hooks, husky, lint-staged',
    ia: 'Configuração de agentes de IA (.ai, .claude, Boost)',
    docs: 'Documentação e decisões',
};

export const MAX_HEADER_LENGTH = 100;
export const MIN_SUBJECT_LENGTH = 10;
