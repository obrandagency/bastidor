# Bastidor

Sistema da O.BRAND para produção e aprovação de conteúdo. A especificação está em `SPEC.md` e a referência visual em `prototipo-bastidor.html` (só referência, dados de exemplo). Construímos uma etapa da "Ordem de construção" por vez e testamos no navegador antes de seguir.

## Stack

Next.js 15 (App Router, TypeScript) + Tailwind 4 + Supabase (Postgres, Auth, Storage) + Vercel + Resend.

## Comandos

- `npm run dev`: servidor local
- `npm run build`: build de produção (rodar antes de cada commit)
- `npm run lint`
- `scripts/testar-banco.sh`: aplica as migrations num Postgres vazio e roda os testes de RLS (`supabase/tests/rls.sql`). Precisa de `PGHOST`, `PGPORT`, `PGUSER`. Roda também no GitHub Actions a cada push

## Convenções

- Todo texto da interface em português; datas dd/mm; fuso America/Sao_Paulo
- Nomes de arquivos, componentes e funções em português (`menu-lateral.tsx`, `criarClienteServidor`)
- Cores e fontes vêm dos tokens em `src/app/globals.css` (copiados do protótipo). Usar `bg-accent`, `text-muted`, `border-line` etc., nunca hex solto
- Fontes: Bricolage Grotesque (títulos, `font-display`), IBM Plex Sans (texto), IBM Plex Mono (números, `font-mono`)
- Tema único, fundo branco. Sem modo escuro
- Tem que funcionar no celular (o cliente aprova pelo telefone)
- Nenhuma chave secreta no navegador. Só `NEXT_PUBLIC_*` vai para o cliente; a service role fica só no servidor

## Estrutura

```
src/app/(time)/      telas do time, com menu lateral (inicio, tarefas, criacao, clientes, ver-como-cliente, configuracoes)
src/app/portal/      portal do cliente (aprovar, relatorio)
src/components/      componentes compartilhados
src/lib/permissoes.ts  o que cada perfil vê no menu (a regra real fica na RLS)
src/app/entrar/      entrada do time (senha), do cliente (link mágico) e "esqueci a senha"
src/app/auth/confirmar/  destino dos links de e-mail (token_hash + type)
src/app/verificacao-acesso/  página que lê cada tabela com a sessão de quem está logado e marca o que o perfil não deveria ver (teste de RLS em produção)
src/app/(time)/clientes/  lista, cadastro (novo, [id]/editar) e Central do cliente ([id]); ações em acoes.ts
src/app/(time)/tarefas/  quadro (quadro.tsx), detalhe (detalhe-tarefa.tsx, usado também no Início), formulários (detalhe.tsx), filtros e ações
src/app/(time)/crm/      funil (quadro-leads.tsx), ficha e novo lead (ficha.tsx), lista e origem (page.tsx); regras em src/lib/dominio/crm.ts
src/app/(time)/chat/     canais e conversa ao vivo (conversa.tsx: Realtime, anexos, menções)
src/app/(time)/inicio/   calendário (calendario.tsx, só desenha) e resumo do dia (page.tsx busca os dados)
src/app/portal/telas.tsx  telas do portal (TelaAprovar, TelaRelatorio) usadas pelo cliente e por "Ver como cliente"; interativos.tsx tem carrossel e botões de decisão
src/app/(time)/criacao/  Criação (page.tsx busca, editor.tsx desenha; artes vão do navegador direto ao Storage e depois registrarArte)
src/lib/notificacoes.ts  rotinas de e-mail (service role): avisarClientesParaAprovar, enviarLembretes, enviarAvisosPendentes, enviarResumoDiario; modelos em src/lib/email/
src/lib/artes.ts     linksDasArtes(): links temporários (1h) gerados com a sessão de quem vê
src/lib/dominio/tarefas.ts  etapas, formatos, áreas, próxima etapa, atraso, fuso de publicação (o mesmo que o banco)
src/lib/datas.ts     hojeSP(), dataBR(), diaMes(), mesPorExtenso() (sempre fuso de São Paulo)
src/lib/sessao.ts    pessoaAtual(), exigirTime(perfis?), exigirCliente()
src/lib/supabase/    clientes do navegador, do servidor, admin (service role, só servidor) e middleware
src/middleware.ts    renova a sessão e manda quem não está logado para /entrar (precisa ficar dentro de src/)
supabase/migrations/ banco versionado; aplicado no Supabase pelo GitHub Actions (.github/workflows/banco.yml + scripts/aplicar-migrations.sh, pela API de gerenciamento com SUPABASE_ACCESS_TOKEN) ao chegar na main. Migration já aplicada nunca é editada: mudança vira migration nova
docs/configuracao.md passo a passo dos painéis (GitHub, Resend, Supabase, Vercel)
docs/seguranca.md    revisão de segurança e LGPD da etapa 7 (o que foi conferido e o que falta nos painéis)
supabase/tests/      stub-supabase.sql (imitação mínima do Supabase) e rls.sql (um usuário de cada perfil)
```

