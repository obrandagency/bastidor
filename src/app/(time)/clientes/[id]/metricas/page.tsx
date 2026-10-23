import Link from "next/link";
import { notFound } from "next/navigation";
import { CabecalhoPagina } from "@/components/cabecalho-pagina";
import { diaMes, hojeSP, mesEAno, somarMes } from "@/lib/datas";
import { dataHoraSP } from "@/lib/dominio/tarefas";
import { exigirTime } from "@/lib/sessao";
import { criarClienteServidor } from "@/lib/supabase/server";
import { FormMetricas } from "./formulario";

export const metadata = { title: "Relatório de métricas" };

export default async function Metricas({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ mes?: string }> }) {
  await exigirTime(["socio", "adm"]);
  const { id } = await params;
  const atual = hojeSP().slice(0, 7);
  const pedido = (await searchParams).mes;
  // Por padrão, o mês passado (o relatório sai depois que o mês fecha)
  const mes = /^\d{4}-\d{2}$/.test(pedido ?? "") && pedido! <= atual ? pedido! : somarMes(atual, -1);
  const supabase = await criarClienteServidor();

  const [{ data: cliente }, { data: relatorio }, { data: conteudos }, { data: meses }] = await Promise.all([
    supabase.from("clients").select("id, nome").eq("id", id).maybeSingle(),
    supabase.from("relatorios_metricas").select("*").eq("client_id", id).eq("mes", `${mes}-01`).maybeSingle(),
    supabase
      .from("tasks")
      .select("id, titulo, publicar_em")
      .eq("client_id", id)
      .eq("etapa", "agendado")
      .gte("publicar_em", `${mes}-01T00:00:00-03:00`)
      .lt("publicar_em", `${somarMes(mes, 1)}-01T00:00:00-03:00`)
      .order("publicar_em"),
    supabase.from("relatorios_metricas").select("mes, publicado_em").eq("client_id", id).order("mes", { ascending: false }),
  ]);
  if (!cliente) notFound();
  const botao = "rounded-lg border border-line bg-card px-2.5 py-[5px] text-[12.5px] font-medium hover:border-ink";
  const link = (m: string) => `/clientes/${id}/metricas?mes=${m}`;

  return (
    <>
      <CabecalhoPagina
        sobretitulo={cliente.nome}
        titulo="Relatório de métricas"
        descricao="Preencha com os números do Instagram e do Gerenciador de Anúncios. O cliente só vê depois de publicado."
        acoes={
          <div className="flex items-center gap-1.5">
            <Link href={link(somarMes(mes, -1))} aria-label="Mês anterior" className={botao}>
              ‹
            </Link>
            <span className="min-w-[130px] text-center text-[13px] font-semibold capitalize">{mesEAno(mes)}</span>
            {mes < atual ? (
              <Link href={link(somarMes(mes, 1))} aria-label="Próximo mês" className={botao}>
                ›
              </Link>
            ) : (
              <span className={`${botao} invisible`}>›</span>
            )}
          </div>
        }
      />
      <p className="mb-4 text-[13px]">
        <Link href={`/clientes/${id}`} className="text-accent hover:underline">
          ← Central do cliente
        </Link>
        {(meses ?? []).length > 0 && (
          <span className="text-muted">
            {" · "}Meses preenchidos:{" "}
            {(meses ?? []).map((m, i) => (
              <span key={m.mes}>
                {i > 0 && ", "}
                <Link href={link(m.mes.slice(0, 7))} className="capitalize hover:underline">
                  {mesEAno(m.mes.slice(0, 7))}
                </Link>
                {m.publicado_em ? "" : " (rascunho)"}
              </span>
            ))}
          </span>
        )}
      </p>
      <FormMetricas
        key={mes}
        clientId={id}
        mes={mes}
        relatorio={relatorio}
        candidatos={(conteudos ?? []).map((t) => ({ id: t.id, titulo: t.titulo, dia: diaMes(dataHoraSP(t.publicar_em).data) }))}
      />
    </>
  );
}
