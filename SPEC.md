# [NOME] — Especificação Técnica

> Documento-mestre do projeto. Fonte da verdade para visão, stack, arquitetura, modelo de
> dados, escopo e boas práticas. Mantido atualizado a cada decisão (ver seção 15).
> **[NOME]** é marcador até a decisão do nome (seção 14).

--- Solin Franquin php

## 1. VISÃO GERAL

O **[NOME]** é um SaaS para grupos de esporte amador organizarem a quadra na regra
**"quem ganha fica"**. Substitui o caderno de papel: fila por ordem de chegada, montagem
automática dos times com teto de mulheres, vencedor fica e perdedor vai para o fim da fila.
O organizador opera pelo celular, em pé, entre os pontos; os jogadores acompanham ao vivo
por um link; outra pessoa pode marcar o placar de cada quadra.

Nasce de um módulo da Tribus (somostribus.com.br, `/rotacao`), usado de verdade desde
07/2026. A lógica e os aprendizados de quadra vêm de lá; o produto, a marca e a infra são
novos.

**Modalidade inicial:** vôlei. O modelo é pensado para outras (futebol) sem implementá-las.

### 1.1 Superfícies

| Superfície | Quem usa | Tarefa | Requisitos |
|---|---|---|---|
| **Quadra** (organizador) | 1 organizador por sessão | Operar a fila rápido | Offline-first, uma mão, toques grandes, legível ao sol |
| **Placar** | Quem estiver marcando (muda a cada partida) | Contar pontos de uma quadra | Dois botões enormes, sem conta, via QR |
| **Ao vivo** (espectador) | Jogadores e público | Ver quadras, fila e placar | Só leitura, tempo real, link fixo do grupo |
| **Painel do grupo** | Dono e organizadores | Conta, membros, elenco, assinatura, logo | Calmo, administrativo |
| **Landing** | Quem ainda não é cliente | Entender e testar | SEO, conversão |
| **Imagem do ranking** | Vai para o WhatsApp | Vitrine da marca e do grupo | PNG gerado no aparelho, offline |

### 1.2 Princípios (herdados da quadra, mantidos de propósito)

1. **Offline-first**: a quadra nunca depende de internet, de servidor ou de pagamento.
2. **O organizador é a autoridade**: o sistema sugere, ele pode furar a regra.
3. **Um organizador por sessão**: nunca dois aparelhos escrevendo na mesma fila.
4. **Mobile-first extremo**: nada de header/footer roubando altura na tela da quadra.
5. **Cor só quando codifica algo** (gênero, estado); nada decorativo.
6. **Tudo em pt-BR.**

---

## 2. ESTRATÉGIA DE EXECUÇÃO

- **O grupo da Tribus é o primeiro cliente** (beta fechado, sem cobrança). Abrir para outros
  grupos só depois de algumas semanas de quadra real.
- **A regra de negócio é portada com rede de proteção**: primeiro testes de caracterização
  sobre o código atual da Tribus, depois a refatoração para eventos (seção 5).
- **Fatia vertical**: cada etapa do roadmap termina usável na quadra.
- **Repo, banco, containers e servidor próprios.** Não compartilhar nada com Tribus nem
  Cifra (mesma regra da Tribus, agora com mais motivo: há cliente pagante e dados de terceiros).

---

## 3. STACK TECNOLÓGICA

Versões-alvo em 10/2026. **Conferir as versões reais na criação do projeto** e registrar aqui.

