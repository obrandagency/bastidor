import Link from "next/link";
import { EstadoVazio } from "@/components/cabecalho-pagina";
import { Icone } from "@/components/icone";
import { Painel } from "@/components/painel";
import { SeloEtapa } from "@/components/tarefa";
import { hojeSP } from "@/lib/datas";
import { dataHoraSP, diasEntre, rotuloFormato } from "@/lib/dominio/tarefas";
import type { Tarefa } from "@/types/banco";
import { DetalheTarefa } from "../../../tarefas/detalhe-tarefa";
import { lerCliente, TituloSecao } from "../dados";

export const metadata = { title: "Aprovação" };

export default async function Aprovacao({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tarefa?: string }> }) {
  const { id } = await params;
  const { tarefa } = await searchParams;
  const { gestao, supabase } = await lerCliente(id);
  const hoje = hojeSP();
  const { data } = await supabase.from("tasks").select("*").eq("client_id", id).in("etapa", ["cliente", "ajuste"]).order("enviado_cliente_em").returns<Tarefa[]>();
  const esperando = (data ?? []).filter((t) => t.etapa === "cliente");
  const ajuste = (data ?? []).filter((t) => t.etapa === "ajuste");
  const base = `/clientes/${id}/aprovacao`;

  const linha = (t: Tarefa) => {
    const dias = t.enviado_cliente_em ? diasEntre(dataHoraSP(t.enviado_cliente_em).data, hoje) : 0;
    return (
      <Link key={t.id} href={`${base}?tarefa=${t.id}`} scroll={false} className="flex min-w-0 items-center gap-3 border-t border-line px-4 py-3 first:border-t-0 hover:bg-surface">
        <div className="min-w-0 flex-1">
          <div className="font-medium [overflow-wrap:anywhere]">{t.titulo}</div>
          <div className="text-[12.5px] text-muted">{rotuloFormato(t.formato) || "Conteúdo"}</div>
        </div>
        <SeloEtapa etapa={t.etapa} />
        {t.etapa === "cliente" && (
          <span className={`w-[96px] flex-none text-right text-[12.5px] ${dias >= 2 ? "font-semibold text-bad" : "text-muted"}`}>
            {dias === 0 ? "enviado hoje" : `há ${dias} dia${dias > 1 ? "s" : ""}`}
          </span>
        )}
      </Link>
    );
  };

  return (
    <>
      <TituloSecao
        titulo="Aprovação"
        descricao="Conteúdos com o cliente esperando aprovação e os que voltaram com pedido de ajuste."
        acoes={
          gestao && (
            <Link href={`/ver-como-cliente/${id}`} className="inline-flex items-center gap-2 rounded-lg border border-line bg-card px-3.5 py-2 text-[13.5px] font-medium hover:border-ink">
              <Icone nome="portal" /> Ver como o cliente vê
            </Link>
          )
        }
      />
      {!data?.length ? (
        <EstadoVazio icone="aprovacao" acao={{ href: `/tarefas?aba=conteudo&cliente=${id}`, rotulo: "Abrir conteúdos" }}>
          Nada esperando o cliente nem em ajuste agora.
        </EstadoVazio>
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <Painel icone="relogio" tom="ambar" titulo={`Com o cliente (${esperando.length})`} semPadding>
            {esperando.map(linha)}
            {!esperando.length && <p className="px-4 py-[18px] text-[13px] text-muted">Nenhum conteúdo esperando aprovação.</p>}
          </Painel>
          <Painel icone="criacao" tom="vermelho" titulo={`Em ajuste (${ajuste.length})`} semPadding>
            {ajuste.map(linha)}
            {!ajuste.length && <p className="px-4 py-[18px] text-[13px] text-muted">Nenhum pedido de ajuste aberto.</p>}
          </Painel>
        </div>
      )}
      {tarefa && <DetalheTarefa id={tarefa} fechar={base} podeExcluir={gestao} />}
    </>
  );
}
