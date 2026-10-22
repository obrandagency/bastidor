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

-- ---------------------------------------------------------------- regras de tarefa (etapa 4)
-- Responsáveis padrão: pauta = Sócia (definido acima), layout = Criação, cliente = Adm
update public.stage_defaults set responsavel_id = '00000000-0000-0000-0000-000000000003' where etapa in ('layout', 'ajuste');
update public.stage_defaults set responsavel_id = '00000000-0000-0000-0000-000000000002' where etapa in ('cliente', 'aprovado', 'agendado');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000003","role":"authenticated"}', true);
insert into public.tasks (id, tipo, client_id, titulo, formato, etapa)
  values ('00000000-0000-0000-0000-0000000000e1', 'conteudo', '00000000-0000-0000-0000-00000000000a', 'Novo post', 'reels', 'pauta');
select testes.ok((select responsavel_id from public.tasks where id = '00000000-0000-0000-0000-0000000000e1') = '00000000-0000-0000-0000-000000000001', 'tarefa: conteúdo novo vai para o responsável padrão da etapa');
select testes.ok((select criado_por from public.tasks where id = '00000000-0000-0000-0000-0000000000e1') = auth.uid(), 'tarefa: registra quem criou');
select testes.ok(testes.conta($$select * from public.task_events where task_id = '00000000-0000-0000-0000-0000000000e1' and de_etapa is null and para_etapa = 'pauta' and origem = 'time'$$) = 1, 'tarefa: criação entra no histórico');

update public.tasks set etapa = 'layout' where id = '00000000-0000-0000-0000-0000000000e1';
select testes.ok((select responsavel_id from public.tasks where id = '00000000-0000-0000-0000-0000000000e1') = '00000000-0000-0000-0000-000000000003', 'tarefa: mudar de etapa troca o responsável');
select testes.ok(testes.conta($$select * from public.task_events where task_id = '00000000-0000-0000-0000-0000000000e1' and de_etapa = 'pauta' and para_etapa = 'layout' and ator_nome = 'Criação'$$) = 1, 'tarefa: movimento registrado com quem moveu');

update public.tasks set etapa = 'cliente' where id = '00000000-0000-0000-0000-0000000000e1';
select testes.ok((select enviado_cliente_em is not null from public.tasks where id = '00000000-0000-0000-0000-0000000000e1'), 'tarefa: Com o cliente grava a data de envio');

update public.tasks set etapa = 'ajuste' where id = '00000000-0000-0000-0000-0000000000e1';
select testes.ok(public.ajustes_do_mes('00000000-0000-0000-0000-00000000000a') = 1, 'tarefa: ajuste movido pelo time não conta no limite');
select testes.recusa($$update public.tasks set etapa = 'aprovado' where id = '00000000-0000-0000-0000-0000000000e1'$$, 'tarefa: Ajuste não vai direto para Aprovado');
select testes.recusa($$update public.tasks set etapa = 'cliente' where id = '00000000-0000-0000-0000-0000000000e1'$$, 'tarefa: Ajuste não volta direto para o cliente');
update public.tasks set etapa = 'revisao' where id = '00000000-0000-0000-0000-0000000000e1';
select testes.ok((select etapa from public.tasks where id = '00000000-0000-0000-0000-0000000000e1') = 'revisao', 'tarefa: Ajuste volta para Revisão interna');

select testes.recusa($$update public.tasks set etapa = 'agendado' where id = '00000000-0000-0000-0000-0000000000e1'$$, 'tarefa: ninguém arrasta para Agendado sem data');
select testes.recusa($$update public.tasks set publicar_em = now() + interval '2 days' where id = '00000000-0000-0000-0000-0000000000e1'$$, 'tarefa: conteúdo não aprovado não recebe data de publicação');
update public.tasks set etapa = 'cliente' where id = '00000000-0000-0000-0000-0000000000e1';
update public.tasks set etapa = 'aprovado' where id = '00000000-0000-0000-0000-0000000000e1';
update public.tasks set publicar_em = now() + interval '2 days' where id = '00000000-0000-0000-0000-0000000000e1';
select testes.ok((select etapa from public.tasks where id = '00000000-0000-0000-0000-0000000000e1') = 'agendado', 'tarefa: aprovado com data de publicação vai para Agendado');
select testes.ok(testes.conta($$select * from public.task_events where task_id = '00000000-0000-0000-0000-0000000000e1' and de_etapa = 'aprovado' and para_etapa = 'agendado'$$) = 1, 'tarefa: ida para Agendado entra no histórico');
update public.tasks set etapa = 'aprovado' where id = '00000000-0000-0000-0000-0000000000e1';
select testes.ok((select publicar_em is null and etapa = 'aprovado' from public.tasks where id = '00000000-0000-0000-0000-0000000000e1'), 'tarefa: sair de Agendado apaga a data de publicação');

