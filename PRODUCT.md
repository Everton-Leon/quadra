# PRODUCT.md — [NOME]

> Rascunho para o Impeccable (`/impeccable init` pode ajustar a estrutura). Lido antes de
> qualquer trabalho de design.

## Register
Ferramenta de quadra com cara de esporte, não de software corporativo. Direta, confiante,
com humor de pelada onde cabe (os "Lanterninhas"). Nunca fofa, nunca genérica.

## Platform
Web. A quadra, o placar e o ao vivo são um PWA instalável, usado quase só no celular.
Painel e landing são web responsiva.

## Users
- **Organizador**: em pé na quadra, celular numa mão, entre um ponto e outro. Tem segundos
  para agir e está sendo cobrado pelo grupo. Pode estar sob sol forte, à noite com refletor
  ou sem sinal. Não lê textos: reconhece posições e cores.
- **Marcador do placar**: qualquer jogador que esteja de fora, a cada partida uma pessoa
  diferente. Nunca viu o app. Precisa entender em um olhar.
- **Jogadores (espectadores)**: abrem o link do WhatsApp para ver "quando eu entro?". Leem de
  relance, às vezes de longe (telão).
- **Dono do grupo**: configura o grupo, convida organizadores, paga. Faz isso sentado, com calma.

## Product Purpose
Substituir o caderno de papel da regra "quem ganha fica": fila justa por ordem de chegada,
times montados com teto de mulheres, vencedor fica, perdedor volta para o fim da fila. E
fazer o grupo inteiro acompanhar isso ao vivo, com placar e ranking.

## Principles
- **Um toque, uma ação.** Na quadra, a ação mais comum (declarar o vencedor) é a mais fácil.
- **Nada rouba altura na tela da quadra.** Sem header de site, sem footer.
- **Cor só quando codifica algo** (gênero, estado). Nada decorativo no chip do jogador.
- **O organizador é a autoridade.** O sistema sugere; furar a regra é permitido, com aviso discreto.
- **Erro tem conserto visível.** Desfazer sempre a um toque, dizendo o que desfaz.
- **Destrutivo pede confirmação; o resto não.** Remover e reiniciar confirmam; trocar não.
- **Offline nunca parece quebrado.** Sem sinal é um estado normal, não um erro.
- **A imagem do ranking é a vitrine.** Ela circula no WhatsApp e precisa orgulhar o grupo.

## Accessibility & Inclusion
- Contraste alto o suficiente para ler sob sol direto.
- Alvos de toque grandes (mínimo 48 px; ações principais bem maiores).
- Gênero nunca comunicado só por cor: sempre com um segundo sinal.
- Nomes longos e duplicados são normais: nunca cortar de forma que dois jogadores fiquem iguais.
- Tudo em pt-BR, com a linguagem da quadra ("próximo time", "quem ganha fica").
