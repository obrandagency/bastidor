"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { adiarLembrete, apagarLembrete, concluirLembrete, dispararLembretes, salvarLembrete, type Lembrete, type Repetir } from "@/app/(time)/lembretes/acoes";
import { classeEntrada } from "@/components/formulario";

type Opcao = { id: string; nome: string };

const REPETIR: { id: Repetir; rotulo: string }[] = [
  { id: "nunca", rotulo: "Não repetir" },
  { id: "diario", rotulo: "Todo dia" },
  { id: "dias_uteis", rotulo: "Dias úteis" },
  { id: "semanal", rotulo: "Toda semana" },
];

// Data e hora em São Paulo, no formato dos campos (aaaa-mm-dd e hh:mm)
function emSP(d: Date) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(d)
      .map((x) => [x.type, x.value]),
  );
  return { data: `${p.year}-${p.month}-${p.day}`, hora: `${p.hour}:${p.minute}` };
}

function quandoTexto(iso: string, agora: Date) {
  const q = emSP(new Date(iso));
  const hoje = emSP(agora).data;
  const amanha = emSP(new Date(agora.getTime() + 86_400_000)).data;
  const dia = q.data === hoje ? "Hoje" : q.data === amanha ? "Amanhã" : q.data.split("-").reverse().slice(0, 2).join("/");
  return `${dia} ${q.hora}`;
}

// Bipe curto (sem arquivo de som)
function bipe() {
  try {
    const ctx = new AudioContext();
    [0, 0.18].forEach((t) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = 880;
      g.gain.setValueAtTime(0.0001, ctx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + 0.15);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + t);
      o.stop(ctx.currentTime + t + 0.16);
    });
  } catch {
    // sem som: o aviso na tela continua
  }
}

function IconeLembrete({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={`fill-none stroke-current ${className}`} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="13" r="7.5" />
      <path d="M12 9.5V13l2.5 1.5M4.5 4.5l2.5-2M19.5 4.5l-2.5-2" />
    </svg>
  );
}

type Form = { id?: string; texto: string; data: string; hora: string; repetir: Repetir; client_id: string; ligarTarefa: boolean };