insert into public.tasks (id, tipo, client_id, titulo, area, etapa, responsavel_id)
  values ('00000000-0000-0000-0000-0000000000e2', 'demanda', null, 'Notas fiscais', 'financeiro', 'a_fazer', '00000000-0000-0000-0000-000000000002');
update public.tasks set etapa = 'fazendo' where id = '00000000-0000-0000-0000-0000000000e2';
select testes.ok((select responsavel_id from public.tasks where id = '00000000-0000-0000-0000-0000000000e2') = '00000000-0000-0000-0000-000000000002', 'tarefa: demanda não troca de responsável sozinha');
select testes.recusa($$update public.tasks set publicar_em = now() where id = '00000000-0000-0000-0000-0000000000e2'$$, 'tarefa: demanda não recebe data de publicação');

insert into public.task_notes (task_id, tipo, texto, autor_id) values ('00000000-0000-0000-0000-0000000000e1', 'interno', 'Trocar a foto', auth.uid());
select testes.ok(testes.conta($$select * from public.task_notes where task_id = '00000000-0000-0000-0000-0000000000e1'$$) = 1, 'tarefa: time comenta');
select testes.recusa($$insert into public.task_notes (task_id, tipo, texto, autor_id) values ('00000000-0000-0000-0000-0000000000e1', 'interno', 'x', '00000000-0000-0000-0000-000000000001')$$, 'tarefa: ninguém comenta em nome de outra pessoa');
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000ca","role":"authenticated"}', true);
select testes.ok(testes.conta('select * from public.task_events') = 0, 'tarefa: cliente continua sem ler o histórico');
reset role;

-- ---------------------------------------------------------------- portal do cliente e artes (etapa 6)
select set_config('request.jwt.claims', '', true);
update public.profiles set ativo = true where email = 'cb@teste.com';
update public.profiles set perfil = 'criacao' where email = 'criacao@teste.com'; -- o Sócio tinha mudado para adm acima
insert into public.tasks (id, tipo, client_id, titulo, formato, etapa)
  values ('00000000-0000-0000-0000-0000000000e3', 'conteudo', '00000000-0000-0000-0000-00000000000a', 'Ainda em pauta', 'reels', 'pauta');
insert into public.tasks (id, tipo, client_id, titulo, area, etapa)
  values ('00000000-0000-0000-0000-0000000000e4', 'demanda', '00000000-0000-0000-0000-00000000000a', 'Campanha de leads', 'trafego_pago', 'fazendo');
insert into public.task_notes (task_id, tipo, texto) values ('00000000-0000-0000-0000-0000000000f1', 'interno', 'Segredo interno');
insert into storage.objects (bucket_id, name) values
  ('artes', '00000000-0000-0000-0000-00000000000a/00000000-0000-0000-0000-0000000000f1/a.png'),
  ('artes', '00000000-0000-0000-0000-00000000000a/00000000-0000-0000-0000-0000000000e3/pauta.png'),
  ('artes', '00000000-0000-0000-0000-00000000000b/00000000-0000-0000-0000-0000000000f2/b.png');
insert into public.task_assets (task_id, caminho, tipo_midia) values
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-00000000000a/00000000-0000-0000-0000-0000000000f1/a.png', 'imagem');
update public.tasks set prazo = (now() at time zone 'America/Sao_Paulo')::date
  where id in ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000e3', '00000000-0000-0000-0000-0000000000e4');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000ca","role":"authenticated"}', true);
