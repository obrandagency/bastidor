-- Bastidor · valor mensal do contrato (Sócio edita, Adm vê; Criação e cliente nunca veem)
-- A RLS de contracts já garante quem vê. As funções do portal não devolvem o valor.

alter table public.contracts add column valor_mensal numeric(10, 2) check (valor_mensal >= 0);

-- Contrato criado pelo CRM ("Virar cliente") nasce com o valor e o escopo "a definir"
alter table public.contracts alter column conteudos_mes drop not null;
alter table public.contracts alter column ajustes_mes drop not null;
