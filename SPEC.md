# Bastidor · Especificação da Fase 1

21/10/2026 · Mayara (O.BRAND)

> Referência visual e de fluxo: o arquivo `prototipo-bastidor.html` nesta mesma pasta. Abra no navegador para ver telas, cores e comportamento. Ele é só referência: usa dados de exemplo e não tem banco.

## Visão geral

A Fase 1 do Bastidor tira a operação de conteúdo da O.BRAND do WhatsApp e das planilhas: o time produz e acompanha tudo num lugar só, e o cliente aprova pelo próprio portal. Nome provisório: Bastidor.

**Problema que resolve**

- Ninguém sabe com clareza quem está com cada demanda e o que está atrasado
- Aprovação de conteúdo se perde em conversa de WhatsApp
- O cliente não vê o que foi entregue no mês nem quantos ajustes já pediu
- Informação do cliente (briefing, tom de voz, acessos) fica espalhada

**Usuários**

- Time da agência: 4 pessoas hoje (Mayara, Renan, Gabi, Lucas)
- Clientes: as pessoas de cada conta que aprovam conteúdo (podem ser mais de uma por cliente)

**Entra na Fase 1**

1. Login e perfis de acesso (time e cliente)
2. Cadastro de clientes e contratos (só o escopo: conteúdos e ajustes por mês)
3. Tarefas: conteúdos com fluxo de 8 etapas e demandas da agência com fluxo de 4 etapas
4. Calendário do mês no Início, com responsável de cada demanda
5. Criação: legenda com prévia do feed e ajustes internos e do cliente
6. Central do cliente: briefing, tom de voz, identidade, acessos e atas
7. Portal do cliente: aprovação, pedido de ajuste e relatório de entregas
8. Limite de ajustes por contrato
9. Lembrete de aprovação e avisos por e-mail

**Fica de fora (fases seguintes)**

CRM, financeiro, tarefas recorrentes, onboarding, Google Agenda, publicação automática no Instagram e Facebook, relatório de métricas, IA nas legendas, rentabilidade, dashboards, chat, academy, white label. Durante a Fase 1, o agendamento continua no Pode Postar. O protótipo mostra esses módulos, mas eles NÃO devem ser construídos agora.

## Como usar este documento no Claude Code

1. Este arquivo fica na raiz do projeto como `SPEC.md`, junto com `prototipo-bastidor.html`
2. Na primeira conversa, peça: *"Leia o SPEC.md e o prototipo-bastidor.html e me proponha a estrutura do projeto e o modelo de banco antes de escrever código"*
3. Revise a proposta, depois peça uma etapa da ordem de construção por vez
4. Ao fim de cada etapa, teste no navegador antes de seguir
5. Peça para manter um `CLAUDE.md` com as decisões do projeto

**Stack sugerida**

| Peça | Ferramenta | Para quê |
| --- | --- | --- |
| Aplicação web | Next.js + TypeScript | Telas do time e portal do cliente no mesmo projeto |
| Banco e login | Supabase (Postgres + Auth + Storage) | Dados, login por e-mail, arquivos das artes, regras de acesso por linha (RLS) |
| Hospedagem | Vercel | Publicar o sistema com domínio próprio |
| E-mails | Resend (ou o envio do próprio Supabase) | Convites, avisos e lembretes |
| Visual | Tailwind CSS | Reproduzir o protótipo: fundo branco, preto e azul |

**Contas necessárias:** GitHub, Supabase, Vercel e o serviço de e-mail. Começar nos planos gratuitos.

**Em paralelo:** verificação da empresa no Meta Business Manager e criação do app de desenvolvedor da Meta (necessário na Fase 2).

## Perfis de acesso

São quatro perfis, e a regra que não pode falhar é: **um cliente nunca vê nada de outro cliente nem nada interno da agência.** Essa regra vale no banco (RLS do Supabase), não só escondendo botões na tela.

| Área | Sócio | Administrativo | Criação | Cliente |
| --- | --- | --- | --- | --- |
| Início e calendário do mês | Sim | Sim | Sim | Não |
| Tarefas (conteúdos e demandas) | Sim | Sim | Sim | Não |
| Criação | Sim | Sim | Sim | Não |
| Central do cliente | Sim | Sim | Sim, sem dados do contrato | Não |
| Contratos (escopo e limite de ajustes) | Editar | Ver | Não | Não |
| Cadastro de clientes e de pessoas | Editar | Editar | Não | Não |
| Configurações e perfis | Editar | Não | Não | Não |
| Portal do próprio cliente | Ver como cliente | Ver como cliente | Não | Sim |