export function Lembretes({ lembretes, clientes }: { lembretes: Lembrete[]; clientes: Opcao[] }) {
  const busca = useSearchParams();
  const tarefaAberta = busca.get("tarefa");
  const [agora, setAgora] = useState(() => new Date());
  const [aberto, setAberto] = useState(false);
  const [dispensados, setDispensados] = useState<string[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  const [permissao, setPermissao] = useState<NotificationPermission | "indisponivel">("indisponivel");
  const tocados = useRef(new Set<string>());

  const vazio = useCallback((): Form => {
    const daquiUmaHora = emSP(new Date(Date.now() + 3_600_000));
    return { texto: "", data: daquiUmaHora.data, hora: daquiUmaHora.hora, repetir: "nunca", client_id: "", ligarTarefa: false };
  }, []);
  const [form, setForm] = useState<Form>(vazio);

  useEffect(() => {
    if (typeof Notification !== "undefined") setPermissao(Notification.permission);
  }, []);

  // Relógio: acorda a cada 20 s e exatamente na hora do próximo lembrete
  const proximo = useMemo(() => lembretes.map((l) => new Date(l.quando).getTime()).filter((t) => t > agora.getTime()).sort((a, b) => a - b)[0], [lembretes, agora]);
  useEffect(() => {
    const intervalo = setInterval(() => setAgora(new Date()), 20_000);
    const exato = proximo ? setTimeout(() => setAgora(new Date()), Math.min(proximo - Date.now() + 200, 2_000_000_000)) : undefined;
    return () => {
      clearInterval(intervalo);
      if (exato) clearTimeout(exato);
    };
  }, [proximo]);

  const vencidos = lembretes.filter((l) => new Date(l.quando) <= agora);
  const hojeSP = emSP(agora).data;
  const deHoje = lembretes.filter((l) => new Date(l.quando) > agora && emSP(new Date(l.quando)).data === hojeSP);
  const proximos = lembretes.filter((l) => new Date(l.quando) > agora && emSP(new Date(l.quando)).data !== hojeSP);
  const naTela = vencidos.filter((l) => !dispensados.includes(l.id + l.quando)).slice(0, 3);

  // Chegou a hora: som, notificação do sistema e sino (uma vez por lembrete e horário)
  useEffect(() => {
    const novos = vencidos.filter((l) => !l.avisado_em && !tocados.current.has(l.id + l.quando));
    if (!novos.length) return;
    novos.forEach((l) => tocados.current.add(l.id + l.quando));
    bipe();
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      novos.forEach((l) => {
        const n = new Notification("Lembrete", { body: l.texto, tag: `lembrete-${l.id}` });
        n.onclick = () => {
          window.focus();
          n.close();
        };
      });
    }
    void dispararLembretes();
  }, [vencidos]);

  const nomeCliente = (id: string | null) => (id ? clientes.find((c) => c.id === id)?.nome : null);
  const rodar = (f: () => Promise<{ erro?: string } | undefined | void>) =>
    iniciar(async () => {
      const r = await f();
      setErro((r && r.erro) || null);
    });

  function salvar(e: React.FormEvent) {
    e.preventDefault();
    rodar(async () => {
      const r = await salvarLembrete({
        id: form.id,
        texto: form.texto,
        data: form.data,
        hora: form.hora,
        repetir: form.repetir,
        client_id: form.client_id || null,
        task_id: form.ligarTarefa && tarefaAberta ? tarefaAberta : null,
      });
      if (!r?.erro) setForm(vazio());
      return r;
    });
  }

  function atalho(min: number | { dia: 0 | 1; hora: string }) {
    const alvo = typeof min === "number" ? emSP(new Date(Date.now() + min * 60_000)) : { data: emSP(new Date(Date.now() + min.dia * 86_400_000)).data, hora: min.hora };
    setForm((f) => ({ ...f, data: alvo.data, hora: alvo.hora }));
  }

  const Item = ({ l, atrasado }: { l: Lembrete; atrasado?: boolean }) => (
    <li className="flex flex-col gap-1 border-t border-line px-3 py-2.5 first:border-t-0">
      <div className="flex items-start gap-2">
        <button
          type="button"
          onClick={() => rodar(() => concluirLembrete(l.id))}
          aria-label={`Concluir: ${l.texto}`}
          title={l.repetir === "nunca" ? "Concluir" : "Feito por hoje (volta na próxima vez)"}
          className="mt-0.5 grid h-[18px] w-[18px] flex-none place-items-center rounded-full border border-muted text-[11px] text-transparent hover:border-ok hover:text-ok"
        >
          ✓
        </button>
        <div className="min-w-0 flex-1">
          <div className="text-[13px] [overflow-wrap:anywhere]">{l.texto}</div>
          <div className={`text-[11.5px] ${atrasado ? "font-semibold text-bad" : "text-muted"}`}>
            {quandoTexto(l.quando, agora)}
            {l.repetir !== "nunca" && ` · ↻ ${REPETIR.find((r) => r.id === l.repetir)?.rotulo.toLowerCase()}`}
            {nomeCliente(l.client_id) && ` · ${nomeCliente(l.client_id)}`}
          </div>
        </div>
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 pl-[26px] text-[11.5px] text-muted">
        {l.task_id && (
          <Link href={`/tarefas?tarefa=${l.task_id}`} scroll={false} className="text-accent hover:underline">
            Abrir tarefa
          </Link>
        )}
        <button type="button" onClick={() => rodar(() => adiarLembrete(l.id, 10))} className="hover:text-ink">
          +10 min
        </button>
        <button type="button" onClick={() => rodar(() => adiarLembrete(l.id, 60))} className="hover:text-ink">
          +1 h
        </button>
        <button type="button" onClick={() => rodar(() => adiarLembrete(l.id, "amanha"))} className="hover:text-ink">
          Amanhã 9h
        </button>
        <button
          type="button"
          onClick={() => {
            const q = emSP(new Date(l.quando));
            setForm({ id: l.id, texto: l.texto, data: q.data, hora: q.hora, repetir: l.repetir, client_id: l.client_id ?? "", ligarTarefa: !!l.task_id });
          }}
          className="hover:text-ink"
        >
          Editar
        </button>
        <button type="button" onClick={() => confirm("Apagar este lembrete?") && rodar(() => apagarLembrete(l.id))} className="text-bad hover:underline">
          Apagar
        </button>
      </div>
    </li>
  );

  const fundoBotao = "bottom-[calc(18px+env(safe-area-inset-bottom,0px))] right-[18px]";

  return (
    <>
      {/* Avisos na hora marcada */}
      {/* Com o painel aberto os atrasados já aparecem na lista */}
      {naTela.length > 0 && !aberto && (
        <div className={`fixed z-[70] flex w-[min(340px,calc(100vw-36px))] flex-col gap-2 ${fundoBotao} mb-[64px]`} role="alert">
          {naTela.map((l) => (
            <div key={l.id + l.quando} className="rounded-xl border border-accent bg-card p-3 shadow-pop">
              <div className="flex items-start gap-2">
                <IconeLembrete className="mt-0.5 h-[18px] w-[18px] flex-none text-accent" />
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] uppercase tracking-[0.06em] text-accent">Lembrete · {quandoTexto(l.quando, agora)}</div>
                  <div className="font-medium [overflow-wrap:anywhere]">{l.texto}</div>
                </div>
                <button type="button" onClick={() => setDispensados((d) => [...d, l.id + l.quando])} aria-label="Esconder" className="px-1 text-muted hover:text-ink">
                  ✕
                </button>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5 pl-[26px]">
                <button type="button" disabled={pendente} onClick={() => rodar(() => concluirLembrete(l.id))} className="rounded-lg border border-accent bg-accent px-2.5 py-1 text-[12.5px] font-medium text-accent-ink">
                  Concluir
                </button>
                <button type="button" disabled={pendente} onClick={() => rodar(() => adiarLembrete(l.id, 10))} className="rounded-lg border border-line px-2.5 py-1 text-[12.5px] hover:border-ink">
                  +10 min
                </button>
                <button type="button" disabled={pendente} onClick={() => rodar(() => adiarLembrete(l.id, 60))} className="rounded-lg border border-line px-2.5 py-1 text-[12.5px] hover:border-ink">
                  +1 h
                </button>
                {l.task_id && (
                  <Link href={`/tarefas?tarefa=${l.task_id}`} scroll={false} className="rounded-lg px-2 py-1 text-[12.5px] text-accent hover:underline">
                    Abrir tarefa
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Painel */}
      {aberto && (
        <section
          aria-label="Lembretes"
          className="fixed bottom-[calc(84px+env(safe-area-inset-bottom,0px))] right-[18px] z-[60] flex max-h-[min(640px,calc(100dvh-120px))] w-[min(380px,calc(100vw-36px))] flex-col overflow-hidden rounded-xl border border-line bg-card shadow-pop"
        >
          <form onSubmit={salvar} className="flex flex-col gap-2 border-b border-line bg-surface p-3">
            <div className="flex items-center justify-between">
              <b className="text-[14px]">{form.id ? "Editar lembrete" : "Novo lembrete"}</b>
              {form.id && (
                <button type="button" onClick={() => setForm(vazio())} className="text-[12px] text-muted hover:text-ink">
                  Cancelar edição
                </button>
              )}
            </div>
            <input
              value={form.texto}
              onChange={(e) => setForm((f) => ({ ...f, texto: e.target.value }))}
              maxLength={300}
              required
              autoFocus
              placeholder="Ex.: Enviar mensagem para a Ótica Visão"
              aria-label="Lembrete"
              className={`${classeEntrada} !py-1.5`}
            />
            <div className="flex flex-wrap gap-1.5 text-[12px]">
              {[
                ["Em 30 min", () => atalho(30)],
                ["Em 1 h", () => atalho(60)],
                [emSP(new Date()).hora < "16:00" ? "Hoje 16h" : "Amanhã 16h", () => atalho({ dia: emSP(new Date()).hora < "16:00" ? 0 : 1, hora: "16:00" })],
                ["Amanhã 9h", () => atalho({ dia: 1, hora: "09:00" })],
              ].map(([rotulo, f]) => (
                <button key={rotulo as string} type="button" onClick={f as () => void} className="rounded-full border border-line bg-card px-2.5 py-0.5 hover:border-ink">
                  {rotulo as string}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-[1fr_96px] gap-2">
              <input type="date" required value={form.data} onChange={(e) => setForm((f) => ({ ...f, data: e.target.value }))} aria-label="Dia" className={`${classeEntrada} !py-1.5`} />
              <input type="time" required value={form.hora} onChange={(e) => setForm((f) => ({ ...f, hora: e.target.value }))} aria-label="Hora" className={`${classeEntrada} !py-1.5`} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <select value={form.repetir} onChange={(e) => setForm((f) => ({ ...f, repetir: e.target.value as Repetir }))} aria-label="Repetir" className={`${classeEntrada} !py-1.5 text-[13px]`}>
                {REPETIR.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.rotulo}
                  </option>
                ))}
              </select>
              <select value={form.client_id} onChange={(e) => setForm((f) => ({ ...f, client_id: e.target.value }))} aria-label="Cliente" className={`${classeEntrada} !py-1.5 text-[13px]`}>
                <option value="">Sem cliente</option>
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
            </div>
            {tarefaAberta && (
              <label className="flex items-center gap-2 text-[12.5px]">
                <input type="checkbox" checked={form.ligarTarefa} onChange={(e) => setForm((f) => ({ ...f, ligarTarefa: e.target.checked }))} className="h-4 w-4" />
                Ligar à tarefa aberta agora
              </label>
            )}
            {erro && <small className="text-[12px] text-bad">{erro}</small>}
            <button disabled={pendente} className="rounded-lg border border-accent bg-accent px-3 py-1.5 text-[13px] font-medium text-accent-ink disabled:opacity-60">
              {pendente ? "Salvando…" : form.id ? "Salvar alterações" : "Criar lembrete"}
            </button>
          </form>

          <div className="overflow-y-auto">
            {permissao === "default" && (
              <button
                type="button"
                onClick={async () => setPermissao(await Notification.requestPermission())}
                className="w-full border-b border-line bg-accent-soft px-3 py-2 text-left text-[12.5px] text-accent"
              >
                Ativar avisos do navegador, para ver o lembrete mesmo em outra aba
              </button>
            )}
            {permissao === "denied" && (
              <p className="border-b border-line px-3 py-2 text-[12px] text-muted">Os avisos do navegador estão bloqueados para este site. O lembrete aparece na tela do Bastidor.</p>
            )}
            {[
              ["Atrasados", vencidos, true],
              ["Hoje", deHoje, false],
              ["Próximos", proximos, false],
            ].map(([titulo, lista, atrasado]) =>
              (lista as Lembrete[]).length ? (
                <div key={titulo as string}>
                  <div className="bg-card px-3 pt-2.5 text-[10.5px] uppercase tracking-[0.1em] text-muted">{titulo as string}</div>
                  <ul>
                    {(lista as Lembrete[]).map((l) => (
                      <Item key={l.id} l={l} atrasado={atrasado as boolean} />
                    ))}
                  </ul>
                </div>
              ) : null,
            )}
            {!lembretes.length && <p className="px-3 py-4 text-[12.5px] text-muted">Nenhum lembrete. Só você vê os seus.</p>}
          </div>
        </section>
      )}

      {/* Botão flutuante */}
      <button
        type="button"
        onClick={() => setAberto((a) => !a)}
        aria-expanded={aberto}
        aria-label={aberto ? "Fechar lembretes" : "Lembretes"}
        title="Lembretes"
        className={`fixed ${fundoBotao} z-[60] grid h-[52px] w-[52px] place-items-center rounded-full bg-accent text-accent-ink shadow-pop hover:border-accent-hover hover:bg-accent-hover print:hidden`}
      >
        {aberto ? <span className="text-[20px] leading-none">✕</span> : <IconeLembrete className="h-6 w-6" />}
        {!aberto && vencidos.length + deHoje.length > 0 && (
          <span className={`absolute -right-1 -top-1 grid h-[20px] min-w-[20px] place-items-center rounded-full px-1 font-mono text-[11px] font-semibold text-white ${vencidos.length ? "bg-bad" : "bg-ink"}`}>
            {vencidos.length + deHoje.length}
          </span>
        )}
      </button>
    </>
  );
}