select testes.ok(testes.conta('select * from public.portal_conteudos()') >= 1, 'portal A: vê os conteúdos para aprovar');
select testes.ok(testes.conta($$select * from public.portal_conteudos() where id = '00000000-0000-0000-0000-0000000000f2'$$) = 0, 'portal A: não vê conteúdo do Cliente B');
select testes.ok(testes.conta($$select * from public.portal_conteudos() where id = '00000000-0000-0000-0000-0000000000e3'$$) = 0, 'portal A: não vê conteúdo em pauta');
select testes.ok(testes.conta($$select * from public.portal_conteudos() where pedidos_ajuste::text like '%Segredo%'$$) = 0, 'portal A: comentário interno não aparece');
select testes.ok(testes.conta($$select * from public.portal_conteudos() where id = '00000000-0000-0000-0000-0000000000f1' and jsonb_array_length(artes) = 1$$) = 1, 'portal A: recebe o caminho da arte');
select testes.recusa($$select * from public.portal_conteudos('00000000-0000-0000-0000-00000000000b')$$, 'portal A: não abre o portal do Cliente B');
select testes.ok((public.portal_resumo() ->> 'cliente') = 'Cliente A' and (public.portal_resumo() ->> 'ajustes_mes')::int = 3, 'portal A: resumo com o limite do contrato');
select testes.ok(testes.conta($$select * from public.portal_relatorio() where situacao = 'Em produção'$$) = 1, 'portal A: relatório mostra o que está em produção');
select testes.ok(testes.conta($$select * from public.portal_servicos() where titulo = 'Campanha de leads' and situacao = 'Em andamento'$$) = 1, 'portal A: outros serviços do mês');
select testes.ok(testes.conta($$select * from storage.objects where bucket_id = 'artes'$$) = 1, 'artes A: vê só a arte de conteúdo que chegou ao portal');
select testes.recusa($$insert into storage.objects (bucket_id, name) values ('artes', '00000000-0000-0000-0000-00000000000a/x/y.png')$$, 'artes A: cliente não envia arquivo');
select testes.recusa($$select public.portal_aprovar('00000000-0000-0000-0000-0000000000f2')$$, 'portal A: não aprova conteúdo do Cliente B');
select testes.recusa($$select public.portal_pedir_ajuste('00000000-0000-0000-0000-0000000000f1', '   ')$$, 'portal A: pedido de ajuste precisa de texto');
select public.portal_pedir_ajuste('00000000-0000-0000-0000-0000000000f1', 'Trocar a cor do fundo');
select testes.ok(public.ajustes_do_mes('00000000-0000-0000-0000-00000000000a') = 2, 'portal A: pedido de ajuste soma 1 no contador do mês');
select testes.ok(testes.conta($$select * from public.portal_conteudos() where id = '00000000-0000-0000-0000-0000000000f1' and etapa = 'ajuste' and pedidos_ajuste::text like '%Trocar a cor%'$$) = 1, 'portal A: vê o próprio pedido de ajuste');
select testes.recusa($$select public.portal_aprovar('00000000-0000-0000-0000-0000000000f1')$$, 'portal A: não aprova conteúdo que já está em ajuste');
reset role;

select testes.ok((select etapa = 'ajuste' and responsavel_id = '00000000-0000-0000-0000-000000000003' from public.tasks where id = '00000000-0000-0000-0000-0000000000f1'), 'portal: pedido de ajuste vira tarefa para o responsável do Ajuste');
select testes.ok(testes.conta($$select * from public.task_events where task_id = '00000000-0000-0000-0000-0000000000f1' and para_etapa = 'ajuste' and origem = 'cliente' and ator_nome = 'Pessoa A editada'$$) = 1, 'portal: registra quem pediu o ajuste');
select testes.ok(testes.conta($$select * from public.notifications where tipo = 'ajuste_pedido' and destinatario_id = '00000000-0000-0000-0000-000000000003'$$) = 1, 'portal: responsável recebe aviso do ajuste');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000003","role":"authenticated"}', true);
select testes.recusa($$select public.portal_resumo('00000000-0000-0000-0000-00000000000a')$$, 'portal: Criação não usa "Ver como cliente"');
select testes.ok(testes.conta($$select * from storage.objects where bucket_id = 'artes'$$) = 3, 'artes: time vê todas');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
select testes.ok(testes.conta($$select * from public.portal_conteudos('00000000-0000-0000-0000-00000000000b')$$) = 1, 'portal: Adm vê como o Cliente B');
select testes.recusa($$select public.portal_aprovar('00000000-0000-0000-0000-0000000000f2')$$, 'portal: "Ver como cliente" não aprova em nome dele');
select testes.recusa($$select public.portal_pedir_ajuste('00000000-0000-0000-0000-0000000000f2', 'x')$$, 'portal: "Ver como cliente" não pede ajuste em nome dele');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000cb","role":"authenticated"}', true);
select public.portal_aprovar('00000000-0000-0000-0000-0000000000f2');
select testes.ok(true, 'portal B: aprova o próprio conteúdo');
reset role;

