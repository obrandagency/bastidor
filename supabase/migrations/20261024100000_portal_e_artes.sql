-- Bastidor · Fase 1 · artes e portal do cliente (etapa 6)
-- O cliente nunca lê as tabelas de tarefa: tudo passa por estas funções, que devolvem só campos seguros.
-- Etapas que o cliente vê: Com o cliente, Ajuste, Aprovado e Agendado.

-- ---------------------------------------------------------------- dia de uma tarefa no calendário
-- Dia da publicação se agendada; senão, o prazo. Mesmo critério do Início e do relatório.
create function public.dia_da_tarefa(t public.tasks) returns date
language sql stable set search_path = '' as $$
  select case
    when t.etapa = 'agendado' and t.publicar_em is not null then (t.publicar_em at time zone 'America/Sao_Paulo')::date
    else t.prazo
  end
$$;

-- ---------------------------------------------------------------- de qual cliente é o portal
-- Cliente: sempre o próprio. Sócio e Adm ("Ver como cliente"): o que pedirem. Demais: recusa.
create function public.portal_cliente_alvo(p_client_id uuid) returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare
  meu uuid := public.meu_cliente();
begin
  if meu is not null then
    if p_client_id is not null and p_client_id <> meu then
      raise exception 'Sem permissão' using errcode = '42501';
    end if;
    return meu;
  end if;
  if public.e_gestao() and p_client_id is not null then
    return p_client_id;
  end if;
  raise exception 'Sem permissão' using errcode = '42501';
end
$$;