| Componente | Tecnologia | Observação |
|---|---|---|
| Linguagem | **PHP 8.5** | |
| Framework | **Laravel 13** | |
| Front (painel, landing) | **Vue 3.5 + Inertia v3 + TypeScript** | Vue 3.6/Vapor só quando sair estável; a migração é por componente |
| Front (quadra, placar, ao vivo) | **PWA Vue 3.5 + TypeScript** | Entrada Vite separada, no mesmo repo; `vite-plugin-pwa` |
| Build | **Vite 8** (Rolldown) | |
| UI | **Tailwind v4 + reka-ui** (via shadcn-vue como ponto de partida), **Lucide** | shadcn como base, **não** como aparência: tokens próprios no `DESIGN.md` |
| Rotas tipadas | **Wayfinder** | Também para as chamadas de API do PWA |
| Autenticação web | **Laravel Fortify** | registration, email-verification, password-confirmation |
| Autenticação do aparelho | **Laravel Sanctum** (token por aparelho) | O PWA segue logado offline e sincroniza depois |
| Tempo real | **Laravel Reverb** (WebSocket) | Canal público por sessão (espectador), privado para organizador/placar |
| Funcionalidades por plano | **Laravel Pennant** | O código pergunta "pode X?", nunca "pagou?" |
| Banco | **PostgreSQL 18** | `uuidv7()` nativo para IDs gerados offline |
| Cache / Fila / Sessão | **Redis** | Filas com Horizon quando houver volume |
| Armazenamento local no aparelho | **IndexedDB** (fila de eventos + estado) | `localStorage` só para preferências |
| Arquivos (logos) | **Object storage S3-compatível** (Cloudflare R2 ou S3) | CORS liberado para o canvas (seção 11) |
| Pagamento | **Gateway a definir** (seção 14) | Atrás de uma interface própria; webhooks idempotentes |
| Testes PHP | **Pest 4** | |
| Testes TS | **Vitest** + **fast-check** (testes de propriedade) | Regra de negócio coberta antes de qualquer refatoração |
| Testes E2E | **Playwright** (viewport de celular) | Fluxo da quadra, offline e sincronização |
| Qualidade | **Pint · Larastan · ESLint · Prettier** | |
| Erros em produção | **Sentry** (ou equivalente) | Front e back |
| Dev | **Docker (Sail)** | Portas próprias (seção 13) para rodar junto com Tribus/Cifra |
| Produção | **VPS próprio** + nginx + TLS, DNS no Cloudflare | Backup diário do banco, fora do servidor |

**Vindo da Tribus, sem mudança:** PHP 8.5, Laravel 13, Inertia v3, Vue 3 + TS, Tailwind v4,
shadcn-vue/reka-ui, Wayfinder, Fortify, Pest 4, Pint, Larastan, ESLint, Prettier, Redis,
Sail, Boost.
**Deixado para trás:** `is_admin` como único nível de acesso; Laravel Excel (trava no PHP 8.5;
reavaliar se precisar exportar).

---

## 4. FERRAMENTAS DE DESENVOLVIMENTO (Claude Code)

### 4.1 Skills do projeto (`.claude/skills/`, instaladas pelo Laravel Boost, versionadas)

| Skill | Quando usar | Origem |
|---|---|---|
| `laravel-best-practices` | Qualquer código backend | Tribus |
| `inertia-vue-development` | Painel e landing (Vue + Inertia) | Tribus |
| `tailwindcss-development` | Estilização | Tribus |
| `wayfinder-development` | Rotas tipadas, inclusive as da API do PWA | Tribus |
| `pest-testing` | Testes PHP | Tribus |
| `fortify-development` | Login, cadastro, verificação de e-mail | Tribus |

O Boost instala skills conforme os pacotes do projeto. Se ele oferecer skills para
**Reverb, Sanctum ou Pennant**, entram também e são registradas aqui.

### 4.2 Plugins

| Plugin | Uso | Status |
|---|---|---|
| `superpowers` | `brainstorming` → `writing-plans` → `executing-plans`; `test-driven-development`, `systematic-debugging`, `verification-before-completion`. Documentos em `docs/superpowers/specs/` e `docs/superpowers/plans/` | **Mantido** (vale também para o TS: TDD com Vitest) |
| **Impeccable** | Design de interface: `/impeccable init` (gera `PRODUCT.md`), `document` (gera `DESIGN.md`), `critique`, `audit`, `polish`, `typeset`, `distill`; detector de vícios visuais via hooks | **Novo**, substitui o `frontend-design` |
| `frontend-design` | — | **Removido** (duas skills de design brigam entre si) |
| `caveman` | Respostas curtas | Opcional, não afeta o código |

Antes de ligar os hooks do Impeccable (`/impeccable hooks on`), ler o que eles executam.

