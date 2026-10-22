-- Bastidor · Fase 1 · perfis e regras de acesso (RLS)
-- Regra que não pode falhar: um cliente nunca vê nada de outro cliente nem nada interno da agência.

-- ---------------------------------------------------------------- quem sou eu
-- security definer: leem profiles sem passar pela RLS (evita recursão nas políticas)
create function public.meu_perfil() returns public.perfil
language sql stable security definer set search_path = '' as $$
  select perfil from public.profiles where id = auth.uid() and ativo
$$;

create function public.meu_cliente() returns uuid
language sql stable security definer set search_path = '' as $$
  select client_id from public.profiles where id = auth.uid() and ativo and perfil = 'cliente'
$$;

create function public.e_time() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(public.meu_perfil() in ('socio', 'adm', 'criacao'), false)
$$;

create function public.e_gestao() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(public.meu_perfil() in ('socio', 'adm'), false)
$$;

create function public.e_socio() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(public.meu_perfil() = 'socio', false)
$$;

-- ---------------------------------------------------------------- só entra quem foi convidado
-- Todo usuário novo do Auth precisa de um convite. Sem convite, o cadastro é recusado,
-- mesmo que o cadastro público do Supabase esteja ligado.
create function public.criar_perfil_do_convite() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  c public.convites;
begin
  select * into c from public.convites where email = lower(new.email);
  if not found then
    raise exception 'Cadastro não permitido: % não tem convite', new.email using errcode = '42501';
  end if;
  insert into public.profiles (id, nome, email, iniciais, cargo, perfil, client_id)
  values (new.id, c.nome, c.email, c.iniciais, c.cargo, c.perfil, c.client_id);
  update public.convites set usuario_criado_em = now() where email = c.email;
  return new;
end
$$;

create trigger criar_perfil_do_convite
after insert on auth.users
for each row execute function public.criar_perfil_do_convite();

-- ---------------------------------------------------------------- proteção do perfil
-- Perfil, cliente e ativo só mudam pelo Sócio (ou pelo Adm, entre pessoas de cliente).
create function public.proteger_perfil() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.perfil = 'socio' and old.ativo and (new.perfil <> 'socio' or not new.ativo)
     and not exists (select 1 from public.profiles where perfil = 'socio' and ativo and id <> old.id) then
    raise exception 'É preciso ter pelo menos um Sócio ativo' using errcode = '23514';
  end if;

  -- Sem usuário logado = servidor com a service role ou migration
  if auth.uid() is null then
    return new;
  end if;

  if new.id <> old.id or new.email <> old.email then
    raise exception 'E-mail e id não podem ser alterados por aqui' using errcode = '42501';
  end if;

  if (new.perfil, new.client_id, new.ativo) is distinct from (old.perfil, old.client_id, old.ativo)
     and not public.e_socio()
     and not (public.e_gestao() and old.perfil = 'cliente' and new.perfil = 'cliente') then
    raise exception 'Sem permissão para mudar perfil, cliente ou acesso' using errcode = '42501';
  end if;

  return new;
end
$$;

create trigger proteger_perfil
before update on public.profiles
for each row execute function public.proteger_perfil();

-- ---------------------------------------------------------------- permissões de base
-- Visitante sem login (anon) não lê nem escreve nada no schema public.
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke execute on all functions in schema public from anon, public;
alter default privileges for role postgres in schema public revoke all on tables from anon;
alter default privileges for role postgres in schema public revoke all on sequences from anon;
alter default privileges for role postgres in schema public revoke execute on functions from anon, public;

grant execute on function public.meu_perfil(), public.meu_cliente(), public.e_time(), public.e_gestao(), public.e_socio()
  to authenticated;

-- profiles: ninguém troca o próprio e-mail ou id pela API
revoke update on public.profiles from authenticated;
grant update (nome, iniciais, cargo, emails_opcionais, perfil, client_id, ativo) on public.profiles to authenticated;
-- histórico de etapas: só gatilhos escrevem
revoke insert, update, delete on public.task_events from authenticated;

-- ---------------------------------------------------------------- RLS
alter table public.clients enable row level security;
alter table public.profiles enable row level security;
alter table public.convites enable row level security;
alter table public.contracts enable row level security;
alter table public.client_briefs enable row level security;
alter table public.meeting_notes enable row level security;
alter table public.tasks enable row level security;
alter table public.task_assets enable row level security;
alter table public.task_notes enable row level security;
alter table public.task_events enable row level security;
alter table public.stage_defaults enable row level security;
alter table public.app_settings enable row level security;
alter table public.notifications enable row level security;

