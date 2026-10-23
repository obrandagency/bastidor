-- Central do cliente com menu próprio (08/11): segmento do cliente e quadro de inspirações

-- ---------------------------------------------------------------- segmento (ex.: Ótica, Restaurante)
alter table public.clients add column segmento text;

-- ---------------------------------------------------------------- inspirações (referências do time para o cliente)
create table public.inspiracoes (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  titulo text not null check (length(trim(titulo)) > 0),
  link text check (link is null or link ~ '^https?://'),
  nota text,
  imagem text, -- bucket "inspiracoes": client_id/arquivo
  criado_por uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  check (imagem is null or imagem like client_id::text || '/%')
);
create index inspiracoes_cliente on public.inspiracoes (client_id, created_at desc);

alter table public.inspiracoes enable row level security;

-- Só o time (cliente nunca vê). Todo o time adiciona; editar e apagar: quem criou, Sócio ou Adm
create policy inspiracoes_ler on public.inspiracoes for select to authenticated using ((select public.e_time()));
create policy inspiracoes_criar on public.inspiracoes for insert to authenticated
  with check ((select public.e_time()) and criado_por = (select auth.uid()));
create policy inspiracoes_editar on public.inspiracoes for update to authenticated
  using ((select public.e_gestao()) or ((select public.e_time()) and criado_por = (select auth.uid())))
  with check ((select public.e_time()));
create policy inspiracoes_apagar on public.inspiracoes for delete to authenticated
  using ((select public.e_gestao()) or ((select public.e_time()) and criado_por = (select auth.uid())));
grant select, insert, update, delete on public.inspiracoes to authenticated;

-- Imagens das inspirações (bucket privado, até 10 MB, só imagens)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('inspiracoes', 'inspiracoes', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do nothing;
create policy inspiracoes_arq_ler on storage.objects for select to authenticated using (bucket_id = 'inspiracoes' and public.e_time());
create policy inspiracoes_arq_enviar on storage.objects for insert to authenticated with check (bucket_id = 'inspiracoes' and public.e_time());
create policy inspiracoes_arq_apagar on storage.objects for delete to authenticated
  using (bucket_id = 'inspiracoes' and (public.e_gestao() or (public.e_time() and owner = auth.uid())));

-- Tamanho por bucket (Configurações) passa a incluir as inspirações
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
    where o.bucket_id in ('artes', 'chat', 'onboarding', 'marca', 'inspiracoes')
    group by o.bucket_id;
end
$$;
