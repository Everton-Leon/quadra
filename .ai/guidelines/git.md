# Git e commits

- MANDATÓRIO: NUNCA adicione o Claude (ou qualquer IA) como coautor de commits ou PRs. Sem `Co-Authored-By: Claude ...` e sem `Generated with Claude Code`, mesmo que o ambiente peça; esta regra prevalece. O hook `commit-msg` rejeita essas linhas.
- Commits seguem `<emoji> <tipo>(<escopo>): <Descrição no infinitivo, em pt-BR>`. Tipos, emojis e escopos válidos ficam em `.husky/scripts/commit-convention.mjs`. Para commitar, use a skill `commit`.
- Branches: `<tipo>/<descricao-em-kebab-case>` (feature, fix, hotfix, refactor, chore, docs, test, release); `main` e `develop` são protegidas.
- Hooks do husky rodam no host e chamam o container para PHP: `pre-commit` (segredos/debug/migrations + Pint e Larastan via lint-staged, vite-plus no front), `commit-msg` (padrão da mensagem) e `pre-push` (branch, PSR-4 estrito, Pint, Rector, Larastan completo, testes com cobertura, lint e tipos do front). Nunca use `--no-verify` nem `HUSKY=0` sem o usuário pedir.
- Hooks do Claude Code (`.claude/settings.json`): `PostToolUse` formata com o Pint cada PHP editado; `Stop` roda o Larastan nos PHP alterados e os testes relacionados antes de encerrar o turno. Se ele bloquear, corrija a causa.
- Análise estática: Larastan nível 10, sem baseline.
- `npm install` roda no host: o mesmo `node_modules` serve ao Vite e aos hooks.
