-- Tarefas recorrentes: um modelo (recorrencias) gera tarefas comuns em tasks.
-- Sócio e Adm criam e editam; a Criação só vê o ↻ nas tarefas geradas (tasks.recorrencia_id).
-- Todo dia às 6h (São Paulo) o pg_cron chama gerar_recorrentes(), que cria as tarefas cujo prazo
-- entrou na antecedência. Prazo em sábado ou domingo é antecipado para sexta.

create table public.recorrencias (
  id uuid primary key default gen_random_uuid(),
  tipo public.tipo_tarefa not null,
  client_id uuid references public.clients (id) on delete cascade, -- nulo = interno da agência
  titulo text not null check (char_length(trim(titulo)) between 1 and 200), -- aceita {mês}, {mês anterior} e {data}
  formato public.formato,
  area public.area,
  responsavel_id uuid references public.profiles (id) on delete set null,
  texto text not null default '',
  frequencia text not null check (frequencia in ('semanal', 'quinzenal', 'mensal')),
  dias_semana smallint[] check (dias_semana <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[]), -- 0 = domingo
  dia_mes smallint check (dia_mes between 1 and 31), -- 31 = último dia do mês
  antecedencia smallint not null default 7 check (antecedencia between 0 and 60),
  inicio date not null default (now() at time zone 'America/Sao_Paulo')::date,
  fim date,
  ativa boolean not null default true,
  criado_por uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint recorrencias_formato check ((tipo = 'conteudo') = (formato is not null)),
  constraint recorrencias_area check ((tipo = 'demanda') = (area is not null)),
  constraint recorrencias_conteudo_tem_cliente check (tipo = 'demanda' or client_id is not null),
  constraint recorrencias_legenda check (tipo <> 'conteudo' or char_length(texto) <= 2200),
  constraint recorrencias_regra check (
    (frequencia = 'mensal' and dia_mes is not null)
    or (frequencia <> 'mensal' and cardinality(dias_semana) > 0)
  ),
  constraint recorrencias_periodo check (fim is null or fim >= inicio)
);
create index on public.recorrencias (client_id);

-- Datas já geradas (mesmo que a tarefa seja apagada depois, não volta a nascer)
create table public.recorrencia_geradas (
  recorrencia_id uuid not null references public.recorrencias (id) on delete cascade,
  data date not null, -- data da ocorrência antes de antecipar o fim de semana
  task_id uuid references public.tasks (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (recorrencia_id, data)
);

alter table public.tasks add column recorrencia_id uuid references public.recorrencias (id) on delete set null;

create function public.tocar_recorrencia() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  if tg_op = 'INSERT' then
    new.criado_por := coalesce(new.criado_por, auth.uid());
  end if;
  return new;
end
$$;
create trigger tocar_recorrencia before insert or update on public.recorrencias
for each row execute function public.tocar_recorrencia();

-- ---------------------------------------------------------------- calendário
-- Ocorrências de um modelo entre duas datas: a data "nominal" e o prazo (fim de semana vai para sexta)
create function public.ocorrencias(r public.recorrencias, p_de date, p_ate date)
returns table (data date, prazo date)
language sql stable set search_path = '' as $$
  select d, d - case extract(isodow from d)::int when 6 then 1 when 7 then 2 else 0 end
  from (
    select g::date as d
    from generate_series(greatest(p_de, r.inicio), least(p_ate, coalesce(r.fim, p_ate)), interval '1 day') g
  ) dias
  where case r.frequencia
    when 'mensal' then
      extract(day from d)::int = least(r.dia_mes::int, extract(day from (date_trunc('month', d) + interval '1 month - 1 day'))::int)
    when 'semanal' then
      extract(dow from d)::smallint = any (r.dias_semana)
    when 'quinzenal' then
      extract(dow from d)::smallint = any (r.dias_semana)
      and ((d - (r.inicio - extract(dow from r.inicio)::int)) / 7) % 2 = 0
  end
$$;

create function public.titulo_recorrente(p_titulo text, p_prazo date) returns text
language sql immutable set search_path = '' as $$
  with m(nomes) as (
    select array['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
  )
  select replace(replace(replace(replace(replace(p_titulo,
    '{mês anterior}', nomes[extract(month from p_prazo - interval '1 month')::int]),
    '{mes anterior}', nomes[extract(month from p_prazo - interval '1 month')::int]),
    '{mês}', nomes[extract(month from p_prazo)::int]),
    '{mes}', nomes[extract(month from p_prazo)::int]),
    '{data}', to_char(p_prazo, 'DD/MM'))
  from m
$$;

-- ---------------------------------------------------------------- geração
-- Sem login (pg_cron): todos os modelos. Com login (Sócio ou Adm, ao salvar): o modelo indicado.
create function public.gerar_recorrentes(p_id uuid default null, p_hoje date default null) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  r public.recorrencias;
  o record;
  desde date;
  v_task uuid;
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
    -- Nada antes da criação do modelo; se a rotina falhar uns dias, recupera até 31 dias para trás
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
      update public.recorrencia_geradas set task_id = v_task where recorrencia_id = r.id and data = o.data;
      n := n + 1;
    end loop;
  end loop;
  return n;
end
$$;

-- Próxima data ainda não gerada de cada modelo ativo (lista em Tarefas > Recorrentes)
create function public.proximas_recorrencias()
returns table (id uuid, prazo date, aparece_em date)
language sql stable set search_path = '' as $$
  select r.id, o.prazo, o.prazo - r.antecedencia
  from public.recorrencias r
  cross join lateral (
    select x.data, x.prazo
    from public.ocorrencias(r, (now() at time zone 'America/Sao_Paulo')::date, (now() at time zone 'America/Sao_Paulo')::date + 400) x
    where not exists (select 1 from public.recorrencia_geradas g where g.recorrencia_id = r.id and g.data = x.data)
    order by x.data
    limit 1
  ) o
  where r.ativa
$$;

-- ---------------------------------------------------------------- acesso
alter table public.recorrencias enable row level security;
alter table public.recorrencia_geradas enable row level security;

create policy recorrencias_gestao on public.recorrencias for all to authenticated
  using ((select public.e_gestao())) with check ((select public.e_gestao()));
create policy geradas_ler on public.recorrencia_geradas for select to authenticated
  using ((select public.e_gestao()));

grant select, insert, update, delete on public.recorrencias to authenticated;
grant select on public.recorrencia_geradas to authenticated;

revoke execute on function public.tocar_recorrencia(), public.titulo_recorrente(text, date) from public, anon;
revoke execute on function public.ocorrencias(public.recorrencias, date, date), public.gerar_recorrentes(uuid, date), public.proximas_recorrencias()
  from public, anon;
grant execute on function public.ocorrencias(public.recorrencias, date, date), public.gerar_recorrentes(uuid, date), public.proximas_recorrencias()
  to authenticated;

-- 6h em São Paulo (9h UTC)
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('bastidor-recorrentes', '0 9 * * *', 'select public.gerar_recorrentes()');
  end if;
end
$$;
