-- Identidade da agência (nome, nome do sistema, logo, cor principal), foto do time e logo dos clientes.
-- Imagens no bucket público "marca" com nomes aleatórios: o logo aparece nos e-mails e na tela de entrada
-- (antes do login). Nada de conteúdo, arte ou contrato vai para esse bucket.
--   agencia/<arquivo>            logo da agência (só Sócio)
--   time/<profile_id>/<arquivo>  foto da pessoa (ela mesma ou o Sócio)
--   clientes/<client_id>/<arq>   logo do cliente (Sócio e Adm)

create table public.identidade (
  id boolean primary key default true check (id), -- uma linha só
  nome_agencia text not null default 'O.BRAND' check (char_length(trim(nome_agencia)) between 1 and 40),
  nome_sistema text not null default 'Bastidor' check (char_length(trim(nome_sistema)) between 1 and 30),
  logo text check (logo ~ '^agencia/[A-Za-z0-9_-]+\.webp$'),
  cor text not null default '#1E4BFF' check (cor ~ '^#[0-9A-F]{6}$'),
  atualizado_por uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);
insert into public.identidade default values;

alter table public.profiles add column foto text;
alter table public.profiles add constraint profiles_foto_da_pessoa
  check (foto is null or foto ~ ('^time/' || id::text || '/[A-Za-z0-9_-]+\.webp$'));

grant update (foto) on public.profiles to authenticated; -- a política profiles_editar decide de quem

alter table public.clients add column logo text;
alter table public.clients add constraint clients_logo_do_cliente
  check (logo is null or logo ~ ('^clientes/' || id::text || '/[A-Za-z0-9_-]+\.webp$'));

create function public.tocar_identidade() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  new.atualizado_por := auth.uid();
  return new;
end
$$;
create trigger tocar_identidade before update on public.identidade
for each row execute function public.tocar_identidade();

alter table public.identidade enable row level security;
create policy identidade_ler on public.identidade for select to authenticated using (true);
create policy identidade_editar on public.identidade for update to authenticated
  using ((select public.e_socio())) with check ((select public.e_socio()));
grant select, update on public.identidade to authenticated;
revoke execute on function public.tocar_identidade() from public, anon;

-- ---------------------------------------------------------------- bucket "marca"
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('marca', 'marca', true, 2097152, array['image/webp'])
on conflict (id) do nothing;

-- Quem pode gravar em cada pasta
create function public.pode_gravar_marca(p_nome text) returns boolean
language sql stable security definer set search_path = '' as $$
  select case (storage.foldername(p_nome))[1]
    when 'agencia' then public.e_socio()
    when 'time' then public.e_time() and ((storage.foldername(p_nome))[2] = auth.uid()::text or public.e_socio())
    when 'clientes' then public.e_gestao()
    else false
  end
$$;
revoke execute on function public.pode_gravar_marca(text) from public, anon;
grant execute on function public.pode_gravar_marca(text) to authenticated;

create policy marca_ler on storage.objects for select to authenticated
  using (bucket_id = 'marca' and (select public.e_time()));
create policy marca_enviar on storage.objects for insert to authenticated
  with check (bucket_id = 'marca' and public.pode_gravar_marca(name));
create policy marca_apagar on storage.objects for delete to authenticated
  using (bucket_id = 'marca' and public.pode_gravar_marca(name));

-- Tamanho por bucket (Configurações) passa a incluir as imagens da marca
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
    where o.bucket_id in ('artes', 'chat', 'onboarding', 'marca')
    group by o.bucket_id;
end
$$;
