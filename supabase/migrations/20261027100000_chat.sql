-- Bastidor · Chat interno do time (Sócio, Adm e Criação; cliente nunca vê)

create table public.chat_canais (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (nome ~ '^[a-z0-9][a-z0-9-]{0,39}$'), -- ex.: geral, criacao, otica-barbosa
  client_id uuid references public.clients (id) on delete cascade, -- canal ligado a um cliente (opcional)
  arquivado boolean not null default false,
  criado_por uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create unique index on public.chat_canais (nome);
insert into public.chat_canais (nome) values ('geral');

create table public.chat_mensagens (
  id uuid primary key default gen_random_uuid(),
  canal_id uuid not null references public.chat_canais (id) on delete cascade,
  autor_id uuid references public.profiles (id) on delete set null,
  autor_nome text,
  texto text not null default '' check (char_length(texto) <= 4000),
  -- [{ "caminho": "canal/arquivo", "nome": "proposta.pdf", "tipo": "application/pdf", "tamanho": 12345 }]
  anexos jsonb not null default '[]'::jsonb check (jsonb_typeof(anexos) = 'array'),
  editada_em timestamptz,
  created_at timestamptz not null default now(),
  constraint chat_mensagem_nao_vazia check (char_length(trim(texto)) > 0 or jsonb_array_length(anexos) > 0)
);
create index on public.chat_mensagens (canal_id, created_at desc);

-- Até onde cada pessoa leu cada canal (contador de não lidas)
create table public.chat_leituras (
  pessoa_id uuid not null references public.profiles (id) on delete cascade,
  canal_id uuid not null references public.chat_canais (id) on delete cascade,
  lido_em timestamptz not null default now(),
  primary key (pessoa_id, canal_id)
);

-- ---------------------------------------------------------------- autor e menções
create function public.preparar_mensagem() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.autor_nome := (select nome from public.profiles where id = new.autor_id);
  return new;
end
$$;
create trigger preparar_mensagem before insert on public.chat_mensagens
for each row execute function public.preparar_mensagem();

-- @Nome avisa a pessoa no sino (pelo primeiro nome, sem diferenciar maiúsculas). Só sino, sem e-mail.
create function public.avisar_mencoes() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  canal text;
begin
  if position('@' in new.texto) = 0 then
    return null;
  end if;
  select nome into canal from public.chat_canais where id = new.canal_id;
  insert into public.notifications (destinatario_id, tipo, texto, link, email_enviado_em)
  select p.id, 'mencao',
         coalesce(new.autor_nome, 'Alguém') || ' mencionou você em #' || canal || ': ' || left(new.texto, 140),
         '/chat?canal=' || new.canal_id,
         now() -- sem e-mail: já nasce como tratado para a fila de envios
  from public.profiles p
  where p.perfil <> 'cliente' and p.ativo and p.id is distinct from new.autor_id
    and lower(new.texto) ~ ('@' || lower(split_part(p.nome, ' ', 1)) || '([^[:alnum:]]|$)');
  return null;
end
$$;
create trigger avisar_mencoes after insert on public.chat_mensagens
for each row execute function public.avisar_mencoes();

-- Não lidas por canal (respeita a RLS de quem pergunta)
create function public.chat_nao_lidas()
returns table (canal_id uuid, total bigint)
language sql stable set search_path = '' as $$
  select m.canal_id, count(*)
  from public.chat_mensagens m
  join public.chat_canais c on c.id = m.canal_id and not c.arquivado
  left join public.chat_leituras l on l.canal_id = m.canal_id and l.pessoa_id = auth.uid()
  where m.autor_id is distinct from auth.uid() and m.created_at > coalesce(l.lido_em, '-infinity'::timestamptz)
  group by m.canal_id
$$;

-- ---------------------------------------------------------------- acesso: só o time
alter table public.chat_canais enable row level security;
alter table public.chat_mensagens enable row level security;
alter table public.chat_leituras enable row level security;

create policy canais_ler on public.chat_canais for select to authenticated using ((select public.e_time()));
create policy canais_criar on public.chat_canais for insert to authenticated with check ((select public.e_gestao()));
create policy canais_editar on public.chat_canais for update to authenticated
  using ((select public.e_gestao()) and nome <> 'geral') with check ((select public.e_gestao()) and nome <> 'geral');

create policy mensagens_ler on public.chat_mensagens for select to authenticated using ((select public.e_time()));
create policy mensagens_enviar on public.chat_mensagens for insert to authenticated
  with check ((select public.e_time()) and autor_id = (select auth.uid())
              and not exists (select 1 from public.chat_canais c where c.id = canal_id and c.arquivado));
create policy mensagens_editar on public.chat_mensagens for update to authenticated
  using ((select public.e_time()) and autor_id = (select auth.uid()))
  with check ((select public.e_time()) and autor_id = (select auth.uid()));
create policy mensagens_apagar on public.chat_mensagens for delete to authenticated
  using ((select public.e_time()) and (autor_id = (select auth.uid()) or (select public.e_socio())));
-- Na edição só o texto muda
revoke update on public.chat_mensagens from authenticated;
grant update (texto, editada_em) on public.chat_mensagens to authenticated;

create policy leituras_proprias on public.chat_leituras for all to authenticated
  using ((select public.e_time()) and pessoa_id = (select auth.uid()))
  with check ((select public.e_time()) and pessoa_id = (select auth.uid()));

grant execute on function public.chat_nao_lidas() to authenticated;

-- ---------------------------------------------------------------- anexos (bucket privado "chat", até 25 MB)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('chat', 'chat', false, 26214400, array[
  'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/quicktime', 'application/pdf', 'text/plain',
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
])
on conflict (id) do nothing;

create policy chat_ler on storage.objects for select to authenticated
  using (bucket_id = 'chat' and public.e_time());
create policy chat_enviar on storage.objects for insert to authenticated
  with check (bucket_id = 'chat' and public.e_time());
create policy chat_apagar on storage.objects for delete to authenticated
  using (bucket_id = 'chat' and public.e_time() and (owner = auth.uid() or public.e_socio()));

-- ---------------------------------------------------------------- tempo real (Supabase Realtime, respeitando a RLS)
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.chat_mensagens;
  end if;
end
$$;

revoke execute on function public.preparar_mensagem(), public.avisar_mencoes() from public, anon;

-- ---------------------------------------------------------------- uso do armazenamento (plano gratuito: 1 GB)
create function public.uso_armazenamento()
returns table (bucket text, arquivos bigint, bytes bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.e_gestao() then
    raise exception 'Sem permissão' using errcode = '42501';
  end if;
  return query
    select o.bucket_id::text, count(*), coalesce(sum((o.metadata ->> 'size')::bigint), 0)::bigint
    from storage.objects o
    where o.bucket_id in ('artes', 'chat')
    group by o.bucket_id;
end
$$;
revoke execute on function public.uso_armazenamento() from public, anon;
grant execute on function public.uso_armazenamento() to authenticated;
