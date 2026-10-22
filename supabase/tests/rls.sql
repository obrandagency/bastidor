-- Teste das regras de acesso: um usuário de cada perfil.
-- Roda num Postgres comum com supabase/tests/stub-supabase.sql + migrations (ver scripts/testar-banco.sh).
-- Tudo acontece numa transação que é desfeita no final.
\set ON_ERROR_STOP 1
\set QUIET 1
begin;

-- ---------------------------------------------------------------- ferramentas
create schema testes;
grant usage on schema testes to anon, authenticated;

create function testes.ok(condicao boolean, mensagem text) returns void language plpgsql as $$
begin
  if condicao is not true then raise exception 'FALHOU: %', mensagem; end if;
  raise notice 'ok  %', mensagem;
end $$;

create function testes.conta(consulta text) returns bigint language plpgsql as $$
declare n bigint;
begin
  execute format('select count(*) from (%s) x', consulta) into n;
  return n;
end $$;

-- Executa um comando que precisa ser recusado (erro ou nenhuma linha afetada)
create function testes.recusa(comando text, mensagem text) returns void language plpgsql as $$
declare n bigint;
begin
  begin
    execute comando;
    get diagnostics n = row_count;
  exception when others then
    raise notice 'ok  % (recusado: %)', mensagem, sqlerrm;
    return;
  end;
  if n > 0 then raise exception 'FALHOU: % (o comando passou e afetou % linha(s))', mensagem, n; end if;
  raise notice 'ok  % (0 linhas)', mensagem;
end $$;

grant execute on all functions in schema testes to anon, authenticated;

-- ---------------------------------------------------------------- dados (como postgres)
insert into public.clients (id, nome, nome_curto) values
  ('00000000-0000-0000-0000-00000000000a', 'Cliente A', 'A'),
  ('00000000-0000-0000-0000-00000000000b', 'Cliente B', 'B');

insert into public.convites (email, nome, iniciais, perfil, client_id) values
  ('socio@teste.com',   'Sócia',    'SO', 'socio',   null),
  ('adm@teste.com',     'Adm',      'AD', 'adm',     null),
  ('criacao@teste.com', 'Criação',  'CR', 'criacao', null),
  ('ca@teste.com',      'Pessoa A', 'PA', 'cliente', '00000000-0000-0000-0000-00000000000a'),
  ('cb@teste.com',      'Pessoa B', 'PB', 'cliente', '00000000-0000-0000-0000-00000000000b'),
  ('saiu@teste.com',    'Saiu',     'SA', 'criacao', null);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000001', 'socio@teste.com'),
  ('00000000-0000-0000-0000-000000000002', 'adm@teste.com'),
  ('00000000-0000-0000-0000-000000000003', 'Criacao@Teste.com'),
  ('00000000-0000-0000-0000-0000000000ca', 'ca@teste.com'),
  ('00000000-0000-0000-0000-0000000000cb', 'cb@teste.com'),
  ('00000000-0000-0000-0000-000000000009', 'saiu@teste.com');
update public.profiles set ativo = false where email = 'saiu@teste.com';

select testes.ok((select count(*) from public.profiles) = 6, 'convite vira perfil ao criar o usuário (e-mail sem diferenciar maiúsculas)');
select testes.recusa($$insert into auth.users (email) values ('intruso@teste.com')$$, 'e-mail sem convite não vira usuário');

insert into public.contracts (client_id, inicio, conteudos_mes, ajustes_mes) values
  ('00000000-0000-0000-0000-00000000000a', '2026-01-01', 12, 2),
  ('00000000-0000-0000-0000-00000000000b', '2026-01-01', 8, 1);
select testes.recusa($$insert into public.contracts (client_id, inicio, conteudos_mes, ajustes_mes)
  values ('00000000-0000-0000-0000-00000000000a', '2026-06-01', 1, 1)$$, 'dois contratos valendo ao mesmo tempo');

