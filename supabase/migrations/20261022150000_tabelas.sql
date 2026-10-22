-- Bastidor · Fase 1 · tipos e tabelas
-- Toda tabela ligada a um cliente tem client_id: é por ele que a RLS separa um cliente do outro.

create extension if not exists btree_gist;

-- ---------------------------------------------------------------- tipos fixos
create type public.perfil as enum ('socio', 'adm', 'criacao', 'cliente');
create type public.tipo_tarefa as enum ('conteudo', 'demanda');
create type public.etapa as enum (
  -- conteúdo (8)
  'pauta', 'copy', 'layout', 'revisao', 'cliente', 'ajuste', 'aprovado', 'agendado',
  -- demanda (4)
  'a_fazer', 'fazendo', 'validacao', 'concluido'
);
create type public.formato as enum ('carrossel', 'reels', 'estatico', 'stories');
create type public.area as enum (
  'trafego_pago', 'atendimento', 'comercial', 'branding', 'financeiro', 'administrativo', 'interno'
);
create type public.tipo_nota as enum ('interno', 'cliente');
create type public.origem_evento as enum ('time', 'cliente', 'sistema');

-- ---------------------------------------------------------------- clientes
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (char_length(trim(nome)) > 0),
  instagram text,
  cor text not null default '#1E4BFF' check (cor ~ '^#[0-9A-Fa-f]{6}$'),
  nome_curto text not null check (char_length(trim(nome_curto)) > 0),
  drive_url text,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- pessoas
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nome text not null,
  email text not null unique check (email = lower(email)),
  iniciais text not null check (char_length(iniciais) between 1 and 3),
  cargo text,
  perfil public.perfil not null,
  client_id uuid references public.clients (id) on delete cascade,
  emails_opcionais boolean not null default true,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  -- client_id existe só para perfil cliente
  constraint profiles_cliente_tem_client_id check ((perfil = 'cliente') = (client_id is not null))
);
create index on public.profiles (client_id);

-- Convite pendente: só e-mails convidados conseguem virar usuário (ver gatilho em auth.users)
create table public.convites (
  email text primary key check (email = lower(email)),
  nome text not null,
  iniciais text not null check (char_length(iniciais) between 1 and 3),
  cargo text,
  perfil public.perfil not null,
  client_id uuid references public.clients (id) on delete cascade,
  convidado_por uuid references public.profiles (id) on delete set null,
  usuario_criado_em timestamptz,
  created_at timestamptz not null default now(),
  constraint convites_cliente_tem_client_id check ((perfil = 'cliente') = (client_id is not null))
);

-- ---------------------------------------------------------------- contratos e central do cliente
create table public.contracts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  inicio date not null,
  fim date,
  conteudos_mes integer not null check (conteudos_mes >= 0),
  ajustes_mes integer not null check (ajustes_mes >= 0),
  created_at timestamptz not null default now(),
  check (fim is null or fim >= inicio),
  -- um cliente não tem dois contratos valendo ao mesmo tempo
  exclude using gist (client_id with =, daterange(inicio, fim, '[]') with &&)
);

create table public.client_briefs (
  client_id uuid primary key references public.clients (id) on delete cascade,
  negocio text not null default '',
  publico text not null default '',
  objetivo text not null default '',
  tom_voz text[] not null default '{}',
  evitar text not null default '',
  cores text[] not null default '{}',
  -- [{ "nome": "Instagram", "liberado": true }]. Nunca guardar senhas aqui.
  acessos jsonb not null default '[]'::jsonb check (jsonb_typeof(acessos) = 'array'),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null
);

