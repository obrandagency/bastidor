"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { reduzir } from "@/components/enviar-imagem";
import { Aviso, Campo } from "@/components/formulario";
import { BUCKET_INSPIRACOES } from "@/lib/constantes";
import { criarClienteNavegador } from "@/lib/supabase/client";
import { apagarInspiracao, criarInspiracao } from "./acoes";

const TIPOS = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export function NovaInspiracao({ clientId }: { clientId: string }) {
  const [aberto, setAberto] = useState(false);
  const [estado, acao, salvando] = useActionState(criarInspiracao, undefined);
  const [caminho, setCaminho] = useState("");
  const [previa, setPrevia] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const formulario = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (estado?.ok) {
      setAberto(false);
      setCaminho("");
      setPrevia(null);
      formulario.current?.reset();
    }
  }, [estado]);

  async function escolher(f: File | undefined) {
    if (!f) return;
    setErro(null);
    if (!TIPOS.includes(f.type)) return setErro("Use JPG, PNG, WebP ou GIF.");
    if (f.size > 15 * 1024 * 1024) return setErro("Imagem acima de 15 MB.");
    setEnviando(true);
    try {
      // GIF vai como está (para não perder a animação); as outras são reduzidas para WebP
      const corpo = f.type === "image/gif" ? f : await reduzir(f, 1600);
      const nome = `${clientId}/${crypto.randomUUID()}.${f.type === "image/gif" ? "gif" : "webp"}`;
      const { error } = await criarClienteNavegador().storage.from(BUCKET_INSPIRACOES).upload(nome, corpo, { contentType: f.type === "image/gif" ? "image/gif" : "image/webp" });
      if (error) throw error;
      setCaminho(nome);
      setPrevia(URL.createObjectURL(corpo));
    } catch {
      setErro("Não foi possível enviar a imagem.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <>
      <button type="button" onClick={() => setAberto(true)} className="rounded-lg border border-accent bg-accent px-3.5 py-2 font-medium text-accent-ink hover:border-accent-hover hover:bg-accent-hover">
        + Nova inspiração
      </button>
      {aberto && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[rgba(5,7,11,.45)] px-4" onClick={() => setAberto(false)}>
          <form
            ref={formulario}
            role="dialog"
            aria-modal="true"
            aria-label="Nova inspiração"
            action={acao}
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[90dvh] w-full max-w-[480px] flex-col gap-3 overflow-y-auto rounded-xl bg-card p-5 shadow-pop"
          >
            <h2 className="text-[17px] font-bold">Nova inspiração</h2>
            {estado?.erro && <Aviso tom="erro">{estado.erro}</Aviso>}
            {erro && <Aviso tom="erro">{erro}</Aviso>}
            <input type="hidden" name="client_id" value={clientId} />
            <input type="hidden" name="imagem" value={caminho} />
            <Campo rotulo="Título" id="titulo" required maxLength={200} autoFocus placeholder="Ex.: Carrossel com fotos de bastidor" />
            <Campo rotulo="Link (post, perfil, site, vídeo)" id="link" type="url" placeholder="https://instagram.com/p/…" />
            <div className="flex flex-col gap-[5px]">
              <label htmlFor="nota" className="text-[11.5px] uppercase tracking-[0.04em] text-muted">
                O que chamou atenção
              </label>
              <textarea id="nota" name="nota" rows={3} maxLength={2000} className="rounded-lg border border-line bg-card px-3 py-2 outline-none focus:border-accent" />
            </div>
            <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed border-line bg-surface px-3 py-4 text-center text-[13px] text-muted hover:border-accent hover:text-accent">
              {previa ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={previa} alt="Prévia da imagem" className="max-h-[200px] rounded-lg object-contain" />
              ) : enviando ? (
                "Enviando imagem…"
              ) : (
                "Imagem (opcional): print ou referência, até 15 MB"
              )}
              <input type="file" accept={TIPOS.join(",")} className="sr-only" onChange={(e) => escolher(e.target.files?.[0])} />
            </label>
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setAberto(false)} className="rounded-lg px-3.5 py-2 text-muted hover:bg-surface hover:text-ink">
                Cancelar
              </button>
              <button disabled={salvando || enviando} className="rounded-lg border border-accent bg-accent px-3.5 py-2 font-medium text-accent-ink hover:bg-accent-hover disabled:opacity-60">
                {salvando ? "Salvando…" : "Salvar"}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}

export function ApagarInspiracao({ id, clientId }: { id: string; clientId: string }) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  return (
    <button
      type="button"
      disabled={pendente}
      onClick={() => {
        if (!confirm("Apagar esta inspiração?")) return;
        iniciar(async () => {
          const r = await apagarInspiracao(id, clientId);
          if (r?.erro) alert(r.erro);
          router.refresh();
        });
      }}
      className="text-[12px] text-muted hover:text-bad"
    >
      {pendente ? "Apagando…" : "Apagar"}
    </button>
  );
}
