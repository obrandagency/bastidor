"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { Aviso, Botao, classeEntrada } from "@/components/formulario";
import type { Estado } from "@/app/entrar/acoes";
import { apagarEtapa, apagarTarefaModelo, moverEtapa, salvarEtapa, salvarTarefaModelo } from "../../onboarding/acoes";

export type EtapaModelo = { id: string; nome: string; cor: string; tarefas: { id: string; texto: string }[] };

function NovaTarefa({ etapaId }: { etapaId: string }) {
  const [estado, acao, enviando] = useActionState(salvarTarefaModelo, undefined);
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (estado?.ok) form.current?.reset();
  }, [estado]);
  return (
    <form ref={form} action={acao} className="flex gap-2">
      <input type="hidden" name="etapa_id" value={etapaId} />
      <input name="texto" required maxLength={200} placeholder="Nova tarefa do modelo" aria-label="Nova tarefa do modelo" className={`${classeEntrada} !py-1.5`} />
      <Botao pequeno className="border-ink bg-ink text-bg" disabled={enviando}>
        Adicionar
      </Botao>
      {estado?.erro && <small className="self-center text-[12px] text-bad">{estado.erro}</small>}
    </form>
  );
}

function TarefaModelo({ t, mostrar }: { t: { id: string; texto: string }; mostrar: (r: Estado) => void }) {
  const [estado, acao] = useActionState(salvarTarefaModelo, undefined);
  const [, iniciar] = useTransition();
  return (
    <form action={acao} className="flex items-center gap-2">
      <input type="hidden" name="id" value={t.id} />
      <input name="texto" defaultValue={t.texto} required maxLength={200} aria-label="Tarefa" className={`${classeEntrada} !py-1.5`} />
      <Botao pequeno variante="fantasma">Salvar</Botao>
      <button
        type="button"
        onClick={() => confirm("Tirar esta tarefa do modelo? Clientes que já têm onboarding não mudam.") && iniciar(async () => mostrar(await apagarTarefaModelo(t.id)))}
        className="text-[12px] text-bad hover:underline"
      >
        Remover
      </button>
      {estado?.ok && <small className="text-[12px] text-ok">✓</small>}
      {estado?.erro && <small className="text-[12px] text-bad">{estado.erro}</small>}
    </form>
  );
}

function CabecalhoEtapa({ e, i, total, mostrar }: { e: EtapaModelo; i: number; total: number; mostrar: (r: Estado) => void }) {
  const [estado, acao] = useActionState(salvarEtapa, undefined);
  const [, iniciar] = useTransition();
  return (
    <form action={acao} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="id" value={e.id} />
      <span className="w-[54px] text-[11px] uppercase tracking-[0.06em] text-muted">Etapa {i + 1}</span>
      <input type="color" name="cor" defaultValue={e.cor} aria-label="Cor da etapa" className="h-8 w-9 cursor-pointer rounded border border-line bg-card" />
      <input name="nome" defaultValue={e.nome} required maxLength={40} aria-label="Nome da etapa" className={`${classeEntrada} !w-auto min-w-[180px] flex-1 !py-1.5 font-semibold`} />
      <Botao pequeno variante="fantasma">Salvar</Botao>
      <button type="button" disabled={i === 0} onClick={() => iniciar(async () => mostrar(await moverEtapa(e.id, -1)))} aria-label="Subir etapa" className="px-1 text-muted hover:text-ink disabled:opacity-30">
        ↑
      </button>
      <button type="button" disabled={i === total - 1} onClick={() => iniciar(async () => mostrar(await moverEtapa(e.id, 1)))} aria-label="Descer etapa" className="px-1 text-muted hover:text-ink disabled:opacity-30">
        ↓
      </button>
      <button
        type="button"
        onClick={() => confirm(`Apagar a etapa ${e.nome} e as tarefas do modelo dela?`) && iniciar(async () => mostrar(await apagarEtapa(e.id)))}
        className="text-[12px] text-bad hover:underline"
      >
        Apagar
      </button>
      {estado?.ok && <small className="text-[12px] text-ok">✓</small>}
      {estado?.erro && <small className="text-[12px] text-bad">{estado.erro}</small>}
    </form>
  );
}

export function EditorModelo({ etapas }: { etapas: EtapaModelo[] }) {
  const [erro, setErro] = useState<string | null>(null);
  const mostrar = (r: Estado) => setErro(r?.erro ?? null);
  const [estado, acao, enviando] = useActionState(salvarEtapa, undefined);
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (estado?.ok) form.current?.reset();
  }, [estado]);

  return (
    <div className="flex max-w-[820px] flex-col gap-3">
      {erro && <Aviso tom="erro">{erro}</Aviso>}
      {etapas.map((e, i) => (
        <section key={e.id} className="flex flex-col gap-2.5 rounded-xl border border-line bg-card p-4" style={{ borderLeft: `3px solid ${e.cor}` }}>
          <CabecalhoEtapa e={e} i={i} total={etapas.length} mostrar={mostrar} />
          <div className="flex flex-col gap-1.5 pl-[62px] max-sm:pl-0">
            {e.tarefas.map((t) => (
              <TarefaModelo key={t.id} t={t} mostrar={mostrar} />
            ))}
            <NovaTarefa etapaId={e.id} />
          </div>
        </section>
      ))}
      <form ref={form} action={acao} className="flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-line p-4">
        <input type="color" name="cor" defaultValue="#5A6275" aria-label="Cor da nova etapa" className="h-8 w-9 cursor-pointer rounded border border-line bg-card" />
        <input name="nome" required maxLength={40} placeholder="Nova etapa (entra antes da última)" aria-label="Nova etapa" className={`${classeEntrada} !w-auto min-w-[200px] flex-1 !py-1.5`} />
        <Botao pequeno variante="principal" disabled={enviando}>
          Criar etapa
        </Botao>
        {estado?.erro && <small className="text-[12px] text-bad">{estado.erro}</small>}
      </form>
    </div>
  );
}
