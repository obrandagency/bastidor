"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState, useTransition } from "react";
import { Aviso } from "@/components/formulario";
import { Avatar } from "@/components/tarefa";
import { apagarContagem, corrigirContagem, iniciarContagem, lancarTempo, pararContagem } from "../rastreador/acoes";
import { duracao, relogio, segundosEntre } from "@/lib/dominio/tempo";

export type RegistroTempo = {
  id: string;
  pessoa: { id: string; nome: string; iniciais: string; foto: string | null } | null;
  inicio: string;
  fim: string | null;
  manual: boolean;
  nota: string | null;
  data: string; // AAAA-MM-DD em São Paulo
  hora: string; // HH:MM em São Paulo
  horaFim: string;
};

const entrada = "rounded-lg border border-line bg-card px-2.5 py-1.5 text-[13px] outline-none focus:border-accent";

// Data, hora de início, duração e nota (lançar e corrigir usam o mesmo formulário)
function FormPeriodo({
  acao,
  rotulo,
  oculto,
  inicial,
  cancelar,
}: {
  acao: (_: Awaited<ReturnType<typeof lancarTempo>>, f: FormData) => ReturnType<typeof lancarTempo>;
  rotulo: string;
  oculto: Record<string, string>;
  inicial: { data: string; hora: string; duracao: string; nota: string };
  cancelar: () => void;
}) {
  const router = useRouter();
  const [estado, enviar, enviando] = useActionState(acao, undefined);
  useEffect(() => {
    if (estado?.ok) {
      cancelar();
      router.refresh();
    }
  }, [estado, cancelar, router]);
  return (
    <form action={enviar} className="flex flex-col gap-2 rounded-lg border border-line bg-surface p-3">
      {Object.entries(oculto).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      {estado?.erro && <Aviso tom="erro">{estado.erro}</Aviso>}
      <div className="grid grid-cols-3 gap-2">
        <label className="flex min-w-0 flex-col gap-1 text-[11.5px] text-muted">
          Dia
          <input type="date" name="data" required defaultValue={inicial.data} className={entrada} />
        </label>
        <label className="flex min-w-0 flex-col gap-1 text-[11.5px] text-muted">
          Começou
          <input type="time" name="hora" required defaultValue={inicial.hora} className={entrada} />
        </label>
        <label className="flex min-w-0 flex-col gap-1 text-[11.5px] text-muted">
          Duração
          <input name="duracao" required defaultValue={inicial.duracao} placeholder="1h30" className={`${entrada} font-mono`} />
        </label>
      </div>
      <input name="nota" defaultValue={inicial.nota} maxLength={500} placeholder="O que foi feito (opcional)" className={entrada} />
      <div className="flex justify-end gap-2">
        <button type="button" onClick={cancelar} className="rounded-lg px-3 py-1.5 text-[13px] text-muted hover:bg-card hover:text-ink">
          Cancelar
        </button>
        <button disabled={enviando} className="rounded-lg border border-accent bg-accent px-3 py-1.5 text-[13px] font-medium text-accent-ink hover:bg-accent-hover disabled:opacity-60">
          {enviando ? "Salvando…" : rotulo}
        </button>
      </div>
    </form>
  );
}

// Seção "Tempo" no detalhe da tarefa
export function TempoTarefa({
  taskId,
  registros,
  eu,
  socio,
  hoje,
}: {
  taskId: string;
  registros: RegistroTempo[];
  eu: string;
  socio: boolean;
  hoje: string;
}) {
  const router = useRouter();
  const [agora, setAgora] = useState<number | null>(null); // só no navegador, para não quebrar a hidratação
  const [lancando, setLancando] = useState(false);
  const [corrigindo, setCorrigindo] = useState<string | null>(null);
  const [todos, setTodos] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  const minhaLigada = registros.find((r) => !r.fim && r.pessoa?.id === eu);
  const algumaLigada = registros.some((r) => !r.fim);
  useEffect(() => {
    setAgora(Date.now());
    if (!algumaLigada) return;
    const t = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(t);
  }, [algumaLigada]);

  const total = registros.reduce((a, r) => a + (r.fim || agora ? segundosEntre(r.inicio, r.fim, agora ?? 0) : 0), 0);
  const porPessoa = new Map<string, { nome: string; segundos: number }>();
  for (const r of registros) {
    const k = r.pessoa?.id ?? "";
    const atual = porPessoa.get(k) ?? { nome: r.pessoa?.nome ?? "Sem pessoa", segundos: 0 };
    atual.segundos += (r.fim || agora ? segundosEntre(r.inicio, r.fim, agora ?? 0) : 0);
    porPessoa.set(k, atual);
  }
  const lista = todos ? registros : registros.slice(0, 6);

  const executar = (acao: () => Promise<{ erro?: string } | undefined>) =>
    iniciar(async () => {
      setErro(null);
      const r = await acao();
      if (r?.erro) setErro(r.erro);
      router.refresh();
    });

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="text-[11.5px] uppercase tracking-[0.04em] text-muted">Tempo</span>
        <b className="font-mono text-[13px]">{duracao(total)}</b>
        <span className="flex-1" />
        {minhaLigada ? (
          <button
            type="button"
            disabled={pendente}
            onClick={() => executar(pararContagem)}
            className="inline-flex items-center gap-2 rounded-lg bg-rail px-3 py-1.5 text-[13px] font-medium text-rail-ink hover:bg-ink disabled:opacity-60"
          >
            <span className="h-2 w-2 animate-pulse rounded-full bg-ok" />
            <span className="font-mono tabular-nums">{relogio(agora ? segundosEntre(minhaLigada.inicio, null, agora) : 0)}</span>■ Parar
          </button>
        ) : (
          <button
            type="button"
            disabled={pendente}
            onClick={() => executar(() => iniciarContagem(taskId))}
            className="rounded-lg border border-accent bg-accent px-3 py-1.5 text-[13px] font-medium text-accent-ink hover:bg-accent-hover disabled:opacity-60"
          >
            ▶ Iniciar contagem
          </button>
        )}
        {!lancando && (
          <button type="button" onClick={() => setLancando(true)} className="rounded-lg border border-line px-3 py-1.5 text-[13px] font-medium hover:border-ink">
            + Lançar tempo
          </button>
        )}
      </div>
      {erro && <p className="mb-2 text-[12.5px] text-bad">{erro}</p>}
      {lancando && (
        <div className="mb-2">
          <FormPeriodo acao={lancarTempo} rotulo="Lançar" oculto={{ task_id: taskId }} inicial={{ data: hoje, hora: "09:00", duracao: "", nota: "" }} cancelar={() => setLancando(false)} />
        </div>
      )}

      {porPessoa.size > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {[...porPessoa.values()]
            .sort((a, b) => b.segundos - a.segundos)
            .map((p) => (
              <span key={p.nome} className="rounded-full bg-surface px-2.5 py-0.5 text-[12px]">
                {p.nome.split(" ")[0]} <b className="font-mono font-semibold">{duracao(p.segundos)}</b>
              </span>
            ))}
        </div>
      )}

      {registros.length === 0 ? (
        <p className="text-[12.5px] text-muted">Nenhum tempo registrado ainda.</p>
      ) : (
        <ul className="flex flex-col">
          {lista.map((r) => (
            <li key={r.id} className="border-t border-line py-2 first:border-t-0">
              <div className="flex items-center gap-2 text-[12.5px]">
                {r.pessoa ? <Avatar iniciais={r.pessoa.iniciais} nome={r.pessoa.nome} foto={r.pessoa.foto} /> : <span className="w-[26px]" />}
                <span className="min-w-0 flex-1">
                  <span className="block truncate">
                    {r.pessoa?.nome ?? "Sem pessoa"}
                    {r.manual && <span className="ml-1.5 rounded-full bg-surface px-1.5 text-[11px] text-muted">lançado</span>}
                  </span>
                  <span className="block font-mono text-[11.5px] text-muted">
                    {r.data.slice(8, 10)}/{r.data.slice(5, 7)} {r.hora}–{r.fim ? r.horaFim : "agora"}
                  </span>
                </span>
                <b className={`flex-none font-mono text-[12.5px] ${r.fim ? "" : "text-ok"}`}>{r.fim ? duracao(segundosEntre(r.inicio, r.fim)) : relogio(agora ? segundosEntre(r.inicio, null, agora) : 0)}</b>
                {socio && r.fim && (
                  <span className="flex flex-none gap-1">
                    <button type="button" onClick={() => setCorrigindo(corrigindo === r.id ? null : r.id)} className="rounded px-1.5 text-[12px] text-muted hover:text-ink">
                      Corrigir
                    </button>
                    <button
                      type="button"
                      disabled={pendente}
                      onClick={() => confirm("Apagar esta contagem?") && executar(() => apagarContagem(r.id))}
                      className="rounded px-1.5 text-[12px] text-muted hover:text-bad"
                    >
                      Apagar
                    </button>
                  </span>
                )}
              </div>
              {r.nota && <p className="ml-[34px] mt-0.5 text-[12px] text-muted [overflow-wrap:anywhere]">{r.nota}</p>}
              {corrigindo === r.id && (
                <div className="mt-2">
                  <FormPeriodo
                    acao={corrigirContagem}
                    rotulo="Salvar correção"
                    oculto={{ id: r.id }}
                    inicial={{ data: r.data, hora: r.hora, duracao: duracao(segundosEntre(r.inicio, r.fim)).replace(/\s/g, ""), nota: r.nota ?? "" }}
                    cancelar={() => setCorrigindo(null)}
                  />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {registros.length > 6 && (
        <button type="button" onClick={() => setTodos((v) => !v)} className="mt-1 text-[12.5px] text-muted hover:text-ink">
          {todos ? "Ver menos" : `Ver todas (${registros.length})`}
        </button>
      )}
    </div>
  );
}