insert into public.client_briefs (client_id, negocio) values
  ('00000000-0000-0000-0000-00000000000a', 'Negócio A'), ('00000000-0000-0000-0000-00000000000b', 'Negócio B');
insert into public.meeting_notes (client_id, data, resumo) values
  ('00000000-0000-0000-0000-00000000000a', '2026-10-01', 'Ata A'), ('00000000-0000-0000-0000-00000000000b', '2026-10-01', 'Ata B');

insert into public.tasks (id, tipo, client_id, titulo, formato, area, etapa, horas) values
  ('00000000-0000-0000-0000-0000000000f1', 'conteudo', '00000000-0000-0000-0000-00000000000a', 'Post A', 'estatico', null, 'cliente', 3),
  ('00000000-0000-0000-0000-0000000000f2', 'conteudo', '00000000-0000-0000-0000-00000000000b', 'Post B', 'reels', null, 'cliente', 2),
  ('00000000-0000-0000-0000-0000000000f3', 'demanda', null, 'Interno', null, 'financeiro', 'a_fazer', null);
insert into public.task_notes (task_id, tipo, texto) values
  ('00000000-0000-0000-0000-0000000000f1', 'interno', 'Comentário interno A');
insert into public.task_events (task_id, para_etapa, origem, created_at) values
  ('00000000-0000-0000-0000-0000000000f1', 'cliente', 'time', now()),
  -- ajustes do cliente A: 2 neste mês (um pedido pelo portal, um movido pelo time) e 1 no mês passado
  ('00000000-0000-0000-0000-0000000000f1', 'ajuste', 'cliente', now()),
  ('00000000-0000-0000-0000-0000000000f1', 'ajuste', 'time', now()),
  ('00000000-0000-0000-0000-0000000000f1', 'ajuste', 'cliente', now() - interval '40 days');
insert into public.notifications (destinatario_id, tipo, texto) values
  ('00000000-0000-0000-0000-0000000000ca', 'aprovar', 'Para A'),
  ('00000000-0000-0000-0000-0000000000cb', 'aprovar', 'Para B');

select testes.recusa($$insert into public.tasks (tipo, client_id, titulo, formato, etapa)
  values ('conteudo', '00000000-0000-0000-0000-00000000000a', 'x', 'reels', 'agendado')$$, 'agendado sem data de publicação');
select testes.recusa($$insert into public.tasks (tipo, client_id, titulo, area, etapa)
  values ('demanda', null, 'x', 'interno', 'pauta')$$, 'demanda com etapa de conteúdo');

-- ---------------------------------------------------------------- visitante sem login
set local role anon;
select set_config('request.jwt.claims', '', true);
select testes.recusa($$select public.ajustes_do_mes('00000000-0000-0000-0000-00000000000a')$$, 'anon: não lê contador de ajustes');
select testes.recusa('select * from public.clients', 'anon: não lê clientes');
select testes.recusa('select * from public.tasks', 'anon: não lê tarefas');
select testes.recusa('select * from public.profiles', 'anon: não lê pessoas');
reset role;