### 4.3 MCP
- **Laravel Boost**: documentação por versão de pacote, banco, logs e erros.
- **Verificação no navegador** (Playwright MCP ou o navegador do Claude) com viewport de
  celular: toda mudança de UI da quadra é conferida em tela pequena antes de dar como pronta.

---

## 5. ARQUITETURA

### 5.1 Visão geral

```
┌──────────────── Repositório único (Laravel) ────────────────┐
│ resources/js/core/     regra de negócio pura em TS (sem Vue, │
│                        sem DOM): reducer, ranking, imagem    │
│ resources/js/painel/   Inertia: landing, conta, painel       │
│ resources/js/quadra/   PWA: quadra, placar, ao vivo          │
│ app/                   API, auth, assinatura, projeções      │
└──────────────────────────────────────────────────────────────┘
        │ HTTPS (eventos em lote)          ▲ WebSocket (Reverb)
        ▼                                  │
   Postgres (eventos, projeções)  ──►  canais por sessão
```

O `core/` é importado pelos dois fronts e é o **único** lugar onde a regra mora. O servidor
**não reexecuta** a regra: guarda eventos, confere ordem e permissão, valida formato,
repassa e projeta estatísticas a partir de eventos autossuficientes (5.3).

### 5.2 Sessão como registro de eventos

Cada ação vira um **evento imutável**; o estado é o resultado de reaplicar os eventos em
ordem (`reducer` em `core/`). Isso dá desfazer de N passos, sincronização simples,
estatística, placar e torneio sobre a mesma base.

```ts
interface Evento {
  id: string            // uuidv7 gerado no aparelho (offline)
  sessaoId: string
  faixa: 'sessao' | `partida:${string}`
  seq: number           // sequencial por faixa, sem buracos
  tipo: string          // ex.: 'vitoria_registrada'
  v: number             // versão do formato do payload desse tipo
  payload: unknown
  criadoEm: string      // relógio do aparelho (informativo)
}
```

Catálogo inicial (faixa `sessao`): `sessao_iniciada`, `config_alterada` (tamanho do time,
quadras, teto de mulheres), `jogador_adicionado`, `jogador_removido`, `jogadores_trocados`,
`times_embaralhados`, `vitoria_registrada`, `desfeito`, `sessao_encerrada`.
Faixa `partida:*`: `ponto_marcado`, `ponto_removido`, `fim_sugerido`.

Regras do registro:
- **Nada aleatório dentro do reducer.** `times_embaralhados` grava o resultado do sorteio.
- **Desfazer é um evento** (`desfeito`, apontando o evento anulado), nunca apagar linha.
- **Eventos autossuficientes para projeção**: `vitoria_registrada` carrega os IDs resolvidos
  de vencedores e perdedores, para o servidor montar `partidas` e estatísticas sem rodar TS.
- **Formato versionado por tipo** (`v`): mudou o payload, sobe a versão e o reducer aceita as
  antigas. Evento gravado nunca é reescrito.

### 5.3 Faixas de escrita e o bastão

- **Faixa `sessao`**: só o aparelho que **segura o bastão** escreve. O grupo pode ter vários
  organizadores, mas só um comanda cada sessão. Passar o bastão: outro organizador pede e o
  atual aceita; se o atual estiver sem sinal, dá para **tomar o bastão** com confirmação
  explícita (eventos não sincronizados do aparelho antigo serão recusados, e ele avisa).
- **Faixa `partida:<id>`**: só o **marcador** daquela quadra escreve. Pontos nunca mexem na
  fila, então as faixas não conflitam.
- **Ponto de contato**: quando o placar atinge o fim, o marcador gera `fim_sugerido`. O
  organizador vê "Quadra 1: Time B venceu 21×18. Confirmar?" e um toque gera
  `vitoria_registrada` na faixa da sessão. O placar sugere; o organizador decide.

### 5.4 Sincronização

- O aparelho grava cada evento primeiro no **IndexedDB** e aplica na hora (UI nunca espera
  rede). Uma fila envia os pendentes em lote: `POST /api/sessoes/{id}/eventos`.
- O servidor aceita se: o autor tem permissão na faixa (bastão ou acesso de placar),
  `seq = último + 1` e o formato é válido. Reenvio do mesmo `id` é **idempotente**.
  Buraco ou faixa sem permissão → `409` com o último `seq` conhecido.
