import Link from "next/link";
import { notFound } from "next/navigation";
import { Avatar, PontoCliente, SeloEtapa } from "@/components/tarefa";
import { dataBR } from "@/lib/datas";
import { area, dataHoraSP, rotuloEtapa } from "@/lib/dominio/tarefas";
import { criarClienteServidor } from "@/lib/supabase/server";
import type { Evento, Nota, Tarefa } from "@/types/banco";
import { Agendamento, Comentarios, Excluir, FormTarefa, Gaveta, NotificarCliente } from "./detalhe";

// Tarefa sem cliente = demanda interna da agência
export const INTERNO = { nome: "O.BRAND (interno)", cor: "#0A0C12", nome_curto: "INTERNO" };

// Painel lateral de uma tarefa, aberto por ?tarefa=id em Tarefas e no Início
export async function DetalheTarefa({ id, fechar, podeExcluir }: { id: string; fechar: string; podeExcluir: boolean }) {
  const supabase = await criarClienteServidor();
  const [{ data: t }, { data: notas }, { data: eventos }, { data: pessoas }, { data: todos }] = await Promise.all([
    supabase.from("tasks").select("*").eq("id", id).maybeSingle<Tarefa>(),
    supabase.from("task_notes").select("*").eq("task_id", id).order("created_at").returns<Nota[]>(),
    supabase.from("task_events").select("*").eq("task_id", id).order("created_at", { ascending: false }).returns<Evento[]>(),
    supabase.from("profiles").select("id, nome, iniciais, perfil, ativo").neq("perfil", "cliente"),
    supabase.from("clients").select("id, nome, cor, ativo").order("nome"),
  ]);
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
        {ajustes > 0 && (
          <span className="text-[12.5px] font-semibold text-bad">
            ↺ {ajustes} ajuste{ajustes > 1 ? "s" : ""} do cliente
          </span>
        )}
        {resp && (
          <span className="ml-auto flex items-center gap-1.5 text-[12.5px] text-muted">
            <Avatar iniciais={resp.iniciais} nome={resp.nome} />
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
          {t.tipo === "conteudo" && t.client_id && (
            <Link
              href={`/criacao?cliente=${t.client_id}&conteudo=${t.id}`}
              className="rounded-lg border border-line px-3.5 py-2 font-medium hover:border-ink"
            >
              Abrir na Criação
            </Link>
          )}
          {podeExcluir && <Excluir tarefa={t} />}
        </div>
      )}
    </Gaveta>
  );
}
