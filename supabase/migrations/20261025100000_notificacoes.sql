-- Bastidor · Fase 1 · notificações (etapa 7)

-- ---------------------------------------------------------------- quando o cliente foi avisado do conteúdo
-- Vazio = ainda não avisado. Volta a ficar vazio cada vez que o conteúdo é reenviado ao cliente.
alter table public.tasks add column aviso_cliente_em timestamptz;

-- ---------------------------------------------------------------- registro de e-mails enviados
-- Evita repetir lembrete e resumo no mesmo dia e mostra o que saiu (ou falhou)
create table public.envios_email (
  id bigint generated always as identity primary key,
  tipo text not null,
  client_id uuid references public.clients (id) on delete cascade,
  destinatario_id uuid references public.profiles (id) on delete cascade,
  email text not null,
  assunto text not null,
  ok boolean not null,
  erro text,
  created_at timestamptz not null default now()
);
create index on public.envios_email (tipo, client_id, created_at);
create index on public.envios_email (tipo, destinatario_id, created_at);
alter table public.envios_email enable row level security;
create policy envios_ler on public.envios_email for select to authenticated using ((select public.e_gestao()));
revoke insert, update, delete on public.envios_email from authenticated;

-- ---------------------------------------------------------------- regras de etapa (mesma de antes + aviso ao cliente)
create or replace function public.regras_de_etapa() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  padrao uuid;
begin
  new.updated_at := now();

  if tg_op = 'INSERT' then
    new.criado_por := coalesce(new.criado_por, auth.uid());
    if new.etapa = 'agendado' then
      raise exception 'Uma tarefa nova não começa em Agendado' using errcode = '23514';
    end if;
  end if;

  if tg_op = 'UPDATE' and old.etapa = 'ajuste' and new.etapa <> 'ajuste' and new.etapa <> 'revisao' then
    raise exception 'Depois de Ajuste o conteúdo volta para Revisão interna' using errcode = '23514';
  end if;

  if tg_op = 'UPDATE' and old.etapa = 'agendado' and new.etapa <> 'agendado'
     and new.publicar_em is not distinct from old.publicar_em then
    new.publicar_em := null;
  end if;

  if new.publicar_em is not null then
    if new.tipo <> 'conteudo' or new.etapa not in ('aprovado', 'agendado') then
      raise exception 'Só conteúdo aprovado recebe data de publicação' using errcode = '23514';
    end if;
    new.etapa := 'agendado';
  end if;

  if tg_op = 'INSERT' or new.etapa is distinct from old.etapa then
    if new.tipo = 'conteudo' and (tg_op = 'UPDATE' or new.responsavel_id is null) then
      select responsavel_id into padrao from public.stage_defaults where etapa = new.etapa;
      if padrao is not null then
        new.responsavel_id := padrao;
      end if;
    end if;
    if new.etapa = 'cliente' then
      new.enviado_cliente_em := now();
      new.aviso_cliente_em := null; -- entra no próximo e-mail "conteúdos para aprovar"
    end if;
  end if;

  return new;
end
$$;

-- ---------------------------------------------------------------- "Você recebeu": aviso ao novo responsável
create function public.avisar_responsavel() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.responsavel_id is null or new.responsavel_id = auth.uid() then
    return null;
  end if;
  if tg_op = 'UPDATE' and new.responsavel_id is not distinct from old.responsavel_id then
    return null;
  end if;
  -- Pedido de ajuste do cliente já gera o aviso próprio (portal_pedir_ajuste)
  if public.meu_cliente() is not null then
    return null;
  end if;
  insert into public.notifications (destinatario_id, tipo, task_id, client_id, texto, link)
  values (
    new.responsavel_id, 'responsavel', new.id, new.client_id,
    'Você recebeu: ' || new.titulo || coalesce(', prazo ' || to_char(new.prazo, 'DD/MM'), ''),
    '/tarefas?aba=' || new.tipo || '&tarefa=' || new.id
  );
  return null;
end
$$;

create trigger avisar_responsavel
after insert or update on public.tasks
for each row execute function public.avisar_responsavel();

-- ---------------------------------------------------------------- rotinas agendadas
-- O Supabase (pg_cron + pg_net) chama /api/cron/<rotina> no site com o segredo CRON_SECRET.
-- Endereço e segredo ficam no Vault (fora do código): bastidor_url e bastidor_cron_secret.
create function public.chamar_rotina(p_rotina text) returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  v_url text;
  v_segredo text;
  v_id bigint;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'bastidor_url';
  select decrypted_secret into v_segredo from vault.decrypted_secrets where name = 'bastidor_cron_secret';
  if v_url is null or v_segredo is null then
    raise notice 'Rotinas do Bastidor sem configuração no Vault';
    return null;
  end if;
  select net.http_post(
    url := rtrim(v_url, '/') || '/api/cron/' || p_rotina,
    headers := jsonb_build_object('Authorization', 'Bearer ' || v_segredo, 'Content-Type', 'application/json'),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  ) into v_id;
  return v_id;
end
$$;
revoke execute on function public.chamar_rotina(text) from public, anon, authenticated;

-- Horários em UTC (São Paulo = UTC-3). Só agenda onde as extensões existem (no Supabase, sim).
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron')
     and exists (select 1 from pg_available_extensions where name = 'pg_net') then
    create extension if not exists pg_cron;
    create extension if not exists pg_net;
    perform cron.schedule('bastidor-avisos', '*/5 * * * *', 'select public.chamar_rotina(''avisos'')');       -- avisos do time, a cada 5 min
    perform cron.schedule('bastidor-resumo', '0 11 * * *', 'select public.chamar_rotina(''resumo'')');        -- 8h: resumo diário do time
    perform cron.schedule('bastidor-lembretes', '0 13 * * *', 'select public.chamar_rotina(''lembretes'')');  -- 10h: lembrete de aprovação
    perform cron.schedule('bastidor-aprovacao', '0 20 * * *', 'select public.chamar_rotina(''aprovacao'')');  -- 17h: conteúdos para aprovar
  end if;
end
$$;

-- ---------------------------------------------------------------- revisão de segurança: execução de funções
-- O padrão do Postgres libera toda função nova para PUBLIC. A regra "in schema" da migration de perfis
-- não remove essa liberação; esta (sem "in schema") remove, para as funções criadas daqui em diante.
alter default privileges for role postgres revoke execute on functions from public;
revoke execute on all functions in schema public from public, anon;
