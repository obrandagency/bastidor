-- Chat: reações com emoji, encaminhar entre canais, mensagens de áudio e menção de tarefa (#)

-- ---------------------------------------------------------------- reações
create table public.chat_reacoes (
  mensagem_id uuid not null references public.chat_mensagens (id) on delete cascade,
  pessoa_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  emoji text not null check (char_length(emoji) between 1 and 16),
  created_at timestamptz not null default now(),
  primary key (mensagem_id, pessoa_id, emoji)
);
alter table public.chat_reacoes enable row level security;
create policy reacoes_ler on public.chat_reacoes for select to authenticated using ((select public.e_time()));
create policy reacoes_minhas on public.chat_reacoes for insert to authenticated
  with check ((select public.e_time()) and pessoa_id = (select auth.uid()));
create policy reacoes_tirar on public.chat_reacoes for delete to authenticated
  using ((select public.e_time()) and pessoa_id = (select auth.uid()));
grant select, insert, delete on public.chat_reacoes to authenticated;

-- ---------------------------------------------------------------- encaminhar
-- A mensagem encaminhada repete o texto e os anexos da original (os arquivos não são duplicados) e guarda
-- de onde veio. O gatilho copia tudo da original: ninguém escreve "encaminhada de" à mão.
alter table public.chat_mensagens
  add column encaminhada_de uuid references public.chat_mensagens (id) on delete set null,
  add column encaminhada jsonb; -- { "canal": "geral", "autor": "Mayara" }

create or replace function public.preparar_mensagem() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  o public.chat_mensagens;
begin
  new.autor_nome := (select nome from public.profiles where id = new.autor_id);
  new.encaminhada := null;
  if new.encaminhada_de is not null then
    select * into o from public.chat_mensagens where id = new.encaminhada_de;
    if not found then
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

-- ---------------------------------------------------------------- áudio
update storage.buckets
set allowed_mime_types = array(select distinct unnest(allowed_mime_types || array['audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/ogg', 'audio/aac']))
where id = 'chat';

-- ---------------------------------------------------------------- menção de tarefa
-- No texto a tarefa vai como #[Título](id). O gatilho guarda a ligação para o detalhe da tarefa
-- mostrar "Conversas sobre esta tarefa". Sem aviso no sino.
create table public.chat_tarefas (
  mensagem_id uuid not null references public.chat_mensagens (id) on delete cascade,
  task_id uuid not null references public.tasks (id) on delete cascade,
  primary key (mensagem_id, task_id)
);
create index on public.chat_tarefas (task_id);
alter table public.chat_tarefas enable row level security;
create policy chat_tarefas_ler on public.chat_tarefas for select to authenticated using ((select public.e_time()));
grant select on public.chat_tarefas to authenticated;

create function public.ligar_tarefas_mencionadas() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' then
    delete from public.chat_tarefas where mensagem_id = new.id;
  end if;
  insert into public.chat_tarefas (mensagem_id, task_id)
  select distinct new.id, t.id
  from regexp_matches(new.texto, '#\[[^\]]*\]\(([0-9a-f-]{36})\)', 'g') as m(grupo)
  join public.tasks t on t.id = m.grupo[1]::uuid
  on conflict do nothing;
  return null;
end
$$;
create trigger ligar_tarefas_mencionadas after insert or update of texto on public.chat_mensagens
for each row execute function public.ligar_tarefas_mencionadas();

revoke execute on function public.ligar_tarefas_mencionadas() from public, anon;

-- Reações ao vivo
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.chat_reacoes;
  end if;
end
$$;