-- ---------------------------------------------------------------- cliente A
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000ca","role":"authenticated"}', true);
select testes.ok(testes.conta('select * from public.clients') = 1, 'cliente A: vê só o próprio cliente');
select testes.ok(testes.conta($$select * from public.clients where nome = 'Cliente B'$$) = 0, 'cliente A: não vê o Cliente B');
select testes.ok(testes.conta('select * from public.profiles') = 1, 'cliente A: vê só o próprio perfil');
select testes.ok(testes.conta('select * from public.contracts') = 0, 'cliente A: não vê contratos');
select testes.ok(testes.conta('select * from public.client_briefs') = 0, 'cliente A: não vê briefing pela API');
select testes.ok(testes.conta('select * from public.meeting_notes') = 0, 'cliente A: não vê atas');
select testes.ok(testes.conta('select * from public.tasks') = 0, 'cliente A: não lê a tabela de tarefas (nem horas nem internas)');
select testes.ok(testes.conta('select * from public.task_notes') = 0, 'cliente A: não vê comentários internos');
select testes.ok(testes.conta('select * from public.task_events') = 0, 'cliente A: não vê histórico');
select testes.ok(testes.conta('select * from public.convites') = 0, 'cliente A: não vê convites');
select testes.ok(testes.conta('select * from public.stage_defaults') = 0, 'cliente A: não vê configurações');
select testes.ok(testes.conta('select * from public.notifications') = 1, 'cliente A: vê só os próprios avisos');
select testes.ok(public.ajustes_do_mes('00000000-0000-0000-0000-00000000000a') = 1, 'cliente A: contador do mês conta só pedidos do portal deste mês');
select testes.ok(public.ajustes_do_mes('00000000-0000-0000-0000-00000000000a', (current_date - 40)) = 1, 'cliente A: contador do mês passado é separado');
select testes.recusa($$select public.ajustes_do_mes('00000000-0000-0000-0000-00000000000b')$$, 'cliente A: não lê o contador do Cliente B');
select testes.recusa($$update public.profiles set perfil = 'socio', client_id = null where id = auth.uid()$$, 'cliente A: não vira Sócio');
select testes.recusa($$update public.profiles set client_id = '00000000-0000-0000-0000-00000000000b' where id = auth.uid()$$, 'cliente A: não troca de cliente');
select testes.recusa($$update public.profiles set email = 'x@x.com' where id = auth.uid()$$, 'cliente A: não troca o e-mail');
select testes.recusa($$insert into public.tasks (tipo, client_id, titulo, formato, etapa)
  values ('conteudo', '00000000-0000-0000-0000-00000000000a', 'x', 'reels', 'pauta')$$, 'cliente A: não cria tarefa');
select testes.recusa($$update public.clients set nome = 'x'$$, 'cliente A: não edita cliente');
select testes.recusa($$insert into public.convites (email, nome, iniciais, perfil, client_id)
  values ('amigo@x.com', 'x', 'X', 'cliente', '00000000-0000-0000-0000-00000000000a')$$, 'cliente A: não convida ninguém');
select testes.recusa($$insert into public.notifications (destinatario_id, tipo, texto)
  values (auth.uid(), 'x', 'x')$$, 'cliente A: não cria aviso');
select testes.recusa($$update public.notifications set texto = 'x'$$, 'cliente A: não altera texto de aviso');
update public.profiles set nome = 'Pessoa A editada' where id = auth.uid();
select testes.ok(testes.conta($$select * from public.profiles where nome = 'Pessoa A editada'$$) = 1, 'cliente A: edita o próprio nome');
reset role;

-- ---------------------------------------------------------------- Criação
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000003","role":"authenticated"}', true);
select testes.ok(testes.conta('select * from public.clients') = 2, 'criação: vê os clientes');
select testes.ok(testes.conta('select * from public.contracts') = 0, 'criação: não vê contratos');
select testes.ok(testes.conta('select * from public.client_briefs') = 2, 'criação: lê a Central do cliente');
select testes.ok(testes.conta($$select * from public.profiles where perfil = 'cliente'$$) = 0, 'criação: não vê pessoas de cliente');
select testes.ok(testes.conta('select * from public.tasks') = 3, 'criação: vê todas as tarefas');
select testes.ok(public.ajustes_do_mes('00000000-0000-0000-0000-00000000000b') = 0, 'criação: lê o contador de qualquer cliente');
select testes.recusa($$update public.client_briefs set negocio = 'x'$$, 'criação: não edita briefing');
select testes.recusa($$insert into public.meeting_notes (client_id, data, resumo)
  values ('00000000-0000-0000-0000-00000000000a', '2026-10-02', 'x')$$, 'criação: não cria ata');
