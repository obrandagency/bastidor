"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Botao, classeEntrada } from "@/components/formulario";
import { BUCKET_ARTES } from "@/lib/constantes";
import { proximaEtapa, rotuloEtapa, type Etapa } from "@/lib/dominio/tarefas";
import { criarClienteNavegador } from "@/lib/supabase/client";
import type { Estado } from "@/app/entrar/acoes";
import type { Nota } from "@/types/banco";
import { comentar, marcarResolvido, moverTarefa } from "../tarefas/acoes";
import { moverArte, registrarArte, removerArte, salvarLegenda } from "./acoes";

type ArteVista = { id: string; url: string | null; tipo: "imagem" | "video" };
type PostFeed = { id: string; titulo: string; url: string | null; tipo: "imagem" | "video" | null };

const TIPOS = ["image/jpeg", "image/png", "image/webp", "image/gif", "video/mp4", "video/quicktime"];
const LIMITE = 50 * 1024 * 1024;

function Ladrilho({ url, tipo, cor, titulo, destaque, vazio }: { url?: string | null; tipo?: string | null; cor: string; titulo?: string; destaque?: boolean; vazio?: boolean }) {
  return (
    <div
      className={`relative aspect-[4/5] overflow-hidden ${destaque ? "outline outline-[3px] -outline-offset-[3px] outline-accent" : ""} ${vazio ? "opacity-35" : ""}`}
      style={{ background: `linear-gradient(165deg, color-mix(in srgb, ${cor} 85%, white), color-mix(in srgb, ${cor} 45%, black))` }}
    >
      {url && tipo === "imagem" && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="absolute inset-0 h-full w-full object-cover" />
      )}
      {url && tipo === "video" && <video src={url} muted playsInline className="absolute inset-0 h-full w-full object-cover" />}
      {!url && titulo && <span className="absolute inset-x-1.5 bottom-1.5 font-display text-[7.5px] font-bold leading-[1.12] text-white">{titulo}</span>}
      {tipo === "video" && <span className="absolute right-1 top-1 text-[9px] text-white">▶</span>}
    </div>
  );
}

