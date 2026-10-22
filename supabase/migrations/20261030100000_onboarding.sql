-- Bastidor · Onboarding de cliente: pipeline de etapas com tarefas, documentos, comentários e histórico
-- Etapas e tarefas padrão são um modelo editável pelo Sócio; cada cliente recebe uma cópia das tarefas.
-- Sócio e Adm editam; Criação vê; o cliente vê só o progresso no portal (função portal_onboarding).

create table public.onboarding_etapas (
  id uuid primary key default gen_random_uuid(),
  ordem integer not null,
  nome text not null check (char_length(trim(nome)) between 1 and 40),
  cor text not null default '#5A6275' check (cor ~ '^#[0-9A-Fa-f]{6}$'),
  created_at timestamptz not null default now()
);

create table public.onboarding_modelo (
  id uuid primary key default gen_random_uuid(),
  etapa_id uuid not null references public.onboarding_etapas (id) on delete cascade,
  ordem integer not null default 0,
  texto text not null check (char_length(trim(texto)) between 1 and 200)
);

create table public.onboardings (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null unique references public.clients (id) on delete cascade,
  etapa_id uuid not null references public.onboarding_etapas (id) on delete restrict, -- etapa atual
  inicio date not null default (now() at time zone 'America/Sao_Paulo')::date,
  responsavel_id uuid references public.profiles (id) on delete set null,
  concluido_em timestamptz, -- quando chegou à última etapa
  criado_por uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.onboarding_tarefas (
  id uuid primary key default gen_random_uuid(),
  onboarding_id uuid not null references public.onboardings (id) on delete cascade,
  etapa_id uuid not null references public.onboarding_etapas (id) on delete restrict,
  ordem integer not null default 0,
  texto text not null check (char_length(trim(texto)) between 1 and 200),
  responsavel_id uuid references public.profiles (id) on delete set null,
  prazo date,
  feito_em timestamptz,
  feito_por uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index on public.onboarding_tarefas (onboarding_id, etapa_id, ordem);

-- Comentários (escritos pelo time) e histórico (gravado pelos gatilhos)
create table public.onboarding_eventos (
  id bigint generated always as identity primary key,
  onboarding_id uuid not null references public.onboardings (id) on delete cascade,
  tipo text not null check (tipo in ('comentario', 'etapa', 'tarefa', 'inicio')),
  texto text not null check (char_length(trim(texto)) between 1 and 4000),
  autor_id uuid references public.profiles (id) on delete set null,
  autor_nome text,
  created_at timestamptz not null default now()
);
create index on public.onboarding_eventos (onboarding_id, created_at desc);

create table public.onboarding_documentos (
  id uuid primary key default gen_random_uuid(),
  onboarding_id uuid not null references public.onboardings (id) on delete cascade,
  caminho text not null unique, -- bucket "onboarding": onboarding_id/arquivo
  nome text not null,
  tipo text not null,
  tamanho bigint not null,
  autor_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- modelo inicial (editável em Configurações)
do $$
declare
  e uuid;
  etapas text[][] := array[
    array['Não iniciado', '#5A6275', 'Enviar mensagem de boas-vindas'],
    array['Administrativo', '#1E4BFF', 'Contrato assinado|Cliente cadastrado no Bastidor|Pessoas do cliente com acesso ao portal'],
    array['Kick-off', '#7A3FD1', 'Reunião de kickoff|Briefing de marca preenchido|Acessos: Instagram, Meta Business e Drive'],
    array['Planejamento', '#D9631E', 'Auditoria do perfil|Pesquisa de concorrentes|Pilares e linha editorial definidos|Primeiro calendário de pautas aprovado'],
    array['Primeiros conteúdos', '#C2367A', 'Identidade visual dos posts|Primeiras publicações no ar'],
    array['Reunião de 30 dias', '#A86400', 'Reunião de alinhamento dos 30 dias|Relatório inicial enviado'],
    array['Operacional', '#16895D', '']
  ];
  i int;
  t text;
  j int;
begin
  for i in 1 .. array_length(etapas, 1) loop
    insert into public.onboarding_etapas (ordem, nome, cor) values (i, etapas[i][1], etapas[i][2]) returning id into e;
    j := 0;
    if etapas[i][3] <> '' then
      foreach t in array string_to_array(etapas[i][3], '|') loop
        j := j + 1;
        insert into public.onboarding_modelo (etapa_id, ordem, texto) values (e, j, t);
      end loop;
    end if;
  end loop;
end
$$;

-- ---------------------------------------------------------------- regras
create function public.etapa_final_onboarding() returns uuid
language sql stable set search_path = '' as $$
  select id from public.onboarding_etapas order by ordem desc limit 1
$$;

-- Novo onboarding: copia as tarefas do modelo e registra o início
create function public.iniciar_onboarding() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  quem public.profiles;
begin
  insert into public.onboarding_tarefas (onboarding_id, etapa_id, ordem, texto)
  select new.id, m.etapa_id, m.ordem, m.texto from public.onboarding_modelo m;
  select * into quem from public.profiles where id = auth.uid();
  insert into public.onboarding_eventos (onboarding_id, tipo, texto, autor_id, autor_nome)
  values (new.id, 'inicio', 'Onboarding iniciado em ' || (select nome from public.onboarding_etapas where id = new.etapa_id), quem.id, quem.nome);
  return null;
end
$$;
create trigger iniciar_onboarding after insert on public.onboardings
for each row execute function public.iniciar_onboarding();

-- Mudou de etapa: histórico, e a última etapa marca como concluído
create function public.regras_onboarding() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  quem public.profiles;
begin
  new.updated_at := now();
  if tg_op = 'INSERT' then
    new.criado_por := coalesce(new.criado_por, auth.uid());
  end if;
  if tg_op = 'INSERT' or new.etapa_id is distinct from old.etapa_id then
    new.concluido_em := case when new.etapa_id = public.etapa_final_onboarding() then now() end;
  end if;
  if tg_op = 'UPDATE' and new.etapa_id is distinct from old.etapa_id then
    select * into quem from public.profiles where id = auth.uid();
    insert into public.onboarding_eventos (onboarding_id, tipo, texto, autor_id, autor_nome)
    values (new.id, 'etapa', 'Movido para ' || (select nome from public.onboarding_etapas where id = new.etapa_id), quem.id, quem.nome);
  end if;
  return new;
end
$$;
create trigger regras_onboarding before insert or update on public.onboardings
for each row execute function public.regras_onboarding();

-- Tarefa marcada ou desmarcada: quem e quando, e entra no histórico
create function public.regras_tarefa_onboarding() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  quem public.profiles;
begin
  if (new.feito_em is null) = (old.feito_em is null) then
    return new;
  end if;
  select * into quem from public.profiles where id = auth.uid();
  if new.feito_em is not null then
    new.feito_em := now();
    new.feito_por := quem.id;
  else
    new.feito_por := null;
  end if;
  insert into public.onboarding_eventos (onboarding_id, tipo, texto, autor_id, autor_nome)
  values (new.onboarding_id, 'tarefa', case when new.feito_em is not null then 'Concluiu: ' else 'Reabriu: ' end || new.texto, quem.id, quem.nome);
  return new;
end
$$;
create trigger regras_tarefa_onboarding before update on public.onboarding_tarefas
for each row execute function public.regras_tarefa_onboarding();

-- ---------------------------------------------------------------- acesso
alter table public.onboarding_etapas enable row level security;
alter table public.onboarding_modelo enable row level security;
alter table public.onboardings enable row level security;
alter table public.onboarding_tarefas enable row level security;
alter table public.onboarding_eventos enable row level security;
alter table public.onboarding_documentos enable row level security;

-- Modelo: o time lê; o Sócio edita
create policy etapas_ler on public.onboarding_etapas for select to authenticated using ((select public.e_time()));
create policy etapas_editar on public.onboarding_etapas for all to authenticated
  using ((select public.e_socio())) with check ((select public.e_socio()));
create policy modelo_ler on public.onboarding_modelo for select to authenticated using ((select public.e_time()));
create policy modelo_editar on public.onboarding_modelo for all to authenticated
  using ((select public.e_socio())) with check ((select public.e_socio()));

-- Onboardings: o time lê; Sócio e Adm editam
create policy onboardings_ler on public.onboardings for select to authenticated using ((select public.e_time()));
create policy onboardings_editar on public.onboardings for all to authenticated
  using ((select public.e_gestao())) with check ((select public.e_gestao()));
create policy ob_tarefas_ler on public.onboarding_tarefas for select to authenticated using ((select public.e_time()));
create policy ob_tarefas_editar on public.onboarding_tarefas for all to authenticated
  using ((select public.e_gestao())) with check ((select public.e_gestao()));
create policy ob_documentos_ler on public.onboarding_documentos for select to authenticated using ((select public.e_time()));
create policy ob_documentos_editar on public.onboarding_documentos for all to authenticated
  using ((select public.e_gestao())) with check ((select public.e_gestao()));

-- Comentários: Sócio e Adm comentam em nome próprio; histórico só pelos gatilhos
create policy ob_eventos_ler on public.onboarding_eventos for select to authenticated using ((select public.e_time()));
create policy ob_eventos_comentar on public.onboarding_eventos for insert to authenticated
  with check ((select public.e_gestao()) and tipo = 'comentario' and autor_id = (select auth.uid()));
create policy ob_eventos_apagar on public.onboarding_eventos for delete to authenticated
  using (tipo = 'comentario' and (autor_id = (select auth.uid()) or (select public.e_socio())));
revoke update on public.onboarding_eventos from authenticated;

-- ---------------------------------------------------------------- documentos (bucket privado "onboarding", até 25 MB)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('onboarding', 'onboarding', false, 26214400, array[
  'image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'text/plain',
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/zip'
])
on conflict (id) do nothing;
create policy onboarding_ler on storage.objects for select to authenticated using (bucket_id = 'onboarding' and public.e_time());
create policy onboarding_enviar on storage.objects for insert to authenticated with check (bucket_id = 'onboarding' and public.e_gestao());
create policy onboarding_apagar on storage.objects for delete to authenticated using (bucket_id = 'onboarding' and public.e_gestao());

-- ---------------------------------------------------------------- portal: o cliente vê só o progresso
create function public.portal_onboarding(p_client_id uuid default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  cid uuid := public.portal_cliente_alvo(p_client_id);
  o public.onboardings;
begin
  select * into o from public.onboardings where client_id = cid;
  if not found then
    return null;
  end if;
  return jsonb_build_object(
    'inicio', o.inicio,
    'concluido_em', o.concluido_em,
    'etapa_atual', (select ordem from public.onboarding_etapas where id = o.etapa_id),
    'etapas', (
      select jsonb_agg(jsonb_build_object(
        'nome', e.nome, 'ordem', e.ordem,
        'tarefas', coalesce((
          select jsonb_agg(jsonb_build_object('texto', t.texto, 'feito', t.feito_em is not null) order by t.ordem, t.created_at)
          from public.onboarding_tarefas t where t.onboarding_id = o.id and t.etapa_id = e.id
        ), '[]'::jsonb)
      ) order by e.ordem)
      from public.onboarding_etapas e
    )
  );
end
$$;

-- Tamanho por bucket (Configurações) passa a incluir os documentos de onboarding
create or replace function public.uso_armazenamento()
returns table (bucket text, arquivos bigint, bytes bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.e_gestao() then
    raise exception 'Sem permissão' using errcode = '42501';
  end if;
  return query
    select o.bucket_id::text, count(*), coalesce(sum((o.metadata ->> 'size')::bigint), 0)::bigint
    from storage.objects o
    where o.bucket_id in ('artes', 'chat', 'onboarding')
    group by o.bucket_id;
end
$$;

revoke execute on function public.etapa_final_onboarding(), public.iniciar_onboarding(), public.regras_onboarding(), public.regras_tarefa_onboarding()
  from public, anon;
grant execute on function public.portal_onboarding(uuid) to authenticated;
