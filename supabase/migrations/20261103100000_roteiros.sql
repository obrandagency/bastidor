-- Roteiros de vídeo: só do time (o cliente não vê). Cada roteiro tem cenas em ordem e pode estar
-- ligado a um conteúdo do quadro. O PDF sai no timbrado da agência (identidade.timbrado).

-- Timbrado: imagem A4 usada de fundo em todas as páginas; margens em mm para o texto não cobrir
-- o cabeçalho e o rodapé do papel; rodapé em texto para quando não houver timbrado
alter table public.identidade
  add column timbrado text check (timbrado ~ '^agencia/[A-Za-z0-9_-]+\.webp$'),
  add column margem_topo smallint not null default 35 check (margem_topo between 5 and 120),
  add column margem_base smallint not null default 25 check (margem_base between 5 and 120),
  add column rodape text not null default '' check (char_length(rodape) <= 300);

create table public.roteiros (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients (id) on delete cascade, -- nulo = interno da agência
  task_id uuid references public.tasks (id) on delete set null,      -- conteúdo do quadro (opcional)
  titulo text not null check (char_length(trim(titulo)) between 1 and 200),
  formato text not null default 'reels' check (formato in ('reels', 'stories', 'tiktok', 'youtube', 'institucional', 'outro')),
  duracao text not null default '' check (char_length(duracao) <= 40),
  objetivo text not null default '' check (char_length(objetivo) <= 2000),
  referencias text not null default '' check (char_length(referencias) <= 2000),
  texto_livre text not null default '' check (char_length(texto_livre) <= 20000),
  cta text not null default '' check (char_length(cta) <= 500),
  legenda text not null default '' check (char_length(legenda) <= 2200),
  situacao text not null default 'rascunho' check (situacao in ('rascunho', 'revisao', 'aprovado')),
  criado_por uuid references public.profiles (id) on delete set null default auth.uid(),
  atualizado_por uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.roteiros (client_id);
create index on public.roteiros (task_id);

create table public.roteiro_cenas (
  id uuid primary key default gen_random_uuid(),
  roteiro_id uuid not null references public.roteiros (id) on delete cascade,
  ordem integer not null default 0,
  tempo text not null default '' check (char_length(tempo) <= 40),
  imagem text not null default '' check (char_length(imagem) <= 3000),     -- o que aparece
  fala text not null default '' check (char_length(fala) <= 3000),         -- fala ou narração
  texto_tela text not null default '' check (char_length(texto_tela) <= 1000),
  audio text not null default '' check (char_length(audio) <= 500)         -- trilha, efeitos
);
create index on public.roteiro_cenas (roteiro_id, ordem);

create function public.tocar_roteiro() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  new.atualizado_por := auth.uid();
  return new;
end
$$;
create trigger tocar_roteiro before update on public.roteiros
for each row execute function public.tocar_roteiro();

-- Regrava as cenas na ordem da tela numa transação só (ou salva tudo, ou nada muda)
create function public.salvar_roteiro_cenas(p_roteiro uuid, p_cenas jsonb) returns void
language plpgsql set search_path = '' as $$
begin
  if jsonb_typeof(p_cenas) <> 'array' or jsonb_array_length(p_cenas) > 200 then
    raise exception 'Até 200 cenas por roteiro' using errcode = '23514';
  end if;
  delete from public.roteiro_cenas where roteiro_id = p_roteiro;
  insert into public.roteiro_cenas (roteiro_id, ordem, tempo, imagem, fala, texto_tela, audio)
  select p_roteiro, n::integer,
         coalesce(c ->> 'tempo', ''), coalesce(c ->> 'imagem', ''), coalesce(c ->> 'fala', ''),
         coalesce(c ->> 'texto_tela', ''), coalesce(c ->> 'audio', '')
  from jsonb_array_elements(p_cenas) with ordinality as x(c, n);
end
$$;

alter table public.roteiros enable row level security;
alter table public.roteiro_cenas enable row level security;

-- Todo o time escreve; apagar só Sócio, Adm ou quem criou
create policy roteiros_ler on public.roteiros for select to authenticated using ((select public.e_time()));
create policy roteiros_criar on public.roteiros for insert to authenticated with check ((select public.e_time()));
create policy roteiros_editar on public.roteiros for update to authenticated
  using ((select public.e_time())) with check ((select public.e_time()));
create policy roteiros_apagar on public.roteiros for delete to authenticated
  using ((select public.e_gestao()) or ((select public.e_time()) and criado_por = (select auth.uid())));
create policy roteiro_cenas_time on public.roteiro_cenas for all to authenticated
  using ((select public.e_time())) with check ((select public.e_time()));

grant select, insert, update, delete on public.roteiros, public.roteiro_cenas to authenticated;
revoke execute on function public.tocar_roteiro() from public, anon;
revoke execute on function public.salvar_roteiro_cenas(uuid, jsonb) from public, anon;
grant execute on function public.salvar_roteiro_cenas(uuid, jsonb) to authenticated;