**Regras**

- O time entra com e-mail e senha. O Sócio convida pessoas e define o perfil
- O cliente recebe um convite por e-mail e entra por link mágico (sem senha), ligado a um único cliente
- No portal, o cliente vê só conteúdos nas etapas Com o cliente, Ajuste, Aprovado e Agendado. Pauta, rascunho, comentários internos e horas nunca aparecem
- Mayara e Renan começam como Sócio; Gabi como Administrativo; Lucas como Criação
- "Ver como cliente" abre o portal com os dados daquele cliente, sem permitir aprovar em nome dele

## Modelo de dados

Nove tabelas cobrem a Fase 1. Toda tabela ligada a um cliente tem `client_id`, e é por ele que as regras de acesso separam um cliente do outro.

| Tabela | Campos principais | Observações |
| --- | --- | --- |
| `profiles` | id, nome, e-mail, iniciais, cargo, perfil (socio, adm, criacao, cliente), client_id | client_id só para perfil cliente |
| `clients` | id, nome, @ do Instagram, cor, nome curto, ativo | Nome curto aparece no calendário (ex.: ÓTICA BARBOSA) |
| `contracts` | client_id, início, fim, conteúdos por mês, ajustes por mês | Valor da mensalidade só entra na Fase 2 |
| `client_briefs` | client_id, negócio, público, objetivo, tom de voz (lista), o que evitar, cores (lista), acessos (lista com status) | Nunca guardar senhas aqui |
| `meeting_notes` | client_id, data, resumo, autor | Atas da Central do cliente |
| `tasks` | id, tipo (conteudo, demanda), client_id (ou interno), título, formato, área, etapa, responsável, prazo, legenda ou descrição, data de publicação, enviado ao cliente em, horas | Uma tabela para os dois tipos; formato só em conteúdo, área só em demanda |
| `task_assets` | task_id, arquivo, ordem | Artes do post (imagem, carrossel, vídeo) no Storage |
| `task_notes` | task_id, tipo (interno, cliente), texto, autor, resolvido | Ajustes internos e pedidos do cliente |
| `task_events` | task_id, de etapa, para etapa, quem, quando | Histórico; base do relatório de entregas e da contagem de ajustes |

**Valores fixos**

- Etapas de conteúdo: pauta, copy, layout, revisão interna, com o cliente, ajuste, aprovado, agendado
- Etapas de demanda: a fazer, fazendo, em validação, concluído
- Formatos: Carrossel, Reels, Estático, Stories
- Áreas de demanda: Tráfego pago, Atendimento, Comercial, Branding, Financeiro, Administrativo, Interno

**Responsável padrão por etapa de conteúdo** (configurável pelo Sócio)

| Etapa | Responsável padrão |
| --- | --- |
| Pauta | Mayara |
| Copy | Renan |
| Layout | Lucas |
| Revisão interna | Mayara |
| Com o cliente | Gabi |
| Ajuste | Lucas |
| Aprovado | Gabi |
| Agendado | Gabi |

## Telas do time

Quatro telas internas, todas no fundo branco com menu lateral branco e o azul só nos destaques, como no protótipo.

### Início

- Abre na aba **Calendário do mês**; segunda aba **Resumo do dia**
- Calendário: cada demanda aparece no dia do prazo, ou no dia da publicação se já estiver agendada
- Cada item mostra as iniciais do responsável, o nome curto do cliente e o título
- Cor pela situação: em produção (cinza), com o cliente (amarelo), ajuste (vermelho claro), aprovado ou concluído (verde), agendado (azul). Atrasado ganha faixa vermelha à esquerda
- Filtro por pessoa no topo, com a contagem do mês de cada um
- Navegação entre meses e botão Hoje; clicar num item abre o detalhe
- Resumo do dia: atrasados e vencendo hoje, esperando o cliente (há quantos dias) e próximas publicações

### Tarefas

