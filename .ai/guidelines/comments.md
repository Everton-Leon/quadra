# Comentários no código

- **Todo comentário é em português (pt-BR)**: comentários de linha, PHPDoc, comentários em Blade, JS, shell, YAML e configs. Termos técnicos e nomes de código ficam como estão (`toBase()`, `Collection`, `Stripe`).
- Comentários são escritos por um desenvolvedor do projeto para quem vai manter o código depois, seja pessoa ou agente. Nunca no tom de um assistente conversando com quem pediu a mudança.

## Quando comentar

- Comente o **porquê**, não o quê: uma restrição externa (limite de uma API, comportamento de um SDK), um bug contornado, uma decisão não óbvia, um efeito colateral (ex.: um observer que atualiza estatísticas), uma invariante que, se quebrada, causa erro.
- Se o nome do método e o código já dizem o que acontece, não comente. Prefira renomear a explicar um nome ruim.
- Use PHPDoc para o que o tipo nativo não expressa (array shapes, generics, `@throws` relevante) e para contratos públicos. Não repita a assinatura em prosa (`@param User $user O usuário`).
- Seções em arquivos longos (`// --- Amizades ---`) são aceitáveis quando ajudam a navegar, em seeders e cenários de teste.

## Como escrever

- Frases curtas, sem emojis.
- Só afirme o que é verdade e verificável no código ou na documentação. Não invente justificativas; se o motivo de uma decisão não é conhecido, não comente.
- Descreva o estado atual do código, como uma invariante: "toBase() garante uma Collection comum mesmo quando vazia; sem ele o intersect() quebra". Não narre a mudança.
- Ao alterar código perto de um comentário, atualize-o ou remova-o se ficou falso.

## Proibido

- Falar com o leitor como se ele tivesse pedido a mudança: "você", "seu", "conforme solicitado", "como você definiu", "mantendo o que você pediu".
- Histórico e marcadores de diff: "Nova rota", "// <-- adicionado", "antes era X", "corrigido", "refatorado", "agora usa Y". Isso vai na mensagem de commit.
- Referência à IA, à sessão ou à tarefa: "Claude", "o agente", "nesta conversa", "conforme o plano".
- Código comentado (o git guarda o histórico) e `TODO` sem contexto. Um `TODO` diz o que falta e por quê.

## Exemplos

```php
// Ruim: tom de assistente e histórico de mudança
'max:150',      // Mantendo o limite que você definiu
Route::post('/orders/{order}/cancel', 'cancel'); // <-- Nova rota

// Bom: explica uma restrição externa que o código sozinho não mostra
// A API do fornecedor limita a 60 requisições por minuto por chave; o resultado
// fica em cache por CEP para a tela de checkout não estourar o limite.

// Bom: invariante que evita regressão
// toBase() garante uma Collection comum mesmo quando vazia; uma Eloquent Collection
// vazia quebraria o intersect() logo abaixo.
```
