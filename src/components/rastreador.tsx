"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { iniciarContagem, pararContagem } from "@/app/(time)/rastreador/acoes";
import { duracao, relogio, segundosEntre } from "@/lib/dominio/tempo";

export type TarefaRastreador = { id: string; tipo: string; titulo: string; cliente: string; minha: boolean };
export type ContagemLigada = { taskId: string; tipo: string; titulo: string; cliente: string; inicio: string };
export type ContagemRecente = { id: string; taskId: string; tipo: string; titulo: string; cliente: string; segundos: number };

const linkTarefa = (t: { tipo: string; id: string }) => `/tarefas?aba=${t.tipo}&tarefa=${t.id}`;

function IconeCronometro({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={`fill-none stroke-current ${className}`} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 21a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM12 9v4l2.5 1.5M10 2h4M19 5l1.5 1.5" />
    </svg>
  );
}

// Botão flutuante ao lado dos lembretes: escolher a tarefa, ligar e parar a contagem
export function Rastreador({
  tarefas,
  ligada,
  hoje,
  recentes,
}: {
  tarefas: TarefaRastreador[];
  ligada: ContagemLigada | null;
  hoje: number; // segundos já encerrados hoje
  recentes: ContagemRecente[];
}) {
  const router = useRouter();
  const tarefaAberta = useSearchParams().get("tarefa");
  const [aberto, setAberto] = useState(false);
  // Hora atual só no navegador (no servidor daria outro segundo e quebraria a hidratação)
  const [agora, setAgora] = useState<number | null>(null);
  const [busca, setBusca] = useState("");
  const [escolhida, setEscolhida] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  // Relógio correndo (1 s) só enquanto há contagem ligada
  useEffect(() => {
    setAgora(Date.now());
    if (!ligada) return;
    const t = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(t);
  }, [ligada]);

  // Tarefa aberta na tela já vem escolhida
  useEffect(() => {
    if (aberto && !escolhida && tarefaAberta && tarefas.some((t) => t.id === tarefaAberta)) setEscolhida(tarefaAberta);
  }, [aberto, escolhida, tarefaAberta, tarefas]);

  useEffect(() => {
    if (!aberto) return;
    const tecla = (e: KeyboardEvent) => e.key === "Escape" && setAberto(false);
    document.addEventListener("keydown", tecla);
    return () => document.removeEventListener("keydown", tecla);
  }, [aberto]);

  const correndo = ligada && agora ? segundosEntre(ligada.inicio, null, agora) : 0;
  // Conta no "Hoje" só se a contagem começou hoje (dia de São Paulo)
  const diaSP = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(d);
  const totalHoje = hoje + (ligada && agora && diaSP(new Date(ligada.inicio)) === diaSP(new Date(agora)) ? correndo : 0);
  const escolhidaInfo = tarefas.find((t) => t.id === escolhida);

  const resultados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return tarefas
      .filter((t) => !termo || t.titulo.toLowerCase().includes(termo) || t.cliente.toLowerCase().includes(termo))
      .sort((a, b) => Number(b.minha) - Number(a.minha))
      .slice(0, 8);
  }, [tarefas, busca]);

  const executar = (acao: () => Promise<{ erro?: string } | undefined | void>) =>
    iniciar(async () => {
      setErro(null);
      const r = await acao();
      if (r && "erro" in r && r.erro) setErro(r.erro);
      else setEscolhida(null);
      router.refresh();
    });

  return (
    <>
      {aberto && (
        <section
          aria-label="Rastreador de tempo"
          className="fixed bottom-[calc(84px+env(safe-area-inset-bottom,0px))] right-[18px] z-[60] flex max-h-[min(640px,calc(100dvh-120px))] w-[min(380px,calc(100vw-36px))] flex-col overflow-hidden rounded-xl border border-line bg-card shadow-pop print:hidden"
        >
          <div className="flex items-center gap-2 border-b border-line px-4 py-3">
            <IconeCronometro className="h-[18px] w-[18px] text-muted" />
            <b className="flex-1 text-[14px]">Rastreador de tempo</b>
            <span className="text-[12.5px] text-muted">
              Hoje <b className="font-mono font-semibold text-ink">{duracao(totalHoje)}</b>
            </span>
          </div>

          <div className="flex flex-col gap-3 overflow-y-auto p-4">
            {ligada && (
              <div className="rounded-xl bg-rail p-3.5 text-rail-ink">
                <div className="flex items-center gap-2 text-[11.5px] uppercase tracking-[0.08em] text-rail-muted">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-ok" /> Contando agora
                </div>
                <Link href={linkTarefa({ tipo: ligada.tipo, id: ligada.taskId })} className="mt-1.5 block font-medium leading-snug hover:underline [overflow-wrap:anywhere]">
                  {ligada.titulo}
                </Link>
                <span className="block text-[12.5px] text-rail-muted">{ligada.cliente}</span>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <b className="font-mono text-[26px] font-semibold tabular-nums">{relogio(correndo)}</b>
                  <button
                    type="button"
                    disabled={pendente}
                    onClick={() => executar(pararContagem)}
                    className="rounded-lg bg-white px-3.5 py-2 text-[13.5px] font-semibold text-ink hover:bg-white/90 disabled:opacity-60"
                  >
                    ■ Parar
                  </button>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <span className="text-[11.5px] uppercase tracking-[0.04em] text-muted">{ligada ? "Trocar para outra tarefa" : "Escolher tarefa"}</span>
              {escolhidaInfo ? (
                <div className="flex items-center gap-2 rounded-lg border border-accent bg-accent-soft px-3 py-2">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-medium">{escolhidaInfo.titulo}</span>
                    <span className="block truncate text-[12px] text-muted">{escolhidaInfo.cliente}</span>
                  </span>
                  <button type="button" onClick={() => setEscolhida(null)} aria-label="Trocar tarefa" className="px-1 text-muted hover:text-ink">
                    ✕
                  </button>
                </div>
              ) : (
                <>
                  <input
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    placeholder="Buscar tarefa ou cliente…"
                    aria-label="Buscar tarefa ou cliente"
                    className="rounded-lg border border-line bg-card px-3 py-2 text-[13.5px] outline-none focus:border-accent"
                  />
                  <ul className="flex flex-col rounded-lg border border-line">
                    {resultados.map((t) => (
                      <li key={t.id} className="border-t border-line first:border-t-0">
                        <button type="button" onClick={() => setEscolhida(t.id)} className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-surface">
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[13px] font-medium">{t.titulo}</span>
                            <span className="block truncate text-[12px] text-muted">{t.cliente}</span>
                          </span>
                          {t.minha && <span className="flex-none rounded-full bg-surface px-2 text-[11px] text-muted">sua</span>}
                        </button>
                      </li>
                    ))}
                    {!resultados.length && <li className="px-3 py-3 text-center text-[12.5px] text-muted">Nenhuma tarefa em aberto com essa busca.</li>}
                  </ul>
                </>
              )}
              <button
                type="button"
                disabled={!escolhida || pendente || escolhida === ligada?.taskId}
                onClick={() => escolhida && executar(() => iniciarContagem(escolhida))}
                className="mt-1 rounded-lg border border-accent bg-accent px-3.5 py-2 font-medium text-accent-ink hover:bg-accent-hover disabled:opacity-50"
              >
                {pendente ? "Um instante…" : ligada ? "▶ Trocar para esta tarefa" : "▶ Iniciar contagem"}
              </button>
              {erro && <p className="text-[12.5px] text-bad">{erro}</p>}
            </div>

            {recentes.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <span className="text-[11.5px] uppercase tracking-[0.04em] text-muted">Últimas contagens</span>
                <ul className="flex flex-col">
                  {recentes.map((r) => (
                    <li key={r.id} className="flex items-center gap-2 border-t border-line py-2 first:border-t-0">
                      <Link href={linkTarefa({ tipo: r.tipo, id: r.taskId })} className="min-w-0 flex-1 hover:text-accent">
                        <span className="block truncate text-[13px]">{r.titulo}</span>
                        <span className="block truncate text-[12px] text-muted">{r.cliente}</span>
                      </Link>
                      <span className="flex-none font-mono text-[12.5px] text-muted">{duracao(r.segundos)}</span>
                      {r.taskId !== ligada?.taskId && tarefas.some((t) => t.id === r.taskId) && (
                        <button
                          type="button"
                          disabled={pendente}
                          onClick={() => executar(() => iniciarContagem(r.taskId))}
                          aria-label={`Contar de novo: ${r.titulo}`}
                          title="Contar de novo"
                          className="grid h-7 w-7 flex-none place-items-center rounded-full border border-line text-[11px] text-muted hover:border-accent hover:text-accent"
                        >
                          ▶
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </section>
      )}

      <button
        type="button"
        onClick={() => setAberto((a) => !a)}
        aria-expanded={aberto}
        aria-label={ligada ? `Contando ${relogio(correndo)} em ${ligada.titulo}` : aberto ? "Fechar rastreador" : "Rastreador de tempo"}
        title="Rastreador de tempo"
        className={`fixed bottom-[calc(18px+env(safe-area-inset-bottom,0px))] right-[80px] z-[60] flex h-[52px] items-center gap-2 rounded-full bg-rail text-rail-ink shadow-pop hover:bg-ink print:hidden ${
          ligada ? "max-w-[min(260px,calc(100vw-110px))] pl-3.5 pr-4" : "w-[52px] justify-center"
        }`}
      >
        {ligada ? (
          <>
            <span className="h-2.5 w-2.5 flex-none animate-pulse rounded-full bg-ok" />
            <span className="flex min-w-0 flex-col items-start leading-tight">
              <b className="font-mono text-[14px] font-semibold tabular-nums">{relogio(correndo)}</b>
              <span className="max-w-full truncate text-[11.5px] text-rail-muted">{ligada.titulo}</span>
            </span>
          </>
        ) : aberto ? (
          <span className="text-[20px] leading-none">✕</span>
        ) : (
          <IconeCronometro className="h-6 w-6" />
        )}
      </button>
    </>
  );
}
