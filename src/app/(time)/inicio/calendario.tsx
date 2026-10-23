"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Avatar, LogoCliente, SeloEtapa } from "@/components/tarefa";
import { Icone } from "@/components/icone";
import type { Etapa } from "@/lib/dominio/tarefas";
import { marcarEtapa } from "../tarefas/acoes-etapas";
import { moverTarefa } from "../tarefas/acoes";

// Calendário do mês dividido em semanas (segunda a domingo). Cada semana abre numa linha por pessoa,
// com os cards do dia em cada coluna. Sem consultas: o page.tsx entrega tudo pronto.

export type ItemCalendario = {
  chave: string;
  tipo: "tarefa" | "etapa" | "crm";
  id: string;
  dia: string;
  pessoaId: string | null;
  cliente: { nome: string; cor: string; logo: string | null };
  titulo: string;
  sub?: string;
  etapa?: Etapa; // tarefa: para o selo de status
  feito: boolean;
  atrasado: boolean;
  recorrente?: boolean;
  // Caixinha: "concluir" (demanda), "avancar" (conteúdo, com o nome da próxima etapa), "etapa" (processo)
  marcar?: { tipo: "concluir" | "reabrir" | "avancar" | "etapa"; para?: Etapa; rotulo: string };
  href: string;
};

export type PessoaCalendario = { id: string; nome: string; cargo: string; iniciais: string; foto: string | null };
export type DiaCalendario = { iso: string; diaSemana: string; data: string; doMes: boolean; hoje: boolean };

function Card({ item }: { item: ItemCalendario }) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();

  function marcar() {
    const m = item.marcar;
    if (!m) return;
    iniciar(async () => {
      const r =
        m.tipo === "etapa"
          ? await marcarEtapa(item.id, !item.feito)
          : await moverTarefa(item.id, m.para as Etapa);
      if (r?.erro) alert(r.erro);
      router.refresh();
    });
  }

  return (
    <div className={`rounded-xl border border-line bg-card p-2.5 transition-opacity ${item.feito ? "opacity-55" : ""} ${pendente ? "animate-pulse" : ""}`}>
      <div className="flex min-w-0 items-center gap-1.5">
        <LogoCliente nome={item.cliente.nome} cor={item.cliente.cor} logo={item.cliente.logo} classe="h-5 w-5 text-[9px]" />
        <span className={`min-w-0 flex-1 truncate text-[12px] ${item.feito ? "text-muted line-through" : ""}`}>{item.cliente.nome}</span>
        {item.atrasado && (
          <span title="Atrasada" className="grid h-5 w-5 flex-none place-items-center rounded-md bg-bad-soft text-bad">
            <Icone nome="relogio" className="!h-3 !w-3" />
          </span>
        )}
        {item.recorrente && (
          <span title="Tarefa recorrente" className="flex-none text-[11px] text-muted">
            ↻
          </span>
        )}
      </div>
      <div className="mt-1.5 flex items-start gap-2">
        {item.marcar ? (
          <button
            type="button"
            onClick={marcar}
            disabled={pendente}
            title={item.marcar.rotulo}
            aria-label={`${item.marcar.rotulo}: ${item.titulo}`}
            className={`mt-[1px] grid h-[18px] w-[18px] flex-none place-items-center rounded-[5px] border text-[11px] ${
              item.feito ? "border-accent bg-accent text-accent-ink" : "border-line bg-surface text-transparent hover:border-accent hover:text-accent"
            }`}
          >
            {item.marcar.tipo === "avancar" ? "›" : "✓"}
          </button>
        ) : (
          item.tipo === "crm" && (
            <span className="mt-[1px] grid h-[18px] w-[18px] flex-none place-items-center rounded-[5px] bg-accent-soft text-accent" title="Follow-up do CRM">
              <Icone nome="funil" className="!h-3 !w-3" />
            </span>
          )
        )}
        <Link href={item.href} scroll={false} className={`min-w-0 flex-1 text-[13px] font-medium leading-[1.35] [overflow-wrap:anywhere] hover:text-accent ${item.feito ? "text-muted line-through" : ""}`}>
          {item.titulo}
          {item.sub && <small className="block text-[11.5px] font-normal text-muted no-underline">{item.sub}</small>}
        </Link>
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        {item.etapa && <SeloEtapa etapa={item.etapa} />}
        {item.tipo === "etapa" && <span className="inline-flex rounded-full bg-andamento-soft px-[9px] py-px text-[11.5px] font-medium text-andamento">Etapa de processo</span>}
        {item.tipo === "crm" && <span className="inline-flex rounded-full bg-accent-soft px-[9px] py-px text-[11.5px] font-medium text-accent">CRM</span>}
      </div>
    </div>
  );
}

// "+" do dia: nova pauta ou nova demanda com esse prazo
function NovoNoDia({ dia }: { dia: DiaCalendario }) {
  const [aberto, setAberto] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => !caixa.current?.contains(e.target as Node) && setAberto(false);
    document.addEventListener("mousedown", fora);
    return () => document.removeEventListener("mousedown", fora);
  }, [aberto]);
  return (
    <div ref={caixa} className="relative flex-none">
      <button
        type="button"
        onClick={() => setAberto((a) => !a)}
        aria-label={`Nova tarefa em ${dia.data}`}
        title="Nova tarefa neste dia"
        className="grid h-7 w-7 place-items-center rounded-full bg-surface text-[17px] leading-none text-muted hover:bg-accent-soft hover:text-accent"
      >
        +
      </button>
      {aberto && (
        <div className="absolute right-0 top-8 z-20 flex w-[150px] flex-col overflow-hidden rounded-lg border border-line bg-card text-[13px] shadow-pop">
          <Link href={`/tarefas?aba=conteudo&nova=1&prazo=${dia.iso}`} className="px-3 py-2 hover:bg-surface">
            Nova pauta
          </Link>
          <Link href={`/tarefas?aba=demanda&nova=1&prazo=${dia.iso}`} className="border-t border-line px-3 py-2 hover:bg-surface">
            Nova demanda
          </Link>
        </div>
      )}
    </div>
  );
}

