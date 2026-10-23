-- Chat: membros por canal. Quem não é membro não vê o canal nem as mensagens (a não ser Sócio e Adm,
-- que administram os canais). O #geral é do time todo (todos = true). Os canais que já existiam
-- começam com todo o time ativo, para ninguém perder nada.

alter table public.chat_canais add column todos boolean not null default false;
update public.chat_canais set todos = true where nome = 'geral';

create table public.chat_membros (
  canal_id uuid not null references public.chat_canais (id) on delete cascade,
  pessoa_id uuid not null references public.profiles (id) on delete cascade,
  adicionado_por uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  primary key (canal_id, pessoa_id)
);
create index on public.chat_membros (pessoa_id);

insert into public.chat_membros (canal_id, pessoa_id, adicionado_por)
select c.id, p.id, null
from public.chat_canais c cross join public.profiles p
where not c.todos and p.ativo and p.perfil <> 'cliente'
on conflict do nothing;

-- Quem criou o canal entra como membro
create function public.membro_criador() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is not null and not new.todos then
    insert into public.chat_membros (canal_id, pessoa_id) values (new.id, auth.uid()) on conflict do nothing;
  end if;
  return null;
end
$$;
create trigger membro_criador after insert on public.chat_canais
for each row execute function public.membro_criador();

-- Pode ver (e escrever, se não estiver arquivado) no canal
create function public.pode_ver_canal(p_canal uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.e_time() and (
    public.e_gestao()
    or exists (select 1 from public.chat_canais c where c.id = p_canal and c.todos)
    or exists (select 1 from public.chat_membros m where m.canal_id = p_canal and m.pessoa_id = auth.uid())
  )
$$;

-- Primeira pasta do caminho no bucket "chat" é o id do canal
create function public.pode_ver_arquivo_chat(p_nome text) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare
  pasta text := (storage.foldername(p_nome))[1];
begin
  if pasta is null or pasta !~ '^[0-9a-f-]{36}$' then
    return false;
  end if;
  return public.pode_ver_canal(pasta::uuid);
end
$$;

-- ---------------------------------------------------------------- políticas com membros
drop policy canais_ler on public.chat_canais;
create policy canais_ler on public.chat_canais for select to authenticated using ((select public.pode_ver_canal(id)));

drop policy mensagens_ler on public.chat_mensagens;
create policy mensagens_ler on public.chat_mensagens for select to authenticated using ((select public.pode_ver_canal(canal_id)));
drop policy mensagens_enviar on public.chat_mensagens;
create policy mensagens_enviar on public.chat_mensagens for insert to authenticated
  with check ((select public.pode_ver_canal(canal_id)) and autor_id = (select auth.uid())
              and not exists (select 1 from public.chat_canais c where c.id = canal_id and c.arquivado));

drop policy reacoes_ler on public.chat_reacoes;
create policy reacoes_ler on public.chat_reacoes for select to authenticated
  using ((select public.pode_ver_canal((select m.canal_id from public.chat_mensagens m where m.id = mensagem_id))));
drop policy reacoes_minhas on public.chat_reacoes;
create policy reacoes_minhas on public.chat_reacoes for insert to authenticated
  with check (pessoa_id = (select auth.uid()) and (select public.pode_ver_canal((select m.canal_id from public.chat_mensagens m where m.id = mensagem_id))));

drop policy chat_tarefas_ler on public.chat_tarefas;
create policy chat_tarefas_ler on public.chat_tarefas for select to authenticated
  using ((select public.pode_ver_canal((select m.canal_id from public.chat_mensagens m where m.id = mensagem_id))));

drop policy chat_ler on storage.objects;
create policy chat_ler on storage.objects for select to authenticated
  using (bucket_id = 'chat' and public.pode_ver_arquivo_chat(name));
drop policy chat_enviar on storage.objects;
create policy chat_enviar on storage.objects for insert to authenticated
  with check (bucket_id = 'chat' and public.pode_ver_arquivo_chat(name));

alter table public.chat_membros enable row level security;
create policy membros_ler on public.chat_membros for select to authenticated using ((select public.pode_ver_canal(canal_id)));
create policy membros_gestao on public.chat_membros for insert to authenticated with check ((select public.e_gestao()));
create policy membros_tirar on public.chat_membros for delete to authenticated using ((select public.e_gestao()));
grant select, insert, delete on public.chat_membros to authenticated;

-- ---------------------------------------------------------------- @menção só avisa quem está no canal
create or replace function public.avisar_mencoes() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  canal public.chat_canais;
begin
  if position('@' in new.texto) = 0 then
    return null;
  end if;
  select * into canal from public.chat_canais where id = new.canal_id;
  insert into public.notifications (destinatario_id, tipo, texto, link, email_enviado_em)
  select p.id, 'mencao',
         coalesce(new.autor_nome, 'Alguém') || ' mencionou você em #' || canal.nome || ': ' || left(new.texto, 140),
         '/chat?canal=' || new.canal_id,
         now() -- sem e-mail: já nasce como tratado para a fila de envios
  from public.profiles p
  where p.perfil <> 'cliente' and p.ativo and p.id is distinct from new.autor_id
    and (canal.todos or p.perfil in ('socio', 'adm') or exists (select 1 from public.chat_membros m where m.canal_id = canal.id and m.pessoa_id = p.id))
    and lower(new.texto) ~ ('@' || lower(split_part(p.nome, ' ', 1)) || '([^[:alnum:]]|$)');
  return null;
end
$$;

-- ---------------------------------------------------------------- encaminhar só de canal que a pessoa vê
create or replace function public.preparar_mensagem() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  o public.chat_mensagens;
begin
  new.autor_nome := (select nome from public.profiles where id = new.autor_id);
  new.encaminhada := null;
  if new.encaminhada_de is not null then
    select * into o from public.chat_mensagens where id = new.encaminhada_de;
    if not found or not public.pode_ver_canal(o.canal_id) then
      raise exception 'Mensagem original não encontrada' using errcode = 'P0002';
    end if;
    new.texto := o.texto;
    new.anexos := o.anexos;
    new.encaminhada := jsonb_build_object(
      'canal', (select nome from public.chat_canais where id = o.canal_id),
      'autor', coalesce(o.encaminhada ->> 'autor', o.autor_nome)
    );
  end if;
  return new;
end
$$;

revoke execute on function public.membro_criador() from public, anon;
revoke execute on function public.pode_ver_canal(uuid), public.pode_ver_arquivo_chat(text) from public, anon;
grant execute on function public.pode_ver_canal(uuid), public.pode_ver_arquivo_chat(text) to authenticated;
