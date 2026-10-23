import { notFound } from "next/navigation";
import { Painel } from "@/components/painel";
import { DadosDoCliente } from "../../formularios";
import { lerCliente, TituloSecao } from "../dados";

export const metadata = { title: "Dados do cliente (LGPD)" };

export default async function Lgpd({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { socio, cliente } = await lerCliente(id);
  if (!socio) notFound();
  return (
    <>
      <TituloSecao titulo="Dados do cliente (LGPD)" descricao="Exportar tudo o que o sistema guarda deste cliente ou apagar de vez. Só o Sócio." />
      <div className="max-w-[760px]">
        <Painel icone="escudo" tom="cinza" titulo="Exportar ou apagar">
          <DadosDoCliente clientId={id} nome={cliente.nome} />
        </Painel>
      </div>
    </>
  );
}
