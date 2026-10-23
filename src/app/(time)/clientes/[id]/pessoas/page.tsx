import { notFound } from "next/navigation";
import { Painel } from "@/components/painel";
import type { Pessoa } from "@/types/banco";
import { AcoesPessoa } from "../../../configuracoes/formularios";
import { FormConviteCliente } from "../../formularios";
import { lerCliente, TituloSecao } from "../dados";

export const metadata = { title: "Pessoas do cliente" };

export default async function PessoasCliente({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { gestao, supabase } = await lerCliente(id);
  if (!gestao) notFound();
  const { data: pessoas } = await supabase.from("profiles").select("*").eq("client_id", id).order("nome").returns<Pessoa[]>();
  return (
    <>
      <TituloSecao titulo="Pessoas do cliente" descricao="Quem do cliente entra no portal para aprovar conteúdos e ver os relatórios." />
      <div className="max-w-[760px]">
        <Painel icone="pessoas" tom="violeta" titulo="Pessoas" extra={<span className="text-[12px] text-muted">aprovam no portal</span>} semPadding>
          <ul>
            {(pessoas ?? []).map((p) => (
              <li key={p.id} className={`flex flex-col gap-2 border-t border-line px-4 py-3 first:border-t-0 ${p.ativo ? "" : "opacity-60"}`}>
                <div className="min-w-0">
                  <div className="font-medium">
                    {p.nome}
                    {!p.ativo && <span className="ml-2 text-[12px] font-normal text-muted">desativado</span>}
                  </div>
                  <div className="truncate text-[12.5px] text-muted">{p.email}</div>
                </div>
                <AcoesPessoa id={p.id} perfil={p.perfil} ativo={p.ativo} souEu={false} />
              </li>
            ))}
            {!pessoas?.length && <li className="px-4 py-3.5 text-[13px] text-muted">Ninguém convidado ainda.</li>}
          </ul>
          <FormConviteCliente clientId={id} />
        </Painel>
      </div>
    </>
  );
}
