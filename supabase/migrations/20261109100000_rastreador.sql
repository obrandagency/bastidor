-- Rastreador de tempo das tarefas (09/11)
-- Cada contagem guarda início e fim; uma por pessoa por vez; só o Sócio corrige ou apaga.
-- As horas da tarefa (tasks.horas) passam a ser a soma das contagens encerradas.

create table public.tempo_registros (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  pessoa_id uuid default auth.uid() references public.profiles (id) on delete set null,
  inicio timestamptz not null default now(),
  fim timestamptz, -- nulo = contando agora
  manual boolean not null default false, -- lançado à mão ("esqueci de ligar") ou vindo do campo Horas antigo
  nota text check (nota is null or char_length(nota) <= 500),
  avisado_em timestamptz, -- aviso de "ligada há 4 h" já enviado
  created_at timestamptz not null default now(),
  check (fim is null or fim > inicio),
  check (not manual or fim is not null)
);
create index on public.tempo_registros (task_id);
create index on public.tempo_registros (pessoa_id, inicio desc);
-- Uma contagem ligada por pessoa
create unique index tempo_uma_por_pessoa on public.tempo_registros (pessoa_id) where fim is null;

alter table public.tempo_registros enable row level security;

create policy tempo_ler on public.tempo_registros for select to authenticated using ((select public.e_time()));
create policy tempo_criar on public.tempo_registros for insert to authenticated
  with check ((select public.e_time()) and (pessoa_id = (select auth.uid()) or (select public.e_socio())));
-- Cada um só para a própria contagem ligada; corrigir é do Sócio
create policy tempo_editar on public.tempo_registros for update to authenticated
  using ((select public.e_socio()) or ((select public.e_time()) and pessoa_id = (select auth.uid()) and fim is null))
  with check ((select public.e_socio()) or pessoa_id = (select auth.uid()));
create policy tempo_apagar on public.tempo_registros for delete to authenticated using ((select public.e_socio()));
grant select, insert, update, delete on public.tempo_registros to authenticated;

-- ---------------------------------------------------------------- regras (quem não é Sócio)
create function public.regras_tempo() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  -- Rotinas do banco (sem login) e o Sócio passam direto
  if auth.uid() is null or public.e_socio() then
    if new.fim is not null and new.fim - new.inicio > interval '24 hours' and auth.uid() is not null then
      raise exception 'Uma contagem tem no máximo 24 horas' using errcode = '23514';
    end if;
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.pessoa_id := auth.uid();
    new.avisado_em := null;
    if new.manual then
      if new.fim > now() + interval '1 minute' then
        raise exception 'Não dá para lançar tempo no futuro' using errcode = '23514';
      end if;
      if new.fim - new.inicio > interval '12 hours' then
        raise exception 'Lance no máximo 12 horas de uma vez' using errcode = '23514';
      end if;
    else
      new.inicio := now();
      new.fim := null;
    end if;
    return new;
  end if;

  -- UPDATE: só parar a própria contagem ligada, agora
  if old.fim is not null or new.fim is null then
    raise exception 'Só o Sócio corrige uma contagem' using errcode = '42501';
  end if;
  new.task_id := old.task_id;
  new.pessoa_id := old.pessoa_id;
  new.inicio := old.inicio;
  new.manual := old.manual;
  new.nota := old.nota;
  new.fim := greatest(now(), old.inicio + interval '1 second');
  return new;
end
$$;
create trigger regras_tempo before insert or update on public.tempo_registros
for each row execute function public.regras_tempo();

