"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Botao, classeEntrada } from "@/components/formulario";
import { BUCKET_CHAT } from "@/lib/constantes";
import { dataHoraSP } from "@/lib/dominio/tarefas";
import { diaMes, hojeSP } from "@/lib/datas";
import { criarClienteNavegador } from "@/lib/supabase/client";
import type { Anexo, MensagemChat } from "@/types/banco";
import { apagarMensagem, editarMensagem, enviarMensagem, marcarLido } from "./acoes";

type Pessoa = { id: string; nome: string; iniciais: string };

const TIPOS = [
  "image/jpeg", "image/png", "image/webp", "image/gif", "video/mp4", "video/quicktime", "application/pdf", "text/plain",
  "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint", "application/vnd.openxmlformats-officedocument.presentationml.presentation",
];
const LIMITE = 25 * 1024 * 1024;

const tamanho = (b: number) => (b > 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1).replace(".", ",")} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

// Texto com links clicáveis e @menções destacadas (sem HTML: o React escapa tudo)
function Texto({ texto }: { texto: string }) {
  const partes = texto.split(/(https?:\/\/[^\s]+|@[\p{L}\p{N}_]+)/u);
  return (
    <p className="whitespace-pre-wrap [overflow-wrap:anywhere]">
      {partes.map((p, i) =>
        /^https?:\/\//.test(p) ? (
          <a key={i} href={p} target="_blank" rel="noreferrer noopener" className="text-accent underline">
            {p}
          </a>
        ) : p.startsWith("@") ? (
          <span key={i} className="rounded bg-accent-soft px-0.5 font-medium text-accent">
            {p}
          </span>
        ) : (
          p
        ),
      )}
    </p>
  );
}

