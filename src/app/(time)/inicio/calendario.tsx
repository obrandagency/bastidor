import Link from "next/link";
import { diasDaGrade, DIAS_CURTOS, mesEAno, somarMes } from "@/lib/datas";
import { estaAtrasada, rotuloEtapa, type Etapa } from "@/lib/dominio/tarefas";
import { Avatar } from "@/components/tarefa";
import type { Pessoa, Tarefa } from "@/types/banco";

type Busca = { aba?: string; mes?: string; pessoa?: string; tarefa?: string };

export type Ctx = {
  hoje: string;
  link: (mudar: Partial<Busca>) => string;
  clienteDe: (id: string | null) => { nome: string; nome_curto: string; cor: string };
  pessoaPor: Map<string, Pessoa>;
};

// Cor da etiqueta no calendário (.chip.k-* do protótipo)
function corDaEtiqueta(e: Etapa) {
  if (e === "cliente") return "bg-warn-soft";
  if (e === "ajuste") return "bg-bad-soft";
  if (e === "aprovado" || e === "concluido") return "bg-ok-soft";
  if (e === "agendado") return "bg-accent-soft";
  return "bg-surface";
}

// Grade do mês (sem consultas: recebe as tarefas já filtradas pelo mês)
export type EtapaCalendario = {
  id: string;
  taskId: string;
  nome: string;
  titulo: string;
  clienteId: string | null;
  dia: string;
  responsavel_id: string | null;
  feito: boolean;
};

export type FollowUp = { id: string; empresa: string; texto: string | null; dia: string; responsavel_id: string | null };