- Junto do lote, o organizador manda um **snapshot** do estado (versão + `ultimoSeq`), para
  quem chega ao vivo carregar rápido sem reprocessar o dia inteiro.
- Retomar em outro aparelho: baixa snapshot + eventos posteriores e reconstrói.

### 5.5 Tempo real

- **Reverb**: canal público `sessao.{codigo}` (espectador) e canal privado para organizador e
  marcadores. O servidor repassa cada evento aceito; o cliente aplica com o mesmo reducer.
  Detectou buraco no `seq` → recarrega o snapshot.
- **Fallback**: polling só com a aba visível (`visibilitychange`), se o WebSocket cair.
- **Link fixo do grupo**: `/{slug-do-grupo}/ao-vivo` sempre mostra a sessão em andamento.
  É o link que fica na descrição do grupo de WhatsApp.

### 5.6 Placar sem conta

Cada quadra de uma sessão tem um **QR de placar** (token próprio, só o hash no banco).
Quem escaneia vira o marcador daquela quadra; o link aponta sempre para a **partida atual**
da quadra. O organizador revoga ou gera outro a qualquer momento. O token só escreve na
faixa `partida:*` daquela quadra.

### 5.7 Acesso

| Papel | Pode |
|---|---|
| **Dono** (do grupo) | Tudo do organizador + assinatura, membros, logo, apagar dados |
| **Organizador** | Abrir sessão, segurar o bastão, gerenciar elenco, ver estatística |
| **Marcador** (token de placar, sem conta) | Marcar pontos de uma quadra numa sessão |
| **Espectador** (público, sem conta) | Ver a sessão ao vivo pelo link |

Autorização por **Policies**. Um usuário pode ser membro de vários grupos.

---

## 6. REGRA DE NEGÓCIO (o coração)

Portada da Tribus (`lib/rotacaoVolei.ts`). **Qualquer mudança aqui exige teste antes.**

1. Fila única por ordem de chegada.
2. Times de **N jogadores** (padrão 5; 4 a 10). Preenche Time A, depois Time B.
3. Quem chega depois entra no fim da fila.
4. Time que **perde** vai inteiro para o fim da fila, na mesma ordem; o **vencedor fica**.
5. A vaga do perdedor é preenchida pelo início da fila.
6. **Teto de mulheres por time** (padrão 2; sem limite, 1 a 5). É teto, não cota: mulher que
   estouraria o teto é **pulada sem perder a vez**. "Sem limite" desliga a regra.
7. **1 a 3 quadras** dividindo a mesma fila.
8. Nome duplicado é permitido; a chave é sempre o `id`.

Casos de borda já tratados: fila sem mulheres suficientes (o time fecha com menos), excesso
de mulheres (acumulam na fila), remover alguém da quadra (repreenche), não declarar vencedor
sem os dois times completos, mudar o teto não desmancha time em quadra (só vagas abertas),
troca manual pode furar o teto (aviso âmbar).

**Invariantes** (testes de propriedade com fast-check):
- Nenhum jogador some nem se duplica: quadra + fila = todos os adicionados − removidos.
- Com fila suficiente, nenhum time montado automaticamente passa do teto.
- Ninguém perde a vez por causa do teto: a ordem relativa da fila se mantém.

**Placar** (novo): regra configurável por sessão (alvo 15/21/25, diferença mínima de 2, teto
de pontos opcional). Ao atingir a condição, gera `fim_sugerido`; nunca encerra sozinho.

**Ranking e lanterninhas**: regras de `rotacaoRanking.ts` (desempate: menos jogos, depois
maior sequência pessoal; "do dia" 6h–17h59, "da noite" 18h–5h59).

---

## 7. MODELO DE DADOS

Identificadores de domínio em **português sem acento** (coerente com o `core/`). Models
declaram `$table` explicitamente (a pluralização do Laravel é em inglês).
IDs: **uuidv7** no que pode nascer offline (sessões, eventos, jogadores); `bigint` no resto.

