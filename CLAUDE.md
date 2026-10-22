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
src/app/(time)/tarefas/  quadro (quadro.tsx), detalhe e nova tarefa (detalhe.tsx), filtros e ações
src/lib/dominio/tarefas.ts  etapas, formatos, áreas, próxima etapa, atraso, fuso de publicação (o mesmo que o banco)
src/lib/datas.ts     hojeSP(), dataBR(), diaMes(), mesPorExtenso() (sempre fuso de São Paulo)
src/lib/sessao.ts    pessoaAtual(), exigirTime(perfis?), exigirCliente()
src/lib/supabase/    clientes do navegador, do servidor, admin (service role, só servidor) e middleware
src/middleware.ts    renova a sessão e manda quem não está logado para /entrar (precisa ficar dentro de src/)
supabase/migrations/ banco versionado; aplicado no Supabase pelo GitHub Actions (.github/workflows/banco.yml + scripts/aplicar-migrations.sh, pela API de gerenciamento com SUPABASE_ACCESS_TOKEN) ao chegar na main. Migration já aplicada nunca é editada: mudança vira migration nova
docs/configuracao.md passo a passo dos painéis (GitHub, Resend, Supabase, Vercel)
supabase/tests/      stub-supabase.sql (imitação mínima do Supabase) e rls.sql (um usuário de cada perfil)
```

## Banco e acesso

- Toda tabela nova precisa de RLS e de casos em `supabase/tests/rls.sql`. Nunca dar acesso do cliente a tabelas: o portal usa funções do banco
- Funções `meu_perfil()`, `meu_cliente()`, `e_time()`, `e_gestao()` (sócio ou adm), `e_socio()` nas políticas, sempre como `(select public.e_time())`
- `anon` não tem acesso a nada no schema public
- Só entra quem tem linha em `convites`: o gatilho em `auth.users` cria o `profiles` a partir do convite e recusa e-mails sem convite
- Perfil, cliente e ativo só mudam pelo Sócio (Adm só entre pessoas de cliente), garantido pelo gatilho `proteger_perfil`; sempre sobra pelo menos um Sócio ativo
- Pessoa desativada (`ativo = false`) perde todo o acesso, mesmo com sessão aberta
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
- [ ] Etapa 5: início
- [ ] Etapa 6: criação e portal
- [ ] Etapa 7: notificações e revisão de segurança
