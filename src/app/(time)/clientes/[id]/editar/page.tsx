import { notFound } from "next/navigation";
import { CabecalhoPagina } from "@/components/cabecalho-pagina";
import { exigirTime } from "@/lib/sessao";
import { criarClienteServidor } from "@/lib/supabase/server";
import type { ClienteCompleto } from "@/types/banco";
import { FormCliente } from "../../formularios";

export const metadata = { title: "Editar cliente · Bastidor" };

export default async function EditarCliente({ params }: { params: Promise<{ id: string }> }) {
  await exigirTime(["socio", "adm"]);
  const { id } = await params;
  const supabase = await criarClienteServidor();
  const { data: cliente } = await supabase.from("clients").select("*").eq("id", id).maybeSingle<ClienteCompleto>();
  if (!cliente) notFound();
  return (
    <>
      <CabecalhoPagina sobretitulo="Clientes" titulo={`Editar ${cliente.nome}`} />
      <FormCliente cliente={cliente} />
    </>
  );
}
