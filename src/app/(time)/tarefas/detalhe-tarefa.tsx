import Link from "next/link";
import { notFound } from "next/navigation";
import { Avatar, PontoCliente, SeloEtapa } from "@/components/tarefa";
import { dataBR, hojeSP } from "@/lib/datas";
import { area, dataHoraSP, rotuloEtapa } from "@/lib/dominio/tarefas";
import { criarClienteServidor } from "@/lib/supabase/server";
import type { Evento, Nota, Tarefa } from "@/types/banco";
import { criarRoteiroDoConteudo } from "../roteiros/acoes";
import { EtapasTarefa, UsarProcesso } from "./etapas";
import { Agendamento, Comentarios, Excluir, FormTarefa, Gaveta, NotificarCliente } from "./detalhe";

// Tarefa sem cliente = demanda interna da agência
export const INTERNO = { nome: "Interno da agência", cor: "#0A0C12", nome_curto: "INTERNO" };

// Painel lateral de uma tarefa, aberto por ?tarefa=id em Tarefas e no Início
export async function DetalheTarefa({ id, fechar, podeExcluir }: { id: string; fechar: string; podeExcluir: boolean }) {
  const supabase = await criarClienteServidor();
  const [{ data: t }, { data: notas }, { data: eventos }, { data: pessoas }, { data: todos }, { data: etapas }, { data: processos }] = await Promise.all([
    supabase.from("tasks").select("*").eq("id", id).maybeSingle<Tarefa>(),
    supabase.from("task_notes").select("*").eq("task_id", id).order("created_at").returns<Nota[]>(),
    supabase.from("task_events").select("*").eq("task_id", id).order("created_at", { ascending: false }).returns<Evento[]>(),
    supabase.from("profiles").select("id, nome, iniciais, perfil, ativo, foto").neq("perfil", "cliente"),
    supabase.from("clients").select("id, nome, cor, ativo").order("nome"),
    supabase.from("tarefa_etapas").select("id, nome, responsavel_id, prazo, feito_em, feito_por").eq("task_id", id).order("ordem").order("created_at"),
    supabase.from("processos").select("id, nome").eq("ativo", true).order("nome"),
  ]);
  const { data: roteiros } = await supabase.from("roteiros").select("id, titulo").eq("task_id", id).order("created_at");
  if (!t) notFound();
  const c = (t.client_id && (todos ?? []).find((x) => x.id === t.client_id)) || INTERNO;
  const ajustes = (eventos ?? []).filter((e) => e.origem === "cliente" && e.para_etapa === "ajuste").length;
  const opcoesTime = (pessoas ?? []).filter((p) => p.ativo).map((p) => ({ id: p.id, nome: p.nome }));
  const opcoesClientes = (todos ?? []).filter((x) => x.ativo).map((x) => ({ id: x.id, nome: x.nome }));
  const autores = Object.fromEntries((pessoas ?? []).map((p) => [p.id, p.nome]));
  const resp = (pessoas ?? []).find((p) => p.id === t.responsavel_id);
  // Cliente inativo continua aparecendo na tarefa antiga
  const clientes = t.client_id && !opcoesClientes.some((o) => o.id === t.client_id) ? [{ id: t.client_id, nome: c.nome }, ...opcoesClientes] : opcoesClientes;
  const agenda = dataHoraSP(t.publicar_em);

  return (
    <Gaveta fechar={fechar} rotulo={t.tipo === "demanda" ? "Demanda" : "Conteúdo"}>
      <div className="flex flex-wrap items-center gap-2">
        <PontoCliente cor={c.cor} />
        <SeloEtapa etapa={t.etapa} />
        {t.tipo === "demanda" && <span className="text-[11px] font-semibold tracking-[0.03em] text-accent">{area(t.area)?.rotulo}</span>}
        <span className="text-[12.5px] text-muted">{c.nome}</span>
        {t.recorrencia_id && (
          <span className="text-[12.5px] text-muted" title="Criada por uma tarefa recorrente">
            ↻ recorrente
          </span>
        )}
        {ajustes > 0 && (
          <span className="text-[12.5px] font-semibold text-bad">
            ↺ {ajustes} ajuste{ajustes > 1 ? "s" : ""} do cliente
          </span>
        )}
        {resp && (
          <span className="ml-auto flex items-center gap-1.5 text-[12.5px] text-muted">
            <Avatar iniciais={resp.iniciais} nome={resp.nome} foto={resp.foto} />
            {resp.nome}
          </span>
        )}
        <Link href={fechar} scroll={false} aria-label="Fechar" className={`${resp ? "" : "ml-auto"} rounded-lg px-3 py-1.5 hover:bg-surface`}>
          ✕
        </Link>
      </div>

      {t.tipo === "conteudo" && t.etapa === "cliente" && <NotificarCliente tarefa={t} />}

      {t.tipo === "conteudo" && (t.etapa === "aprovado" || t.etapa === "agendado") && (
        <Agendamento key={t.updated_at} tarefa={t} data={agenda.data} hora={agenda.hora} />
      )}

      <FormTarefa key={t.updated_at} tarefa={t} time={opcoesTime} clientes={clientes} />

      {t.tipo === "demanda" &&
        (etapas?.length ? (
          <EtapasTarefa
            taskId={t.id}
            hoje={hojeSP()}
            time={(pessoas ?? []).filter((p) => p.ativo).map((p) => ({ id: p.id, nome: p.nome, iniciais: p.iniciais, foto: p.foto }))}
            etapas={etapas.map((e) => ({
              id: e.id,
              nome: e.nome,
              responsavel_id: e.responsavel_id,
              prazo: e.prazo,
              feito: !!e.feito_em,
              feitoPor: e.feito_por ? (autores[e.feito_por] ?? null) : null,
            }))}
          />
        ) : (
          <UsarProcesso taskId={t.id} processos={processos ?? []} hoje={hojeSP()} />
        ))}

      <Comentarios taskId={t.id} notas={notas ?? []} autores={autores} />

      <div>
        <div className="mb-2 text-[11.5px] uppercase tracking-[0.04em] text-muted">Histórico</div>
        <ol className="flex flex-col gap-1.5 text-[12.5px]">
          {(eventos ?? []).map((e) => {
            const { data, hora } = dataHoraSP(e.created_at);
            return (
              <li key={e.id} className="flex gap-2">
                <span className="w-[86px] flex-none font-mono text-muted">
                  {dataBR(data).slice(0, 5)} {hora}
                </span>
                <span>
                  {e.de_etapa ? `${rotuloEtapa(e.de_etapa)} → ${rotuloEtapa(e.para_etapa)}` : `Criada em ${rotuloEtapa(e.para_etapa)}`}
                  <span className="text-muted">
                    {" · "}
                    {e.ator_nome ?? "sistema"}
                    {e.origem === "cliente" ? " (cliente)" : ""}
                  </span>
                </span>
              </li>
            );
          })}
        </ol>
      </div>

      {(t.tipo === "conteudo" || podeExcluir) && (
        <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-line pt-3">
          {t.tipo === "conteudo" &&
            (roteiros ?? []).map((r) => (
              <Link key={r.id} href={`/roteiros/${r.id}`} className="rounded-lg border border-line px-3.5 py-2 font-medium hover:border-ink">
                Roteiro{(roteiros ?? []).length > 1 ? `: ${r.titulo}` : ""}
              </Link>
            ))}
          {t.tipo === "conteudo" && !roteiros?.length && (t.formato === "reels" || t.formato === "stories") && (
            <form action={criarRoteiroDoConteudo}>
              <input type="hidden" name="task_id" value={t.id} />
              <input type="hidden" name="titulo" value={t.titulo} />
              <input type="hidden" name="client_id" value={t.client_id ?? "interno"} />
              <input type="hidden" name="formato" value={t.formato} />
              <button className="rounded-lg border border-line px-3.5 py-2 font-medium hover:border-ink">Criar roteiro</button>
            </form>
          )}
          {t.tipo === "conteudo" && t.client_id && (
            <Link
              href={`/criacao?cliente=${t.client_id}&conteudo=${t.id}`}
              className="rounded-lg border border-line px-3.5 py-2 font-medium hover:border-ink"
            >
              Abrir na Criação
            </Link>
          )}
          {podeExcluir && (
            <Link
              href={t.recorrencia_id ? `/tarefas/recorrentes?editar=${t.recorrencia_id}` : `/tarefas/recorrentes?de=${t.id}`}
              className="rounded-lg border border-line px-3.5 py-2 font-medium hover:border-ink"
            >
              {t.recorrencia_id ? "↻ Ver repetição" : "↻ Repetir esta tarefa"}
            </Link>
          )}
          {podeExcluir && <Excluir tarefa={t} />}
        </div>
      )}
    </Gaveta>
  );
}
