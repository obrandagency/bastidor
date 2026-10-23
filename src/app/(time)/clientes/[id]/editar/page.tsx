import { notFound } from "next/navigation";
import { CabecalhoPagina } from "@/components/cabecalho-pagina";
import { exigirTime } from "@/lib/sessao";
import { criarClienteServidor } from "@/lib/supabase/server";
import type { ClienteCompleto } from "@/types/banco";
import { EnviarImagem } from "@/components/enviar-imagem";
import { LogoCliente } from "@/components/tarefa";
import { urlMarca } from "@/lib/marca";
import { salvarLogoCliente } from "../../acoes";
import { FormCliente } from "../../formularios";

export const metadata = { title: "Editar cliente" };

export default async function EditarCliente({ params }: { params: Promise<{ id: string }> }) {
  await exigirTime(["socio", "adm"]);
  const { id } = await params;
  const supabase = await criarClienteServidor();
  const { data: cliente } = await supabase.from("clients").select("*").eq("id", id).maybeSingle<ClienteCompleto>();
  if (!cliente) notFound();
  return (
    <>
      <CabecalhoPagina sobretitulo="Clientes" titulo={`Editar ${cliente.nome}`} />
      <div className="mb-4 max-w-[640px] rounded-xl border border-line bg-card p-4">
        <h2 className="mb-3 text-[15px] font-bold">Logo do cliente</h2>
        <EnviarImagem
          pasta={`clientes/${id}`}
          atual={urlMarca(cliente.logo)}
          salvar={salvarLogoCliente.bind(null, id)}
          rotulo="Enviar logo"
          vazio={<LogoCliente nome={cliente.nome} cor={cliente.cor} classe="h-full w-full text-[20px]" />}
        />
        <p className="mt-2.5 text-[12.5px] text-muted">Aparece na Central do cliente, no quadro de onboarding e no topo do portal desse cliente.</p>
      </div>
      <FormCliente cliente={cliente} />
    </>
  );
}
