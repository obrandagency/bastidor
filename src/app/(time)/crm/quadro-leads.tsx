"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { Botao, classeEntrada } from "@/components/formulario";
import { Avatar } from "@/components/tarefa";
import { ETAPAS_LEAD, leadAberto, proximaEtapaLead, reais, rotuloEtapaLead, type EtapaLead } from "@/lib/dominio/crm";
import { moverLead } from "./acoes";

export type CardLead = {
  id: string;
  empresa: string;
  etapa: EtapaLead;
  segmento: string | null;
  contato: string | null;
  cidade: string | null;
  valor: number;
  origem: string;
  proximo: { texto: string; quando: string; atrasado: boolean; hoje: boolean } | null;
  motivo: string | null;
  resp: { iniciais: string; nome: string } | null;
  href: string;
};

export function QuadroLeads({ cards }: { cards: CardLead[] }) {
  const [pendentes, setPendentes] = useState<Record<string, EtapaLead>>({});
  const [arrastando, setArrastando] = useState<CardLead | null>(null);
  const [sobre, setSobre] = useState<EtapaLead | null>(null);
  const [perdendo, setPerdendo] = useState<CardLead | null>(null);
  const [motivo, setMotivo] = useState("");
  const [aviso, setAviso] = useState<{ texto: string; erro: boolean } | null>(null);
  const [, iniciar] = useTransition();

  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setAviso(null), aviso.erro ? 5000 : 2600);
    return () => clearTimeout(t);
  }, [aviso]);

  const etapaDe = (c: CardLead) => pendentes[c.id] ?? c.etapa;

  function mover(c: CardLead, para: EtapaLead, motivoPerda?: string) {
    if (etapaDe(c) === para) return;
    if (para === "perdido" && !motivoPerda) {
      setPerdendo(c);
      setMotivo("");
      return;
    }
    setPendentes((p) => ({ ...p, [c.id]: para }));
    iniciar(async () => {
      const r = await moverLead(c.id, para, motivoPerda);
      setPendentes((p) => {
        const resto = { ...p };
        delete resto[c.id];
        return resto;
      });
      setAviso(
        r?.erro
          ? { texto: r.erro, erro: true }
          : { texto: para === "ganho" ? `${c.empresa} fechou! Abra a ficha para virar cliente.` : `Movido para ${rotuloEtapaLead(para)}.`, erro: false },
      );
    });
  }

  return (
    <>
      <div className="-mx-1 overflow-x-auto pb-2.5">
        <div className="grid min-h-[420px] auto-cols-[250px] grid-flow-col gap-3 px-1">
          {ETAPAS_LEAD.map((col) => {
            const itens = cards.filter((c) => etapaDe(c) === col.id);
            const soma = itens.reduce((a, c) => a + c.valor, 0);
            return (
              <div
                key={col.id}
                onDragOver={(e) => {
                  if (arrastando && etapaDe(arrastando) !== col.id) {
                    e.preventDefault();
                    setSobre(col.id);
                  }
                }}
                onDragLeave={() => setSobre((s) => (s === col.id ? null : s))}
                onDrop={(e) => {
                  e.preventDefault();
                  setSobre(null);
                  if (arrastando) mover(arrastando, col.id);
                  setArrastando(null);
                }}
                className={`flex flex-col gap-2 rounded-xl border p-2.5 transition-colors ${
                  sobre === col.id
                    ? "border-accent bg-accent-soft"
                    : col.id === "ganho"
                      ? "border-transparent bg-ok-soft/60"
                      : col.id === "perdido"
                        ? "border-transparent bg-bad-soft/50"
                        : "border-transparent bg-surface"
                }`}
              >
                <div className="flex items-center justify-between px-1 pt-0.5 text-[13px] font-semibold">
                  <span>{col.rotulo}</span>
                  <span className="font-mono text-[11.5px] text-muted">{itens.length}</span>
                </div>
                {itens.length > 0 && <div className="-mt-1 px-1 font-mono text-[11.5px] text-muted">{reais(soma)}/mês</div>}
                {itens.map((c) => {
                  const proxima = leadAberto(etapaDe(c)) ? proximaEtapaLead(etapaDe(c)) : null;
                  return (
                    <div
                      key={c.id}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.effectAllowed = "move";
                        setArrastando(c);
                      }}
                      onDragEnd={() => {
                        setArrastando(null);
                        setSobre(null);
                      }}
                      className={`relative flex cursor-grab flex-col gap-1.5 rounded-[10px] border border-line bg-card p-2.5 hover:border-muted ${
                        arrastando?.id === c.id ? "opacity-40" : ""
                      } ${pendentes[c.id] ? "animate-pulse" : ""}`}
                    >
                      {c.segmento && <span className="text-[11px] font-semibold tracking-[0.03em] text-accent">{c.segmento}</span>}
                      <Link
                        href={c.href}
                        scroll={false}
                        draggable={false}
                        className="text-[13.5px] font-semibold leading-[1.3] [overflow-wrap:anywhere] after:absolute after:inset-0 after:content-['']"
                      >
                        {c.empresa}
                      </Link>
                      {(c.contato || c.cidade) && (
                        <div className="text-[11.5px] text-muted">{[c.contato, c.cidade].filter(Boolean).join(" · ")}</div>
                      )}
                      <div className="font-mono text-[11.5px] font-medium">
                        {reais(c.valor)}
                        <span className="text-muted">/mês</span>
                      </div>
                      {leadAberto(etapaDe(c)) ? (
                        <div className="text-[11.5px] leading-[1.35] text-muted">
                          {c.proximo ? (
                            <>
                              {c.proximo.texto} ·{" "}
                              <span className={c.proximo.atrasado ? "font-semibold text-bad" : c.proximo.hoje ? "font-semibold text-warn" : "font-mono"}>
                                {c.proximo.quando}
                              </span>
                            </>
                          ) : (
                            "Sem próximo passo"
                          )}
                        </div>
                      ) : (
                        etapaDe(c) === "perdido" && c.motivo && <div className="text-[11.5px] text-muted">{c.motivo}</div>
                      )}
                      <div className="flex items-center gap-2 text-[11.5px] text-muted">
                        {c.resp && <Avatar iniciais={c.resp.iniciais} nome={c.resp.nome} />}
                        <span>{c.origem}</span>
                        <span className="flex-1" />
                        {proxima && (
                          <button
                            type="button"
                            onClick={() => mover(c, proxima)}
                            title={`Mover para ${rotuloEtapaLead(proxima)}`}
                            aria-label={`Mover para ${rotuloEtapaLead(proxima)}`}
                            className="relative z-10 grid h-6 w-[26px] place-items-center rounded-md border border-line text-muted hover:border-accent hover:bg-accent hover:text-accent-ink"
                          >
                            ›
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {perdendo && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[rgba(5,7,11,.45)] px-4" onClick={() => setPerdendo(null)}>
          <form
            role="dialog"
            aria-modal="true"
            aria-label="Motivo da perda"
            onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => {
              e.preventDefault();
              if (!motivo.trim()) return;
              const c = perdendo;
              setPerdendo(null);
              mover(c, "perdido", motivo.trim());
            }}
            className="flex w-full max-w-[420px] flex-col gap-3 rounded-xl bg-card p-5 shadow-pop"
          >
            <h2 className="text-[17px] font-bold">Por que {perdendo.empresa} não fechou?</h2>
            <input
              autoFocus
              required
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ex.: preço, timing, escolheu outra agência"
              aria-label="Motivo da perda"
              className={classeEntrada}
            />
            <div className="flex gap-2">
              <Botao variante="principal" disabled={!motivo.trim()}>
                Mover para Perdido
              </Botao>
              <Botao type="button" variante="fantasma" onClick={() => setPerdendo(null)}>
                Cancelar
              </Botao>
            </div>
          </form>
        </div>
      )}

      <div
        role="status"
        aria-live="polite"
        className={`pointer-events-none fixed bottom-[calc(22px+env(safe-area-inset-bottom,0px))] left-1/2 z-[60] max-w-[calc(100%-32px)] -translate-x-1/2 rounded-[10px] px-4 py-2.5 text-[13px] text-bg shadow-pop transition-all ${
          aviso ? "translate-y-0 opacity-100" : "translate-y-5 opacity-0"
        } ${aviso?.erro ? "bg-bad" : "bg-ink"}`}
      >
        {aviso?.texto}
      </div>
    </>
  );
}
