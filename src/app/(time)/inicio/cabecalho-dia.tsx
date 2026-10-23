"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const FUSO = "America/Sao_Paulo";
const agoraSP = () => {
  const d = new Date();
  const hora = Number(new Intl.DateTimeFormat("en-US", { timeZone: FUSO, hour: "numeric", hourCycle: "h23" }).format(d));
  return {
    relogio: new Intl.DateTimeFormat("pt-BR", { timeZone: FUSO, hour: "2-digit", minute: "2-digit" }).format(d),
    saudacao: hora < 12 ? "Bom dia" : hora < 18 ? "Boa tarde" : "Boa noite",
  };
};

// Cabeçalho escuro do Início: dia da semana, data, relógio, saudação, pensamento do dia e um atalho
export function CabecalhoDia({ nome, diaSemana, data, pensamento, logo, agencia }: { nome: string; diaSemana: string; data: string; pensamento: string; logo: string | null; agencia: string }) {
  const [agora, setAgora] = useState(agoraSP);
  useEffect(() => {
    const t = setInterval(() => setAgora(agoraSP()), 15_000);
    return () => clearInterval(t);
  }, []);

  return (
    <section className="relative mb-5 overflow-hidden rounded-2xl bg-rail px-5 py-6 text-rail-ink md:px-9 md:py-8">
      {/* brilho suave da cor da marca no canto */}
      <div aria-hidden="true" className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-accent opacity-25 blur-[90px]" />
      <div className="relative flex items-center justify-between gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {logo ? <img src={logo} alt={agencia} className="h-6 w-auto max-w-[120px] object-contain" /> : <span className="font-display text-[15px] font-bold">{agencia}</span>}
        <span className="flex items-center gap-2 font-mono text-[14px] tabular-nums text-rail-ink/85" aria-label={`Agora são ${agora.relogio}`}>
          <span className="h-2 w-2 animate-pulse rounded-full bg-accent" aria-hidden="true" />
          {agora.relogio}
        </span>
      </div>
      <div className="relative mt-5 flex items-center gap-4">
        <span className="text-[13px] font-semibold uppercase tracking-[0.2em] text-accent">{diaSemana}</span>
        <span className="h-px flex-1 bg-rail-line" />
        <span className="hidden text-[13px] text-rail-muted sm:block">{data}</span>
      </div>
      <h1 className="relative mt-3 font-display text-[34px] font-bold leading-[1.05] tracking-[-0.03em] md:text-[48px]">
        {agora.saudacao},
        <span className="block text-accent">{nome}</span>
      </h1>
      <div className="relative mt-5 border-l-2 border-accent pl-4">
        <div className="text-[11px] uppercase tracking-[0.2em] text-rail-muted">Pensamento do dia</div>
        <p className="mt-1 text-[15px] text-rail-ink/90 md:text-[16px]">{pensamento}</p>
      </div>
      <Link href="/tarefas?aba=conteudo" className="relative mt-5 inline-flex items-center gap-2 text-[15px] font-semibold text-accent hover:underline">
        <span aria-hidden="true" className="text-rail-muted">→</span>
        Qual cliente vai ficar feliz hoje?
      </Link>
    </section>
  );
}
