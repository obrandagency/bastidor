"use client";

import { useEffect, useRef, useState } from "react";

const MAXIMO = 5 * 60; // segundos

export const tempo = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

// Grava áudio pelo microfone (até 5 min). WebM/Opus no Chrome e Firefox, MP4/AAC no Safari e iPhone.
export function Gravador({ enviar, desabilitado }: { enviar: (audio: Blob, tipo: string, segundos: number) => void; desabilitado?: boolean }) {
  const [gravando, setGravando] = useState(false);
  const [segundos, setSegundos] = useState(0);
  const [erro, setErro] = useState<string | null>(null);
  const gravador = useRef<MediaRecorder | null>(null);
  const partes = useRef<Blob[]>([]);
  const cancelado = useRef(false);
  const inicio = useRef(0);

  useEffect(() => {
    if (!gravando) return;
    const t = setInterval(() => {
      const s = (Date.now() - inicio.current) / 1000;
      setSegundos(s);
      if (s >= MAXIMO) parar(false);
    }, 250);
    return () => clearInterval(t);
  }, [gravando]);

  async function comecar() {
    setErro(null);
    if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setErro("Este navegador não grava áudio.");
      return;
    }
    try {
      const fluxo = await navigator.mediaDevices.getUserMedia({ audio: true });
      const tipo = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/aac"].find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
      const r = new MediaRecorder(fluxo, tipo ? { mimeType: tipo } : undefined);
      partes.current = [];
      cancelado.current = false;
      r.ondataavailable = (e) => e.data.size && partes.current.push(e.data);
      r.onstop = () => {
        fluxo.getTracks().forEach((t) => t.stop());
        const base = (r.mimeType || tipo || "audio/webm").split(";")[0];
        const s = (Date.now() - inicio.current) / 1000;
        if (!cancelado.current && partes.current.length) enviar(new Blob(partes.current, { type: base }), base, Math.round(s));
        setGravando(false);
        setSegundos(0);
      };
      gravador.current = r;
      inicio.current = Date.now();
      r.start(1000);
      setGravando(true);
    } catch {
      setErro("Permita o uso do microfone para gravar.");
    }
  }

  function parar(cancelar: boolean) {
    cancelado.current = cancelar;
    if (gravador.current?.state === "recording") gravador.current.stop();
  }

  if (gravando)
    return (
      <div className="flex h-[38px] flex-none items-center gap-2 rounded-lg border border-bad bg-bad-soft px-2.5 text-[13px]">
        <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-bad" aria-hidden="true" />
        <span className="font-mono tabular-nums text-bad" aria-live="polite">
          {tempo(segundos)} / {tempo(MAXIMO)}
        </span>
        <button type="button" onClick={() => parar(true)} className="text-muted hover:text-ink">
          Cancelar
        </button>
        <button type="button" onClick={() => parar(false)} className="rounded-md bg-accent px-2 py-0.5 font-medium text-accent-ink hover:bg-accent-hover">
          Enviar
        </button>
      </div>
    );
  return (
    <>
      <button
        type="button"
        onClick={comecar}
        disabled={desabilitado}
        title={erro ?? "Gravar áudio (até 5 min)"}
        aria-label="Gravar áudio"
        className={`grid h-[38px] w-[38px] flex-none place-items-center rounded-lg border hover:border-ink disabled:opacity-50 ${erro ? "border-bad text-bad" : "border-line"}`}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" className="h-[17px] w-[17px] fill-none stroke-current" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" />
        </svg>
      </button>
      {erro && <span className="sr-only" role="alert">{erro}</span>}
    </>
  );
}
