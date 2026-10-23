import { lerCliente } from "./dados";
import { MenuCliente } from "./menu-cliente";

// Central do cliente: menu próprio (Geral, Estratégia, Conteúdo, Comercial, Conta) ao lado das páginas
export default async function LayoutCliente({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { eu, gestao, cliente, supabase } = await lerCliente(id);
  const [{ data: todos }, { count: aprovar }] = await Promise.all([
    supabase.from("clients").select("id, nome").eq("ativo", true).order("nome"),
    supabase.from("tasks").select("id", { count: "exact", head: true }).eq("client_id", id).eq("etapa", "cliente"),
  ]);
  const outros = (todos ?? []).some((c) => c.id === id) ? todos! : [{ id, nome: cliente.nome }, ...(todos ?? [])];

  return (
    <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
      <MenuCliente
        cliente={{ id, nome: cliente.nome, cor: cliente.cor, logo: cliente.logo ?? null, ativo: cliente.ativo, segmento: cliente.segmento }}
        clientes={outros}
        perfil={eu.perfil}
        gestao={gestao}
        aprovar={aprovar ?? 0}
      />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