- Duas abas: **Conteúdos** (8 etapas) e **Demandas da agência** (4 etapas), cada uma em quadro com colunas
- Arrastar o card entre colunas ou usar a seta muda a etapa
- Em conteúdo, mudar de etapa passa o card para o responsável padrão daquela etapa. Em demanda, o responsável só muda manualmente
- Mover para Com o cliente grava a data de envio e avisa o cliente (ver Notificações)
- Ninguém arrasta para Agendado: o conteúdo só vai para Agendado quando recebe data e hora de publicação
- Avançar a partir de Ajuste leva de volta para Revisão interna, nunca direto para Aprovado
- Filtros por cliente e por responsável
- Atrasado = prazo vencido e fora das etapas Com o cliente, Aprovado, Agendado e Concluído
- Título de pauta é salvo sempre em CAIXA ALTA
- Detalhe da tarefa (painel lateral): título, etapa, responsável, cliente, formato ou área, prazo, horas, legenda ou descrição, artes, comentários e histórico

### Criação

- Escolhe o cliente; à esquerda, os conteúdos dele em produção
- Centro: legenda com contador até 2.200 caracteres, upload das artes e duas abas de ajustes: internos e do cliente
- Ajuste pode ser marcado como resolvido
- Direita: prévia do feed do Instagram com o post atual em destaque, seguido dos já aprovados e agendados. A legenda aparece embaixo enquanto é digitada

### Central do cliente

- Briefing: o negócio, público, objetivo com o marketing
- Tom de voz: palavras que descrevem a marca e o que evitar
- Identidade: cores em hexadecimal; logo e manual ficam como link para a pasta do Drive
- Acessos: lista do que já foi liberado (Instagram, Meta Business, Drive, site), sem senhas
- Contrato: conteúdos por mês, ajustes usados no mês de um total, vigência
- Atas: resumo e data de cada reunião

## Portal do cliente

O cliente entra pelo link do convite e cai num portal com a marca da agência e duas abas: **Aprovar conteúdos** e **Relatório de entregas**. Todo pedido de ajuste volta para o time como tarefa, sem ninguém precisar repassar.

**Fluxo de aprovação**

```
Revisão interna → Com o cliente → [Cliente decide]
                    (lembrete após 2 dias)     ├─ aprova ──────→ Aprovado → (Gabi agenda no Pode Postar) → Agendado
                                               └─ pede ajuste ─→ Ajuste (contador do mês +1) → volta para Revisão interna
```

O ajuste não volta direto ao cliente: passa de novo pela revisão interna antes de ser reenviado.

### Aprovar conteúdos

- Mostra os conteúdos na etapa Com o cliente: arte (com carrossel navegável), legenda, formato e data prevista
- **Aprovar:** move para Aprovado, registra quem aprovou e quando, e avisa a Gabi
- **Pedir ajuste:** abre um campo de texto obrigatório. Ao enviar, cria um ajuste do tipo cliente, move para Ajuste, passa para o responsável padrão e soma 1 no contador de ajustes do mês
- Histórico recente embaixo: o que foi aprovado e o que está em ajuste
- Na Fase 1, depois de aprovado, a Gabi agenda no Pode Postar e registra data e hora no Bastidor, o que move para Agendado

### Limite de ajustes

- O contrato define quantas rodadas de ajuste o cliente tem por mês
- O topo do portal mostra "Ajustes do mês: X de Y"
- Quando X já é igual a Y, o pedido de ajuste continua permitido, mas mostra o aviso: "Você já usou os Y ajustes do mês previstos no contrato. Este pedido pode ser cobrado à parte."
- O contador zera no dia 1 de cada mês
- O time vê o mesmo contador na Central do cliente

### Relatório de entregas

- Calculado em tempo real a partir das tarefas, sem trabalho manual
- Topo: conteúdos publicados ou agendados no mês contra o total do contrato, com barra de progresso; conteúdos em produção; ajustes usados
- Lista de conteúdos do mês com status em linguagem do cliente: Em produção, Aguardando você, Em ajuste, Aprovado, Agendado, Publicado (agendado com data já passada)
- Outros serviços do mês (demandas da agência ligadas ao cliente): só título, área e Em andamento ou Concluído
- Seletor de mês para ver meses anteriores

## Notificações e lembretes