export function EditorCriacao({
  tarefa,
  artes,
  notas,
  autores,
  feed,
  cliente,
}: {
  tarefa: { id: string; titulo: string; texto: string; etapa: Etapa; detalhe: string; responsavel: string; clientId: string };
  artes: ArteVista[];
  notas: Nota[];
  autores: Record<string, string>;
  feed: PostFeed[];
  cliente: { nome: string; instagram: string | null; cor: string };
}) {
  const router = useRouter();
  const [aba, setAba] = useState<"legenda" | "interno" | "cliente">("legenda");
  const [legenda, setLegenda] = useState(tarefa.texto);
  const [aviso, setAviso] = useState<Estado>(undefined);
  const [enviando, setEnviando] = useState<string | null>(null);
  const [ocupado, iniciar] = useTransition();
  const [novo, setNovo] = useState("");
  const arquivo = useRef<HTMLInputElement>(null);

  // Trocou de conteúdo: começa do que está salvo
  useEffect(() => {
    setLegenda(tarefa.texto);
    setAviso(undefined);
  }, [tarefa.id, tarefa.texto]);

  const internas = notas.filter((n) => n.tipo === "interno");
  const doCliente = notas.filter((n) => n.tipo === "cliente");
  const proxima = proximaEtapa("conteudo", tarefa.etapa);
  const mudou = legenda !== tarefa.texto;
  const handle = cliente.instagram ?? cliente.nome.toLowerCase().replace(/\s+/g, "");

  async function enviar(arquivos: FileList | null) {
    if (!arquivos?.length) return;
    const supabase = criarClienteNavegador();
    for (const [i, f] of [...arquivos].entries()) {
      if (!TIPOS.includes(f.type)) {
        setAviso({ erro: `${f.name}: use JPG, PNG, WEBP, GIF, MP4 ou MOV.` });
        continue;
      }
      if (f.size > LIMITE) {
        setAviso({ erro: `${f.name} passa de 50 MB.` });
        continue;
      }
      setEnviando(`Enviando ${i + 1} de ${arquivos.length}…`);
      const ext = (f.name.split(".").pop() ?? "bin").toLowerCase();
      const caminho = `${tarefa.clientId}/${tarefa.id}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from(BUCKET_ARTES).upload(caminho, f, { contentType: f.type });
      if (error) {
        setAviso({ erro: `${f.name}: não foi possível enviar.` });
        continue;
      }
      const r = await registrarArte(tarefa.id, caminho, f.type.startsWith("video/") ? "video" : "imagem");
      if (r?.erro) setAviso(r);
    }
    setEnviando(null);
    if (arquivo.current) arquivo.current.value = "";
    router.refresh();
  }

  const executar = (acao: () => Promise<Estado>) =>
    iniciar(async () => {
      const r = await acao();
      if (r) setAviso(r);
    });

  const Notas = ({ lista }: { lista: Nota[] }) => (
    <div className="flex flex-col gap-2">
      {lista.map((n) => (
        <div
          key={n.id}
          className={`flex items-start gap-2.5 rounded-[10px] border px-[11px] py-[9px] ${n.tipo === "cliente" ? "border-bad/35 bg-bad-soft" : "border-line"} ${
            n.resolvido ? "opacity-55" : ""
          }`}
        >
          <input
            type="checkbox"
            aria-label="Marcar como resolvido"
            defaultChecked={n.resolvido}
            onChange={(e) => executar(() => marcarResolvido(n.id, e.target.checked))}
            className="mt-1 h-4 w-4 accent-[var(--color-accent)]"
          />
          <div className={`min-w-0 flex-1 text-[13px] [overflow-wrap:anywhere] ${n.resolvido ? "line-through" : ""}`}>
            <p className="whitespace-pre-line">{n.texto}</p>
            <small className="block text-[11.5px] text-muted">{n.tipo === "cliente" ? cliente.nome : n.autor_id ? autores[n.autor_id] : ""}</small>
          </div>
        </div>
      ))}
      {lista.length === 0 && <p className="text-[13px] text-muted">Nenhum por aqui.</p>}
    </div>
  );

  const abas: [typeof aba, string][] = [
    ["legenda", "Legenda"],
    ["interno", `Ajustes internos (${internas.filter((n) => !n.resolvido).length})`],
    ["cliente", `Ajustes do cliente (${doCliente.filter((n) => !n.resolvido).length})`],
  ];

  return (
    <>
      <section className="min-w-0 rounded-xl border border-line bg-card">
        <div className="flex flex-wrap items-start justify-between gap-2.5 border-b border-line px-4 py-3.5">
          <div className="min-w-0">
            <h2 className="text-[15px] font-bold [overflow-wrap:anywhere]">{tarefa.titulo}</h2>
            <div className="mt-0.5 text-[12.5px] text-muted">
              {tarefa.detalhe} · {rotuloEtapa(tarefa.etapa)} · {tarefa.responsavel}
            </div>
          </div>
          {proxima && (
            <Botao pequeno disabled={ocupado} onClick={() => executar(() => moverTarefa(tarefa.id, proxima))}>
              {rotuloEtapa(proxima)} ›
            </Botao>
          )}
        </div>

        <div className="flex flex-col gap-3.5 px-4 py-3.5">
          {aviso?.erro && <p className="rounded-lg bg-bad-soft px-3 py-2 text-[13px] text-bad">{aviso.erro}</p>}

          {/* Artes */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[11.5px] uppercase tracking-[0.04em] text-muted">Artes {artes.length > 1 ? "(carrossel)" : ""}</span>
              <label className="cursor-pointer rounded-lg border border-line px-2.5 py-[5px] text-[12.5px] font-medium hover:border-ink">
                {enviando ?? "+ Enviar arquivos"}
                <input
                  ref={arquivo}
                  type="file"
                  multiple
                  accept={TIPOS.join(",")}
                  disabled={!!enviando}
                  onChange={(e) => enviar(e.target.files)}
                  className="sr-only"
                />
              </label>
            </div>
            {artes.length === 0 ? (
              <p className="rounded-lg border border-dashed border-line px-3 py-4 text-center text-[12.5px] text-muted">
                Nenhuma arte ainda. Imagens ou vídeo, até 50 MB cada.
              </p>
            ) : (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {artes.map((a, i) => (
                  <div key={a.id} className="w-[96px] flex-none">
                    <div className="overflow-hidden rounded-md border border-line">
                      <Ladrilho url={a.url} tipo={a.tipo} cor={cliente.cor} />
                    </div>
                    <div className="mt-1 flex items-center justify-between text-[12px]">
                      <button aria-label="Mover para a esquerda" disabled={i === 0 || ocupado} onClick={() => executar(() => moverArte(a.id, -1))} className="px-1 text-muted disabled:opacity-30">
                        ‹
                      </button>
                      <button
                        aria-label="Remover arte"
                        disabled={ocupado}
                        onClick={() => confirm("Remover esta arte?") && executar(() => removerArte(a.id))}
                        className="text-bad hover:underline"
                      >
                        Remover
                      </button>
                      <button aria-label="Mover para a direita" disabled={i === artes.length - 1 || ocupado} onClick={() => executar(() => moverArte(a.id, 1))} className="px-1 text-muted disabled:opacity-30">
                        ›
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div role="tablist" className="inline-flex flex-wrap gap-0.5 self-start rounded-[9px] bg-surface p-[3px]">
            {abas.map(([id, rotulo]) => (
              <button
                key={id}
                role="tab"
                aria-selected={aba === id}
                onClick={() => setAba(id)}
                className={`rounded-[7px] px-3 py-[5px] text-[12.5px] font-medium ${aba === id ? "bg-card text-ink shadow-[0_1px_3px_rgba(0,0,0,.08)]" : "text-muted hover:text-ink"}`}
              >
                {rotulo}
              </button>
            ))}
          </div>

          {aba === "legenda" && (
            <div className="flex flex-col gap-[5px]">
              <label htmlFor="legenda" className="text-[11.5px] uppercase tracking-[0.04em] text-muted">
                Legenda
              </label>
              <textarea
                id="legenda"
                rows={9}
                value={legenda}
                onChange={(e) => setLegenda(e.target.value)}
                placeholder="Escreva a legenda aqui"
                className={`${classeEntrada} resize-y leading-[1.55]`}
              />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className={`font-mono text-[11.5px] ${legenda.length > 2200 ? "font-semibold text-bad" : "text-muted"}`}>
                  {legenda.length.toLocaleString("pt-BR")} / 2.200 caracteres
                </span>
                <div className="flex items-center gap-2">
                  {aviso?.ok && !mudou && <small className="text-[12.5px] text-ok">{aviso.ok}</small>}
                  <Botao variante="principal" pequeno disabled={ocupado || !mudou || legenda.length > 2200} onClick={() => executar(() => salvarLegenda(tarefa.id, legenda))}>
                    {mudou ? "Salvar legenda" : "Salva"}
                  </Botao>
                </div>
              </div>
            </div>
          )}
          {aba === "interno" && (
            <>
              <Notas lista={internas} />
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData();
                  f.set("task_id", tarefa.id);
                  f.set("texto", novo);
                  executar(async () => {
                    const r = await comentar(undefined, f);
                    if (r?.ok) setNovo("");
                    return r?.erro ? r : undefined;
                  });
                }}
                className="flex gap-2"
              >
                <input value={novo} onChange={(e) => setNovo(e.target.value)} required placeholder="Ex.: aumentar o contraste do título" aria-label="Novo ajuste interno" className={classeEntrada} />
                <Botao className="border-ink bg-ink text-bg" disabled={ocupado}>
                  Adicionar
                </Botao>
              </form>
            </>
          )}
          {aba === "cliente" && (
            <>
              <Notas lista={doCliente} />
              <p className="text-[12.5px] text-muted">Os pedidos do cliente chegam aqui pelo portal de aprovação.</p>
            </>
          )}
        </div>
      </section>

      {/* Prévia do feed do Instagram */}
      <section className="min-w-0 self-start rounded-[22px] border border-line bg-card p-3.5 shadow-pop">
        <div className="mb-3 flex items-center gap-2.5">
          <span
            className="h-11 w-11 flex-none rounded-full"
            style={{ background: `linear-gradient(165deg, color-mix(in srgb, ${cliente.cor} 80%, white), color-mix(in srgb, ${cliente.cor} 45%, black))` }}
          />
          <div className="min-w-0">
            <b className="block truncate text-[13px]">@{handle}</b>
            <span className="text-[12px] text-muted">Prévia do feed</span>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-0.5">
          <Ladrilho url={artes[0]?.url} tipo={artes[0]?.tipo} cor={cliente.cor} titulo={tarefa.titulo} destaque />
          {feed.slice(0, 8).map((p) => (
            <Ladrilho key={p.id} url={p.url} tipo={p.tipo} cor={cliente.cor} titulo={p.titulo} />
          ))}
          {Array.from({ length: Math.max(0, 8 - feed.length) }, (_, i) => (
            <Ladrilho key={`v${i}`} cor={cliente.cor} vazio />
          ))}
        </div>
        <div className="mt-3 max-h-[150px] overflow-auto whitespace-pre-wrap text-[12.5px] [overflow-wrap:anywhere]">
          <b>{handle}</b> {legenda || <span className="text-muted">A legenda aparece aqui.</span>}
        </div>
      </section>
    </>
  );
}