### 7.1 Conta e grupo
- `users` (padrão + `phone` nullable).
- `grupos`: `id`, `nome`, `slug` (único, usado no link fixo), `modalidade` (`volei`),
  `logo_path` nullable, `config_padrao` jsonb (tamanho do time, quadras, teto, regra de
  placar), timestamps.
- `membros_grupo`: `grupo_id`, `user_id`, `papel` (`dono`, `organizador`), timestamps;
  único (`grupo_id`, `user_id`).
- `convites`: `grupo_id`, `email` ou link, `papel`, `token_hash`, `expira_em`, `aceito_em`.

### 7.2 Elenco
- `jogadores`: `id` (uuid), `grupo_id`, `nome`, `genero` (`M`/`F`), `ativo`, timestamps.
  Avulsos podem existir só dentro da sessão (nome no evento) e ser promovidos ao elenco.

### 7.3 Sessão e eventos
- `sessoes`: `id` (uuid), `grupo_id`, `codigo` (curto, público), `iniciada_em`,
  `encerrada_em`, `config` jsonb, `controlador_token_id` (bastão), `snapshot` jsonb,
  `snapshot_seq`, timestamps.
- `eventos`: `id` (uuid), `sessao_id`, `faixa`, `seq`, `tipo`, `v`, `payload` jsonb,
  `autor_tipo`/`autor_id`, `criado_no_aparelho_em`, `recebido_em`;
  único (`sessao_id`, `faixa`, `seq`). **Somente inserção.**
- `acessos_placar`: `sessao_id`, `quadra`, `token_hash`, `revogado_em`.

### 7.4 Projeções (montadas a partir de eventos; podem ser refeitas)
- `partidas`: `sessao_id`, `quadra`, `inicio`, `fim`, `time_a`/`time_b` (IDs), `pontos_a`,
  `pontos_b`, `vencedor`, `regra` jsonb.
- Estatística por jogador e período: consultas sobre `partidas` (materializar só se pesar).

### 7.5 Assinatura
- `assinaturas`: `grupo_id`, `status` (`teste`, `ativa`, `inadimplente`, `cancelada`),
  `plano`, `teste_termina_em`, `provedor`, `provedor_id`, `periodo_atual_fim`, timestamps.
- `webhooks_recebidos`: `provedor`, `id_externo` (único), `payload` jsonb, `processado_em`.

### 7.6 Futuro (não criar agora)
`torneios`, chaves e fases, reaproveitando `partidas`.

---

## 8. PLANOS, TESTE E PAGAMENTO

- **Sem plano grátis permanente. Teste grátis de 7 dias**, sem cartão no cadastro.
  Em aberto: contar o teste em **dias de jogo** em vez de dias corridos (seção 14).
- Funcionalidades por plano via **Pennant** (`logo-proprio`, `varios-organizadores`, `placar`,
  `estatistica`…). O código nunca checa status de pagamento diretamente.
- **Nunca travar no meio do jogo**: o aparelho guarda as permissões do grupo com validade
  de alguns dias. Assinatura vencida bloqueia só **abrir nova sessão**; a sessão em
  andamento termina normal.
- Sem plano grátis, a **página ao vivo e a imagem do ranking são o canal de aquisição**:
  ambas levam uma assinatura discreta do [NOME] com link.
- **Gateway atrás de interface própria** (`CobrancaGateway`): trocar de provedor não toca o
  domínio. Webhooks idempotentes por `id_externo`. Reaproveitar a pesquisa de taxas da Tribus
  (`2026-07-09-manual-payment-tracking-design.md`), lembrando que o perfil agora é outro:
  assinatura recorrente de valor baixo, Pix recorrente pesa mais que cartão.

---

## 9. IDENTIDADE E INTERFACE

- Fluxo de design com **Impeccable**: `PRODUCT.md` (quem usa e em que situação) escrito antes
  da primeira tela; `DESIGN.md` gerado e mantido com `/impeccable document`.
- Cada superfície (1.1) é desenhada para a sua tarefa; a quadra não herda o visual do painel.
- **Legibilidade ao sol** é requisito da quadra e do placar (contraste alto; avaliar tema claro).
- Ícone testado em **48 px** (PWA, favicon) e na imagem do ranking.
- Crédito à Tribus discreto ("feito pela galera da Tribus"), a confirmar.
- Nome, domínio e logo: seção 14.

