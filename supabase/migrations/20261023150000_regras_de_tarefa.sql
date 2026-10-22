-- Bastidor · Fase 1 · regras de tarefa (etapa 4)
-- As regras ficam no banco para valerem em qualquer caminho: quadro, detalhe, portal ou API.

-- ---------------------------------------------------------------- antes de gravar
create function public.regras_de_etapa() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  padrao uuid;
begin
  new.updated_at := now();

  if tg_op = 'INSERT' then
    new.criado_por := coalesce(new.criado_por, auth.uid());
    if new.etapa = 'agendado' then
      raise exception 'Uma tarefa nova não começa em Agendado' using errcode = '23514';
    end if;
  end if;

  -- Ajuste só volta para Revisão interna (nunca direto para Aprovado ou para o cliente)
  if tg_op = 'UPDATE' and old.etapa = 'ajuste' and new.etapa <> 'ajuste' and new.etapa <> 'revisao' then
    raise exception 'Depois de Ajuste o conteúdo volta para Revisão interna' using errcode = '23514';
  end if;

  -- Saiu de Agendado: a data de publicação deixa de valer
  if tg_op = 'UPDATE' and old.etapa = 'agendado' and new.etapa <> 'agendado'
     and new.publicar_em is not distinct from old.publicar_em then
    new.publicar_em := null;
  end if;

  -- Data de publicação só em conteúdo aprovado; recebê-la leva para Agendado.
  -- Ninguém arrasta para Agendado: sem data, o check tasks_agendado_tem_data recusa.
  if new.publicar_em is not null then
    if new.tipo <> 'conteudo' or new.etapa not in ('aprovado', 'agendado') then
      raise exception 'Só conteúdo aprovado recebe data de publicação' using errcode = '23514';
    end if;
    new.etapa := 'agendado';
  end if;

  if tg_op = 'INSERT' or new.etapa is distinct from old.etapa then
    -- Conteúdo passa para o responsável padrão da nova etapa (demanda só muda à mão)
    if new.tipo = 'conteudo' and (tg_op = 'UPDATE' or new.responsavel_id is null) then
      select responsavel_id into padrao from public.stage_defaults where etapa = new.etapa;
      if padrao is not null then
        new.responsavel_id := padrao;
      end if;
    end if;
    if new.etapa = 'cliente' then
      new.enviado_cliente_em := now();
    end if;
  end if;

  return new;
end
$$;

create trigger regras_de_etapa
before insert or update on public.tasks
for each row execute function public.regras_de_etapa();

-- ---------------------------------------------------------------- depois de gravar: histórico
create function public.registrar_etapa() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  quem public.profiles;
begin
  if tg_op = 'UPDATE' and new.etapa is not distinct from old.etapa then
    return null;
  end if;
  select * into quem from public.profiles where id = auth.uid();
  insert into public.task_events (task_id, de_etapa, para_etapa, ator_id, ator_nome, origem)
  values (
    new.id,
    case when tg_op = 'UPDATE' then old.etapa end,
    new.etapa,
    quem.id,
    quem.nome,
    case when quem.id is null then 'sistema' when quem.perfil = 'cliente' then 'cliente' else 'time' end::public.origem_evento
  );
  return null;
end
$$;

-- Sem "update of etapa": a etapa também muda dentro de regras_de_etapa (ex.: ao receber data de publicação)
create trigger registrar_etapa
after insert or update on public.tasks
for each row execute function public.registrar_etapa();

-- ---------------------------------------------------------------- responsável padrão inicial
-- Mayara: Pauta e Revisão · Renan: Copy · Lucas: Layout e Ajuste · Gabi: Com o cliente, Aprovado e Agendado.
-- Se a pessoa ainda não existe, fica vazio e o Sócio define em Configurações.
update public.stage_defaults d
set responsavel_id = p.id
from public.profiles p
where p.perfil <> 'cliente'
  and d.responsavel_id is null
  and split_part(lower(p.nome), ' ', 1) = case d.etapa
    when 'pauta' then 'mayara'
    when 'copy' then 'renan'
    when 'layout' then 'lucas'
    when 'revisao' then 'mayara'
    when 'cliente' then 'gabi'
    when 'ajuste' then 'lucas'
    when 'aprovado' then 'gabi'
    when 'agendado' then 'gabi'
  end;