select testes.recusa($$insert into public.convites (email, nome, iniciais, perfil) values ('x@x.com', 'x', 'X', 'criacao')$$, 'criação: não convida');
select testes.recusa($$update public.profiles set perfil = 'socio' where id = auth.uid()$$, 'criação: não vira Sócio');
select testes.recusa($$update public.stage_defaults set responsavel_id = auth.uid()$$, 'criação: não muda responsável padrão');
select testes.recusa($$delete from public.tasks$$, 'criação: não apaga tarefas');
select testes.recusa($$insert into public.task_events (task_id, para_etapa, origem)
  values ('00000000-0000-0000-0000-0000000000f1', 'aprovado', 'cliente')$$, 'criação: não forja histórico');
update public.tasks set titulo = 'Post A revisado' where id = '00000000-0000-0000-0000-0000000000f1';
select testes.ok(testes.conta($$select * from public.tasks where titulo = 'Post A revisado'$$) = 1, 'criação: edita tarefa');
reset role;

-- ---------------------------------------------------------------- Administrativo
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
select testes.ok(testes.conta('select * from public.contracts') = 2, 'adm: vê contratos');
select testes.recusa($$update public.contracts set ajustes_mes = 99$$, 'adm: não edita contrato');
select testes.ok(testes.conta('select * from public.profiles') = 6, 'adm: vê todas as pessoas');
insert into public.convites (email, nome, iniciais, perfil, client_id)
  values ('nova@clientea.com', 'Nova', 'NO', 'cliente', '00000000-0000-0000-0000-00000000000a');
select testes.ok(true, 'adm: convida pessoa de cliente');
select testes.recusa($$insert into public.convites (email, nome, iniciais, perfil) values ('x@x.com', 'x', 'X', 'criacao')$$, 'adm: não convida pessoa do time');
select testes.recusa($$update public.profiles set perfil = 'socio' where id = auth.uid()$$, 'adm: não vira Sócio');
select testes.recusa($$update public.profiles set perfil = 'adm', client_id = null where email = 'ca@teste.com'$$, 'adm: não promove cliente a time');
update public.profiles set ativo = false where email = 'cb@teste.com';
select testes.ok(testes.conta($$select * from public.profiles where email = 'cb@teste.com' and not ativo$$) = 1, 'adm: desativa pessoa de cliente');
update public.client_briefs set negocio = 'Negócio A revisado' where client_id = '00000000-0000-0000-0000-00000000000a';
select testes.ok(testes.conta($$select * from public.client_briefs where negocio = 'Negócio A revisado'$$) = 1, 'adm: edita briefing');
reset role;

-- ---------------------------------------------------------------- pessoa desativada
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000cb","role":"authenticated"}', true);
select testes.ok(testes.conta('select * from public.clients') = 0, 'cliente B desativado: não vê mais nada');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000009","role":"authenticated"}', true);
select testes.ok(testes.conta('select * from public.tasks') = 0, 'pessoa do time desativada: não vê tarefas');
reset role;

-- ---------------------------------------------------------------- Sócio
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
update public.contracts set ajustes_mes = 3 where client_id = '00000000-0000-0000-0000-00000000000a';
select testes.ok(testes.conta('select * from public.contracts where ajustes_mes = 3') = 1, 'sócio: edita contrato');
insert into public.convites (email, nome, iniciais, perfil) values ('novo@obrand.com', 'Novo', 'NV', 'criacao');
select testes.ok(true, 'sócio: convida pessoa do time');
update public.profiles set perfil = 'adm' where email = 'criacao@teste.com';
select testes.ok(testes.conta($$select * from public.profiles where email = 'criacao@teste.com' and perfil = 'adm'$$) = 1, 'sócio: muda perfil');
update public.stage_defaults set responsavel_id = auth.uid() where etapa = 'pauta';
select testes.ok(testes.conta('select * from public.stage_defaults where responsavel_id is not null') = 1, 'sócio: muda responsável padrão');
select testes.recusa($$update public.profiles set perfil = 'adm' where id = auth.uid()$$, 'sócio: não rebaixa o único Sócio ativo');
reset role;

select testes.ok(true, 'TODOS OS TESTES PASSARAM');
rollback;