export function Conversa({
  canalId,
  titulo,
  iniciais,
  eu,
  podeApagarTudo,
  pessoas,
  arquivado,
}: {
  canalId: string;
  titulo: string;
  iniciais: MensagemChat[];
  eu: string;
  podeApagarTudo: boolean;
  pessoas: Pessoa[];
  arquivado?: boolean;
}) {
  const [mensagens, setMensagens] = useState(iniciais);
  const [texto, setTexto] = useState("");
  const [anexos, setAnexos] = useState<Anexo[]>([]);
  const [enviandoArquivo, setEnviandoArquivo] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [editando, setEditando] = useState<{ id: string; texto: string } | null>(null);
  const [links, setLinks] = useState<Record<string, string>>({});
  const [ocupado, iniciar] = useTransition();
  const lista = useRef<HTMLDivElement>(null);
  const campo = useRef<HTMLTextAreaElement>(null);
  const supabase = useMemo(() => criarClienteNavegador(), []);
  const porId = useMemo(() => new Map(pessoas.map((p) => [p.id, p])), [pessoas]);

  const rolarParaFim = () => requestAnimationFrame(() => lista.current?.scrollTo({ top: lista.current.scrollHeight }));

  // Tempo real: novas, editadas e apagadas aparecem sem recarregar (a RLS vale também aqui)
  useEffect(() => {
    let ativo = true;
    const canal = supabase.channel(`chat-${canalId}`);
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) supabase.realtime.setAuth(data.session.access_token);
      if (!ativo) return;
      canal
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_mensagens", filter: `canal_id=eq.${canalId}` }, (p) => {
          const nova = p.new as MensagemChat;
          setMensagens((m) => (m.some((x) => x.id === nova.id) ? m : [...m, nova]));
          rolarParaFim();
          if (nova.autor_id !== eu) marcarLido(canalId);
        })
        .on("postgres_changes", { event: "UPDATE", schema: "public", table: "chat_mensagens", filter: `canal_id=eq.${canalId}` }, (p) => {
          const nova = p.new as MensagemChat;
          setMensagens((m) => m.map((x) => (x.id === nova.id ? nova : x)));
        })
        .on("postgres_changes", { event: "DELETE", schema: "public", table: "chat_mensagens" }, (p) => {
          const id = (p.old as { id?: string }).id;
          if (id) setMensagens((m) => m.filter((x) => x.id !== id));
        })
        .subscribe();
    })();
    marcarLido(canalId);
    rolarParaFim();
    return () => {
      ativo = false;
      supabase.removeChannel(canal);
    };
  }, [canalId, eu, supabase]);

  // Links temporários dos anexos (gerados com a sessão de quem vê)
  useEffect(() => {
    const faltando = [...new Set(mensagens.flatMap((m) => m.anexos.map((a) => a.caminho)))].filter((c) => !links[c]);
    if (!faltando.length) return;
    supabase.storage
      .from(BUCKET_CHAT)
      .createSignedUrls(faltando, 3600)
      .then(({ data }) => {
        const novos: Record<string, string> = {};
        for (const d of data ?? []) if (d.path && d.signedUrl) novos[d.path] = d.signedUrl;
        setLinks((l) => ({ ...l, ...novos }));
      });
  }, [mensagens, links, supabase]);

  async function anexar(arquivos: FileList | null) {
    if (!arquivos?.length) return;
    setErro(null);
    for (const f of [...arquivos]) {
      if (!TIPOS.includes(f.type)) {
        setErro(`${f.name}: tipo de arquivo não aceito.`);
        continue;
      }
      if (f.size > LIMITE) {
        setErro(`${f.name} passa de 25 MB.`);
        continue;
      }
      setEnviandoArquivo(f.name);
      const seguro = f.name.normalize("NFD").replace(/[^\w.-]+/g, "_").slice(-80);
      const caminho = `${canalId}/${crypto.randomUUID()}-${seguro}`;
      const { error } = await supabase.storage.from(BUCKET_CHAT).upload(caminho, f, { contentType: f.type });
      if (error) setErro(`${f.name}: não foi possível enviar.`);
      else setAnexos((a) => [...a, { caminho, nome: f.name, tipo: f.type, tamanho: f.size }]);
    }
    setEnviandoArquivo(null);
  }

  const enviar = useCallback(() => {
    if (!texto.trim() && anexos.length === 0) return;
    const t = texto;
    const a = anexos;
    setTexto("");
    setAnexos([]);
    iniciar(async () => {
      const r = await enviarMensagem(canalId, t, a);
      if (r?.erro) {
        setErro(r.erro);
        setTexto(t);
        setAnexos(a);
      }
    });
  }, [texto, anexos, canalId]);

  // Sugestões de @menção enquanto digita
  const termo = /(^|\s)@([\p{L}\p{N}_]*)$/u.exec(texto)?.[2];
  const sugestoes =
    termo === undefined
      ? []
      : pessoas.filter((p) => p.id !== eu && p.nome.toLowerCase().startsWith(termo.toLowerCase())).slice(0, 5);
  const mencionar = (p: Pessoa) => {
    setTexto((t) => t.replace(/@[\p{L}\p{N}_]*$/u, `@${p.nome.split(" ")[0]} `));
    campo.current?.focus();
  };

  let diaAnterior = "";
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="flex items-center justify-between border-b border-line px-4 py-3.5">
        <h2 className="text-[15px] font-bold">{titulo}</h2>
        <span className="text-[12.5px] text-muted">{pessoas.length} pessoas</span>
      </div>

      <div ref={lista} className="flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto p-4">
        {mensagens.length === 0 && <p className="text-muted">Nenhuma mensagem ainda. Comece a conversa.</p>}
        {mensagens.map((m) => {
          const { data, hora } = dataHoraSP(m.created_at);
          const separador = data !== diaAnterior ? (data === hojeSP() ? "Hoje" : diaMes(data)) : null;
          diaAnterior = data;
          const autor = m.autor_id ? porId.get(m.autor_id) : null;
          const meu = m.autor_id === eu;
          return (
            <div key={m.id}>
              {separador && (
                <div className="mb-3 flex items-center gap-2 text-[11px] uppercase tracking-[0.08em] text-muted">
                  <span className="h-px flex-1 bg-line" />
                  {separador}
                  <span className="h-px flex-1 bg-line" />
                </div>
              )}
              <div className="group flex items-start gap-2.5">
                <span className="grid h-[26px] w-[26px] flex-none place-items-center rounded-full bg-ink text-[10.5px] font-semibold text-bg">
                  {autor?.iniciais ?? "?"}
                </span>
                <div className="min-w-0 flex-1 text-[13.5px]">
                  <div className="flex items-baseline gap-2">
                    <b className="text-[13px]">{m.autor_nome ?? autor?.nome ?? "Alguém"}</b>
                    <span className="font-mono text-[11px] text-muted">{hora}</span>
                    {m.editada_em && <span className="text-[11px] text-muted">(editada)</span>}
                    {(meu || podeApagarTudo) && editando?.id !== m.id && (
                      <span className="ml-auto hidden gap-2 text-[12px] group-hover:flex group-focus-within:flex">
                        {meu && (
                          <button onClick={() => setEditando({ id: m.id, texto: m.texto })} className="text-muted hover:text-ink">
                            Editar
                          </button>
                        )}
                        <button
                          onClick={() =>
                            confirm("Apagar esta mensagem?") &&
                            iniciar(async () => {
                              const r = await apagarMensagem(m.id);
                              if (r?.erro) setErro(r.erro);
                              else setMensagens((l) => l.filter((x) => x.id !== m.id));
                            })
                          }
                          className="text-bad hover:underline"
                        >
                          Apagar
                        </button>
                      </span>
                    )}
                  </div>
                  {editando?.id === m.id ? (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        const t = editando.texto;
                        iniciar(async () => {
                          const r = await editarMensagem(m.id, t);
                          if (r?.erro) setErro(r.erro);
                          else setEditando(null);
                        });
                      }}
                      className="mt-1 flex gap-2"
                    >
                      <input
                        autoFocus
                        value={editando.texto}
                        onChange={(e) => setEditando({ id: m.id, texto: e.target.value })}
                        aria-label="Editar mensagem"
                        className={classeEntrada}
                      />
                      <Botao pequeno variante="principal" disabled={ocupado}>
                        Salvar
                      </Botao>
                      <Botao type="button" pequeno variante="fantasma" onClick={() => setEditando(null)}>
                        Cancelar
                      </Botao>
                    </form>
                  ) : (
                    m.texto && <Texto texto={m.texto} />
                  )}
                  {m.anexos.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-2">
                      {m.anexos.map((a) =>
                        a.tipo.startsWith("image/") && links[a.caminho] ? (
                          <a key={a.caminho} href={links[a.caminho]} target="_blank" rel="noreferrer">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={links[a.caminho]} alt={a.nome} className="max-h-[180px] max-w-[240px] rounded-lg border border-line object-cover" />
                          </a>
                        ) : (
                          <a
                            key={a.caminho}
                            href={links[a.caminho] ?? "#"}
                            target="_blank"
                            rel="noreferrer"
                            className="flex max-w-[260px] items-center gap-2 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[12.5px] hover:border-muted"
                          >
                            <span aria-hidden="true">📎</span>
                            <span className="min-w-0 truncate">{a.nome}</span>
                            <span className="flex-none font-mono text-[11px] text-muted">{tamanho(a.tamanho)}</span>
                          </a>
                        ),
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {arquivado ? (
        <p className="border-t border-line px-4 py-3 text-[13px] text-muted">Canal arquivado: só leitura.</p>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            enviar();
          }}
          className="relative flex flex-col gap-2 border-t border-line p-3"
        >
          {sugestoes.length > 0 && (
            <ul className="absolute bottom-full left-3 mb-1 w-[220px] overflow-hidden rounded-lg border border-line bg-card shadow-pop">
              {sugestoes.map((p) => (
                <li key={p.id}>
                  <button type="button" onClick={() => mencionar(p)} className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] hover:bg-surface">
                    <span className="grid h-5 w-5 place-items-center rounded-full bg-ink text-[8px] font-semibold text-bg">{p.iniciais}</span>
                    {p.nome}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {erro && <p className="rounded-lg bg-bad-soft px-3 py-1.5 text-[12.5px] text-bad">{erro}</p>}
          {(anexos.length > 0 || enviandoArquivo) && (
            <div className="flex flex-wrap gap-2">
              {anexos.map((a) => (
                <span key={a.caminho} className="flex items-center gap-1.5 rounded-lg border border-line bg-surface px-2 py-1 text-[12px]">
                  📎 <span className="max-w-[160px] truncate">{a.nome}</span>
                  <button
                    type="button"
                    aria-label={`Tirar ${a.nome}`}
                    onClick={() => {
                      setAnexos((l) => l.filter((x) => x.caminho !== a.caminho));
                      supabase.storage.from(BUCKET_CHAT).remove([a.caminho]);
                    }}
                    className="text-muted hover:text-ink"
                  >
                    ×
                  </button>
                </span>
              ))}
              {enviandoArquivo && <span className="text-[12px] text-muted">Enviando {enviandoArquivo}…</span>}
            </div>
          )}
          <div className="flex items-end gap-2">
            <label className="grid h-[38px] w-[38px] flex-none cursor-pointer place-items-center rounded-lg border border-line hover:border-ink" title="Anexar arquivo">
              <span aria-hidden="true">📎</span>
              <span className="sr-only">Anexar arquivo</span>
              <input type="file" multiple accept={TIPOS.join(",")} onChange={(e) => anexar(e.target.files).then(() => (e.target.value = ""))} className="sr-only" />
            </label>
            <textarea
              ref={campo}
              rows={1}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (sugestoes.length && termo !== undefined) mencionar(sugestoes[0]);
                  else enviar();
                }
              }}
              placeholder={`Mensagem para ${titulo}`}
              aria-label={`Mensagem para ${titulo}`}
              className={`${classeEntrada} max-h-[140px] min-h-[38px] resize-none leading-[1.45]`}
            />
            <Botao variante="principal" disabled={ocupado || !!enviandoArquivo || (!texto.trim() && !anexos.length)}>
              Enviar
            </Botao>
          </div>
          <small className="text-[11.5px] text-muted">Enter envia · Shift+Enter quebra a linha · @ menciona alguém</small>
        </form>
      )}
    </div>
  );
}