## Banco e acesso

- Toda tabela nova precisa de RLS e de casos em `supabase/tests/rls.sql`. Nunca dar acesso do cliente a tabelas: o portal usa funções do banco
- Funções `meu_perfil()`, `meu_cliente()`, `e_time()`, `e_gestao()` (sócio ou adm), `e_socio()` nas políticas, sempre como `(select public.e_time())`
- `anon` não tem acesso a nada no schema public
- Só entra quem tem linha em `convites`: o gatilho em `auth.users` cria o `profiles` a partir do convite e recusa e-mails sem convite
- Perfil, cliente e ativo só mudam pelo Sócio (Adm só entre pessoas de cliente), garantido pelo gatilho `proteger_perfil`; sempre sobra pelo menos um Sócio ativo
- Pessoa desativada (`ativo = false`) perde todo o acesso, mesmo com sessão aberta
- Artes no bucket privado `artes`, caminho `client_id/task_id/arquivo`; o cliente só lê arte de conteúdo dele em Com o cliente, Ajuste, Aprovado ou Agendado (`cliente_ve_arte`)
- Portal: funções `portal_resumo`, `portal_conteudos`, `portal_relatorio`, `portal_servicos` (leitura; Sócio e Adm passam `p_client_id`) e `portal_aprovar`, `portal_pedir_ajuste` (só perfil cliente). Aprovar avisa os Adm; pedir ajuste avisa o responsável (tabela notifications)
- Links de e-mail usam os modelos do Supabase com `{{ .SiteURL }}/auth/confirmar?token_hash={{ .TokenHash }}&type=...`

## Decisões tomadas (21 e 22/10/2026)

Desvios ou complementos do SPEC aprovados pela Mayara:

1. **Sem CAIXA ALTA:** títulos de conteúdo e de demanda ficam como foram digitados (o SPEC pedia CAIXA ALTA na pauta)
2. **Três tabelas além das nove do SPEC:** `stage_defaults` (responsável padrão por etapa), `app_settings` (dias até o lembrete, padrão 2) e `notifications` (sino + fila de e-mails)
3. **E-mail "conteúdos para aprovar":** um e-mail por cliente às 17h com tudo enviado no dia, mais um botão "Notificar o cliente agora" que dispara na hora
4. **Ajuste manual pelo time:** o time pode mover para Ajuste (ex.: pedido que chegou pelo WhatsApp). Isso NÃO conta no limite do contrato; só conta pedido feito pelo portal
5. **Criação na Central do cliente:** só leitura (briefing, tom de voz, identidade, acessos, atas). Não vê contrato
6. **Cliente não lê a tabela `tasks`:** RLS filtra linhas, não colunas. O portal usa funções do banco (`portal_resumo`, `portal_conteudos`, `portal_servicos`, `portal_aprovar`, `portal_pedir_ajuste`) que devolvem só campos seguros
7. **Ver como cliente:** funções de leitura do portal aceitam `client_id` para sócio e adm; funções de escrita só aceitam perfil cliente
8. **Contador de ajustes calculado:** conta `task_events` com origem = cliente e para_etapa = ajuste no mês (fuso SP). Zera sozinho no dia 1
9. **Regras de etapa no banco (gatilhos):** responsável padrão em conteúdo, `enviado_cliente_em`, Ajuste só volta para Revisão interna, Agendado exige `publicar_em`, todo movimento gera `task_events`
10. **Rotinas agendadas:** `pg_cron` + `pg_net` do Supabase chamando `/api/cron/*` com `CRON_SECRET` (o cron gratuito da Vercel só roda 1x por dia sem hora exata)
11. **Menu da Fase 1:** Início, Tarefas, Criação, Central do cliente, Ver como cliente (sócio e adm), Configurações (sócio). Módulos fora da Fase 1 do protótipo não são construídos
12. **Convites:** tabela `convites` (13ª tabela) guarda nome, perfil e cliente de quem foi convidado; o perfil nasce dela

## Andamento