const GRADE = "grid grid-cols-[128px_repeat(7,minmax(152px,1fr))] md:grid-cols-[180px_repeat(7,minmax(152px,1fr))]";

export function CalendarioSemanas({
  semanas,
  itens,
  pessoas,
  abertaInicial,
}: {
  semanas: DiaCalendario[][];
  itens: ItemCalendario[];
  pessoas: PessoaCalendario[];
  abertaInicial: number;
}) {
  const [abertas, setAbertas] = useState<number[]>([abertaInicial]);
  const alternar = (i: number) => setAbertas((a) => (a.includes(i) ? a.filter((x) => x !== i) : [...a, i]));
  const semDono: PessoaCalendario = { id: "", nome: "Sem responsável", cargo: "", iniciais: "?", foto: null };

  return (
    <div className="flex flex-col gap-3">
      {semanas.map((dias, i) => {
        const daSemana = itens.filter((it) => dias.some((d) => d.iso === it.dia));
        const aberta = abertas.includes(i);
        // Só as pessoas com algo nesta semana (e "Sem responsável" se houver)
        const linhas = [...pessoas, semDono].filter((p) => daSemana.some((it) => (it.pessoaId ?? "") === p.id));
        return (
          <section key={dias[0].iso} className="overflow-x-auto rounded-xl border border-line bg-card">
            <div className="min-w-[1192px] md:min-w-[1244px]">
              <div className={`${GRADE} items-center`}>
                <button
                  type="button"
                  onClick={() => alternar(i)}
                  aria-expanded={aberta}
                  className="sticky left-0 z-10 flex h-full items-center gap-3 bg-card px-4 py-3.5 text-left hover:text-accent"
                >
                  <span className={`text-muted transition-transform ${aberta ? "rotate-180" : ""}`} aria-hidden="true">
                    ⌄
                  </span>
                  <span>
                    <b className="block text-[15px] font-semibold">Semana {String(i + 1).padStart(2, "0")}</b>
                    <small className="text-[12px] text-muted">
                      {dias[0].data.split(" de ")[0]}/{dias[0].iso.slice(5, 7)} a {dias[6].data.split(" de ")[0]}/{dias[6].iso.slice(5, 7)}
                    </small>
                  </span>
                </button>
                {dias.map((d) => {
                  const n = daSemana.filter((it) => it.dia === d.iso).length;
                  return (
                    <div key={d.iso} className={`flex items-start justify-between gap-2 px-3 py-3 ${d.doMes ? "" : "opacity-50"}`}>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className={`whitespace-nowrap text-[14px] font-semibold ${d.hoje ? "text-accent" : ""}`}>{d.diaSemana}</span>
                          {n > 0 && <span className="rounded bg-surface px-1.5 font-mono text-[11px] text-muted">{n}</span>}
                        </div>
                        <div className={`whitespace-nowrap text-[12.5px] ${d.hoje ? "font-medium text-accent" : "text-muted"}`}>
                          {d.data}
                          {d.hoje && <span className="ml-1.5 rounded-full bg-accent px-1.5 py-px text-[10.5px] text-accent-ink">hoje</span>}
                        </div>
                      </div>
                      <NovoNoDia dia={d} />
                    </div>
                  );
                })}
              </div>

              {aberta &&
                (linhas.length === 0 ? (
                  <div className="border-t border-line px-4 py-6 text-center text-[13px] text-muted">Nenhuma tarefa nesta semana.</div>
                ) : (
                  linhas.map((p) => (
                    <div key={p.id || "sem"} className={`${GRADE} border-t border-line`}>
                      <div className="sticky left-0 z-10 flex items-center gap-3 bg-card px-4 py-3">
                        <span className="hidden md:block">{p.id ? <Avatar iniciais={p.iniciais} nome={p.nome} foto={p.foto} grande /> : <span className="grid h-11 w-11 flex-none place-items-center rounded-full border border-dashed border-line text-muted">?</span>}</span>
                        <div className="min-w-0">
                          <div className="truncate font-medium">{p.nome}</div>
                          {p.cargo && <div className="truncate text-[12px] text-muted">{p.cargo}</div>}
                        </div>
                      </div>
                      {dias.map((d) => {
                        const doDia = daSemana.filter((it) => it.dia === d.iso && (it.pessoaId ?? "") === p.id);
                        return (
                          <div key={d.iso} className={`flex flex-col gap-2 bg-surface p-2 ${d.hoje ? "bg-accent-soft/60" : ""}`}>
                            {doDia.map((it) => (
                              <Card key={it.chave} item={it} />
                            ))}
                            {doDia.length === 0 && <div className="rounded-xl border border-dashed border-line px-2 py-3 text-center text-[12px] text-muted/70">Nenhuma tarefa</div>}
                          </div>
                        );
                      })}
                    </div>
                  ))
                ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
