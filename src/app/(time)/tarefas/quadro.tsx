"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { Avatar, PontoCliente, Prazo } from "@/components/tarefa";
import { podeMover, proximaEtapa, rotuloEtapa, type Etapa, type TipoTarefa } from "@/lib/dominio/tarefas";
import { moverTarefa } from "./acoes";

export type Card = {
  id: string;
  titulo: string;
  etapa: Etapa;
  prazo: string | null;
  clienteNome: string;
  clienteCor: string;
  detalhe: string; // formato (conteúdo) ou área (demanda)
  resp: { iniciais: string; nome: string; foto?: string | null } | null;
  ajustesCliente: number;
  recorrente: boolean;
  href: string;
};

export function Quadro({
  tipo,
  colunas,
  cards,
  hoje,
}: {
  tipo: TipoTarefa;
  colunas: { id: Etapa; rotulo: string }[];
  cards: Card[];
  hoje: string;
}) {
  // Etapa mostrada enquanto o banco confirma o movimento
  const [pendentes, setPendentes] = useState<Record<string, Etapa>>({});
  const [arrastando, setArrastando] = useState<Card | null>(null);
  const [sobre, setSobre] = useState<Etapa | null>(null);
  const [aviso, setAviso] = useState<{ texto: string; erro: boolean } | null>(null);
  const [, iniciar] = useTransition();

  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setAviso(null), aviso.erro ? 5000 : 2600);
    return () => clearTimeout(t);
  }, [aviso]);

  const etapaDe = (c: Card) => pendentes[c.id] ?? c.etapa;

  function mover(c: Card, para: Etapa) {
    if (!podeMover(etapaDe(c), para)) {
      setAviso({
        texto: para === "agendado" ? "Para agendar, abra o conteúdo e registre a data e a hora." : "Depois de Ajuste o conteúdo volta para Revisão interna.",
        erro: true,
      });
      return;
    }
    setPendentes((p) => ({ ...p, [c.id]: para }));
    iniciar(async () => {
      const r = await moverTarefa(c.id, para);
      setPendentes((p) => {
        const resto = { ...p };
        delete resto[c.id];
        return resto;
      });
      setAviso(r?.erro ? { texto: r.erro, erro: true } : { texto: `Movido para ${rotuloEtapa(para)}.`, erro: false });
    });
  }

  return (
    <>
      <div className="-mx-1 overflow-x-auto pb-2.5">
        <div className="grid min-h-[420px] auto-cols-[250px] grid-flow-col gap-3 px-1">
          {colunas.map((col) => {
            const itens = cards.filter((c) => etapaDe(c) === col.id);
            const aceita = arrastando && podeMover(etapaDe(arrastando), col.id);
            return (
              <div
                key={col.id}
                onDragOver={(e) => {
                  if (aceita) {
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
                  sobre === col.id ? "border-accent bg-accent-soft" : "border-transparent bg-surface"
                } ${arrastando && !aceita && etapaDe(arrastando) !== col.id ? "opacity-60" : ""}`}
              >
                <div className="flex items-center justify-between px-1 pb-1 pt-0.5 text-[13px] font-semibold">
                  <span>{col.rotulo}</span>
                  <span className="font-mono text-[11.5px] text-muted">{itens.length}</span>
                </div>
                {itens.map((c) => {
                  const proxima = proximaEtapa(tipo, etapaDe(c));
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
                      className={`relative flex cursor-grab flex-col gap-2 rounded-[10px] border border-line bg-card p-2.5 hover:border-muted ${
                        arrastando?.id === c.id ? "opacity-40" : ""
                      } ${pendentes[c.id] ? "animate-pulse" : ""}`}
                    >
                      <div className="flex min-w-0 items-center gap-1.5 text-[11.5px] text-muted">
                        <PontoCliente cor={c.clienteCor} />
                        <span className="truncate">
                          {c.clienteNome} · {c.detalhe}
                        </span>
                        {c.recorrente && (
                          <span className="ml-auto flex-none" title="Tarefa recorrente" aria-label="Tarefa recorrente">
                            ↻
                          </span>
                        )}
                      </div>
                      <Link
                        href={c.href}
                        scroll={false}
                        draggable={false}
                        className="text-[12.5px] font-semibold leading-[1.3] [overflow-wrap:anywhere] after:absolute after:inset-0 after:content-['']"
                      >
                        {c.titulo}
                      </Link>
                      <div className="flex items-center gap-2 text-[11.5px] text-muted">
                        {c.resp ? <Avatar iniciais={c.resp.iniciais} nome={c.resp.nome} foto={c.resp.foto} /> : <span>Sem responsável</span>}
                        <Prazo prazo={c.prazo} etapa={etapaDe(c)} hoje={hoje} />
                        {c.ajustesCliente > 0 && (
                          <span className="font-semibold text-bad" title="Ajustes pedidos pelo cliente">
                            ↺{c.ajustesCliente}
                          </span>
                        )}
                        <span className="flex-1" />
                        {proxima && (
                          <button
                            type="button"
                            onClick={() => mover(c, proxima)}
                            title={`Mover para ${rotuloEtapa(proxima)}`}
                            aria-label={`Mover para ${rotuloEtapa(proxima)}`}
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
