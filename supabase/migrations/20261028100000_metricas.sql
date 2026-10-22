-- Bastidor · Relatório de métricas mensal do cliente
-- Preenchido pela agência (Sócio e Adm) até o app da Meta ser aprovado; o cliente só vê depois de publicado.

create table public.relatorios_metricas (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  mes date not null check (mes = date_trunc('month', mes)::date), -- sempre o dia 1
  -- Instagram
  alcance integer check (alcance >= 0),
  novos_seguidores integer,
  engajamento numeric(5, 2) check (engajamento >= 0), -- em %
  visitas_perfil integer check (visitas_perfil >= 0),
  cliques_link integer check (cliques_link >= 0),
  alcance_semanas integer[] not null default '{}' check (cardinality(alcance_semanas) <= 5),
  -- Tráfego pago (Meta Ads)
  investimento numeric(10, 2) check (investimento >= 0),
  resultados integer check (resultados >= 0),
  resultado_rotulo text, -- ex.: agendamentos, conversas no WhatsApp, compras no site
  -- Até 3 posts publicados em destaque
  destaques uuid[] not null default '{}' check (cardinality(destaques) <= 3),
  leitura text not null default '',
  publicado_em timestamptz,
  publicado_por uuid references public.profiles (id) on delete set null,
  atualizado_por uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, mes)
);

alter table public.relatorios_metricas enable row level security;
create policy metricas_ler on public.relatorios_metricas for select to authenticated using ((select public.e_time()));
create policy metricas_escrever on public.relatorios_metricas for all to authenticated
  using ((select public.e_gestao())) with check ((select public.e_gestao()));

-- ---------------------------------------------------------------- portal: só relatório publicado
-- Devolve o relatório do mês (ou nulo), a variação sobre o mês anterior publicado e os destaques com a arte.
create function public.portal_metricas(p_client_id uuid default null, p_mes date default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  cid uuid := public.portal_cliente_alvo(p_client_id);
  r public.relatorios_metricas;
  ant public.relatorios_metricas;
  v_mes date;
begin
  if p_mes is null then
    select max(mes) into v_mes from public.relatorios_metricas where client_id = cid and publicado_em is not null;
  else
    v_mes := date_trunc('month', p_mes)::date;
  end if;
  select * into r from public.relatorios_metricas where client_id = cid and mes = v_mes and publicado_em is not null;
  if not found then
    return jsonb_build_object(
      'relatorio', null,
      'meses', coalesce((select jsonb_agg(mes order by mes desc) from public.relatorios_metricas where client_id = cid and publicado_em is not null), '[]'::jsonb)
    );
  end if;
  select * into ant from public.relatorios_metricas
  where client_id = cid and mes = (v_mes - interval '1 month')::date and publicado_em is not null;

  return jsonb_build_object(
    'relatorio', jsonb_build_object(
      'mes', r.mes, 'alcance', r.alcance, 'novos_seguidores', r.novos_seguidores, 'engajamento', r.engajamento,
      'visitas_perfil', r.visitas_perfil, 'cliques_link', r.cliques_link, 'alcance_semanas', to_jsonb(r.alcance_semanas),
      'investimento', r.investimento, 'resultados', r.resultados, 'resultado_rotulo', r.resultado_rotulo,
      'leitura', r.leitura, 'publicado_em', r.publicado_em,
      'alcance_anterior', ant.alcance, 'novos_anterior', ant.novos_seguidores,
      'instagram', (select instagram from public.clients where id = cid),
      -- Destaques: só conteúdo do próprio cliente já agendado/publicado (a arte passa na política do Storage)
      'destaques', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', t.id, 'titulo', t.titulo, 'formato', t.formato,
          'arte', (select a.caminho from public.task_assets a where a.task_id = t.id order by a.ordem, a.created_at limit 1)
        ) order by array_position(r.destaques, t.id))
        from public.tasks t
        where t.id = any (r.destaques) and t.client_id = cid and t.etapa = 'agendado'
      ), '[]'::jsonb)
    ),
    'meses', coalesce((select jsonb_agg(mes order by mes desc) from public.relatorios_metricas where client_id = cid and publicado_em is not null), '[]'::jsonb)
  );
end
$$;
revoke execute on function public.portal_metricas(uuid, date) from public, anon;
grant execute on function public.portal_metricas(uuid, date) to authenticated;