---

## 10. ESCOPO

### v1 — beta fechado (grupo da Tribus)
- Conta, grupo, membros (dono + organizadores), elenco.
- PWA da quadra com todas as funcionalidades atuais da Tribus, sobre eventos, offline.
- Bastão (passar e tomar), desfazer de N passos.
- Ao vivo em tempo real com link fixo do grupo.
- Imagem do ranking + lanterninhas (com o desempate e dia/noite).
- `/rotacao` da Tribus redireciona (301).

### v1.1 — Placar
QR por quadra, marcador sem conta, `fim_sugerido` → confirmação do organizador; placar no ao vivo.

### v1.2 — Estatística
Histórico entre dias, ranking do mês por jogador do elenco.

### v2 — Abertura
Teste grátis, assinatura e gateway, convites, logo próprio na imagem, landing, termos e
política de privacidade.

### Depois (não é escopo)
Torneio e sua transmissão · modo telão · futebol · login com Google · espectador gerando a imagem.

---

## 11. SEGURANÇA E LGPD

- Tokens (aparelho, placar, convite) guardados só como **hash**. Link de organizador leva o
  segredo no **fragmento** (`#`), que não chega a logs.
- **Rate limit** em criação de sessão, envio de eventos e login. Tamanho máximo de lote e de
  snapshot.
- Páginas ao vivo com `noindex`.
- **Logo**: só imagem (PNG/SVG sanitizado/WebP), tamanho máximo, redimensionado no upload;
  servido com **CORS** e carregado com `crossOrigin="anonymous"` (senão o canvas fica
  "sujo" e o `toBlob` falha); cacheado pelo service worker para a imagem sair offline.
- **LGPD**: dados guardados de forma permanente (nome e gênero do elenco, estatística). O
  grupo decide sobre os dados; o [NOME] processa. Termos e política antes da v2; o dono pode
  apagar jogador e grupo (apagar anonimiza o jogador nos eventos). Consultar advogado antes
  de abrir ao público.

---

## 12. BOAS PRÁTICAS DE DESENVOLVIMENTO

1. **Ler a SPEC antes de cada tarefa.** Decisão que muda o projeto → atualizar a SPEC no mesmo passo.
2. **Usar as skills** (seção 4) ao entrar em cada domínio; design passa pelo Impeccable.
3. **Regra de negócio só no `core/`, e com teste antes.** Vitest + testes de propriedade.
   Nada de regra em componente Vue nem no PHP.
4. **Eventos são imutáveis e versionados.** Nunca reescrever evento gravado.
5. **Offline-first não se negocia**: nenhuma ação da quadra espera rede, servidor ou pagamento.
6. **Teste o que importa**: core (Vitest), API de eventos, permissões e webhooks (Pest),
   fluxo da quadra offline → online (Playwright).
7. **Migrations imutáveis após aplicadas.**
8. **Arquivos pelo Artisan** (`make:model -mf`, `make:test --pest`) com `--no-interaction`.
9. **Validação em Form Requests.** Dinheiro em `decimal(10,2)`; datas em `America/Sao_Paulo`.
10. **Mobile-first**, verificado em viewport de celular antes de concluir.
11. **Qualidade antes de finalizar**: `pint --dirty`, Larastan, ESLint, types.
12. **Commits pequenos e descritivos**; versionar `.claude/`, `PRODUCT.md` e `DESIGN.md`.
13. **Comandos rodam no container**: `docker compose exec laravel.test …`.

---

## 13. AMBIENTE

Portas próprias para rodar junto com Tribus e Cifra (no `.env`):

| Serviço | Variável | Porta host |
|---|---|---|
| App | `APP_PORT` | `8010` |
| PostgreSQL | `FORWARD_DB_PORT` | `5442` |
| Redis | `FORWARD_REDIS_PORT` | `6389` |
| Vite | `VITE_PORT` | `5183` |
| Reverb | `REVERB_PORT` | `8090` |

```bash
docker compose up -d
docker compose exec laravel.test php artisan migrate
docker compose exec laravel.test php artisan test --compact
npm run test        # Vitest
npm run test:e2e    # Playwright
npm run dev
```

