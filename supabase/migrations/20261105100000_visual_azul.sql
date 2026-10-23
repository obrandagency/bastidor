-- Novo azul de ação da plataforma (#2563EB). Quem ainda usa o azul antigo padrão passa para o novo;
-- uma cor escolhida pelo Sócio em Configurações > Identidade fica como está.
alter table public.identidade alter column cor set default '#2563EB';
update public.identidade set cor = '#2563EB' where cor = '#1E4BFF';
