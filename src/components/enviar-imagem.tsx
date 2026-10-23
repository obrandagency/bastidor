"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { BUCKET_MARCA } from "@/lib/marca";
import { criarClienteNavegador } from "@/lib/supabase/client";
import type { Estado } from "@/app/entrar/acoes";

// Reduz a imagem no navegador (lado maior até `maximo` px) e converte para WebP, mantendo a transparência
export async function reduzir(arquivo: File, maximo: number): Promise<Blob> {
  const bitmap = await createImageBitmap(arquivo);
  const escala = Math.min(1, maximo / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * escala);
  canvas.height = Math.round(bitmap.height * escala);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((ok, erro) => canvas.toBlob((b) => (b ? ok(b) : erro(new Error("conversão"))), "image/webp", 0.88));
}

export function EnviarImagem({
  pasta,
  atual,
  salvar,
  forma = "redonda",
  maximo = 512,
  vazio,
  rotulo = "Enviar imagem",
  compacta,
}: {
  pasta: string; // ex.: time/<id>, clientes/<id>, agencia
  atual: string | null; // endereço público da imagem atual
  salvar: (caminho: string | null) => Promise<Estado>;
  forma?: "redonda" | "livre";
  maximo?: number;
  vazio: React.ReactNode; // o que aparece sem imagem (iniciais, bolinha de cor)
  rotulo?: string;
  compacta?: boolean; // só a bolinha clicável (listas)
}) {
  const router = useRouter();
  const entrada = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function escolher(arquivo: File | undefined) {
    if (!arquivo) return;
    setErro(null);
    if (!arquivo.type.startsWith("image/")) return setErro("Escolha uma imagem (JPG, PNG ou WebP).");
    if (arquivo.size > 15 * 1024 * 1024) return setErro("Imagem acima de 15 MB.");
    setEnviando(true);
    try {
      const blob = await reduzir(arquivo, maximo);
      const caminho = `${pasta}/${crypto.randomUUID().replaceAll("-", "")}.webp`;
      const { error } = await criarClienteNavegador().storage.from(BUCKET_MARCA).upload(caminho, blob, { contentType: "image/webp" });
      if (error) throw error;
      const r = await salvar(caminho);
      if (r?.erro) setErro(r.erro);
      router.refresh();
    } catch {
      setErro("Não foi possível enviar a imagem.");
    } finally {
      setEnviando(false);
      if (entrada.current) entrada.current.value = "";
    }
  }

  async function remover() {
    if (!confirm("Remover a imagem?")) return;
    setEnviando(true);
    const r = await salvar(null);
    if (r?.erro) setErro(r.erro);
    setEnviando(false);
    router.refresh();
  }

  const arquivo = (
    <input ref={entrada} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => escolher(e.target.files?.[0])} />
  );

  if (compacta)
    return (
      <span className="relative flex-none">
        <button
          type="button"
          disabled={enviando}
          onClick={() => entrada.current?.click()}
          title={erro ?? (atual ? "Trocar foto" : "Enviar foto")}
          aria-label={atual ? "Trocar foto" : "Enviar foto"}
          className={`grid h-8 w-8 place-items-center overflow-hidden rounded-full ring-offset-2 hover:ring-2 hover:ring-accent ${enviando ? "animate-pulse" : ""} ${erro ? "ring-2 ring-bad" : ""}`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {atual ? <img src={atual} alt="" className="h-full w-full object-cover" /> : vazio}
        </button>
        {arquivo}
      </span>
    );

  return (
    <div className="flex flex-wrap items-center gap-3">
      <span
        className={`grid flex-none place-items-center overflow-hidden border border-line bg-surface ${
          forma === "redonda" ? "h-14 w-14 rounded-full" : "h-14 min-w-14 max-w-[180px] rounded-lg px-2"
        }`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {atual ? <img src={atual} alt="" className={forma === "redonda" ? "h-full w-full object-cover" : "max-h-12 w-auto object-contain"} /> : vazio}
      </span>
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-3 text-[13px]">
          <button type="button" disabled={enviando} onClick={() => entrada.current?.click()} className="rounded-lg border border-line px-3 py-[6px] font-medium hover:border-ink disabled:opacity-60">
            {enviando ? "Enviando…" : atual ? "Trocar" : rotulo}
          </button>
          {atual && !enviando && (
            <button type="button" onClick={remover} className="text-bad hover:underline">
              Remover
            </button>
          )}
        </div>
        <small className="text-[12px] text-muted">JPG, PNG ou WebP. A imagem é reduzida antes de enviar.</small>
        {erro && <small className="text-[12px] text-bad">{erro}</small>}
      </div>
      {arquivo}
    </div>
  );
}