---

## 14. DECISÕES EM ABERTO

| # | Decisão | Opções / notas |
|---|---|---|
| 1 | **Nome e domínio** | Ganhou Fica, Rei da Quadra, Próximo!, Fila da Quadra… Verificar registro.br, `.app`/`.com`, Instagram, INPI |
| 2 | **Unidade do teste grátis** | 7 dias corridos (decidido) × dias de jogo (grupo que joga 1×/semana testa só 1 dia) |
| 3 | **Gateway** | Asaas, Mercado Pago, Pagar.me, Stripe; peso no Pix recorrente |
| 4 | **Preço e planos** | Valor por grupo; o que cada plano libera |
| 5 | **Tema da quadra** | Escuro (herança) × claro de alto contraste (sol) |
| 6 | **Object storage** | Cloudflare R2 × S3 × disco local no começo |
| 7 | **Hospedagem** | Provedor e tamanho do VPS próprio |
| 8 | **Ranking não publicado na Tribus** | Publicar lá antes × trazer direto (recomendado: direto, já com teste) |
| 9 | **Crédito à Tribus** | Na imagem, no rodapé ou não |

---

## 15. REGISTRO DE DECISÕES

> **Decisão (2026-10-07):** o produto é um **SaaS por grupo**, não uma ferramenta de um grupo
> só. Contas, grupos com dono e organizadores, assinatura por grupo e logo próprio. Torneio e
> transmissão dele ficam para depois, mas a arquitetura já os considera.

> **Decisão (2026-10-07):** **um organizador por sessão** (bastão). Vários organizadores por
> grupo, nunca dois escrevendo na mesma fila. Elimina resolução de conflito.

> **Decisão (2026-10-07):** **placar marcado por outra pessoa**, sem conta, via QR por quadra,
> em faixa de escrita própria. O placar sugere o fim; o organizador confirma.

> **Decisão (2026-10-07):** **sessão como registro de eventos** (seção 5.2), no lugar de
> publicar o estado inteiro. Motivos: desfazer de N passos, placar, estatística, torneio e
> sincronização sobre a mesma base.

> **Decisão (2026-10-07):** **stack Laravel + Inertia + PWA no mesmo repo, Reverb para tempo
> real**, revertendo a ideia inicial de Cloudflare Workers + Durable Objects: com contas,
> assinatura e permissões, o trabalho passa a ser o que o Laravel resolve e o dono domina.

> **Decisão (2026-10-07):** **sem plano grátis; teste de 7 dias.** Unidade do teste em aberto.

> **Decisão (2026-10-07):** **Impeccable no lugar do `frontend-design`** como ferramenta de
> design. Front com nível de acabamento alto é requisito, não polimento final.

---

## 16. ROADMAP DE CONSTRUÇÃO (ordem sugerida)

0. **Projeto**: Laravel 13 + Inertia + Vue + Vite 8, Boost e skills, `superpowers`,
   Impeccable (`init` com o `PRODUCT.md`), Vitest, Playwright, portas próprias.
1. **Testes de caracterização**: copiar `rotacaoVolei.ts` e `rotacaoRanking.ts` da Tribus
   **sem alterar**, cobrir o comportamento atual (sequências reais + invariantes + migrações
   de estado v1→v3).
2. **Refatorar o core para eventos** (reducer), com os testes garantindo o mesmo resultado.
   Trazer o ranking não publicado (desempate, lanterninhas, dia/noite).
3. **Backend**: grupos, membros, sessões, API de eventos (permissão, `seq`, idempotência), snapshot.
4. **PWA da quadra**: IndexedDB, fila de sincronização, bastão, desfazer de N passos.
5. **Ao vivo**: Reverb, canal por sessão, link fixo do grupo, fallback de polling.
6. **Deploy + beta**: VPS próprio, backup, Sentry; grupo da Tribus usando; `/rotacao` → 301.
7. **Placar** (v1.1).
8. **Elenco e estatística** (v1.2).
9. **Abertura** (v2): teste, assinatura, convites, logo, landing, termos.
10. **Torneio** e o resto da lista.