-- clients: o time vê todos; o cliente vê só a própria linha (nome e marca no portal)
create policy clients_ler on public.clients for select to authenticated
  using ((select public.e_time()) or id = (select public.meu_cliente()));
create policy clients_criar on public.clients for insert to authenticated
  with check ((select public.e_gestao()));
create policy clients_editar on public.clients for update to authenticated
  using ((select public.e_gestao())) with check ((select public.e_gestao()));
create policy clients_apagar on public.clients for delete to authenticated
  using ((select public.e_socio()));

-- profiles: gestão vê todos; Criação vê o time; cada um vê a si mesmo
create policy profiles_ler on public.profiles for select to authenticated
  using (
    id = (select auth.uid())
    or (select public.e_gestao())
    or ((select public.e_time()) and perfil <> 'cliente')
  );
create policy profiles_editar on public.profiles for update to authenticated
  using (
    id = (select auth.uid())
    or (select public.e_socio())
    or ((select public.e_gestao()) and perfil = 'cliente')
  )
  with check (
    id = (select auth.uid())
    or (select public.e_socio())
    or ((select public.e_gestao()) and perfil = 'cliente')
  );

-- convites: Sócio convida qualquer perfil; Adm convida só pessoas de cliente
create policy convites_tudo on public.convites for all to authenticated
  using ((select public.e_socio()) or ((select public.e_gestao()) and perfil = 'cliente'))
  with check ((select public.e_socio()) or ((select public.e_gestao()) and perfil = 'cliente'));

-- contracts: Sócio edita, Adm vê, Criação e cliente nada
create policy contracts_ler on public.contracts for select to authenticated
  using ((select public.e_gestao()));
create policy contracts_criar on public.contracts for insert to authenticated
  with check ((select public.e_socio()));
create policy contracts_editar on public.contracts for update to authenticated
  using ((select public.e_socio())) with check ((select public.e_socio()));
create policy contracts_apagar on public.contracts for delete to authenticated
  using ((select public.e_socio()));

-- Central do cliente: o time lê; Sócio e Adm editam (Criação só lê)
create policy briefs_ler on public.client_briefs for select to authenticated
  using ((select public.e_time()));
create policy briefs_escrever on public.client_briefs for all to authenticated
  using ((select public.e_gestao())) with check ((select public.e_gestao()));

create policy atas_ler on public.meeting_notes for select to authenticated
  using ((select public.e_time()));
create policy atas_escrever on public.meeting_notes for all to authenticated
  using ((select public.e_gestao())) with check ((select public.e_gestao()));

-- Tarefas: só o time. O cliente usa as funções do portal (etapa 6), nunca as tabelas.
create policy tasks_ler on public.tasks for select to authenticated
  using ((select public.e_time()));
create policy tasks_criar on public.tasks for insert to authenticated
  with check ((select public.e_time()));
create policy tasks_editar on public.tasks for update to authenticated
  using ((select public.e_time())) with check ((select public.e_time()));
create policy tasks_apagar on public.tasks for delete to authenticated
  using ((select public.e_gestao()));

create policy assets_tudo on public.task_assets for all to authenticated
  using ((select public.e_time())) with check ((select public.e_time()));

create policy notes_ler on public.task_notes for select to authenticated
  using ((select public.e_time()));
create policy notes_criar on public.task_notes for insert to authenticated
  with check ((select public.e_time()) and autor_id = (select auth.uid()));
create policy notes_editar on public.task_notes for update to authenticated
  using ((select public.e_time())) with check ((select public.e_time()));
create policy notes_apagar on public.task_notes for delete to authenticated
  using (autor_id = (select auth.uid()) or (select public.e_gestao()));

create policy events_ler on public.task_events for select to authenticated
  using ((select public.e_time()));

-- Configurações: o time lê; só o Sócio muda
create policy stage_defaults_ler on public.stage_defaults for select to authenticated
  using ((select public.e_time()));
create policy stage_defaults_editar on public.stage_defaults for update to authenticated
  using ((select public.e_socio())) with check ((select public.e_socio()));

create policy app_settings_ler on public.app_settings for select to authenticated
  using ((select public.e_time()));
create policy app_settings_editar on public.app_settings for update to authenticated
  using ((select public.e_socio())) with check ((select public.e_socio()));

-- Avisos: cada um vê e marca como lidos só os seus. Quem cria é o servidor.
create policy avisos_ler on public.notifications for select to authenticated
  using (destinatario_id = (select auth.uid()));
create policy avisos_marcar_lido on public.notifications for update to authenticated
  using (destinatario_id = (select auth.uid())) with check (destinatario_id = (select auth.uid()));
revoke insert, delete on public.notifications from authenticated;
revoke update on public.notifications from authenticated;
grant update (lida_em) on public.notifications to authenticated;
