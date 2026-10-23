"use client";

import Link from "next/link";
import { useActionState, useEffect, useState, useTransition } from "react";
import { Aviso, Botao, Campo, Selecao } from "@/components/formulario";
import { Avatar, LogoCliente } from "@/components/tarefa";
import { iniciarOnboarding, moverOnboarding } from "./acoes";

export type EtapaQuadro = { id: string; nome: string; cor: string };
export type CardOnboarding = {
  id: string;
  etapaId: string;
  cliente: string;
  cor: string;
  logo: string | null;
  inicio: string;
  feitas: number;
  total: number;
  comentarios: number;
  documentos: number;
  resp: { iniciais: string; nome: string; foto?: string | null } | null;
};

function Iniciar({
  etapa,
  clientes,
  time,
  eu,
  hoje,
  fechar,
}: {
  etapa: EtapaQuadro;
  clientes: { id: string; nome: string }[];
  time: { id: string; nome: string }[];
  eu: string;
  hoje: string;
  fechar: () => void;
}) {
  const [estado, acao, enviando] = useActionState(iniciarOnboarding, undefined);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[rgba(5,7,11,.45)] px-4" onClick={fechar}>
      <form
        role="dialog"
        aria-modal="true"
        aria-label="Iniciar onboarding"
        action={acao}
        onClick={(e) => e.stopPropagation()}
        className="flex w-full max-w-[440px] flex-col gap-3 rounded-xl bg-card p-5 shadow-pop"
      >
        <h2 className="text-[17px] font-bold">Iniciar onboarding em {etapa.nome}</h2>
        <input type="hidden" name="etapa_id" value={etapa.id} />
        {clientes.length === 0 ? (
          <p className="text-[13px] text-muted">Todos os clientes ativos já têm onboarding. Cadastre um cliente na Central do cliente ou pelo CRM.</p>
        ) : (
          <>
            <Selecao rotulo="Cliente" id="client_id" required defaultValue="">
              <option value="" disabled>
                Escolha
              </option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </Selecao>
            <div className="grid grid-cols-2 gap-3">
              <Campo rotulo="Início" id="inicio" type="date" defaultValue={hoje} />
              <Selecao rotulo="Responsável" id="responsavel_id" defaultValue={eu}>
                {time.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome}
                  </option>
                ))}
              </Selecao>
            </div>
          </>
        )}
        {estado?.erro && <Aviso tom="erro">{estado.erro}</Aviso>}
        <div className="flex gap-2">
          {clientes.length > 0 && (
            <Botao variante="principal" disabled={enviando}>
              {enviando ? "Iniciando…" : "Iniciar"}
            </Botao>
          )}
          <Botao type="button" variante="fantasma" onClick={fechar}>
            Cancelar
          </Botao>
        </div>
      </form>
    </div>
  );
}