- [x] Etapa 1: base do projeto, visual, menu lateral, telas vazias. Publicado e testado na Vercel (projeto `bastidor-obrand`, time `obrand-agency`), deploy automático a cada push na `main`. O `vercel.json` fixa o framework Next.js (sem ele o deploy dava 404) e a região `iad1` (a mesma do Supabase, us-east-1)
- [x] Etapa 2: login e perfis. Aprovada em 22/10: Resend (bastidor@obrandagency.com) ligado ao Supabase, modelos de e-mail em português, Mayara entrou como Sócia, e `/verificacao-acesso` deu tudo ✓ para Sócia, Criação (Lucas) e cliente de teste. Os clientes "Cliente Teste A/B" e as pessoas de teste ficam até o piloto e depois são apagados
- [x] Etapa 3: clientes, contratos e Central do cliente. Aprovada em 23/10: testada no navegador pela Mayara e clientes reais cadastrados
- [ ] Etapa 4: tarefas. Código pronto: quadros de Conteúdos e Demandas (arrastar, seta, filtros), detalhe lateral (?tarefa=id) com campos, agendamento, comentários e histórico, nova tarefa (?nova=1), responsável padrão em Configurações; regras no gatilho `regras_de_etapa` e histórico em `registrar_etapa`. Testada no navegador pela Mayara em 23/10; semana de uso pelo time em andamento (critério do SPEC)
- [ ] Etapa 5: início. Código pronto: Calendário do mês (dia do prazo ou da publicação, cores por situação, faixa de atraso, filtro por pessoa com contagem, navegação de mês) e Resumo do dia (atrasadas e vencendo hoje, esperando o cliente há N dias, próximas publicações); clicar abre o mesmo detalhe de Tarefas. Falta teste no navegador
- [ ] Etapa 6: criação e portal. Código pronto: Criação (lista em produção, artes com envio direto ao Storage, ordem e remoção, legenda com contador, ajustes internos e do cliente, prévia do feed), portal (aprovar com carrossel, pedir ajuste com aviso de limite, histórico recente, relatório de entregas por mês) e Ver como cliente (mesmas telas, sem decidir). Falta: testar com um cliente piloto por um mês
- [ ] Etapa 7: notificações e revisão de segurança. Código pronto: e-mails (Resend) para aprovar às 17h + "Notificar o cliente agora", lembrete às 10h (1 por dia por cliente, dias configuráveis), avisos do time a cada 5 min (aprovou, ajuste, você recebeu), resumo diário às 8h; sino (/avisos), Minha conta (/conta) com opção de desligar e-mails; rotinas por pg_cron + pg_net + Vault chamando /api/cron/<rotina>; revisão de segurança em docs/seguranca.md; /privacidade e /termos (rascunho); exportar e apagar cliente (LGPD); backup semanal por GitHub Actions. Falta: configurar Resend, CRON_SECRET e Vault (docs/configuracao.md seção 6) e ver os e-mails chegando

## Depois da Fase 1

- [ ] CRM (26/10): Sócio e Adm editam; Criação e cliente não veem. Funil de 7 etapas (arrastar, seta; Perdido pede motivo), lista, origem dos leads, ficha lateral com histórico automático, "Virar cliente" cria o cliente na Central. Follow-ups no calendário do Início, no Resumo do dia e no resumo das 8h. Serviços: Social media, Tráfego pago, Branding, Identidade visual, Vídeo, Endomarketing, Outros. Sem importação de leads. Falta teste no navegador
- [ ] Chat interno (27/10): só o time (cliente nunca vê). Começa com #geral; Sócio e Adm criam e arquivam canais (opcionalmente ligados a um cliente). Tempo real pelo Supabase Realtime (tabela chat_mensagens na publicação supabase_realtime), não lidas por canal e no menu, @menção avisa só no sino, editar a própria mensagem, apagar a própria (Sócio apaga qualquer), anexos até 25 MB no bucket privado "chat". Uso do armazenamento em Configurações (plano gratuito: 1 GB). Falta teste no navegador
- [ ] Dashboards e relatório de métricas (28/10): Dashboards para todo o time (conteúdos do mês, aprovados de primeira, atraso, ajustes, funil, ajustes por cliente, tempo de aprovação, carga por pessoa, demandas por área, horas por cliente, por cliente). Relatório de métricas preenchido pela agência em /clientes/[id]/metricas (Instagram, tráfego pago, destaques, leitura), rascunho ou publicado; publicar avisa o cliente por e-mail; aba Métricas no portal e no Ver como cliente (portal_metricas só devolve publicado). Automático pela API da Meta quando o app for aprovado. Gráficos em src/components/graficos.tsx (uma série, azul da marca). Falta teste no navegador
- [ ] Pendentes de decisão: valor do contrato (Adm vê? Virar cliente cria contrato com o valor?) e avisos por WhatsApp (quem recebe, API oficial da Meta, número exclusivo)
