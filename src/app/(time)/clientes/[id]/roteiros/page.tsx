import Link from "next/link";
import { EstadoVazio } from "@/components/cabecalho-pagina";
import { dataBR } from "@/lib/datas";
import { NovoRoteiro } from "../../../roteiros/novo";
import { lerCliente, TituloSecao } from "../dados";

export const metadata = { title: "Roteiros" };

const SITUACAO: Record<string, [string, string]> = {
  rascunho: ["Rascunho", "border-line bg-surface text-muted"],
  revisao: ["Em revisão", "border-warn/30 bg-warn-soft text-warn"],
  aprovado: ["Aprovado", "border-ok/30 bg-ok-soft text-ok"],
};

export default async function RoteirosCliente({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, cliente } = await lerCliente(id);
  const { data: roteiros } = await supabase
    .from("roteiros")
    .select("id, titulo, formato, duracao, situacao, updated_at")
    .eq("client_id", id)
    .order("updated_at", { ascending: false });

  return (
    <>
      <TituloSecao
        titulo="Roteiros"
        descricao="Roteiros de vídeo deste cliente. Só o time vê."
        acoes={<NovoRoteiro clientes={[{ id, nome: cliente.nome }]} clienteFiltro={id} />}
      />
      {!roteiros?.length ? (
        <EstadoVazio icone="roteiros">
          Nenhum roteiro para este cliente ainda.
        </EstadoVazio>
      ) : (
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,260px),1fr))] gap-3">
          {roteiros.map((r) => {
            const [rotulo, cor] = SITUACAO[r.situacao] ?? SITUACAO.rascunho;
            return (
              <li key={r.id}>
                <Link href={`/roteiros/${r.id}`} className="flex h-full flex-col gap-2 rounded-xl border border-line bg-card p-4 hover:border-muted">
                  <b className="text-[15px] leading-snug [overflow-wrap:anywhere]">{r.titulo}</b>
                  <span className="text-[12.5px] capitalize text-muted">
                    {r.formato}
                    {r.duracao ? ` · ${r.duracao}` : ""}
                  </span>
                  <span className="mt-auto flex items-center justify-between pt-1">
                    <span className={`rounded-full border px-[9px] py-px text-[11.5px] font-medium ${cor}`}>{rotulo}</span>
                    <span className="font-mono text-[11.5px] text-muted">{dataBR(r.updated_at).slice(0, 5)}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
