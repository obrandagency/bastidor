# Configuração do Bastidor (etapa 2)

Passos feitos uma vez, nos painéis do GitHub, do Supabase, do Resend e da Vercel. Nenhuma chave secreta deve ser colada no chat.

## 1. GitHub: chaves para criar as tabelas

O GitHub aplica as migrations no Supabase sozinho (`scripts/aplicar-migrations.sh`, pela API do Supabase). Para isso ele precisa de uma chave.

1. **Token do Supabase:** supabase.com → clique no seu avatar → **Account preferences → Access Tokens → Generate new token**. Nome: `GitHub Bastidor`. Copie o token (ele só aparece uma vez).
2. No GitHub: repositório **obrandagency/bastidor → Settings → Secrets and variables → Actions → New repository secret**: `SUPABASE_ACCESS_TOKEN` com o token do passo 1.
3. Aba **Actions → Banco → Run workflow → Run workflow**. Em 1 ou 2 minutos as tabelas estão criadas.

## 2. Resend: envio dos e-mails

O e-mail padrão do Supabase só entrega para quem é membro da organização no Supabase e no máximo 2 por hora. Para convidar o time e os clientes, use o Resend.

1. Crie a conta em resend.com.
2. **Domains → Add Domain:** `obrandagency.com`. O Resend mostra registros DNS (MX, TXT/SPF e DKIM). Cadastre-os onde o domínio está hospedado (Registro.br, Cloudflare, Hostinger etc.) e espere o status ficar **Verified**.
3. **API Keys → Create API Key**, permissão *Sending access*. Copie a chave (começa com `re_`).
4. No Supabase: **Authentication → Emails → SMTP Settings → Enable Custom SMTP**:
   - Sender email: `bastidor@obrandagency.com`
   - Sender name: `Bastidor · O.BRAND`
   - Host: `smtp.resend.com`
   - Port: `465`
   - Username: `resend`
   - Password: a chave `re_...`
5. Em **Authentication → Rate Limits**, suba "Rate limit for sending emails" para 30 por hora.

## 3. Supabase: login

**Authentication → Sign In / Providers → Email**
- Desligue **Allow new users to sign up** (só entra quem for convidado; convites continuam funcionando)

**Authentication → URL Configuration**
- Site URL: `https://bastidor-obrand.vercel.app`
- Redirect URLs: adicione `https://bastidor-obrand.vercel.app/**` e `http://localhost:3000/**`

**Authentication → Emails → Templates.** Troque assunto e corpo de três modelos (copie exatamente, inclusive o que está entre `{{ }}`):

### Invite user

Assunto: `Seu acesso ao Bastidor`

```html
<h2>Você foi convidado para o Bastidor</h2>
<p>A O.BRAND liberou o seu acesso. Clique no botão para entrar:</p>
<p><a href="{{ .SiteURL }}/auth/confirmar?token_hash={{ .TokenHash }}&type=invite" style="display:inline-block;background:#1E4BFF;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">Aceitar convite</a></p>
<p>Se o link expirar, peça um novo à O.BRAND.</p>
```

### Magic Link

Assunto: `Seu link de acesso ao Bastidor`

```html
<h2>Entrar no Bastidor</h2>
<p>Clique no botão para entrar. Não precisa de senha.</p>
<p><a href="{{ .SiteURL }}/auth/confirmar?token_hash={{ .TokenHash }}&type=email" style="display:inline-block;background:#1E4BFF;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">Entrar</a></p>
<p>Se você não pediu este link, ignore este e-mail.</p>
```

### Reset Password

Assunto: `Criar nova senha no Bastidor`

```html
<h2>Nova senha</h2>
<p>Clique no botão para criar uma nova senha:</p>
<p><a href="{{ .SiteURL }}/auth/confirmar?token_hash={{ .TokenHash }}&type=recovery" style="display:inline-block;background:#1E4BFF;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">Criar nova senha</a></p>
<p>Se você não pediu, ignore este e-mail. A sua senha atual continua valendo.</p>
```

## 4. Vercel: variáveis do servidor

Projeto **bastidor-obrand → Settings → Environment Variables**:

| Name | Value |
|---|---|
| `NEXT_PUBLIC_SITE_URL` | `https://bastidor-obrand.vercel.app` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → **Project Settings → API Keys** → chave secreta (`sb_secret_...`, ou a *service_role* na aba Legacy) |

Depois: **Deployments → … → Redeploy**.

## 5. Primeira Sócia e cliente de teste

Só entra quem tem convite. O primeiro convite é feito no Supabase → **SQL Editor → New query**. Troque o e-mail e rode:

```sql
insert into public.convites (email, nome, iniciais, cargo, perfil)
values (lower('EMAIL-DA-MAYARA'), 'Mayara', 'MA', 'Estratégia e tráfego', 'socio');

-- dois clientes de teste para conferir que um não vê o outro (apagar depois do teste)
insert into public.clients (nome, nome_curto) values ('Cliente Teste A', 'TESTE A'), ('Cliente Teste B', 'TESTE B');
```

Depois: **Authentication → Users → Add user → Send invitation**, com o mesmo e-mail. A Mayara recebe o convite, cria a senha e, em **Configurações**, convida o resto do time.