create table public.meeting_notes (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  data date not null,
  resumo text not null,
  autor_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index on public.meeting_notes (client_id, data desc);

-- ---------------------------------------------------------------- tarefas
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  tipo public.tipo_tarefa not null,
  client_id uuid references public.clients (id) on delete cascade, -- nulo = interno da agência
  titulo text not null check (char_length(trim(titulo)) > 0),
  formato public.formato,
  area public.area,
  etapa public.etapa not null,
  responsavel_id uuid references public.profiles (id) on delete set null,
  prazo date,
  texto text not null default '', -- legenda (conteúdo) ou descrição (demanda)
  publicar_em timestamptz,
  enviado_cliente_em timestamptz,
  horas numeric(6, 2) check (horas >= 0),
  criado_por uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tasks_etapa_do_tipo check (
    (tipo = 'conteudo' and etapa in ('pauta', 'copy', 'layout', 'revisao', 'cliente', 'ajuste', 'aprovado', 'agendado'))
    or (tipo = 'demanda' and etapa in ('a_fazer', 'fazendo', 'validacao', 'concluido'))
  ),
  constraint tasks_formato_so_em_conteudo check ((tipo = 'conteudo') = (formato is not null)),
  constraint tasks_area_so_em_demanda check ((tipo = 'demanda') = (area is not null)),
  constraint tasks_conteudo_tem_cliente check (tipo = 'demanda' or client_id is not null),
  constraint tasks_agendado_tem_data check (etapa <> 'agendado' or publicar_em is not null),
  constraint tasks_legenda_ate_2200 check (tipo <> 'conteudo' or char_length(texto) <= 2200)
);
create index on public.tasks (client_id);
create index on public.tasks (responsavel_id);
create index on public.tasks (prazo);
create index on public.tasks (etapa);

create table public.task_assets (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  caminho text not null unique, -- caminho no bucket "artes": client_id/task_id/arquivo
  tipo_midia text not null check (tipo_midia in ('imagem', 'video')),
  ordem integer not null default 0,
  criado_por uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index on public.task_assets (task_id, ordem);

create table public.task_notes (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  tipo public.tipo_nota not null,
  texto text not null check (char_length(trim(texto)) > 0),
  autor_id uuid references public.profiles (id) on delete set null,
  resolvido boolean not null default false,
  resolvido_por uuid references public.profiles (id) on delete set null,
  resolvido_em timestamptz,
  created_at timestamptz not null default now()
);
create index on public.task_notes (task_id, created_at);

-- Histórico de etapas. Base do relatório de entregas, da contagem de ajustes
-- e do registro de quem aprovou o quê e quando (LGPD). Só gatilhos escrevem aqui.
create table public.task_events (
  id bigint generated always as identity primary key,
  task_id uuid not null references public.tasks (id) on delete cascade,
  de_etapa public.etapa,
  para_etapa public.etapa not null,
  ator_id uuid references public.profiles (id) on delete set null,
  ator_nome text, -- cópia do nome, para o registro sobreviver se a pessoa sair
  origem public.origem_evento not null,
  created_at timestamptz not null default now()
);
create index on public.task_events (task_id, created_at);
create index on public.task_events (para_etapa, origem, created_at);

-- ---------------------------------------------------------------- configurações
create table public.stage_defaults (
  etapa public.etapa primary key
    check (etapa in ('pauta', 'copy', 'layout', 'revisao', 'cliente', 'ajuste', 'aprovado', 'agendado')),
  responsavel_id uuid references public.profiles (id) on delete set null
);
insert into public.stage_defaults (etapa)
values ('pauta'), ('copy'), ('layout'), ('revisao'), ('cliente'), ('ajuste'), ('aprovado'), ('agendado');

create table public.app_settings (
  id smallint primary key default 1 check (id = 1),
  dias_lembrete integer not null default 2 check (dias_lembrete between 1 and 30),
  updated_at timestamptz not null default now()
);
insert into public.app_settings default values;

-- ---------------------------------------------------------------- avisos (sino + fila de e-mails)
create table public.notifications (
  id bigint generated always as identity primary key,
  destinatario_id uuid not null references public.profiles (id) on delete cascade,
  tipo text not null,
  task_id uuid references public.tasks (id) on delete cascade,
  client_id uuid references public.clients (id) on delete cascade,
  texto text not null,
  link text,
  lida_em timestamptz,
  email_enviado_em timestamptz,
  created_at timestamptz not null default now()
);
create index on public.notifications (destinatario_id, lida_em);
create index on public.notifications (email_enviado_em) where email_enviado_em is null;
