# Revisão de segurança e LGPD (etapa 7)

25/10/2026. Revisão antes de colocar cliente de verdade no portal. Nada grave pendente no código; restam configurações de painel marcadas como **Fazer**.

## Acesso aos dados (banco)

| Item | Situação | Como é garantido |
|---|---|---|
| Um cliente nunca vê nada de outro cliente nem nada interno | OK | RLS em todas as tabelas; o cliente não lê `tasks`, `task_notes`, `task_events`, contratos, briefing nem atas; o portal usa funções que devolvem só campos seguros |
| Todas as tabelas com RLS | OK | Teste automático em `supabase/tests/rls.sql` (falha se surgir tabela sem RLS) |
| Visitante sem login sem acesso | OK | Teste automático: `anon` sem permissão em tabelas e sem executar funções |
| Funções privilegiadas (security definer) | OK | Todas com `search_path` fixo; teste automático |
| Só entra quem foi convidado | OK | Gatilho em `auth.users` recusa e-mail sem convite; cadastro público desligado no Supabase |
| Troca de perfil | OK | Só o Sócio (Adm só entre pessoas de cliente); sempre sobra um Sócio ativo |
| Pessoa desativada | OK | Perde todo o acesso na hora, mesmo com sessão aberta |
| "Ver como cliente" | OK | Lê como o cliente; aprovar e pedir ajuste só aceitam perfil cliente |
| Histórico de aprovações (LGPD) | OK | `task_events` grava quem aprovou ou pediu ajuste e quando; ninguém escreve nele pela API |
| Testes | OK | 124 verificações rodam a cada push no GitHub Actions |

## Arquivos (artes)

| Item | Situação |
|---|---|
| Bucket `artes` privado, sem link público | OK |
| Link sempre temporário (1 hora; 7 dias só na exportação LGPD) | OK |
| Cliente só abre arte de conteúdo dele que já chegou ao portal | OK (política `cliente_ve_arte`, testada) |
| Só o time envia ou apaga arte | OK |
| Tipos aceitos: JPG, PNG, WEBP, GIF, MP4, MOV, até 50 MB | OK |

## Chat interno (adicionado em 27/10)

| Item | Situação |
|---|---|
| Cliente não vê canais, mensagens nem anexos | OK (RLS e política do bucket `chat`, testadas) |
| Ninguém escreve em nome de outra pessoa nem troca o autor | OK |
| Tempo real respeita a RLS | OK (Supabase Realtime com o token de quem está logado) |
| Anexos em bucket privado, links temporários de 1 hora, até 25 MB | OK |
| Apagar cliente (LGPD) leva os canais ligados a ele, as mensagens e os anexos | OK |

## Chaves e servidor

| Item | Situação |
|---|---|
| Nenhuma chave secreta no navegador | OK: só `NEXT_PUBLIC_SUPABASE_URL` e a chave pública vão para o navegador; service role, Resend e CRON_SECRET só no servidor (conferido por busca no código) |
| Uso da service role | OK: só em convites, reenvio de acesso, lista de acessos (Sócio), apagar cliente (Sócio) e rotinas de e-mail; cada uso confere a permissão antes |
| Rotinas `/api/cron/*` | OK: exigem `CRON_SECRET` (mínimo 24 caracteres, comparação em tempo constante) |
| Cabeçalhos de segurança | OK: sem abrir em iframe, HTTPS obrigatório (HSTS), nosniff, referrer e permissões restritas |
| Redirecionamentos | OK: só para caminhos internos (corrigido em Avisos) |
| Dependências | OK: `npm audit` sem vulnerabilidades (PostCSS forçado para 8.5.31) |
| Senhas e acessos de clientes | OK: o Bastidor não guarda; a Central só marca liberado/pendente |

## LGPD

| Item | Situação |
|---|---|
| Guardar só o necessário | OK: nome e e-mail de quem aprova |
| Política de privacidade e termos de uso no portal | OK: `/privacidade` e `/termos`. **Fazer:** revisão jurídica do texto (rascunho) |
| Exportar e apagar dados de um cliente | OK: Central do cliente → Dados do cliente (LGPD), só Sócio |
| Registro de quem aprovou o quê e quando | OK |
| Fornecedores fora do Brasil (Supabase e Vercel nos EUA, Resend) | Citado na política |

## Backup

O plano gratuito do Supabase não tem backup diário. Exportação semanal automática (`.github/workflows/backup.yml`): todas as tabelas em JSON, guardadas 90 dias como artefato privado do GitHub. As artes não entram (ficam no bucket). Para backup diário com restauração em um clique: plano Pro do Supabase.

## Fazer (painéis)

1. Supabase → Authentication → Sign In / Providers → Email: **Minimum password length = 8** (o app já exige 8, mas a API do Supabase aceita 6 por padrão)
2. Cadastrar `SUPABASE_SERVICE_ROLE_KEY` nos segredos do GitHub para o backup semanal rodar
3. Revisão jurídica de `/privacidade` e `/termos`
4. Antes do piloto: apagar "Cliente Teste A/B" e as pessoas de teste
