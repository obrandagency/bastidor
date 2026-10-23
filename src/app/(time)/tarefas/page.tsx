import Link from "next/link";
import { CabecalhoPagina } from "@/components/cabecalho-pagina";
import { hojeSP } from "@/lib/datas";
import { area, ETAPAS_CONTEUDO, ETAPAS_DEMANDA, FINALIZADAS, rotuloFormato, type TipoTarefa } from "@/lib/dominio/tarefas";
import { exigirTime } from "@/lib/sessao";
import { criarClienteServidor } from "@/lib/supabase/server";
import type { Pessoa, Tarefa } from "@/types/banco";
import { FormNovaTarefa, Gaveta } from "./detalhe";
import { DetalheTarefa, INTERNO } from "./detalhe-tarefa";
import { Filtros } from "./filtros";
import { Quadro, type Card } from "./quadro";

export const metadata = { title: "Tarefas" };

type Busca = { aba?: string; cliente?: string; resp?: string; tarefa?: string; nova?: string };

export default async function Tarefas({ searchParams }: { searchParams: Promise<Busca> }) {
  const eu = await exigirTime();
  const busca = await searchParams;
  const gestao = eu.perfil === "socio" || eu.perfil === "adm";
  const tipo: TipoTarefa = busca.aba === "demanda" ? "demanda" : "conteudo";
  const hoje = hojeSP();
  const supabase = await criarClienteServidor();

  // Endereço desta tela com os filtros atuais, mudando só o que for pedido
  const link = (mudar: Partial<Busca>) => {
    const p = new URLSearchParams();
    const final = { aba: tipo, cliente: busca.cliente, resp: busca.resp, ...mudar };
    Object.entries(final).forEach(([k, v]) => v && p.set(k, v));
    return `/tarefas?${p}`;
  };

  let consulta = supabase.from("tasks").select("*").eq("tipo", tipo).order("prazo", { ascending: true, nullsFirst: false });
  if (busca.cliente === "interno") consulta = consulta.is("client_id", null);
  else if (busca.cliente) consulta = consulta.eq("client_id", busca.cliente);
  if (busca.resp) consulta = consulta.eq("responsavel_id", busca.resp);

  const [{ data: tarefas }, { data: clientes }, { data: time }, { data: ajustes }, abertas] = await Promise.all([
    consulta.returns<Tarefa[]>(),
    supabase.from("clients").select("id, nome, nome_curto, cor, ativo").order("nome"),
    supabase.from("profiles").select("*").neq("perfil", "cliente").eq("ativo", true).order("nome").returns<Pessoa[]>(),
    supabase.from("task_events").select("task_id").eq("origem", "cliente").eq("para_etapa", "ajuste"),
    Promise.all(
      (["conteudo", "demanda"] as const).map((t) =>
        supabase.from("tasks").select("id", { count: "exact", head: true }).eq("tipo", t).not("etapa", "in", `(${FINALIZADAS.join(",")})`),
      ),
    ),
  ]);

  // Demandas com processo: progresso e etapa atual no card
  const comProcesso = tipo === "demanda";
  const [{ data: etapas }, { data: processos }] = await Promise.all([
    comProcesso
      ? supabase.from("tarefa_etapas").select("task_id, nome, feito_em, ordem, tasks!inner(etapa)").neq("tasks.etapa", "concluido").order("ordem").order("created_at")
      : Promise.resolve({ data: [] as { task_id: string; nome: string; feito_em: string | null; ordem: number }[] }),
    supabase.from("processos").select("id, nome, area").eq("ativo", true).order("nome"),
  ]);
  const etapasPor = new Map<string, { nome: string; feito: boolean }[]>();
  (etapas ?? []).forEach((e) => etapasPor.set(e.task_id, [...(etapasPor.get(e.task_id) ?? []), { nome: e.nome, feito: !!e.feito_em }]));

  const clientePor = new Map((clientes ?? []).map((c) => [c.id, c]));
  const pessoaPor = new Map((time ?? []).map((p) => [p.id, p]));
  const ajustesPor = new Map<string, number>();
  (ajustes ?? []).forEach((e) => ajustesPor.set(e.task_id, (ajustesPor.get(e.task_id) ?? 0) + 1));
  const clienteDe = (id: string | null) => (id ? clientePor.get(id) : null) ?? INTERNO;

  const cards: Card[] = (tarefas ?? []).map((t) => {
    const r = t.responsavel_id ? pessoaPor.get(t.responsavel_id) : null;
    return {
      id: t.id,
      titulo: t.titulo,
      etapa: t.etapa,
      prazo: t.prazo,
      clienteNome: clienteDe(t.client_id).nome,
      clienteCor: clienteDe(t.client_id).cor,
      detalhe: tipo === "conteudo" ? rotuloFormato(t.formato) : (area(t.area)?.rotulo ?? ""),
      resp: r ? { iniciais: r.iniciais, nome: r.nome, foto: r.foto } : null,
      ajustesCliente: ajustesPor.get(t.id) ?? 0,
      recorrente: !!t.recorrencia_id,
      etapas: etapasPor.has(t.id)
        ? {
            feitas: etapasPor.get(t.id)!.filter((e) => e.feito).length,
            total: etapasPor.get(t.id)!.length,
            atual: etapasPor.get(t.id)!.find((e) => !e.feito)?.nome ?? null,
          }
        : undefined,
      href: link({ tarefa: t.id }),
    };
  });

  const opcoesClientes = (clientes ?? []).filter((c) => c.ativo).map((c) => ({ id: c.id, nome: c.nome }));
  const opcoesTime = (time ?? []).map((p) => ({ id: p.id, nome: p.nome }));
  const [nConteudo, nDemanda] = abertas.map((r) => r.count ?? 0);

  return (
    <>
      <CabecalhoPagina
        sobretitulo="Operação"
        titulo="Tarefas"
        descricao={
          tipo === "demanda"
            ? "Tudo o que a agência precisa fazer além do conteúdo: tráfego, comercial, financeiro, branding, atendimento."
            : "Arraste os cards entre as etapas ou use a seta para avançar. Cada etapa passa o conteúdo para o responsável certo."
        }
        acoes={
          <div className="flex flex-wrap items-center gap-2">
            {gestao && (
              <Link href="/tarefas/processos" className="rounded-lg border border-line bg-card px-3.5 py-2 font-medium hover:border-ink">
                Processos
              </Link>
            )}
            {gestao && (
              <Link href="/tarefas/recorrentes" className="rounded-lg border border-line bg-card px-3.5 py-2 font-medium hover:border-ink">
                ↻ Recorrentes
              </Link>
            )}
            <Link href={link({ nova: "1" })} scroll={false} className="rounded-lg border border-accent bg-accent px-3.5 py-2 font-medium text-accent-ink hover:brightness-110">
              {tipo === "demanda" ? "+ Nova demanda" : "+ Nova pauta"}
            </Link>
          </div>
        }
      />

      <div role="tablist" className="mb-4 inline-flex flex-wrap gap-0.5 rounded-[9px] bg-surface p-[3px]">
        {(
          [
            ["conteudo", `Conteúdos · ${nConteudo}`],
            ["demanda", `Demandas da agência · ${nDemanda}`],
          ] as const
        ).map(([aba, rotulo]) => (
          <Link
            key={aba}
            role="tab"
            aria-selected={tipo === aba}
            href={`/tarefas?aba=${aba}`}
            className={`rounded-[7px] px-3 py-[5px] text-[12.5px] font-medium ${
              tipo === aba ? "bg-card text-ink shadow-[0_1px_3px_rgba(0,0,0,.08)]" : "text-muted hover:text-ink"
            }`}
          >
            {rotulo}
          </Link>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap items-end gap-2.5">
        <Filtros clientes={opcoesClientes} time={opcoesTime} comInterno={tipo === "demanda"} />
        <span className="ml-auto self-center rounded-full border border-dashed border-line px-2.5 py-0.5 text-[11.5px] text-muted">
          {cards.length} {tipo === "demanda" ? "demandas" : "conteúdos"}
        </span>
      </div>

      <Quadro
        key={`${tipo}-${busca.cliente ?? ""}-${busca.resp ?? ""}`}
        tipo={tipo}
        colunas={tipo === "conteudo" ? ETAPAS_CONTEUDO : ETAPAS_DEMANDA}
        cards={cards}
        hoje={hoje}
      />

      {busca.nova && (
        <Gaveta fechar={link({})} rotulo={tipo === "demanda" ? "Nova demanda" : "Nova pauta"}>
          <div className="flex justify-end">
            <Link href={link({})} scroll={false} aria-label="Fechar" className="rounded-lg px-3 py-1.5 hover:bg-surface">
              ✕
            </Link>
          </div>
          <FormNovaTarefa
            tipo={tipo}
            time={opcoesTime}
            clientes={opcoesClientes}
            eu={eu.id}
            clienteFiltro={busca.cliente && busca.cliente !== "interno" ? busca.cliente : undefined}
            processos={processos ?? []}
            hoje={hoje}
          />
        </Gaveta>
      )}

      {busca.tarefa && (
        <DetalheTarefa id={busca.tarefa} fechar={link({})} podeExcluir={gestao} />
      )}
    </>
  );
}