-- ---------------------------------------------------------------- topo do portal e do relatório
create function public.portal_resumo(p_client_id uuid default null, p_mes date default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  cid uuid := public.portal_cliente_alvo(p_client_id);
  ref date := coalesce(p_mes, (now() at time zone 'America/Sao_Paulo')::date);
  v_ini date := date_trunc('month', ref)::date;
  v_fim date := (date_trunc('month', ref) + interval '1 month')::date;
  k public.contracts;
begin
  -- Contrato que vale no mês consultado (o mais recente, se houver troca no meio do mês)
  select * into k from public.contracts
  where client_id = cid and inicio < v_fim and (fim is null or fim >= v_ini)
  order by inicio desc limit 1;

  return jsonb_build_object(
    'cliente', (select nome from public.clients where id = cid),
    'mes', v_ini,
    'conteudos_mes', k.conteudos_mes,
    'ajustes_mes', k.ajustes_mes,
    'ajustes_usados', public.ajustes_do_mes(cid, v_ini),
    'entregues', (
      select count(*) from public.tasks t
      where t.client_id = cid and t.tipo = 'conteudo' and t.etapa = 'agendado'
        and public.dia_da_tarefa(t) >= v_ini and public.dia_da_tarefa(t) < v_fim
    ),
    'em_producao', (
      select count(*) from public.tasks t
      where t.client_id = cid and t.tipo = 'conteudo' and t.etapa not in ('aprovado', 'agendado')
        and public.dia_da_tarefa(t) >= v_ini and public.dia_da_tarefa(t) < v_fim
    ),
    'aguardando', (
      select count(*) from public.tasks t where t.client_id = cid and t.tipo = 'conteudo' and t.etapa = 'cliente'
    )
  );
end
$$;

-- ---------------------------------------------------------------- conteúdos para aprovar e histórico recente
create function public.portal_conteudos(p_client_id uuid default null)
returns table (
  id uuid,
  titulo text,
  formato public.formato,
  etapa public.etapa,
  legenda text,
  prazo date,
  publicar_em timestamptz,
  enviado_cliente_em timestamptz,
  atualizado_em timestamptz,
  artes jsonb,
  pedidos_ajuste jsonb
)
language sql stable security definer set search_path = '' as $$
  select
    t.id, t.titulo, t.formato, t.etapa, t.texto, t.prazo, t.publicar_em, t.enviado_cliente_em, t.updated_at,
    coalesce((
      select jsonb_agg(jsonb_build_object('caminho', a.caminho, 'tipo', a.tipo_midia) order by a.ordem, a.created_at)
      from public.task_assets a where a.task_id = t.id
    ), '[]'::jsonb),
    -- Só os pedidos do próprio cliente; comentários internos nunca saem daqui
    coalesce((
      select jsonb_agg(jsonb_build_object('texto', n.texto, 'em', n.created_at) order by n.created_at)
      from public.task_notes n where n.task_id = t.id and n.tipo = 'cliente'
    ), '[]'::jsonb)
  from public.tasks t
  where t.client_id = public.portal_cliente_alvo(p_client_id)
    and t.tipo = 'conteudo'
    and (
      t.etapa in ('cliente', 'ajuste')
      or (t.etapa in ('aprovado', 'agendado') and (t.updated_at > now() - interval '45 days' or t.publicar_em >= now()))
    )
  order by t.enviado_cliente_em nulls last, t.prazo nulls last
$$;

-- ---------------------------------------------------------------- relatório de entregas
create function public.portal_relatorio(p_client_id uuid default null, p_mes date default null)
returns table (id uuid, titulo text, formato public.formato, dia date, situacao text)
language sql stable security definer set search_path = '' as $$
  with alvo as (
    select public.portal_cliente_alvo(p_client_id) as cid,
           date_trunc('month', coalesce(p_mes, (now() at time zone 'America/Sao_Paulo')::date))::date as ini
  )
  select t.id, t.titulo, t.formato, public.dia_da_tarefa(t),
    case
      when t.etapa = 'agendado' and t.publicar_em <= now() then 'Publicado'
      when t.etapa = 'agendado' then 'Agendado'
      when t.etapa = 'aprovado' then 'Aprovado'
      when t.etapa = 'ajuste' then 'Em ajuste'
      when t.etapa = 'cliente' then 'Aguardando você'
      else 'Em produção'
    end
  from public.tasks t, alvo
  where t.client_id = alvo.cid and t.tipo = 'conteudo'
    and public.dia_da_tarefa(t) >= alvo.ini
    and public.dia_da_tarefa(t) < (alvo.ini + interval '1 month')::date
  order by public.dia_da_tarefa(t), t.titulo
$$;

-- Outros serviços do mês: só título, área e Em andamento ou Concluído
create function public.portal_servicos(p_client_id uuid default null, p_mes date default null)
returns table (titulo text, area public.area, situacao text)
language sql stable security definer set search_path = '' as $$
  with alvo as (
    select public.portal_cliente_alvo(p_client_id) as cid,
           date_trunc('month', coalesce(p_mes, (now() at time zone 'America/Sao_Paulo')::date))::date as ini
  )
  select t.titulo, t.area, case when t.etapa = 'concluido' then 'Concluído' else 'Em andamento' end
  from public.tasks t, alvo
  where t.client_id = alvo.cid and t.tipo = 'demanda'
    and coalesce(t.prazo, (t.created_at at time zone 'America/Sao_Paulo')::date) >= alvo.ini
    and coalesce(t.prazo, (t.created_at at time zone 'America/Sao_Paulo')::date) < (alvo.ini + interval '1 month')::date
  order by t.etapa = 'concluido', t.titulo
$$;

-- ---------------------------------------------------------------- decisões do cliente (só o próprio cliente; "Ver como cliente" não aprova)
create function public.portal_aprovar(p_task_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  meu uuid := public.meu_cliente();
  t public.tasks;
begin
  if meu is null then
    raise exception 'Só o cliente aprova pelo portal' using errcode = '42501';
  end if;
  select * into t from public.tasks where id = p_task_id and client_id = meu and tipo = 'conteudo' for update;
  if not found then
    raise exception 'Conteúdo não encontrado' using errcode = 'P0002';
  end if;
  if t.etapa <> 'cliente' then
    raise exception 'Este conteúdo não está esperando a sua aprovação' using errcode = '23514';
  end if;

  -- O gatilho registrar_etapa grava quem aprovou e quando (origem = cliente)
  update public.tasks set etapa = 'aprovado' where id = p_task_id;

  insert into public.notifications (destinatario_id, tipo, task_id, client_id, texto, link)
  select p.id, 'cliente_aprovou', t.id, meu, 'Cliente aprovou: ' || t.titulo, '/tarefas?tarefa=' || t.id
  from public.profiles p where p.perfil = 'adm' and p.ativo;
end
$$;

create function public.portal_pedir_ajuste(p_task_id uuid, p_texto text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  meu uuid := public.meu_cliente();
  t public.tasks;
  pedido text := trim(coalesce(p_texto, ''));
begin
  if meu is null then
    raise exception 'Só o cliente pede ajuste pelo portal' using errcode = '42501';
  end if;
  if pedido = '' then
    raise exception 'Descreva o ajuste' using errcode = '23514';
  end if;
  select * into t from public.tasks where id = p_task_id and client_id = meu and tipo = 'conteudo' for update;
  if not found then
    raise exception 'Conteúdo não encontrado' using errcode = 'P0002';
  end if;
  if t.etapa <> 'cliente' then
    raise exception 'Este conteúdo não está esperando a sua aprovação' using errcode = '23514';
  end if;

  insert into public.task_notes (task_id, tipo, texto, autor_id) values (t.id, 'cliente', pedido, auth.uid());
  -- Vai para Ajuste: o gatilho passa para o responsável padrão e o histórico soma 1 no contador do mês
  update public.tasks set etapa = 'ajuste' where id = p_task_id returning * into t;

  if t.responsavel_id is not null then
    insert into public.notifications (destinatario_id, tipo, task_id, client_id, texto, link)
    values (t.responsavel_id, 'ajuste_pedido', t.id, meu, 'Ajuste pedido em ' || t.titulo || ': ' || pedido, '/tarefas?tarefa=' || t.id);
  end if;
end
$$;

revoke execute on function public.dia_da_tarefa(public.tasks), public.portal_cliente_alvo(uuid) from public, anon, authenticated;
revoke execute on function
  public.portal_resumo(uuid, date), public.portal_conteudos(uuid), public.portal_relatorio(uuid, date),
  public.portal_servicos(uuid, date), public.portal_aprovar(uuid), public.portal_pedir_ajuste(uuid, text)
  from public, anon;
grant execute on function
  public.portal_resumo(uuid, date), public.portal_conteudos(uuid), public.portal_relatorio(uuid, date),
  public.portal_servicos(uuid, date), public.portal_aprovar(uuid), public.portal_pedir_ajuste(uuid, text)
  to authenticated;

-- ---------------------------------------------------------------- artes no Storage (bucket privado)
-- Caminho: client_id/task_id/arquivo. Link sempre temporário (signed URL).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('artes', 'artes', false, 52428800,
        array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/quicktime'])
on conflict (id) do nothing;

-- O cliente vê a arte só de conteúdo dele que já chegou ao portal
create function public.cliente_ve_arte(p_caminho text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.tasks t
    where (storage.foldername(p_caminho))[2] ~ '^[0-9a-f-]{36}$'
      and t.id = ((storage.foldername(p_caminho))[2])::uuid
      and t.client_id = public.meu_cliente()
      and t.etapa in ('cliente', 'ajuste', 'aprovado', 'agendado')
  )
$$;
revoke execute on function public.cliente_ve_arte(text) from public, anon;
grant execute on function public.cliente_ve_arte(text) to authenticated;

create policy artes_ler on storage.objects for select to authenticated
  using (bucket_id = 'artes' and (public.e_time() or public.cliente_ve_arte(name)));
create policy artes_enviar on storage.objects for insert to authenticated
  with check (bucket_id = 'artes' and public.e_time());
create policy artes_trocar on storage.objects for update to authenticated
  using (bucket_id = 'artes' and public.e_time()) with check (bucket_id = 'artes' and public.e_time());
create policy artes_apagar on storage.objects for delete to authenticated
  using (bucket_id = 'artes' and public.e_time());