Na Fase 1 tudo sai por e-mail; WhatsApp fica para a Fase 3. Cada aviso tem um sino dentro do sistema também.

| Quando | Quem recebe | Mensagem |
| --- | --- | --- |
| Conteúdo vai para Com o cliente | Pessoas do cliente | "Você tem N conteúdos para aprovar", com botão para o portal. Agrupa os envios do mesmo dia num e-mail só |
| Conteúdo parado em Com o cliente há X dias | Pessoas do cliente | Lembrete de aprovação. X configurável (padrão 2 dias), no máximo 1 lembrete por dia por cliente |
| Cliente aprova | Gabi (perfil Administrativo) | "Cliente aprovou: título" |
| Cliente pede ajuste | Responsável pela etapa Ajuste | O texto do pedido e o link da tarefa |
| Tarefa muda de responsável | Novo responsável | "Você recebeu: título, prazo" |
| Tarefa vence amanhã ou atrasa | Responsável | Resumo diário às 8h, um e-mail por pessoa |

- Lembretes automáticos rodam por uma rotina agendada (cron do Supabase ou da Vercel) uma vez por dia
- Cada pessoa pode desligar os e-mails não essenciais; o cliente não pode desligar o aviso de conteúdo novo

## Segurança, LGPD e qualidade

**Segurança**

- Regras de acesso por linha (RLS) ligadas em todas as tabelas, testadas com um usuário de cada perfil
- Arquivos das artes em bucket privado, com link temporário
- Nenhuma chave secreta no código do navegador; variáveis de ambiente na Vercel
- Senhas e acessos dos clientes nunca dentro do Bastidor; usar um gerenciador de senhas
- Antes de colocar cliente de verdade: revisão de segurança completa

**LGPD**

- Guardar só o necessário: nome e e-mail de quem aprova
- Página de política de privacidade e termo de uso no portal do cliente
- Ao encerrar um contrato: exportar e apagar os dados daquele cliente sob pedido
- Registro de quem aprovou o quê e quando

**Backup**

- Backup diário do banco. Conferir o que o plano escolhido do Supabase oferece; se não tiver, criar uma exportação semanal agendada

**Qualidade**

- Funciona no celular: o cliente aprova principalmente pelo telefone
- Todo texto em português, datas no formato dd/mm e fuso de São Paulo
- Visual igual ao protótipo: branco, preto e azul; fontes Bricolage Grotesque (títulos), IBM Plex Sans (texto) e IBM Plex Mono (números)

## Ordem de construção

Sete etapas, cada uma testável sozinha. Só avance quando a anterior passar no critério de pronto.

1. **Base do projeto:** Next.js, Supabase, Vercel, visual do protótipo, menu lateral
   - Pronto quando: o sistema abre no endereço da Vercel com o menu e as telas vazias
2. **Login e perfis:** login do time, convite de pessoas, os quatro perfis e as regras de acesso
   - Pronto quando: entrando como Lucas, Contratos e Configurações não aparecem; um cliente de teste não consegue ler nada de outro cliente nem pela API
3. **Clientes, contratos e Central do cliente**
   - Pronto quando: os clientes reais estão cadastrados com briefing, tom de voz e limite de ajustes
4. **Tarefas:** as duas abas em quadro, detalhe lateral, responsável automático, histórico de etapas
   - Pronto quando: o time usa por uma semana no lugar do controle atual
5. **Início:** calendário do mês e resumo do dia
   - Pronto quando: dá para responder "o que cada um tem esta semana" só olhando o calendário
6. **Criação e portal do cliente:** upload das artes, prévia do feed, aprovação, ajuste, limite e relatório de entregas
   - Pronto quando: um cliente piloto aprova um mês inteiro pelo portal sem precisar de WhatsApp
7. **Notificações e revisão de segurança**
   - Pronto quando: os e-mails da tabela de notificações chegam e a revisão de segurança não aponta nada grave

**Piloto:** liberar o portal para 2 ou 3 clientes por um mês, ajustar, e só então abrir para todos.

**Perguntas em aberto**

- [ ] Nome definitivo da plataforma e domínio
- [ ] Quais clientes entram no piloto
- [ ] Quem acompanha o desenvolvimento no dia a dia
- [ ] Padrão de ajustes por mês nos contratos atuais
