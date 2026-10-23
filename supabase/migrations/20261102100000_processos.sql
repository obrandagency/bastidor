-- Processos: modelos de demanda com etapas em sequência (ex.: Projeto de branding).
-- Sócio e Adm editam os modelos; ao criar uma demanda com processo, as etapas são copiadas para ela
-- (tarefa_etapas), com responsável e prazo calculados. Quando uma etapa é concluída, a demanda passa
-- para o responsável da próxima, que recebe o aviso "sua vez" (sino e e-mail).

create table public.processos (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (char_length(trim(nome)) between 1 and 120),
  area public.area not null,
  descricao text not null default '',
  ativo boolean not null default true,
  criado_por uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create table public.processo_etapas (
  id uuid primary key default gen_random_uuid(),
  processo_id uuid not null references public.processos (id) on delete cascade,
  ordem integer not null default 0,
  nome text not null check (char_length(trim(nome)) between 1 and 120),
  responsavel_id uuid references public.profiles (id) on delete set null,
  dias smallint not null default 0 check (dias between 0 and 365) -- prazo: dias depois do início
);
create index on public.processo_etapas (processo_id, ordem);

create table public.tarefa_etapas (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  ordem integer not null default 0,
  nome text not null check (char_length(trim(nome)) between 1 and 120),
  responsavel_id uuid references public.profiles (id) on delete set null,
  prazo date,
  feito_em timestamptz,
  feito_por uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index on public.tarefa_etapas (task_id, ordem);
create index on public.tarefa_etapas (prazo) where feito_em is null;

alter table public.tasks add column processo_id uuid references public.processos (id) on delete set null;
alter table public.recorrencias add column processo_id uuid references public.processos (id) on delete set null;
alter table public.recorrencias add constraint recorrencias_processo_so_em_demanda check (processo_id is null or tipo = 'demanda');

-- ---------------------------------------------------------------- datas
-- Sábado e domingo vão para a sexta anterior (a mesma regra das recorrentes)
create function public.dia_util_anterior(p date) returns date
language sql immutable set search_path = '' as $$
  select p - case extract(isodow from p)::int when 6 then 1 when 7 then 2 else 0 end
$$;

-- ---------------------------------------------------------------- aplicar um processo a uma demanda
-- Copia as etapas; prazo de cada uma = início + dias. O prazo da demanda vira o da última etapa e o
-- responsável, o da primeira (se houver). Só demanda sem etapas.
create function public.aplicar_processo(p_task uuid, p_processo uuid, p_inicio date) returns void
language plpgsql set search_path = '' as $$
declare
  t public.tasks;
  primeira uuid;
  ultimo date;
begin
  select * into t from public.tasks where id = p_task;
  if not found then
    raise exception 'Tarefa não encontrada' using errcode = 'P0002';
  end if;
  if t.tipo <> 'demanda' then
    raise exception 'Processos são só para demandas' using errcode = '23514';
  end if;
  if exists (select 1 from public.tarefa_etapas where task_id = p_task) then
    raise exception 'Esta demanda já tem etapas' using errcode = '23514';
  end if;

  insert into public.tarefa_etapas (task_id, ordem, nome, responsavel_id, prazo)
  select p_task, row_number() over (order by e.ordem, e.nome), e.nome, e.responsavel_id, public.dia_util_anterior(p_inicio + e.dias)
  from public.processo_etapas e
  where e.processo_id = p_processo;

  select responsavel_id into primeira from public.tarefa_etapas where task_id = p_task order by ordem limit 1;
  select max(prazo) into ultimo from public.tarefa_etapas where task_id = p_task;

  -- O responsável da primeira etapa recebe o aviso normal "Você recebeu"
  update public.tasks
  set processo_id = p_processo,
      prazo = coalesce(ultimo, prazo),
      responsavel_id = coalesce(primeira, responsavel_id)
  where id = p_task;
end
$$;

-- ---------------------------------------------------------------- etapas em sequência
create function public.regras_etapa_tarefa() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and new.task_id <> old.task_id then
    raise exception 'A etapa não muda de tarefa' using errcode = '42501';
  end if;
  if tg_op = 'UPDATE' and (new.feito_em is null) <> (old.feito_em is null) then
    if new.feito_em is not null then
      -- Só conclui quando as anteriores estão feitas
      if exists (select 1 from public.tarefa_etapas a where a.task_id = new.task_id and a.ordem < new.ordem and a.feito_em is null) then
        raise exception 'Conclua as etapas anteriores primeiro' using errcode = '23514';
      end if;
      new.feito_por := auth.uid();
    else
      -- Só reabre se a seguinte ainda não foi feita
      if exists (select 1 from public.tarefa_etapas a where a.task_id = new.task_id and a.ordem > new.ordem and a.feito_em is not null) then
        raise exception 'Reabra primeiro as etapas seguintes' using errcode = '23514';
      end if;
      new.feito_por := null;
    end if;
  end if;
  return new;
end
$$;
create trigger regras_etapa_tarefa before update on public.tarefa_etapas
for each row execute function public.regras_etapa_tarefa();

-- Depois de concluir: a demanda passa para o responsável da próxima etapa, que recebe "sua vez".
-- A primeira etapa concluída tira a demanda de A fazer.
create function public.avancar_etapa_tarefa() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  t public.tasks;
  prox public.tarefa_etapas;
begin
  if new.feito_em is null or old.feito_em is not null then
    return null;
  end if;
  select * into t from public.tasks where id = new.task_id;
  select * into prox from public.tarefa_etapas where task_id = new.task_id and feito_em is null order by ordem limit 1;

  perform set_config('bastidor.sem_aviso_responsavel', 'sim', true);
  update public.tasks
  set responsavel_id = coalesce(prox.responsavel_id, responsavel_id),
      etapa = case when etapa = 'a_fazer' then 'fazendo'::public.etapa else etapa end
  where id = new.task_id;
  perform set_config('bastidor.sem_aviso_responsavel', '', true);

  if prox.id is not null and prox.responsavel_id is not null and prox.responsavel_id is distinct from auth.uid() then
    insert into public.notifications (destinatario_id, tipo, task_id, client_id, texto, link)
    values (
      prox.responsavel_id, 'etapa_vez', t.id, t.client_id,
      'Sua vez: ' || prox.nome || ' em ' || t.titulo || coalesce(', prazo ' || to_char(prox.prazo, 'DD/MM'), ''),
      '/tarefas?aba=demanda&tarefa=' || t.id
    );
  end if;
  return null;
end
$$;
create trigger avancar_etapa_tarefa after update on public.tarefa_etapas
for each row execute function public.avancar_etapa_tarefa();

-- O aviso "Você recebeu" fica de fora quando quem passou a demanda foi a etapa (já existe o "sua vez")
create or replace function public.avisar_responsavel() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(current_setting('bastidor.sem_aviso_responsavel', true), '') = 'sim' then
    return null;
  end if;
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

-- ---------------------------------------------------------------- recorrentes com processo
-- O processo termina na data da ocorrência: início = prazo - maior "dias" do processo
create or replace function public.gerar_recorrentes(p_id uuid default null, p_hoje date default null) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  r public.recorrencias;
  o record;
  desde date;
  v_task uuid;
  duracao integer;
  n integer := 0;
begin
  if auth.uid() is not null then
    if not public.e_gestao() then
      raise exception 'Sem permissão' using errcode = '42501';
    end if;
  elsif p_hoje is not null then
    hoje := p_hoje; -- só sem login (testes e manutenção)
  end if;

  for r in select * from public.recorrencias where ativa and (p_id is null or id = p_id) loop
    if r.client_id is not null and not exists (select 1 from public.clients c where c.id = r.client_id and c.ativo) then
      continue;
    end if;
    desde := greatest(hoje - 31, (r.created_at at time zone 'America/Sao_Paulo')::date);
    for o in select * from public.ocorrencias(r, desde, hoje + r.antecedencia + 2) loop
      continue when o.prazo - r.antecedencia > hoje or o.prazo < desde;
      insert into public.recorrencia_geradas (recorrencia_id, data) values (r.id, o.data)
        on conflict do nothing;
      continue when not found;
      insert into public.tasks (tipo, client_id, titulo, formato, area, etapa, responsavel_id, prazo, texto, criado_por, recorrencia_id)
      values (
        r.tipo, r.client_id, public.titulo_recorrente(r.titulo, o.prazo), r.formato, r.area,
        (case r.tipo when 'conteudo' then 'pauta' else 'a_fazer' end)::public.etapa,
        r.responsavel_id, o.prazo, r.texto, r.criado_por, r.id
      )
      returning id into v_task;
      if r.processo_id is not null and exists (select 1 from public.processos p where p.id = r.processo_id) then
        select coalesce(max(dias), 0) into duracao from public.processo_etapas where processo_id = r.processo_id;
        perform public.aplicar_processo(v_task, r.processo_id, o.prazo - duracao);
      end if;
      update public.recorrencia_geradas set task_id = v_task where recorrencia_id = r.id and data = o.data;
      n := n + 1;
    end loop;
  end loop;
  return n;
end
$$;

-- ---------------------------------------------------------------- acesso
alter table public.processos enable row level security;
alter table public.processo_etapas enable row level security;
alter table public.tarefa_etapas enable row level security;

-- Modelos: o time lê (para escolher ao criar demanda); Sócio e Adm editam
create policy processos_ler on public.processos for select to authenticated using ((select public.e_time()));
create policy processos_editar on public.processos for all to authenticated
  using ((select public.e_gestao())) with check ((select public.e_gestao()));
create policy processo_etapas_ler on public.processo_etapas for select to authenticated using ((select public.e_time()));
create policy processo_etapas_editar on public.processo_etapas for all to authenticated
  using ((select public.e_gestao())) with check ((select public.e_gestao()));

-- Etapas de cada demanda: o time inteiro, como as próprias tarefas
create policy tarefa_etapas_time on public.tarefa_etapas for all to authenticated
  using ((select public.e_time())) with check ((select public.e_time()));

grant select, insert, update, delete on public.processos, public.processo_etapas, public.tarefa_etapas to authenticated;

revoke execute on function public.regras_etapa_tarefa(), public.avancar_etapa_tarefa() from public, anon;
revoke execute on function public.dia_util_anterior(date), public.aplicar_processo(uuid, uuid, date) from public, anon;
grant execute on function public.dia_util_anterior(date), public.aplicar_processo(uuid, uuid, date) to authenticated;
