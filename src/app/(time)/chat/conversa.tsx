"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Botao, classeEntrada } from "@/components/formulario";
import { Avatar } from "@/components/tarefa";
import { BUCKET_CHAT } from "@/lib/constantes";
import { dataHoraSP } from "@/lib/dominio/tarefas";
import { diaMes, hojeSP } from "@/lib/datas";
import { criarClienteNavegador } from "@/lib/supabase/client";
import type { Anexo, MensagemChat, ReacaoChat } from "@/types/banco";
import { apagarMensagem, buscarTarefas, editarMensagem, encaminhar, enviarMensagem, marcarLido, reagir } from "./acoes";
import { Gravador, tempo } from "./gravador";
import { SeletorEmoji } from "./seletor-emoji";

type Pessoa = { id: string; nome: string; iniciais: string; foto: string | null };

const TIPOS = [
  "image/jpeg", "image/png", "image/webp", "image/gif", "video/mp4", "video/quicktime", "application/pdf", "text/plain",
  "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint", "application/vnd.openxmlformats-officedocument.presentationml.presentation",
];
const LIMITE = 25 * 1024 * 1024;

const tamanho = (b: number) => (b > 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1).replace(".", ",")} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

// Tarefa mencionada: no banco vai como #[Título](id); na caixa de texto aparece só #Título
const TOKEN_TAREFA = /#\[([^\]]*)\]\(([0-9a-f-]{36})\)/g;
const tituloSeguro = (t: string) => t.replace(/[[\]()#\n]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);

// "#[Título](id)" -> "#Título" e o mapa título -> id (para editar e para mandar de volta)
function paraCaixa(texto: string) {
  const mapa: Record<string, string> = {};
  const limpo = texto.replace(TOKEN_TAREFA, (_, titulo: string, id: string) => {
    mapa[titulo] = id;
    return `#${titulo}`;
  });
  return { texto: limpo, mapa };
}
function paraBanco(texto: string, mapa: Record<string, string>) {
  // Títulos mais longos primeiro, para um não engolir o outro
  return Object.keys(mapa)
    .sort((a, b) => b.length - a.length)
    .reduce((t, titulo) => t.split(`#${titulo}`).join(`#[${titulo}](${mapa[titulo]})`), texto);
}

// Texto com links clicáveis, @menções e #tarefas destacadas (sem HTML: o React escapa tudo)
function Texto({ texto }: { texto: string }) {
  const partes = texto.split(/(#\[[^\]]*\]\([0-9a-f-]{36}\)|https?:\/\/[^\s]+|@[\p{L}\p{N}_]+)/u);
  return (
    <p className="whitespace-pre-wrap [overflow-wrap:anywhere]">
      {partes.map((p, i) =>
        p.startsWith("#[") ? (
          <Link key={i} href={`/tarefas?tarefa=${p.slice(-37, -1)}`} className="rounded bg-andamento-soft px-1 font-medium text-andamento hover:underline">
            #{p.slice(2, p.indexOf("]("))}
          </Link>
        ) : /^https?:\/\//.test(p) ? (
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
  reacoesIniciais,
  canais,
}: {
  canalId: string;
  titulo: string;
  iniciais: MensagemChat[];
  eu: string;
  podeApagarTudo: boolean;
  pessoas: Pessoa[];
  arquivado?: boolean;
  reacoesIniciais: ReacaoChat[];
  canais: { id: string; nome: string }[]; // destino do "Encaminhar"
}) {
  const [mensagens, setMensagens] = useState(iniciais);
  const [reacoes, setReacoes] = useState(reacoesIniciais);
  const [seletor, setSeletor] = useState<{ mensagemId: string; ancora: DOMRect } | null>(null);
  const [encaminhando, setEncaminhando] = useState<MensagemChat | null>(null);
  const [tarefasMarcadas, setTarefasMarcadas] = useState<Record<string, string>>({});
  const [sugestoesTarefa, setSugestoesTarefa] = useState<{ id: string; titulo: string; cliente: string }[]>([]);
  const [texto, setTexto] = useState("");
  const [anexos, setAnexos] = useState<Anexo[]>([]);
  const [enviandoArquivo, setEnviandoArquivo] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [editando, setEditando] = useState<{ id: string; texto: string; mapa: Record<string, string> } | null>(null);
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
        // Reações ao vivo (a lista guarda só as das mensagens que estão na tela)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_reacoes" }, (p) => {
          const r = p.new as ReacaoChat;
          setReacoes((l) => (l.some((x) => x.mensagem_id === r.mensagem_id && x.pessoa_id === r.pessoa_id && x.emoji === r.emoji) ? l : [...l, r]));
        })
        .on("postgres_changes", { event: "DELETE", schema: "public", table: "chat_reacoes" }, (p) => {
          const r = p.old as ReacaoChat;
          setReacoes((l) => l.filter((x) => !(x.mensagem_id === r.mensagem_id && x.pessoa_id === r.pessoa_id && x.emoji === r.emoji)));
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
    setTarefasMarcadas({});
    iniciar(async () => {
      const r = await enviarMensagem(canalId, paraBanco(t, tarefasMarcadas), a);
      if (r?.erro) {
        setErro(r.erro);
        setTexto(t);
        setAnexos(a);
      }
    });
  }, [texto, anexos, canalId, tarefasMarcadas]);

  // Áudio gravado: sobe para o Storage e vai como anexo
  async function enviarAudio(audio: Blob, tipo: string, segundos: number) {
    setErro(null);
    const ext = tipo.includes("mp4") || tipo.includes("aac") ? "m4a" : tipo.includes("ogg") ? "ogg" : "webm";
    const caminho = `${canalId}/${crypto.randomUUID()}-audio.${ext}`;
    const { error } = await supabase.storage.from(BUCKET_CHAT).upload(caminho, audio, { contentType: tipo });
    if (error) {
      setErro("Não foi possível enviar o áudio.");
      return;
    }
    const r = await enviarMensagem(canalId, "", [{ caminho, nome: "Áudio", tipo, tamanho: audio.size, duracao: segundos }]);
    if (r?.erro) setErro(r.erro);
  }

  function alternarReacao(mensagemId: string, emoji: string) {
    const minha = reacoes.some((r) => r.mensagem_id === mensagemId && r.pessoa_id === eu && r.emoji === emoji);
    // Mostra na hora; o banco confirma (e o tempo real avisa os outros)
    setReacoes((l) => (minha ? l.filter((r) => !(r.mensagem_id === mensagemId && r.pessoa_id === eu && r.emoji === emoji)) : [...l, { mensagem_id: mensagemId, pessoa_id: eu, emoji }]));
    iniciar(async () => {
      const r = await reagir(mensagemId, emoji, !minha);
      if (r?.erro) setErro(r.erro);
    });
  }
  const escolherEmoji = useCallback(
    (emoji: string) => {
      if (seletor) alternarReacao(seletor.mensagemId, emoji);
      setSeletor(null);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [seletor, reacoes],
  );
  const fecharSeletor = useCallback(() => setSeletor(null), []);

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

  // # abre a busca de tarefas (título ou cliente) enquanto digita
  const termoTarefa = /(^|\s)#([^#\n]{0,40})$/u.exec(texto)?.[2];
  useEffect(() => {
    if (termoTarefa === undefined) {
      setSugestoesTarefa([]);
      return;
    }
    const t = setTimeout(() => buscarTarefas(termoTarefa).then(setSugestoesTarefa), 200);
    return () => clearTimeout(t);
  }, [termoTarefa]);
  const mencionarTarefa = (tarefa: { id: string; titulo: string }) => {
    const titulo = tituloSeguro(tarefa.titulo) || "Tarefa";
    setTexto((t) => t.replace(/#[^#\n]{0,40}$/u, `#${titulo} `));
    setTarefasMarcadas((m) => ({ ...m, [titulo]: tarefa.id }));
    setSugestoesTarefa([]);
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
                <Avatar iniciais={autor?.iniciais ?? "?"} nome={autor?.nome} foto={autor?.foto} />
                <div className="min-w-0 flex-1 text-[13.5px]">
                  <div className="flex items-baseline gap-2">
                    <b className="text-[13px]">{m.autor_nome ?? autor?.nome ?? "Alguém"}</b>
                    <span className="font-mono text-[11px] text-muted">{hora}</span>
                    {m.editada_em && <span className="text-[11px] text-muted">(editada)</span>}
                    {editando?.id !== m.id && (
                      <span className="ml-auto flex gap-2.5 text-[12px] opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 [@media(hover:none)]:opacity-100">
                        <button onClick={(e) => setSeletor({ mensagemId: m.id, ancora: e.currentTarget.getBoundingClientRect() })} className="text-muted hover:text-ink" title="Reagir">
                          😊+
                        </button>
                        {!arquivado && (
                          <button onClick={() => setEncaminhando(m)} className="text-muted hover:text-ink">
                            Encaminhar
                          </button>
                        )}
                        {meu && !m.encaminhada && (
                          <button onClick={() => setEditando({ id: m.id, ...paraCaixa(m.texto) })} className="text-muted hover:text-ink">
                            Editar
                          </button>
                        )}
                        {(meu || podeApagarTudo) && (
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
                        )}
                      </span>
                    )}
                  </div>
                  {editando?.id === m.id ? (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        const t = paraBanco(editando.texto, editando.mapa);
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
                        onChange={(e) => setEditando({ ...editando, texto: e.target.value })}
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
                    <div className={m.encaminhada ? "mt-0.5 border-l-2 border-line pl-2.5" : ""}>
                      {m.encaminhada && (
                        <div className="mb-0.5 text-[11.5px] text-muted">
                          ↪ Encaminhada de #{m.encaminhada.canal}
                          {m.encaminhada.autor ? ` · ${m.encaminhada.autor}` : ""}
                        </div>
                      )}
                      {m.texto && <Texto texto={m.texto} />}
                    </div>
                  )}
                  {m.anexos.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-2">
                      {m.anexos.map((a) =>
                        a.tipo.startsWith("audio/") ? (
                          <span key={a.caminho} className="flex items-center gap-2 rounded-full border border-line bg-surface py-1 pl-1 pr-3">
                            {links[a.caminho] ? <audio controls preload="metadata" src={links[a.caminho]} className="h-8 w-[240px] max-w-full" /> : <span className="px-2 text-[12px] text-muted">Carregando áudio…</span>}
                            {a.duracao ? <span className="font-mono text-[11px] text-muted">{tempo(a.duracao)}</span> : null}
                          </span>
                        ) : a.tipo.startsWith("image/") && links[a.caminho] ? (
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
                  <Reacoes
                    lista={reacoes.filter((r) => r.mensagem_id === m.id)}
                    eu={eu}
                    nomeDe={(id) => porId.get(id)?.nome ?? "Alguém"}
                    alternar={(emoji) => alternarReacao(m.id, emoji)}
                    abrirSeletor={(ancora) => setSeletor({ mensagemId: m.id, ancora })}
                  />
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
                    <Avatar iniciais={p.iniciais} foto={p.foto} classe="h-5 w-5 text-[8px]" />
                    {p.nome}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {sugestoesTarefa.length > 0 && (
            <ul className="absolute bottom-full left-3 mb-1 w-[min(360px,calc(100%-24px))] overflow-hidden rounded-lg border border-line bg-card shadow-pop">
              <li className="border-b border-line px-3 py-1.5 text-[11px] uppercase tracking-[0.08em] text-muted">Mencionar tarefa</li>
              {sugestoesTarefa.map((t) => (
                <li key={t.id}>
                  <button type="button" onClick={() => mencionarTarefa(t)} className="flex w-full items-baseline gap-2 px-3 py-2 text-left text-[13px] hover:bg-surface">
                    <span className="font-medium text-andamento">#</span>
                    <span className="min-w-0 flex-1 truncate">{t.titulo}</span>
                    <span className="flex-none text-[11.5px] text-muted">{t.cliente}</span>
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
                  else if (sugestoesTarefa.length && termoTarefa !== undefined) mencionarTarefa(sugestoesTarefa[0]);
                  else enviar();
                }
              }}
              placeholder={`Mensagem para ${titulo}`}
              aria-label={`Mensagem para ${titulo}`}
              className={`${classeEntrada} max-h-[140px] min-h-[38px] resize-none leading-[1.45]`}
            />
            <Gravador enviar={enviarAudio} desabilitado={!!enviandoArquivo} />
            <Botao variante="principal" disabled={ocupado || !!enviandoArquivo || (!texto.trim() && !anexos.length)}>
              Enviar
            </Botao>
          </div>
          <small className="text-[11.5px] text-muted">Enter envia · Shift+Enter quebra a linha · @ menciona alguém · # menciona uma tarefa</small>
        </form>
      )}

      {seletor && <SeletorEmoji ancora={seletor.ancora} escolher={escolherEmoji} fechar={fecharSeletor} />}
      {encaminhando && (
        <Encaminhar
          mensagem={encaminhando}
          canais={canais}
          fechar={() => setEncaminhando(null)}
        />
      )}
    </div>
  );
}

// Reações embaixo da mensagem: emoji, quantidade e quem reagiu (ao passar o mouse); clicar liga ou desliga a minha
function Reacoes({
  lista,
  eu,
  nomeDe,
  alternar,
  abrirSeletor,
}: {
  lista: ReacaoChat[];
  eu: string;
  nomeDe: (id: string) => string;
  alternar: (emoji: string) => void;
  abrirSeletor: (ancora: DOMRect) => void;
}) {
  if (!lista.length) return null;
  const grupos = [...new Set(lista.map((r) => r.emoji))].map((emoji) => ({ emoji, pessoas: lista.filter((r) => r.emoji === emoji).map((r) => r.pessoa_id) }));
  return (
    <div className="mt-1.5 flex flex-wrap gap-1">
      {grupos.map((g) => {
        const minha = g.pessoas.includes(eu);
        return (
          <button
            key={g.emoji}
            type="button"
            onClick={() => alternar(g.emoji)}
            title={g.pessoas.map((p) => (p === eu ? "Você" : nomeDe(p))).join(", ")}
            aria-pressed={minha}
            className={`flex items-center gap-1 rounded-full border px-2 py-px text-[13px] ${minha ? "border-accent bg-accent-soft" : "border-line bg-card hover:border-muted"}`}
          >
            <span>{g.emoji}</span>
            <span className={`font-mono text-[11px] ${minha ? "text-accent" : "text-muted"}`}>{g.pessoas.length}</span>
          </button>
        );
      })}
      <button
        type="button"
        onClick={(e) => abrirSeletor(e.currentTarget.getBoundingClientRect())}
        aria-label="Adicionar reação"
        className="rounded-full border border-dashed border-line px-2 py-px text-[12px] text-muted hover:border-muted"
      >
        +
      </button>
    </div>
  );
}

function Encaminhar({ mensagem, canais, fechar }: { mensagem: MensagemChat; canais: { id: string; nome: string }[]; fechar: () => void }) {
  const [destino, setDestino] = useState(canais.find((c) => c.id !== mensagem.canal_id)?.id ?? canais[0]?.id ?? "");
  const [comentario, setComentario] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [pendente, iniciar] = useTransition();
  const previa = paraCaixa(mensagem.texto).texto;
  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-[rgba(5,7,11,.45)] px-4" onClick={fechar}>
      <form
        role="dialog"
        aria-modal="true"
        aria-label="Encaminhar mensagem"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          iniciar(async () => {
            const r = await encaminhar(mensagem.id, destino, comentario);
            if (r?.erro) setErro(r.erro);
            else {
              setOk(true);
              setTimeout(fechar, 900);
            }
          });
        }}
        className="flex w-full max-w-[440px] flex-col gap-3 rounded-xl bg-card p-5 shadow-pop"
      >
        <h2 className="text-[17px] font-bold">Encaminhar mensagem</h2>
        <div className="rounded-lg border-l-2 border-line bg-surface px-3 py-2 text-[13px]">
          <div className="mb-0.5 text-[11.5px] text-muted">{mensagem.encaminhada?.autor ?? mensagem.autor_nome ?? "Alguém"}</div>
          <p className="line-clamp-4 whitespace-pre-wrap [overflow-wrap:anywhere]">{previa || (mensagem.anexos.length ? `${mensagem.anexos.length} anexo(s)` : "")}</p>
        </div>
        <label className="flex flex-col gap-[5px] text-[11.5px] uppercase tracking-[0.04em] text-muted">
          Para o canal
          <select value={destino} onChange={(e) => setDestino(e.target.value)} className={`${classeEntrada} normal-case tracking-normal text-ink`}>
            {canais.map((c) => (
              <option key={c.id} value={c.id}>
                #{c.nome}
              </option>
            ))}
          </select>
        </label>
        <textarea
          value={comentario}
          onChange={(e) => setComentario(e.target.value)}
          rows={2}
          maxLength={4000}
          placeholder="Comentário (opcional)"
          aria-label="Comentário"
          className={`${classeEntrada} resize-y`}
        />
        {erro && <p className="text-[12.5px] text-bad">{erro}</p>}
        <div className="flex gap-2">
          <Botao variante="principal" disabled={pendente || !destino || ok}>
            {ok ? "Encaminhada ✓" : pendente ? "Encaminhando…" : "Encaminhar"}
          </Botao>
          <Botao type="button" variante="fantasma" onClick={fechar}>
            Cancelar
          </Botao>
        </div>
      </form>
    </div>
  );
}