select testes.ok(testes.conta($$select * from public.task_events where task_id = '00000000-0000-0000-0000-0000000000f2' and para_etapa = 'aprovado' and origem = 'cliente' and ator_nome = 'Pessoa B'$$) = 1, 'portal: registra quem aprovou e quando');
select testes.ok(testes.conta($$select * from public.notifications where tipo = 'cliente_aprovou' and destinatario_id = '00000000-0000-0000-0000-000000000002'$$) = 1, 'portal: Adm recebe aviso da aprovação');

-- ---------------------------------------------------------------- notificações (etapa 7)
select testes.ok(testes.conta($$select * from public.notifications where tipo = 'responsavel' and destinatario_id = '00000000-0000-0000-0000-000000000003'$$) = 0, 'aviso: quem se atribui não recebe "Você recebeu"');
select testes.ok(testes.conta($$select * from public.notifications where tipo = 'responsavel' and task_id = '00000000-0000-0000-0000-0000000000f1'$$) = 0, 'aviso: pedido de ajuste do cliente não gera aviso duplicado');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
update public.tasks set responsavel_id = '00000000-0000-0000-0000-000000000003' where id = '00000000-0000-0000-0000-0000000000e2';
select testes.recusa($$insert into public.envios_email (tipo, email, assunto, ok) values ('x', 'x@x.com', 'x', true)$$, 'envios: ninguém grava pela API');
reset role;
select testes.ok(testes.conta($$select * from public.notifications where tipo = 'responsavel' and task_id = '00000000-0000-0000-0000-0000000000e2' and destinatario_id = '00000000-0000-0000-0000-000000000003' and texto like 'Você recebeu: Notas fiscais%'$$) = 1, 'aviso: novo responsável recebe "Você recebeu"');
update public.tasks set etapa = 'cliente', aviso_cliente_em = now() where id = '00000000-0000-0000-0000-0000000000e3';
select testes.ok((select aviso_cliente_em is null from public.tasks where id = '00000000-0000-0000-0000-0000000000e3'), 'aviso: conteúdo que chega ao cliente entra no próximo e-mail');
insert into public.envios_email (tipo, client_id, email, assunto, ok) values ('lembrete', '00000000-0000-0000-0000-00000000000a', 'ca@teste.com', 'Lembrete', true);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
select testes.ok(testes.conta('select * from public.envios_email') = 1, 'envios: Adm vê o registro de e-mails');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000003","role":"authenticated"}', true);
select testes.ok(testes.conta('select * from public.envios_email') = 0, 'envios: Criação não vê');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000ca","role":"authenticated"}', true);
select testes.ok(testes.conta('select * from public.envios_email') = 0, 'envios: cliente não vê');
select testes.recusa($$select public.chamar_rotina('avisos')$$, 'rotinas: ninguém dispara pela API');
reset role;

-- ---------------------------------------------------------------- CRM
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
insert into public.leads (id, empresa, contato, origem, servicos, valor_mensal, responsavel_id, proximo_passo, proximo_passo_em)
  values ('00000000-0000-0000-0000-0000000000d1', 'Padaria Dona Lu', 'Luciana', 'instagram', '{social_media,identidade_visual}', 1500,
          '00000000-0000-0000-0000-000000000002', 'Ligar', current_date);
