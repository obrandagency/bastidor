-- Bastidor · CRM: funil comercial da agência (Sócio e Adm; Criação e cliente não veem)

create type public.etapa_lead as enum ('novo', 'contato', 'reuniao', 'proposta', 'negociacao', 'ganho', 'perdido');
create type public.origem_lead as enum ('indicacao', 'instagram', 'trafego_pago', 'site', 'evento', 'prospeccao');

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  empresa text not null check (char_length(trim(empresa)) > 0),
  contato text,
  whatsapp text,
  segmento text,
  cidade text,
  origem public.origem_lead,
  servicos text[] not null default '{}'
    check (servicos <@ array['social_media', 'trafego_pago', 'branding', 'identidade_visual', 'video', 'endomarketing', 'outros']),
  valor_mensal numeric(10, 2) not null default 0 check (valor_mensal >= 0),
  etapa public.etapa_lead not null default 'novo',
  responsavel_id uuid references public.profiles (id) on delete set null,
  proximo_passo text,
  proximo_passo_em date,
  motivo_perda text,
  fechado_em date,
  client_id uuid references public.clients (id) on delete set null, -- quando vira cliente
  criado_por uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint leads_perdido_tem_motivo check (etapa <> 'perdido' or char_length(trim(coalesce(motivo_perda, ''))) > 0)
);
create index on public.leads (etapa);
create index on public.leads (responsavel_id);
create index on public.leads (proximo_passo_em) where etapa not in ('ganho', 'perdido');

-- Histórico: anotações (ligação, reunião, mensagem) e mudanças de etapa (gravadas pelo gatilho)
create table public.lead_eventos (
  id bigint generated always as identity primary key,
  lead_id uuid not null references public.leads (id) on delete cascade,
  tipo text not null check (tipo in ('nota', 'etapa')),
  texto text not null check (char_length(trim(texto)) > 0),
  autor_id uuid references public.profiles (id) on delete set null,
  autor_nome text,
  created_at timestamptz not null default now()
);
create index on public.lead_eventos (lead_id, created_at);

-- ---------------------------------------------------------------- regras
create function public.rotulo_etapa_lead(e public.etapa_lead) returns text
language sql immutable set search_path = '' as $$
  select case e
    when 'novo' then 'Novo lead' when 'contato' then 'Primeiro contato' when 'reuniao' then 'Reunião marcada'
    when 'proposta' then 'Proposta enviada' when 'negociacao' then 'Negociação' when 'ganho' then 'Fechado'
    when 'perdido' then 'Perdido'
  end
$$;

create function public.regras_do_lead() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.updated_at := now();
  if tg_op = 'INSERT' then
    new.criado_por := coalesce(new.criado_por, auth.uid());
  end if;
  if tg_op = 'INSERT' or new.etapa is distinct from old.etapa then
    if new.etapa in ('ganho', 'perdido') then
      -- Fechado ou perdido: guarda a data e encerra o follow-up
      new.fechado_em := (now() at time zone 'America/Sao_Paulo')::date;
      new.proximo_passo := null;
      new.proximo_passo_em := null;
    else
      new.fechado_em := null;
    end if;
    if new.etapa <> 'perdido' then
      new.motivo_perda := null;
    end if;
  end if;
  return new;
end
$$;

create trigger regras_do_lead
before insert or update on public.leads
for each row execute function public.regras_do_lead();

create function public.registrar_etapa_lead() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  quem public.profiles;
begin
  if tg_op = 'UPDATE' and new.etapa is not distinct from old.etapa then
    return null;
  end if;
  select * into quem from public.profiles where id = auth.uid();
  insert into public.lead_eventos (lead_id, tipo, texto, autor_id, autor_nome)
  values (
    new.id, 'etapa',
    case when tg_op = 'INSERT' then 'Entrou em ' else 'Movido para ' end || public.rotulo_etapa_lead(new.etapa)
      || case when new.etapa = 'perdido' then ': ' || new.motivo_perda else '' end,
    quem.id, quem.nome
  );
  return null;
end
$$;

create trigger registrar_etapa_lead
after insert or update on public.leads
for each row execute function public.registrar_etapa_lead();

-- ---------------------------------------------------------------- acesso: Sócio e Adm
alter table public.leads enable row level security;
alter table public.lead_eventos enable row level security;

create policy leads_tudo on public.leads for all to authenticated
  using ((select public.e_gestao())) with check ((select public.e_gestao()));

create policy lead_eventos_ler on public.lead_eventos for select to authenticated
  using ((select public.e_gestao()));
create policy lead_eventos_anotar on public.lead_eventos for insert to authenticated
  with check ((select public.e_gestao()) and tipo = 'nota' and autor_id = (select auth.uid()));
create policy lead_eventos_apagar on public.lead_eventos for delete to authenticated
  using ((select public.e_gestao()) and tipo = 'nota');
revoke update on public.lead_eventos from authenticated;

revoke execute on function public.rotulo_etapa_lead(public.etapa_lead), public.regras_do_lead(), public.registrar_etapa_lead()
  from public, anon;
