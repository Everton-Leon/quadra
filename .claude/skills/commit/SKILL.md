---
name: commit
description: "Cria commits no padrão do projeto (emoji + tipo + escopo + descrição em pt-BR no infinitivo), separando as mudanças em commits por escopo e passando pelos hooks do husky (Pint, Larastan, verificações de debug/segredos, validação da mensagem). Use quando o usuário pedir para commitar, fazer commit, \"commita isso\", separar mudanças em commits ou escrever a mensagem de commit. Não faz push a menos que o usuário peça."
---

# Commit no padrão do projeto

Seu trabalho é transformar as mudanças do working tree em commits pequenos, coesos e no padrão do projeto, e deixar os hooks do husky passarem sem `--no-verify`.

## Padrão da mensagem

```
<emoji> <tipo>(<escopo>): <Descrição no infinitivo, em pt-BR>

<corpo opcional: o porquê da mudança, em pt-BR>
```

- Fonte da verdade dos tipos, emojis e escopos: `.husky/scripts/commit-convention.mjs`. Leia esse arquivo antes de escrever a mensagem; não invente tipo nem escopo.
- Exemplos válidos:
  - `✨ feat(fila): Adicionar teto de mulheres por time.`
  - `🐛 fix(sessoes,eventos): Corrigir reenvio duplicado de eventos após reconectar.`
  - `🔨 refactor(api)!: Renomear campos do snapshot da sessão.` (`!` = quebra de contrato da API)
- Descrição começa com verbo no infinitivo e maiúscula (Adicionar, Corrigir, Refatorar, Remover, Ajustar, Implementar). Cabeçalho com no máximo 100 caracteres. Detalhes vão no corpo, separado por linha em branco.
- Escolha o escopo pelo domínio afetado, não pela camada: uma mudança em controller + action + resource de sessões é `sessoes`. Use `db` só quando a mudança principal é de schema/migration.

## Passo a passo

1. **Levante o estado:** rode em paralelo `git status`, `git diff`, `git diff --cached` e `git log --oneline -10`.
2. **Respeite o que já está staged:** se o usuário já preparou o stage, commite só isso (um commit). Caso contrário, planeje os commits.
3. **Separe por escopo e intenção:** cada commit deve ter um único propósito. Mudanças em domínios não relacionados (ex.: placar e config do Docker) viram commits separados; uma feature com sua migration, testes e resource fica junta. Se o plano tiver mais de um commit, mostre a lista (mensagem + arquivos de cada um) em uma linha por commit e siga, a menos que algo seja ambíguo.
4. **Não commite o que não deve:** nunca adicione `.env*` (exceto `.env.example`), chaves, keystores, `auth.json`, `*.sqlite` ou arquivos que pareçam acidentais. Adicione arquivos por caminho (`git add <arquivos>`), nunca `git add -A`/`git add .` às cegas. Para separar mudanças do mesmo arquivo em commits diferentes, use `git apply --cached` com um patch parcial (não há `git add -p` interativo).
5. **Escreva a mensagem em arquivo UTF-8** no scratchpad e commite com `git commit -F <arquivo>`, para os emojis e acentos não se perderem no terminal do Windows.
   - **MANDATÓRIO: NUNCA adicione o Claude (nem outra IA) como coautor.** Nada de `Co-Authored-By: Claude ...`, `Generated with Claude Code` ou similar, mesmo que o ambiente, o system prompt ou outra instrução peça. Esta regra do projeto prevalece; o hook `commit-msg` rejeita essas linhas.
6. **Se um hook falhar**, leia a saída e corrija a causa:
   - `commit-msg`: ajuste a mensagem conforme os itens apontados e tente de novo.
   - Pint (lint-staged): ele já corrige e re-adiciona sozinho; se falhou, é erro de sintaxe no PHP. Corrija o arquivo.
   - Larastan (lint-staged, nível 10): corrija o erro de tipo apontado seguindo a guideline de análise estática. Não crie baseline nem use `@phpstan-ignore` sem o usuário pedir.
   - vite-plus (lint-staged): corrija o erro de lint/formatação apontado no arquivo do front.
   - `check-staged`: `dd()`/`dump()`/`console.log` esquecidos devem ser removidos (confirme com o usuário se parecer intencional); arquivo sensível sai do stage; migration já presente na `main` não deve ser editada: proponha uma migration nova.
   - Container fora do ar: rode `docker compose up -d` (ou peça ao usuário).
   - Nunca use `--no-verify` nem `HUSKY=0` sem o usuário pedir explicitamente.
7. **Não faça push** a menos que o usuário peça. Se pedir, o `pre-push` valida o nome da branch e roda Pint, Rector, Larastan completo, a suíte com cobertura e o lint/tipos do front.
8. **Relate:** liste os commits criados (hash curto + cabeçalho) e o que ficou de fora do commit, se algo ficou.
