# Bastidor

Sistema da O.BRAND para produção e aprovação de conteúdo. A especificação está em `SPEC.md` e a referência visual em `prototipo-bastidor.html` (só referência, dados de exemplo). Construímos uma etapa da "Ordem de construção" por vez e testamos no navegador antes de seguir.

## Stack

Next.js 15 (App Router, TypeScript) + Tailwind 4 + Supabase (Postgres, Auth, Storage) + Vercel + Resend.

## Comandos

- `npm run dev`: servidor local
- `npm run build`: build de produção (rodar antes de cada commit)
- `npm run lint`

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
src/lib/supabase/    clientes do navegador e do servidor
supabase/migrations/ banco versionado (a partir da etapa 2)
```

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

## Andamento

- [x] Etapa 1: base do projeto, visual, menu lateral, telas vazias. Falta publicar na Vercel (depende das contas)
- [ ] Etapa 2: login e perfis (o layout do time usa uma pessoa fixa, `PESSOA_PROVISORIA`, até aqui)
- [ ] Etapa 3: clientes, contratos e Central do cliente
- [ ] Etapa 4: tarefas
- [ ] Etapa 5: início
- [ ] Etapa 6: criação e portal
- [ ] Etapa 7: notificações e revisão de segurança
