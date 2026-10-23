import Link from "next/link";
import { CabecalhoPagina, EstadoVazio } from "@/components/cabecalho-pagina";
import { PontoCliente } from "@/components/tarefa";
import { dataBR, hojeSP } from "@/lib/datas";
import { descreverRegra, type Recorrencia } from "@/lib/dominio/recorrentes";
import { area, rotuloFormato } from "@/lib/dominio/tarefas";
import { exigirTime } from "@/lib/sessao";
import { criarClienteServidor } from "@/lib/supabase/server";
import type { Tarefa } from "@/types/banco";
import { Gaveta } from "../detalhe";
import { INTERNO } from "../detalhe-tarefa";
import { AcoesRecorrencia, FormRecorrencia } from "./formulario";

export const metadata = { title: "Tarefas recorrentes" };

type Busca = { nova?: string; editar?: string; de?: string };

export default async function Recorrentes({ searchParams }: { searchParams: Promise<Busca> }) {
  await exigirTime(["socio", "adm"]);
  const busca = await searchParams;
  const hoje = hojeSP();
  const supabase = await criarClienteServidor();

  const [{ data: modelos }, { data: proximas }, { data: geradas }, { data: clientes }, { data: time }, { data: processos }] = await Promise.all([
    supabase.from("recorrencias").select("*").order("ativa", { ascending: false }).order("titulo").returns<Recorrencia[]>(),
    supabase.rpc("proximas_recorrencias"),
    supabase.from("recorrencia_geradas").select("recorrencia_id"),
    supabase.from("clients").select("id, nome, cor, ativo").order("nome"),
    supabase.from("profiles").select("id, nome").neq("perfil", "cliente").eq("ativo", true).order("nome"),
    supabase.from("processos").select("id, nome").eq("ativo", true).order("nome"),
  ]);
  const nomeProcesso = new Map((processos ?? []).map((p) => [p.id, p.nome]));
  const proxima = new Map(((proximas ?? []) as { id: string; prazo: string; aparece_em: string }[]).map((p) => [p.id, p]));
  const criadas = new Map<string, number>();
  (geradas ?? []).forEach((g) => criadas.set(g.recorrencia_id, (criadas.get(g.recorrencia_id) ?? 0) + 1));
  const clientePor = new Map((clientes ?? []).map((c) => [c.id, c]));
  const nomeDe = new Map((time ?? []).map((p) => [p.id, p.nome]));
  const opcoesClientes = (clientes ?? []).filter((c) => c.ativo).map((c) => ({ id: c.id, nome: c.nome }));

  // Formulário: novo, editar um modelo ou "Repetir esta tarefa" (?de=id da tarefa)
  let inicial: Partial<Recorrencia> | null = null;
  if (busca.editar) inicial = (modelos ?? []).find((m) => m.id === busca.editar) ?? null;
  else if (busca.de) {
    const { data: t } = await supabase.from("tasks").select("*").eq("id", busca.de).maybeSingle<Tarefa>();
    if (t) {
      const dia = t.prazo ? Number(t.prazo.slice(8, 10)) : 5;
      inicial = {
        tipo: t.tipo,
        client_id: t.client_id,
        titulo: t.titulo,
        formato: t.formato,
        area: t.area,
        responsavel_id: t.tipo === "demanda" ? t.responsavel_id : null,
        texto: t.texto,
        frequencia: "mensal",
        dia_mes: Math.min(dia, 28),
        processo_id: t.processo_id,
      };
    }
  } else if (busca.nova) inicial = {};

  return (
    <>
      <CabecalhoPagina
        sobretitulo="Tarefas"
        titulo="Tarefas recorrentes"
        descricao="Tarefas que se repetem nascem sozinhas no quadro, todo dia às 6h, alguns dias antes do prazo."
        acoes={
          <div className="flex items-center gap-3">
            <Link href="/tarefas?aba=demanda" className="text-[13px] text-muted hover:text-ink">
              ← Voltar ao quadro
            </Link>
            <Link href="/tarefas/recorrentes?nova=1" scroll={false} className="rounded-lg border border-accent bg-accent px-3.5 py-2 font-medium text-accent-ink hover:border-accent-hover hover:bg-accent-hover">
              + Nova recorrente
            </Link>
          </div>
        }
      />

      {!modelos?.length ? (
        <EstadoVazio icone="calendario" acao={{ href: "/tarefas/recorrentes?nova=1", rotulo: "+ Nova recorrente" }}>
          Nenhuma tarefa recorrente ainda. Ex.: relatório mensal, fechamento financeiro, reunião de pauta.
        </EstadoVazio>
      ) : (
      <section className="rounded-xl border border-line bg-card">
        {(modelos ?? []).map((m) => {
          const c = (m.client_id && clientePor.get(m.client_id)) || INTERNO;
          const p = proxima.get(m.id);
          return (
            <div key={m.id} className={`flex flex-col gap-2 border-t border-line px-4 py-3 first:border-t-0 md:flex-row md:items-center ${m.ativa ? "" : "opacity-60"}`}>
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-1.5 text-[11.5px] text-muted">
                  <PontoCliente cor={c.cor} />
                  <span className="truncate">
                    {c.nome} · {m.tipo === "conteudo" ? rotuloFormato(m.formato) : area(m.area)?.rotulo}
                    {m.responsavel_id && nomeDe.get(m.responsavel_id) ? ` · ${nomeDe.get(m.responsavel_id)}` : ""}
                  </span>
                </div>
                <Link href={`/tarefas/recorrentes?editar=${m.id}`} scroll={false} className="font-semibold [overflow-wrap:anywhere] hover:text-accent">
                  ↻ {m.titulo}
                </Link>
                <div className="text-[12.5px] text-muted">
                  {descreverRegra(m)} · aparece {m.antecedencia === 0 ? "no próprio dia" : `${m.antecedencia} dia${m.antecedencia > 1 ? "s" : ""} antes`}
                  {m.fim ? ` · até ${dataBR(m.fim)}` : ""}
                  {m.processo_id ? ` · processo ${nomeProcesso.get(m.processo_id) ?? "arquivado"}` : ""}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px]">
                {!m.ativa ? (
                  <span className="rounded-full bg-surface px-2 text-[11.5px] text-muted">Pausada</span>
                ) : p ? (
                  <span className="text-muted">
                    Próximo prazo <b className="font-mono font-medium text-ink">{dataBR(p.prazo).slice(0, 5)}</b>
                    {p.aparece_em > hoje ? `, aparece ${dataBR(p.aparece_em).slice(0, 5)}` : ""}
                  </span>
                ) : (
                  <span className="text-muted">Sem próximas datas</span>
                )}
                <span className="font-mono text-[11.5px] text-muted">{criadas.get(m.id) ?? 0} criadas</span>
                <AcoesRecorrencia id={m.id} ativa={m.ativa} />
              </div>
            </div>
          );
        })}
      </section>
      )}

      {inicial && (
        <Gaveta fechar="/tarefas/recorrentes" rotulo="Tarefa recorrente">
          <div className="flex justify-end">
            <Link href="/tarefas/recorrentes" scroll={false} aria-label="Fechar" className="rounded-lg px-3 py-1.5 hover:bg-surface">
              ✕
            </Link>
          </div>
          <FormRecorrencia
            inicial={inicial}
            hoje={hoje}
            processos={processos ?? []}
            time={(time ?? []).map((p) => ({ id: p.id, nome: p.nome }))}
            clientes={
              inicial.client_id && !opcoesClientes.some((o) => o.id === inicial.client_id)
                ? [{ id: inicial.client_id, nome: clientePor.get(inicial.client_id)?.nome ?? "Cliente" }, ...opcoesClientes]
                : opcoesClientes
            }
          />
        </Gaveta>
      )}
    </>
  );
}
