-- Bastidor · Fase 1 · contador de ajustes do mês
-- Conta os pedidos de ajuste feitos pelo cliente no portal (task_events com origem = cliente
-- e para_etapa = ajuste) no mês de referência, no fuso de São Paulo. Zera sozinho no dia 1.
-- Ajuste movido pelo time não conta (decisão 4 do CLAUDE.md).

create function public.ajustes_do_mes(
  p_client_id uuid,
  p_referencia date default (now() at time zone 'America/Sao_Paulo')::date
) returns integer
language plpgsql stable security definer set search_path = '' as $$
begin
  -- O time vê de qualquer cliente; o cliente, só do próprio
  if not (public.e_time() or p_client_id = public.meu_cliente()) then
    raise exception 'Sem permissão' using errcode = '42501';
  end if;

  return (
    select count(*)::integer
    from public.task_events e
    join public.tasks t on t.id = e.task_id
    where t.client_id = p_client_id
      and e.origem = 'cliente'
      and e.para_etapa = 'ajuste'
      and date_trunc('month', e.created_at at time zone 'America/Sao_Paulo') = date_trunc('month', p_referencia::timestamp)
  );
end
$$;

revoke execute on function public.ajustes_do_mes(uuid, date) from public, anon;
grant execute on function public.ajustes_do_mes(uuid, date) to authenticated;
