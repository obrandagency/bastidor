"use client";

import { useEffect, useRef, useState } from "react";
import { tempo } from "./gravador";

const BARRAS = 52;

// Ondas do som: lidas do próprio áudio; se o navegador não conseguir decodificar, usa um desenho fixo pelo nome do arquivo
async function ondasDoAudio(url: string, semente: string): Promise<number[]> {
  try {
    const dados = await (await fetch(url)).arrayBuffer();
    const ctx = new AudioContext();
    const audio = await ctx.decodeAudioData(dados);
    ctx.close();
    const canal = audio.getChannelData(0);
    const passo = Math.floor(canal.length / BARRAS) || 1;
    const picos = Array.from({ length: BARRAS }, (_, i) => {
      let max = 0;
      for (let j = i * passo; j < Math.min((i + 1) * passo, canal.length); j += 16) max = Math.max(max, Math.abs(canal[j]));
      return max;
    });
    const maior = Math.max(...picos) || 1;
    return picos.map((p) => Math.max(0.12, p / maior));
  } catch {
    let h = 0;
    for (const c of semente) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    return Array.from({ length: BARRAS }, (_, i) => 0.2 + (((h >> i % 24) ^ (i * 7)) % 10) / 12.5);
  }
}

// Mensagem de áudio: botão redondo de tocar, ondas com o ponto de progresso (clicar pula para o ponto) e a duração
export function PlayerAudio({ url, caminho, duracao }: { url: string | undefined; caminho: string; duracao?: number }) {
  const audio = useRef<HTMLAudioElement>(null);
  const [tocando, setTocando] = useState(false);
  const [posicao, setPosicao] = useState(0); // 0 a 1
  const [total, setTotal] = useState(duracao ?? 0);
  const [ondas, setOndas] = useState<number[] | null>(null);

  useEffect(() => {
    if (url) ondasDoAudio(url, caminho).then(setOndas);
  }, [url, caminho]);

  function alternar() {
    const a = audio.current;
    if (!a) return;
    if (a.paused) a.play().catch(() => setTocando(false)); // navegador sem suporte ao formato
    else a.pause();
  }

  function pular(e: React.MouseEvent<HTMLDivElement>) {
    const a = audio.current;
    if (!a || !a.duration || !isFinite(a.duration)) return;
    const r = e.currentTarget.getBoundingClientRect();
    a.currentTime = ((e.clientX - r.left) / r.width) * a.duration;
  }

  const lista = ondas ?? Array.from({ length: BARRAS }, () => 0.3);
  const restante = total ? total * (tocando || posicao > 0 ? 1 - posicao : 1) : 0;

  return (
    <div className="flex w-full max-w-[420px] items-center gap-3 rounded-2xl bg-surface px-3 py-2.5">
      {url && (
        <audio
          ref={audio}
          src={url}
          preload="metadata"
          onPlay={() => setTocando(true)}
          onPause={() => setTocando(false)}
          onEnded={() => {
            setTocando(false);
            setPosicao(0);
          }}
          onLoadedMetadata={(e) => isFinite(e.currentTarget.duration) && setTotal(e.currentTarget.duration)}
          onTimeUpdate={(e) => {
            const a = e.currentTarget;
            if (a.duration && isFinite(a.duration)) setPosicao(a.currentTime / a.duration);
          }}
        />
      )}
      <button
        type="button"
        onClick={alternar}
        disabled={!url}
        aria-label={tocando ? "Pausar áudio" : "Tocar áudio"}
        className="grid h-10 w-10 flex-none place-items-center rounded-full bg-accent text-accent-ink hover:bg-accent-hover disabled:opacity-50"
      >
        {tocando ? (
          <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 fill-current">
            <path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" aria-hidden="true" className="ml-0.5 h-4 w-4 fill-current">
            <path d="M7 4.5v15l12-7.5z" />
          </svg>
        )}
      </button>
      <div
        role="slider"
        aria-label="Posição do áudio"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(posicao * 100)}
        onClick={pular}
        className="relative flex h-8 min-w-0 flex-1 cursor-pointer items-center gap-[2px]"
      >
        {lista.map((v, i) => (
          <span
            key={i}
            className={`w-[2px] flex-1 rounded-full ${i / BARRAS < posicao ? "bg-accent" : "bg-muted/45"}`}
            style={{ height: `${Math.round(v * 100)}%` }}
          />
        ))}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent"
          style={{ left: `${posicao * 100}%` }}
        />
      </div>
      <span className="flex-none font-mono text-[12.5px] tabular-nums text-muted">{tempo(restante)}</span>
    </div>
  );
}