-- ---------------------------------------------------------------- horas da tarefa = soma das contagens encerradas
create function public.somar_horas(p_task uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform set_config('bastidor.somando_horas', '1', true);
  update public.tasks t
  set horas = (
    select round((sum(extract(epoch from r.fim - r.inicio)) / 3600)::numeric, 2)
    from public.tempo_registros r where r.task_id = p_task and r.fim is not null
  )
  where t.id = p_task;
  perform set_config('bastidor.somando_horas', '', true);
end
$$;

create function public.atualizar_horas() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    perform public.somar_horas(old.task_id);
  end if;
  if tg_op in ('INSERT', 'UPDATE') and (tg_op = 'INSERT' or new.task_id <> old.task_id) then
    perform public.somar_horas(new.task_id);
  end if;
  return null;
end
$$;
create trigger atualizar_horas after insert or update or delete on public.tempo_registros
for each row execute function public.atualizar_horas();

-- Ninguém digita horas na tarefa: o valor vem só das contagens
create function public.proteger_horas() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is not null and coalesce(current_setting('bastidor.somando_horas', true), '') <> '1' then
    new.horas := case when tg_op = 'INSERT' then null else old.horas end;
  end if;
  return new;
end
$$;
create trigger proteger_horas before insert or update of horas on public.tasks
for each row execute function public.proteger_horas();

-- ---------------------------------------------------------------- iniciar e parar (uma contagem por vez)
create function public.iniciar_contagem(p_task uuid) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  novo uuid;
begin
  if not public.e_time() then
    raise exception 'Sem permissão' using errcode = '42501';
  end if;
  -- Ligar outra tarefa para a anterior
  update public.tempo_registros set fim = now() where pessoa_id = auth.uid() and fim is null;
  insert into public.tempo_registros (task_id, pessoa_id) values (p_task, auth.uid()) returning id into novo;
  return novo;
end
$$;

create function public.parar_contagem() returns void
language sql security invoker set search_path = '' as $$
  update public.tempo_registros set fim = now() where pessoa_id = auth.uid() and fim is null;
$$;

-- ---------------------------------------------------------------- vigia: aviso de 4 h e parada às 23h59 (pg_cron a cada 5 min)
create function public.vigiar_contagens() returns void
language plpgsql security definer set search_path = '' as $$
begin
  -- Contagem que atravessou a meia-noite para às 23h59min59s do dia em que começou
  with paradas as (
    update public.tempo_registros r
    set fim = (((r.inicio at time zone 'America/Sao_Paulo')::date + time '23:59:59') at time zone 'America/Sao_Paulo')
    where r.fim is null
      and (r.inicio at time zone 'America/Sao_Paulo')::date < (now() at time zone 'America/Sao_Paulo')::date
    returning r.*
  )
  insert into public.notifications (destinatario_id, tipo, task_id, client_id, texto, link, email_enviado_em)
  select p.pessoa_id, 'contagem', t.id, t.client_id, 'Sua contagem em "' || t.titulo || '" parou às 23h59',
         '/tarefas?aba=' || t.tipo || '&tarefa=' || t.id, now()
  from paradas p join public.tasks t on t.id = p.task_id
  where p.pessoa_id is not null;

  -- Ligada há 4 horas ou mais: um aviso no sino
  with longas as (
    update public.tempo_registros r
    set avisado_em = now()
    where r.fim is null and r.avisado_em is null and r.inicio <= now() - interval '4 hours'
    returning r.*
  )
  insert into public.notifications (destinatario_id, tipo, task_id, client_id, texto, link, email_enviado_em)
  select l.pessoa_id, 'contagem', t.id, t.client_id, 'Sua contagem em "' || t.titulo || '" está ligada há 4 horas',
         '/tarefas?aba=' || t.tipo || '&tarefa=' || t.id, now()
  from longas l join public.tasks t on t.id = l.task_id
  where l.pessoa_id is not null;
end
$$;

revoke execute on function public.regras_tempo(), public.somar_horas(uuid), public.atualizar_horas(), public.proteger_horas(), public.vigiar_contagens() from public, anon, authenticated;
revoke execute on function public.iniciar_contagem(uuid), public.parar_contagem() from public, anon;
grant execute on function public.iniciar_contagem(uuid), public.parar_contagem() to authenticated;

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('bastidor-contagens', '*/5 * * * *', 'select public.vigiar_contagens()');
  end if;
end
$$;

-- ---------------------------------------------------------------- horas digitadas antes viram uma contagem lançada à mão
insert into public.tempo_registros (task_id, pessoa_id, inicio, fim, manual, nota)
select t.id, t.responsavel_id, x.inicio, x.inicio + t.horas * interval '1 hour', true, 'Horas registradas antes do rastreador'
from public.tasks t
cross join lateral (
  select coalesce(((t.prazo + time '12:00') at time zone 'America/Sao_Paulo'), t.created_at) as inicio
) x
where t.horas > 0;
