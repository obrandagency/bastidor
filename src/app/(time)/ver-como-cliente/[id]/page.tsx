import Link from "next/link";
import { notFound } from "next/navigation";
import { exigirTime } from "@/lib/sessao";
import { criarClienteServidor } from "@/lib/supabase/server";
import { TelaAprovar, TelaMetricas, TelaRelatorio } from "@/app/portal/telas";

export const metadata = { title: "Ver como cliente · Bastidor" };

export default async function PortalDoCliente({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ aba?: string; mes?: string }>;
}) {
  await exigirTime(["socio", "adm"]);
  const { id } = await params;
  const { aba, mes } = await searchParams;
  const supabase = await criarClienteServidor();
  const { data: cliente } = await supabase.from("clients").select("nome").eq("id", id).maybeSingle();
  if (!cliente) notFound();
  const relatorio = aba === "relatorio";
  const metricas = aba === "metricas";
  const abas = [
    ["Aprovar conteúdos", `/ver-como-cliente/${id}`, !relatorio && !metricas],
    ["Relatório de entregas", `/ver-como-cliente/${id}?aba=relatorio`, relatorio],
    ["Métricas", `/ver-como-cliente/${id}?aba=metricas`, metricas],
  ] as const;

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-accent-soft px-3.5 py-2.5 text-[13px] text-accent">
        <span>
          Vendo o portal como <b>{cliente.nome}</b>. Nada aqui aprova ou pede ajuste em nome do cliente.
        </span>
        <Link href="/ver-como-cliente" className="font-medium hover:underline">
          Trocar cliente
        </Link>
      </div>
      <nav aria-label="Portal" className="mb-5 flex gap-1 border-b border-line">
        {abas.map(([rotulo, href, ativa]) => (
          <Link
            key={href}
            href={href}
            aria-current={ativa ? "page" : undefined}
            className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2.5 text-[13.5px] font-medium ${
              ativa ? "border-accent text-ink" : "border-transparent text-muted hover:text-ink"
            }`}
          >
            {rotulo}
          </Link>
        ))}
      </nav>
      {metricas ? (
        <TelaMetricas clientId={id} mes={mes} base={`/ver-como-cliente/${id}?aba=metricas`} />
      ) : relatorio ? (
        <TelaRelatorio clientId={id} mes={mes} base={`/ver-como-cliente/${id}?aba=relatorio`} />
      ) : (
        <TelaAprovar clientId={id} somenteLeitura />
      )}
    </>
  );
}