select testes.ok(testes.conta($$select * from public.lead_eventos where lead_id = '00000000-0000-0000-0000-0000000000d1' and texto = 'Entrou em Novo lead' and autor_nome = 'Adm'$$) = 1, 'crm: Adm cria lead e o histórico registra');
select testes.recusa($$insert into public.leads (empresa, servicos) values ('X', '{marketing_digital}')$$, 'crm: só serviços da lista');
select testes.recusa($$update public.leads set etapa = 'perdido' where id = '00000000-0000-0000-0000-0000000000d1'$$, 'crm: Perdido exige o motivo');
update public.leads set etapa = 'ganho' where id = '00000000-0000-0000-0000-0000000000d1';
select testes.ok((select fechado_em is not null and proximo_passo is null and proximo_passo_em is null from public.leads where id = '00000000-0000-0000-0000-0000000000d1'), 'crm: Fechado grava a data e encerra o follow-up');
update public.leads set etapa = 'perdido', motivo_perda = 'Preço' where id = '00000000-0000-0000-0000-0000000000d1';
select testes.ok(testes.conta($$select * from public.lead_eventos where lead_id = '00000000-0000-0000-0000-0000000000d1' and texto = 'Movido para Perdido: Preço'$$) = 1, 'crm: perda entra no histórico com o motivo');
update public.leads set etapa = 'negociacao' where id = '00000000-0000-0000-0000-0000000000d1';
select testes.ok((select fechado_em is null and motivo_perda is null from public.leads where id = '00000000-0000-0000-0000-0000000000d1'), 'crm: reabrir limpa data de fechamento e motivo');
insert into public.lead_eventos (lead_id, tipo, texto, autor_id) values ('00000000-0000-0000-0000-0000000000d1', 'nota', 'Ligou pedindo proposta', auth.uid());
select testes.recusa($$insert into public.lead_eventos (lead_id, tipo, texto, autor_id) values ('00000000-0000-0000-0000-0000000000d1', 'etapa', 'Movido para Fechado', auth.uid())$$, 'crm: ninguém forja mudança de etapa no histórico');
select testes.recusa($$insert into public.lead_eventos (lead_id, tipo, texto, autor_id) values ('00000000-0000-0000-0000-0000000000d1', 'nota', 'x', '00000000-0000-0000-0000-000000000001')$$, 'crm: ninguém anota em nome de outra pessoa');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000003","role":"authenticated"}', true);
select testes.ok(testes.conta('select * from public.leads') = 0 and testes.conta('select * from public.lead_eventos') = 0, 'crm: Criação não vê o CRM');
select testes.recusa($$insert into public.leads (empresa) values ('X')$$, 'crm: Criação não cria lead');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000ca","role":"authenticated"}', true);
select testes.ok(testes.conta('select * from public.leads') = 0, 'crm: cliente não vê o CRM');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
select testes.ok(testes.conta('select * from public.leads') = 1, 'crm: Sócio vê o CRM');
reset role;