export function QuadroOnboarding({
  etapas,
  cards,
  podeEditar,
  clientesSemOnboarding,
  time,
  eu,
  hoje,
}: {
  etapas: EtapaQuadro[];
  cards: CardOnboarding[];
  podeEditar: boolean;
  clientesSemOnboarding: { id: string; nome: string }[];
  time: { id: string; nome: string }[];
  eu: string;
  hoje: string;
}) {
  const [pendentes, setPendentes] = useState<Record<string, string>>({});
  const [arrastando, setArrastando] = useState<CardOnboarding | null>(null);
  const [sobre, setSobre] = useState<string | null>(null);
  const [iniciando, setIniciando] = useState<EtapaQuadro | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [, iniciar] = useTransition();

  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setAviso(null), 4000);
    return () => clearTimeout(t);
  }, [aviso]);

  const etapaDe = (c: CardOnboarding) => pendentes[c.id] ?? c.etapaId;
  const dataBR = (iso: string) => iso.split("-").reverse().join("/");

  function mover(c: CardOnboarding, para: string) {
    if (etapaDe(c) === para) return;
    setPendentes((p) => ({ ...p, [c.id]: para }));
    iniciar(async () => {
      const r = await moverOnboarding(c.id, para);
      setPendentes((p) => {
        const resto = { ...p };
        delete resto[c.id];
        return resto;
      });
      if (r?.erro) setAviso(r.erro);
    });
  }

  return (
    <>
      <div className="-mx-1 overflow-x-auto pb-2.5">
        <div className="grid min-h-[420px] auto-cols-[260px] grid-flow-col gap-3 px-1">
          {etapas.map((etapa) => {
            const itens = cards.filter((c) => etapaDe(c) === etapa.id);
            return (
              <div
                key={etapa.id}
                onDragOver={(e) => {
                  if (arrastando && podeEditar) {
                    e.preventDefault();
                    setSobre(etapa.id);
                  }
                }}
                onDragLeave={() => setSobre((s) => (s === etapa.id ? null : s))}
                onDrop={(e) => {
                  e.preventDefault();
                  setSobre(null);
                  if (arrastando) mover(arrastando, etapa.id);
                  setArrastando(null);
                }}
                className={`flex flex-col gap-2.5 rounded-xl border p-2.5 transition-colors ${sobre === etapa.id ? "border-accent bg-accent-soft" : "border-line bg-card"}`}
              >
                <div className="flex items-center gap-2 border-l-[3px] py-1 pl-2.5" style={{ borderColor: etapa.cor }}>
                  <span className="font-semibold">{etapa.nome}</span>
                  <span className="rounded bg-accent-soft px-1.5 font-mono text-[10.5px] text-accent">{itens.length}</span>
                  {podeEditar && (
                    <button
                      type="button"
                      onClick={() => setIniciando(etapa)}
                      aria-label={`Iniciar onboarding em ${etapa.nome}`}
                      title="Iniciar onboarding de um cliente nesta etapa"
                      className="ml-auto grid h-6 w-6 place-items-center rounded-full text-[16px] text-accent hover:bg-accent-soft"
                    >
                      +
                    </button>
                  )}
                </div>
                {itens.length === 0 && <div className="rounded-lg border border-dashed border-line py-4 text-center text-[12.5px] text-muted">Nenhum cliente</div>}
                {itens.map((c) => (
                  <div
                    key={c.id}
                    draggable={podeEditar}
                    onDragStart={(e) => {
                      e.dataTransfer.effectAllowed = "move";
                      setArrastando(c);
                    }}
                    onDragEnd={() => {
                      setArrastando(null);
                      setSobre(null);
                    }}
                    className={`relative flex flex-col gap-2 rounded-[10px] border border-line bg-card p-3 hover:border-muted ${podeEditar ? "cursor-grab" : ""} ${
                      arrastando?.id === c.id ? "opacity-40" : ""
                    } ${pendentes[c.id] ? "animate-pulse" : ""}`}
                  >
                    <div className="flex items-center gap-2">
                      <LogoCliente nome={c.cliente} cor={c.cor} logo={c.logo} />
                      <Link
                        href={`/onboarding/${c.id}`}
                        draggable={false}
                        className="min-w-0 truncate font-semibold after:absolute after:inset-0 after:content-['']"
                      >
                        {c.cliente}
                      </Link>
                    </div>
                    <div className="flex items-center gap-1.5 text-[12px] text-muted">
                      <span aria-hidden="true">📅</span>
                      <span className="font-mono">{dataBR(c.inicio)}</span>
                    </div>
                    <div>
                      <div className="mb-1 flex justify-between text-[11.5px] text-muted">
                        <span>
                          {c.feitas} de {c.total} tarefas
                        </span>
                        <span className="font-mono">{c.total ? Math.round((c.feitas / c.total) * 100) : 0}%</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-surface">
                        <i className="block h-full rounded-full bg-accent" style={{ width: `${c.total ? (c.feitas / c.total) * 100 : 0}%` }} />
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 border-t border-line pt-2 text-[11.5px] text-muted">
                      {c.resp && <Avatar iniciais={c.resp.iniciais} nome={c.resp.nome} foto={c.resp.foto} />}
                      <span className="flex-1" />
                      {c.comentarios > 0 && (
                        <span className="rounded bg-accent-soft px-1.5 py-0.5 text-accent" title="Comentários">
                          💬 {c.comentarios}
                        </span>
                      )}
                      {c.documentos > 0 && (
                        <span className="rounded bg-accent-soft px-1.5 py-0.5 text-accent" title="Documentos">
                          📎 {c.documentos}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      {iniciando && (
        <Iniciar etapa={iniciando} clientes={clientesSemOnboarding} time={time} eu={eu} hoje={hoje} fechar={() => setIniciando(null)} />
      )}
      <div
        role="status"
        aria-live="polite"
        className={`pointer-events-none fixed bottom-[calc(22px+env(safe-area-inset-bottom,0px))] left-1/2 z-[60] -translate-x-1/2 rounded-[10px] bg-bad px-4 py-2.5 text-[13px] text-white shadow-pop transition-all ${
          aviso ? "opacity-100" : "translate-y-5 opacity-0"
        }`}
      >
        {aviso}
      </div>
    </>
  );
}
