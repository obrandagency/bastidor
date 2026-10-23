import Link from "next/link";
import { CabecalhoPagina } from "@/components/cabecalho-pagina";
import { LogoCliente } from "@/components/tarefa";
import { diaMes } from "@/lib/datas";
import { dataHoraSP } from "@/lib/dominio/tarefas";
import { rotuloFormatoVideo, situacaoRoteiro, SITUACOES_ROTEIRO, type Roteiro } from "@/lib/dominio/roteiros";
import { exigirTime } from "@/lib/sessao";
import { criarClienteServidor } from "@/lib/supabase/server";
import { INTERNO } from "../tarefas/detalhe-tarefa";
import { NovoRoteiro } from "./novo";

export const metadata = { title: "Roteiros" };

type Busca = { cliente?: string; situacao?: string; nova?: string };

export default async function Roteiros({ searchParams }: { searchParams: Promise<Busca> }) {
  await exigirTime();
  const busca = await searchParams;
  const supabase = await criarClienteServidor();
  let consulta = supabase.from("roteiros").select("*").order("updated_at", { ascending: false });
  if (busca.cliente === "interno") consulta = consulta.is("client_id", null);
  else if (busca.cliente) consulta = consulta.eq("client_id", busca.cliente);
  if (busca.situacao) consulta = consulta.eq("situacao", busca.situacao);
  const [{ data: roteiros }, { data: clientes }, { data: pessoas }, { data: cenas }] = await Promise.all([
    consulta.returns<Roteiro[]>(),
    supabase.from("clients").select("id, nome, nome_curto, cor, logo, ativo").order("nome"),
    supabase.from("profiles").select("id, nome").neq("perfil", "cliente"),
    supabase.from("roteiro_cenas").select("roteiro_id"),
  ]);
  const clientePor = new Map((clientes ?? []).map((c) => [c.id, c]));
  const nomeDe = new Map((pessoas ?? []).map((p) => [p.id, p.nome]));
  const nCenas = new Map<string, number>();
  (cenas ?? []).forEach((c) => nCenas.set(c.roteiro_id, (nCenas.get(c.roteiro_id) ?? 0) + 1));
  const link = (mudar: Partial<Busca>) => {
    const p = new URLSearchParams();
    Object.entries({ cliente: busca.cliente, situacao: busca.situacao, ...mudar }).forEach(([k, v]) => v && p.set(k, v));
    return `/roteiros${p.size ? `?${p}` : ""}`;
  };
  const filtro = "rounded-full border px-3 py-1 text-[12.5px]";

  return (
    <>
      <CabecalhoPagina
        sobretitulo="Operação"
        titulo="Roteiros"
        descricao="Roteiros de vídeo em cenas, só do time. Baixe em PDF no timbrado da agência."
        acoes={<NovoRoteiro clientes={(clientes ?? []).filter((c) => c.ativo).map((c) => ({ id: c.id, nome: c.nome }))} clienteFiltro={busca.cliente} />}
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <form action="/roteiros" className="contents">
          <select
            name="cliente"
            defaultValue={busca.cliente ?? ""}
            aria-label="Cliente"
            className="rounded-lg border border-line bg-card px-2.5 py-1.5 text-[13px]"
          >
            <option value="">Todos os clientes</option>
            <option value="interno">Interno da agência</option>
            {(clientes ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
          {busca.situacao && <input type="hidden" name="situacao" value={busca.situacao} />}
          <button className="rounded-lg border border-line px-2.5 py-1.5 text-[13px] hover:border-ink">Filtrar</button>
        </form>
        <span className="mx-1 h-5 w-px bg-line" />
        <Link href={link({ situacao: undefined })} className={`${filtro} ${!busca.situacao ? "border-accent bg-accent-soft font-semibold" : "border-line bg-card"}`}>
          Todos
        </Link>
        {SITUACOES_ROTEIRO.map((s) => (
          <Link key={s.id} href={link({ situacao: s.id })} className={`${filtro} ${busca.situacao === s.id ? "border-accent bg-accent-soft font-semibold" : "border-line bg-card"}`}>
            {s.rotulo}
          </Link>
        ))}
      </div>

      <section className="rounded-xl border border-line bg-card">
        {(roteiros ?? []).map((r) => {
          const c = (r.client_id && clientePor.get(r.client_id)) || null;
          const s = situacaoRoteiro(r.situacao);
          const { data, hora } = dataHoraSP(r.updated_at);
          return (
            <Link key={r.id} href={`/roteiros/${r.id}`} className="flex min-w-0 items-center gap-3 border-t border-line px-4 py-3 first:border-t-0 hover:bg-surface">
              <LogoCliente nome={c?.nome ?? INTERNO.nome} cor={c?.cor ?? INTERNO.cor} logo={c?.logo} classe="h-8 w-8 text-[12px]" />
              <div className="min-w-0 flex-1">
                <div className="font-medium [overflow-wrap:anywhere]">{r.titulo}</div>
                <div className="text-[12.5px] text-muted">
                  {c?.nome ?? INTERNO.nome} · {rotuloFormatoVideo(r.formato)}
                  {r.duracao ? ` · ${r.duracao}` : ""} · {nCenas.get(r.id) ?? 0} cenas
                </div>
              </div>
              <span className="hidden text-right text-[12px] text-muted sm:block">
                {diaMes(data)} {hora}
                {r.atualizado_por && nomeDe.get(r.atualizado_por) ? <small className="block">{nomeDe.get(r.atualizado_por)}</small> : null}
              </span>
              <span className={`whitespace-nowrap rounded-full px-[9px] py-px text-[11.5px] font-medium ${s.classe}`}>{s.rotulo}</span>
            </Link>
          );
        })}
        {!roteiros?.length && <p className="px-4 py-[18px] text-[13px] text-muted">Nenhum roteiro por aqui. Crie o primeiro em &quot;+ Novo roteiro&quot; ou a partir de um Reels no quadro de Tarefas.</p>}
      </section>
    </>
  );
}
