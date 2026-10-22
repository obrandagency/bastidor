"use client";

import { useState, useTransition } from "react";
import { Aviso, Botao, classeEntrada } from "@/components/formulario";
import type { Estado } from "@/app/entrar/acoes";
import { aprovar, pedirAjuste } from "./acoes";

export type Midia = { url: string; tipo: "imagem" | "video" };

// Arte do post; carrossel navegável quando há mais de uma
export function Carrossel({ midias, cor }: { midias: Midia[]; cor: string }) {
  const [i, setI] = useState(0);
  if (midias.length === 0)
    return (
      <div
        className="grid aspect-[4/5] w-full place-items-center rounded-lg text-[12.5px] text-white/85"
        style={{ background: `linear-gradient(165deg, color-mix(in srgb, ${cor} 85%, white), color-mix(in srgb, ${cor} 45%, black))` }}
      >
        Arte em breve
      </div>
    );
  const atual = midias[i];
  return (
    <div className="relative overflow-hidden rounded-lg bg-surface">
      {atual.tipo === "video" ? (
        <video key={atual.url} src={atual.url} controls playsInline className="aspect-[4/5] w-full bg-ink object-contain" />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={atual.url} alt={`Arte ${i + 1} de ${midias.length}`} className="aspect-[4/5] w-full object-cover" />
      )}
      {midias.length > 1 && (
        <>
          <button
            type="button"
            aria-label="Arte anterior"
            onClick={() => setI((i - 1 + midias.length) % midias.length)}
            className="absolute left-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-[18px] shadow-pop"
          >
            ‹
          </button>
          <button
            type="button"
            aria-label="Próxima arte"
            onClick={() => setI((i + 1) % midias.length)}
            className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-[18px] shadow-pop"
          >
            ›
          </button>
          <div className="absolute inset-x-0 bottom-2 flex justify-center gap-1.5">
            {midias.map((_, j) => (
              <span key={j} className={`h-1.5 w-1.5 rounded-full ${j === i ? "bg-white" : "bg-white/50"}`} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function Decisao({
  id,
  usados,
  limite,
  somenteLeitura,
}: {
  id: string;
  usados: number;
  limite: number | null;
  somenteLeitura?: boolean;
}) {
  const [pedindo, setPedindo] = useState(false);
  const [texto, setTexto] = useState("");
  const [retorno, setRetorno] = useState<Estado>(undefined);
  const [enviando, iniciar] = useTransition();

  if (somenteLeitura)
    return <p className="text-[12.5px] text-muted">Visualização da equipe: só o cliente aprova ou pede ajuste.</p>;
  if (retorno?.ok) return <Aviso tom="ok">{retorno.ok}</Aviso>;

  const acabou = limite !== null && usados >= limite;
  return (
    <div className="flex flex-col gap-2.5">
      {retorno?.erro && <Aviso tom="erro">{retorno.erro}</Aviso>}
      {!pedindo ? (
        <div className="flex flex-wrap gap-2">
          <Botao
            variante="principal"
            disabled={enviando}
            onClick={() => iniciar(async () => setRetorno(await aprovar(id)))}
            className="flex-1 sm:flex-none"
          >
            {enviando ? "Aprovando…" : "Aprovar"}
          </Botao>
          <Botao disabled={enviando} onClick={() => setPedindo(true)} className="flex-1 sm:flex-none">
            Pedir ajuste
          </Botao>
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            iniciar(async () => setRetorno(await pedirAjuste(id, texto)));
          }}
          className="flex flex-col gap-2.5"
        >
          {acabou && (
            <Aviso tom="aviso">
              Você já usou os {limite} ajustes do mês previstos no contrato. Este pedido pode ser cobrado à parte.
            </Aviso>
          )}
          <label htmlFor={`ajuste-${id}`} className="text-[11.5px] uppercase tracking-[0.04em] text-muted">
            O que precisa mudar?
          </label>
          <textarea
            id={`ajuste-${id}`}
            required
            autoFocus
            rows={3}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            className={`${classeEntrada} resize-y leading-[1.55]`}
          />
          <div className="flex flex-wrap gap-2">
            <Botao variante="principal" disabled={enviando || !texto.trim()}>
              {enviando ? "Enviando…" : "Enviar pedido"}
            </Botao>
            <Botao type="button" variante="fantasma" disabled={enviando} onClick={() => setPedindo(false)}>
              Cancelar
            </Botao>
          </div>
        </form>
      )}
    </div>
  );
}
