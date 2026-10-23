-- Lembretes pessoais (botão flutuante): cada pessoa do time vê e mexe só nos seus; o cliente nunca.
-- O aviso é só no navegador (tela, som e notificação do sistema com o Bastidor aberto) e no sino.
-- Sem e-mail: o aviso do sino já nasce com email_enviado_em preenchido.

create table public.lembretes (
  id uuid primary key default gen_random_uuid(),
  dono_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  texto text not null check (char_length(trim(texto)) between 1 and 300),
  quando timestamptz not null,
  repetir text not null default 'nunca' check (repetir in ('nunca', 'diario', 'dias_uteis', 'semanal')),
  client_id uuid references public.clients (id) on delete set null,
  task_id uuid references public.tasks (id) on delete set null,
  avisado_em timestamptz, -- quando entrou no sino (zera ao adiar ou repetir)
  concluido_em timestamptz,
  created_at timestamptz not null default now()
);
create index on public.lembretes (dono_id, quando) where concluido_em is null;
create index on public.lembretes (quando) where concluido_em is null and avisado_em is null;

alter table public.lembretes enable row level security;
create policy lembretes_dono on public.lembretes for all to authenticated
  using (dono_id = (select auth.uid()) and (select public.e_time()))
  with check (dono_id = (select auth.uid()) and (select public.e_time()));
grant select, insert, update, delete on public.lembretes to authenticated;

-- Próxima vez de um lembrete que se repete, mantendo o horário (fuso de São Paulo), depois de agora
create function public.proximo_lembrete(p_quando timestamptz, p_repetir text, p_agora timestamptz default now()) returns timestamptz
language plpgsql stable set search_path = '' as $$
declare
  t timestamp := p_quando at time zone 'America/Sao_Paulo';
  agora timestamp := p_agora at time zone 'America/Sao_Paulo';
begin
  loop
    t := t + case p_repetir when 'semanal' then interval '7 days' else interval '1 day' end;
    continue when p_repetir = 'dias_uteis' and extract(isodow from t) in (6, 7);
    exit when t > agora;
  end loop;
  return t at time zone 'America/Sao_Paulo';
end
$$;

-- Concluir: o que se repete pula para a próxima vez; o resto fica concluído
create function public.concluir_lembrete(p_id uuid) returns void
language plpgsql set search_path = '' as $$
begin
  update public.lembretes
  set quando = case when repetir = 'nunca' then quando else public.proximo_lembrete(quando, repetir) end,
      concluido_em = case when repetir = 'nunca' then now() end,
      avisado_em = null
  where id = p_id; -- a política garante que é do dono
end
$$;

-- Põe no sino os lembretes que chegaram na hora. Com login: só os da pessoa; sem login (pg_cron): todos
create function public.disparar_lembretes() returns integer
language plpgsql security definer set search_path = '' as $$
declare
  n integer;
begin
  with vencidos as (
    update public.lembretes l
    set avisado_em = now()
    where l.concluido_em is null and l.avisado_em is null and l.quando <= now()
      and (auth.uid() is null or l.dono_id = auth.uid())
      and exists (select 1 from public.profiles p where p.id = l.dono_id and p.ativo and p.perfil <> 'cliente')
    returning l.*
  )
  insert into public.notifications (destinatario_id, tipo, task_id, client_id, texto, link, email_enviado_em)
  select v.dono_id, 'lembrete', v.task_id, v.client_id, 'Lembrete: ' || v.texto,
         coalesce('/tarefas?aba=' || t.tipo || '&tarefa=' || t.id, '/avisos'), now()
  from vencidos v left join public.tasks t on t.id = v.task_id;
  get diagnostics n = row_count;
  return n;
end
$$;

revoke execute on function public.proximo_lembrete(timestamptz, text, timestamptz), public.concluir_lembrete(uuid), public.disparar_lembretes() from public, anon;
grant execute on function public.proximo_lembrete(timestamptz, text, timestamptz), public.concluir_lembrete(uuid), public.disparar_lembretes() to authenticated;

-- A cada minuto, para o sino ficar certo mesmo com o Bastidor fechado
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('bastidor-lembretes-pessoais', '* * * * *', 'select public.disparar_lembretes()');
  end if;
end
$$;