-- ---------------------------------------------------------------- chat
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
insert into public.chat_canais (id, nome, client_id) values ('00000000-0000-0000-0000-0000000000c1', 'cliente-a', '00000000-0000-0000-0000-00000000000a');
select testes.ok(true, 'chat: Adm cria canal');
select testes.recusa($$insert into public.chat_canais (nome) values ('Nome Inválido')$$, 'chat: nome de canal só minúsculas, números e hífen');
select testes.recusa($$update public.chat_canais set arquivado = true where nome = 'geral'$$, 'chat: #geral não é arquivado');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000003","role":"authenticated"}', true);
select testes.recusa($$insert into public.chat_canais (nome) values ('criacao')$$, 'chat: Criação não cria canal');
insert into public.chat_mensagens (id, canal_id, autor_id, texto) values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000c1', auth.uid(), 'Arte pronta, @adm pode revisar?');
select testes.ok(testes.conta($$select * from public.chat_mensagens where autor_nome = 'Criação'$$) = 1, 'chat: Criação conversa e o nome do autor é gravado');
select testes.recusa($$insert into public.chat_mensagens (canal_id, autor_id, texto) values ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-000000000001', 'x')$$, 'chat: ninguém escreve em nome de outra pessoa');
select testes.recusa($$insert into public.chat_mensagens (canal_id, autor_id, texto) values ('00000000-0000-0000-0000-0000000000c1', auth.uid(), '   ')$$, 'chat: mensagem vazia não vai');
update public.chat_mensagens set texto = 'Arte pronta, @adm pode revisar? (v2)', editada_em = now() where id = '00000000-0000-0000-0000-0000000000a1';
select testes.recusa($$update public.chat_mensagens set autor_id = '00000000-0000-0000-0000-000000000001' where id = '00000000-0000-0000-0000-0000000000a1'$$, 'chat: autor não muda');
reset role;
select testes.ok(testes.conta($$select * from public.notifications where tipo = 'mencao' and destinatario_id = '00000000-0000-0000-0000-000000000002' and email_enviado_em is not null$$) = 1, 'chat: @menção avisa no sino, sem e-mail');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
select testes.ok((select total from public.chat_nao_lidas() where canal_id = '00000000-0000-0000-0000-0000000000c1') = 1, 'chat: conta não lidas');
insert into public.chat_leituras (pessoa_id, canal_id) values (auth.uid(), '00000000-0000-0000-0000-0000000000c1');
select testes.ok(not exists (select 1 from public.chat_nao_lidas() where canal_id = '00000000-0000-0000-0000-0000000000c1'), 'chat: ler zera o contador');
select testes.recusa($$delete from public.chat_mensagens where id = '00000000-0000-0000-0000-0000000000a1'$$, 'chat: Adm não apaga mensagem de outra pessoa');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000ca","role":"authenticated"}', true);
select testes.ok(testes.conta('select * from public.chat_canais') = 0 and testes.conta('select * from public.chat_mensagens') = 0, 'chat: cliente não vê o chat');
select testes.recusa($$insert into public.chat_mensagens (canal_id, autor_id, texto) values ('00000000-0000-0000-0000-0000000000c1', auth.uid(), 'oi')$$, 'chat: cliente não escreve no chat');
select testes.recusa($$insert into storage.objects (bucket_id, name) values ('chat', 'x/y.pdf')$$, 'chat: cliente não envia anexo');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
delete from public.chat_mensagens where id = '00000000-0000-0000-0000-0000000000a1';
select testes.ok(testes.conta($$select * from public.chat_mensagens where id = '00000000-0000-0000-0000-0000000000a1'$$) = 0, 'chat: Sócio apaga qualquer mensagem');
select testes.ok(testes.conta('select * from public.uso_armazenamento()') >= 1, 'armazenamento: Sócio vê o uso');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000003","role":"authenticated"}', true);
select testes.recusa('select * from public.uso_armazenamento()', 'armazenamento: Criação não vê o uso');
reset role;

-- ---------------------------------------------------------------- relatório de métricas
select set_config('request.jwt.claims', '', true);
update public.tasks set etapa = 'agendado', publicar_em = now() - interval '2 days' where id = '00000000-0000-0000-0000-0000000000f2';
insert into public.relatorios_metricas (client_id, mes, alcance, novos_seguidores, publicado_em) values
  ('00000000-0000-0000-0000-00000000000b', date_trunc('month', current_date - interval '1 month')::date, 1000, 50, now());
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
insert into public.relatorios_metricas (client_id, mes, alcance, novos_seguidores, alcance_semanas, destaques, leitura) values
  ('00000000-0000-0000-0000-00000000000b', date_trunc('month', current_date)::date, 1200, 40, '{300,280,310,310}',
   '{00000000-0000-0000-0000-0000000000f2,00000000-0000-0000-0000-0000000000f1}', 'Alcance cresceu com os Reels.');
select testes.ok(true, 'métricas: Adm preenche o relatório');
select testes.recusa($$insert into public.relatorios_metricas (client_id, mes) values ('00000000-0000-0000-0000-00000000000a', '2026-10-15')$$, 'métricas: mês é sempre o dia 1');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000003","role":"authenticated"}', true);
select testes.ok(testes.conta('select * from public.relatorios_metricas') = 2, 'métricas: Criação lê');
select testes.recusa($$update public.relatorios_metricas set alcance = 1$$, 'métricas: Criação não edita');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000cb","role":"authenticated"}', true);
select testes.ok(testes.conta('select * from public.relatorios_metricas') = 0, 'métricas: cliente não lê a tabela');
select testes.ok((public.portal_metricas(null, current_date) -> 'relatorio') = 'null'::jsonb, 'métricas: rascunho não aparece no portal');
select testes.ok((public.portal_metricas() -> 'relatorio' ->> 'alcance')::int = 1000, 'métricas: portal mostra o último publicado');
reset role;
update public.relatorios_metricas set publicado_em = now() where mes = date_trunc('month', current_date)::date;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000cb","role":"authenticated"}', true);
select testes.ok((public.portal_metricas() -> 'relatorio' ->> 'alcance_anterior')::int = 1000, 'métricas: traz o mês anterior para a variação');
select testes.ok(jsonb_array_length(public.portal_metricas() -> 'relatorio' -> 'destaques') = 1, 'métricas: destaque de outro cliente não aparece');
select testes.recusa($$select public.portal_metricas('00000000-0000-0000-0000-00000000000a')$$, 'métricas: cliente B não abre o relatório do A');
reset role;

-- ---------------------------------------------------------------- revisão de segurança
select testes.ok(not exists (select 1 from pg_tables where schemaname = 'public' and not rowsecurity), 'segurança: todas as tabelas do schema public com RLS');
select testes.ok(not exists (
  select 1 from information_schema.role_table_grants where table_schema = 'public' and grantee = 'anon'
), 'segurança: visitante sem login sem permissão em nenhuma tabela');
select testes.ok(not exists (
  select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'execute')
), 'segurança: visitante sem login não executa nenhuma função');
select testes.ok(not exists (
  select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prosecdef and not exists (select 1 from unnest(p.proconfig) c where c like 'search_path=%')
), 'segurança: toda função security definer fixa o search_path');

select testes.ok(true, 'TODOS OS TESTES PASSARAM');
rollback;