export function VistaCalendario({
  mes,
  pessoa,
  time,
  todas,
  diaDe,
  hoje,
  link,
  clienteDe,
  pessoaPor,
  followups = [],
  etapas = [],
}: Ctx & {
  mes: string;
  pessoa?: string;
  time: Pessoa[];
  todas: Tarefa[];
  diaDe: (t: Tarefa) => string | null;
  followups?: FollowUp[];
  etapas?: EtapaCalendario[];
}) {
  const minhasEtapas = pessoa ? etapas.filter((e) => e.responsavel_id === pessoa) : etapas;
  const meusFollowups = pessoa ? followups.filter((f) => f.responsavel_id === pessoa) : followups;
  const doMes = pessoa ? todas.filter((t) => t.responsavel_id === pessoa) : todas;
  const atrasadas = doMes.filter((t) => estaAtrasada(t, hoje)).length;
  const porDia = new Map<string, Tarefa[]>();
  doMes.forEach((t) => porDia.set(diaDe(t)!, [...(porDia.get(diaDe(t)!) ?? []), t]));
  const nomePessoa = pessoa ? pessoaPor.get(pessoa)?.nome : null;

  const botaoPessoa = "inline-flex items-center gap-[7px] rounded-full border px-3 py-1 text-[12.5px]";
  return (
    <>
      <div className="mb-3.5 flex flex-wrap gap-2">
        <Link
          href={link({ pessoa: undefined })}
          className={`${botaoPessoa} ${!pessoa ? "border-accent bg-accent-soft font-semibold" : "border-line bg-card hover:border-muted"}`}
        >
          Todo o time · {todas.length}
        </Link>
        {time.map((p) => (
          <Link
            key={p.id}
            href={link({ pessoa: p.id })}
            className={`${botaoPessoa} !pl-1 ${pessoa === p.id ? "border-accent bg-accent-soft font-semibold" : "border-line bg-card hover:border-muted"}`}
          >
            <Avatar iniciais={p.iniciais} foto={p.foto} classe="h-[22px] w-[22px] text-[9px]" />
            {p.nome.split(" ")[0]} · {todas.filter((t) => t.responsavel_id === p.id).length}
          </Link>
        ))}
      </div>

      <section className="rounded-xl border border-line bg-card">
        <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-line px-4 py-3.5">
          <div>
            <h2 className="text-[15px] font-bold capitalize">{mesEAno(mes)}</h2>
            <div className="mt-0.5 text-[12.5px] text-muted">
              {doMes.length} demanda{doMes.length === 1 ? "" : "s"}
              {nomePessoa ? ` com ${nomePessoa}` : ""}
              {atrasadas > 0 && (
                <span className="font-semibold text-bad">
                  {" "}
                  · {atrasadas} atrasada{atrasadas > 1 ? "s" : ""}
                </span>
              )}
            </div>
          </div>
          <div className="flex gap-1.5">
            {[
              ["‹", "Mês anterior", somarMes(mes, -1)],
              ["Hoje", "Mês atual", undefined],
              ["›", "Próximo mês", somarMes(mes, 1)],
            ].map(([rotulo, aria, alvo]) => (
              <Link
                key={aria}
                href={link({ mes: alvo })}
                aria-label={aria}
                className="rounded-lg border border-line bg-card px-2.5 py-[5px] text-[12.5px] font-medium hover:border-ink"
              >
                {rotulo}
              </Link>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <div className="grid min-w-[660px] grid-cols-[repeat(7,minmax(90px,1fr))] border-l border-t border-line">
            {DIAS_CURTOS.map((d) => (
              <div key={d} className="border-b border-r border-line bg-surface p-2 text-[11px] uppercase tracking-[0.08em] text-muted">
                {d}
              </div>
            ))}
            {diasDaGrade(mes).map((dia) => {
              const itens = porDia.get(dia) ?? [];
              const doDia = meusFollowups.filter((f) => f.dia === dia);
              const etapasDoDia = minhasEtapas.filter((e) => e.dia === dia);
              return (
                <div
                  key={dia}
                  className={`flex min-h-[118px] min-w-0 flex-col gap-1 border-b border-r border-line p-1.5 ${dia.startsWith(mes) ? "" : "bg-surface"}`}
                >
                  <span
                    className={`font-mono text-[11.5px] ${dia === hoje ? "w-6 rounded-full bg-accent text-center text-accent-ink" : "text-muted"}`}
                  >
                    {Number(dia.slice(8))}
                  </span>
                  {doDia.map((f) => {
                    const r = f.responsavel_id ? pessoaPor.get(f.responsavel_id) : null;
                    return (
                      <Link
                        key={f.id}
                        href={`/crm?lead=${f.id}`}
                        title={`CRM · ${f.empresa}${f.texto ? ` · ${f.texto}` : ""}${r ? ` · com ${r.nome}` : ""}`}
                        className={`flex w-full min-w-0 items-center gap-[5px] rounded-md bg-card px-1.5 py-[3px] text-[11px] font-medium text-accent shadow-[inset_0_0_0_1px_var(--color-accent)] hover:brightness-[.96] ${
                          dia < hoje ? "shadow-[inset_3px_0_0_var(--color-bad),inset_0_0_0_1px_var(--color-accent)]" : ""
                        }`}
                      >
                        {r && (
                          <span className="grid h-[18px] w-[18px] flex-none place-items-center rounded-full bg-ink text-[8px] font-semibold text-bg">
                            {r.iniciais}
                          </span>
                        )}
                        <span className="min-w-0 truncate">CRM · {f.empresa}</span>
                      </Link>
                    );
                  })}
                  {etapasDoDia.map((e) => {
                    const r = e.responsavel_id ? pessoaPor.get(e.responsavel_id) : null;
                    const c = clienteDe(e.clienteId);
                    return (
                      <Link
                        key={e.id}
                        href={link({ tarefa: e.taskId })}
                        scroll={false}
                        title={`Etapa ${e.nome} · ${c.nome} · ${e.titulo}${r ? ` · com ${r.nome}` : ""}${e.feito ? " · feita" : ""}`}
                        className={`flex w-full min-w-0 items-center gap-[5px] rounded-md border border-dashed px-1.5 py-[2px] text-[11px] hover:brightness-[.96] ${
                          e.feito ? "border-ok/40 bg-ok-soft text-muted line-through" : "border-line bg-card"
                        } ${!e.feito && dia < hoje ? "shadow-[inset_3px_0_0_var(--color-bad)]" : ""}`}
                      >
                        {r && <Avatar iniciais={r.iniciais} foto={r.foto} classe="h-[18px] w-[18px] text-[8px]" />}
                        <span className="min-w-0 truncate">
                          ↳ {e.nome} · {e.titulo}
                        </span>
                      </Link>
                    );
                  })}
                  {itens.map((t) => {
                    const c = clienteDe(t.client_id);
                    const r = t.responsavel_id ? pessoaPor.get(t.responsavel_id) : null;
                    return (
                      <Link
                        key={t.id}
                        href={link({ tarefa: t.id })}
                        scroll={false}
                        title={`${c.nome} · ${t.titulo} · ${rotuloEtapa(t.etapa)}${r ? ` · com ${r.nome}` : ""}`}
                        className={`flex w-full min-w-0 items-center gap-[5px] rounded-md px-1.5 py-[3px] text-[11px] hover:brightness-[.96] ${corDaEtiqueta(t.etapa)} ${
                          estaAtrasada(t, hoje) ? "shadow-[inset_3px_0_0_var(--color-bad)]" : ""
                        }`}
                      >
                        {r && (
                          <span className="grid h-[18px] w-[18px] flex-none place-items-center rounded-full bg-ink text-[8px] font-semibold text-bg">
                            {r.iniciais}
                          </span>
                        )}
                        <span className="min-w-0 truncate">
                          {c.nome_curto} · {t.titulo}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap gap-3.5 border-t border-line px-4 py-3 text-[12px] text-muted">
          {[
            ["bg-surface border border-line", "Em produção"],
            ["bg-warn-soft", "Com o cliente"],
            ["bg-bad-soft", "Ajuste"],
            ["bg-ok-soft", "Aprovado ou concluído"],
            ["bg-accent-soft", "Agendado"],
            ["bg-bad", "Atrasado"],
            ...(followups.length ? [["bg-card shadow-[inset_0_0_0_1px_var(--color-accent)]", "Follow-up do CRM"]] : []),
            ...(etapas.length ? [["bg-card border border-dashed border-muted", "Etapa de processo"]] : []),
          ].map(([cor, rotulo]) => (
            <span key={rotulo} className="inline-flex items-center gap-1.5">
              <i className={`inline-block h-3 w-3 rounded-[3px] ${cor}`} />
              {rotulo}
            </span>
          ))}
          <span>As iniciais mostram quem está com a demanda</span>
        </div>
      </section>
    </>
  );
}

