"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { Aviso, Botao, Selecao, classeEntrada } from "@/components/formulario";
import { AREAS } from "@/lib/dominio/tarefas";
import type { Estado } from "@/app/entrar/acoes";
import { alternarProcesso, apagarEtapaProcesso, apagarProcesso, moverEtapaProcesso, salvarEtapaProcesso, salvarProcesso } from "./acoes";

type Opcao = { id: string; nome: string };
export type EtapaModelo = { id: string; nome: string; responsavel_id: string | null; dias: number };
export type ProcessoModelo = { id: string; nome: string; area: string; descricao: string; ativo: boolean; etapas: EtapaModelo[] };

const campoPequeno = `${classeEntrada} !py-1.5`;

function OpcoesTime({ time }: { time: Opcao[] }) {
  return (
    <>
      <option value="">Sem responsável</option>
      {time.map((p) => (
        <option key={p.id} value={p.id}>
          {p.nome}
        </option>
      ))}
    </>
  );
}

function LinhaEtapa({ e, i, total, time, mostrar }: { e: EtapaModelo; i: number; total: number; time: Opcao[]; mostrar: (r: Estado) => void }) {
  const [estado, acao] = useActionState(salvarEtapaProcesso, undefined);
  const [, iniciar] = useTransition();
  return (
    <form action={acao} className="grid grid-cols-[28px_minmax(0,1fr)] items-center gap-2 border-t border-line py-2 first:border-t-0 sm:grid-cols-[28px_minmax(0,1fr)_170px_92px_auto]">
      <input type="hidden" name="id" value={e.id} />
      <span className="font-mono text-[12px] text-muted">{i + 1}.</span>
      <input name="nome" defaultValue={e.nome} required maxLength={120} aria-label="Etapa" className={campoPequeno} />
      <select name="responsavel_id" defaultValue={e.responsavel_id ?? ""} aria-label="Responsável" className={`${campoPequeno} max-sm:col-start-2`}>
        <OpcoesTime time={time} />
      </select>
      <label className="flex items-center gap-1.5 text-[12px] text-muted max-sm:col-start-2">
        dia
        <input name="dias" type="number" min={0} max={365} defaultValue={e.dias} aria-label="Dias depois do início" className={`${campoPequeno} w-[60px]`} />
      </label>
      <span className="flex items-center gap-2 text-[12.5px] max-sm:col-start-2">
        <Botao pequeno variante="fantasma">Salvar</Botao>
        <button type="button" disabled={i === 0} onClick={() => iniciar(async () => mostrar(await moverEtapaProcesso(e.id, -1)))} aria-label="Subir" className="text-muted hover:text-ink disabled:opacity-30">
          ↑
        </button>
        <button type="button" disabled={i === total - 1} onClick={() => iniciar(async () => mostrar(await moverEtapaProcesso(e.id, 1)))} aria-label="Descer" className="text-muted hover:text-ink disabled:opacity-30">
          ↓
        </button>
        <button type="button" onClick={() => confirm(`Tirar a etapa ${e.nome}?`) && iniciar(async () => mostrar(await apagarEtapaProcesso(e.id)))} className="text-bad hover:underline">
          Remover
        </button>
        {estado?.ok && <small className="text-ok">✓</small>}
        {estado?.erro && <small className="text-bad">{estado.erro}</small>}
      </span>
    </form>
  );
}

function NovaEtapa({ processoId, time, proximoDia }: { processoId: string; time: Opcao[]; proximoDia: number }) {
  const [estado, acao, enviando] = useActionState(salvarEtapaProcesso, undefined);
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (estado?.ok) form.current?.reset();
  }, [estado]);
  return (
    <form ref={form} action={acao} className="mt-1 grid grid-cols-[28px_minmax(0,1fr)] items-center gap-2 sm:grid-cols-[28px_minmax(0,1fr)_170px_92px_auto]">
      <input type="hidden" name="processo_id" value={processoId} />
      <span className="text-muted">+</span>
      <input name="nome" required maxLength={120} placeholder="Nova etapa" aria-label="Nova etapa" className={campoPequeno} />
      <select name="responsavel_id" defaultValue="" aria-label="Responsável" className={`${campoPequeno} max-sm:col-start-2`}>
        <OpcoesTime time={time} />
      </select>
      <label className="flex items-center gap-1.5 text-[12px] text-muted max-sm:col-start-2">
        dia
        <input key={proximoDia} name="dias" type="number" min={0} max={365} defaultValue={proximoDia} aria-label="Dias depois do início" className={`${campoPequeno} w-[60px]`} />
      </label>
      <span className="max-sm:col-start-2">
        <Botao pequeno className="border-ink bg-ink text-bg" disabled={enviando}>
          Adicionar
        </Botao>
        {estado?.erro && <small className="ml-2 text-[12px] text-bad">{estado.erro}</small>}
      </span>
    </form>
  );
}

function CabecalhoProcesso({ p, mostrar }: { p: ProcessoModelo; mostrar: (r: Estado) => void }) {
  const [estado, acao] = useActionState(salvarProcesso, undefined);
  const [, iniciar] = useTransition();
  return (
    <form action={acao} className="flex flex-col gap-2">
      <input type="hidden" name="id" value={p.id} />
      <div className="flex flex-wrap items-center gap-2">
        <input name="nome" defaultValue={p.nome} required maxLength={120} aria-label="Nome do processo" className={`${campoPequeno} !w-auto min-w-[200px] flex-1 font-semibold`} />
        <select name="area" defaultValue={p.area} aria-label="Área" className={`${campoPequeno} !w-auto`}>
          {AREAS.map((a) => (
            <option key={a.id} value={a.id}>
              {a.rotulo}
            </option>
          ))}
        </select>
        <Botao pequeno variante="fantasma">Salvar</Botao>
        <button type="button" onClick={() => iniciar(async () => mostrar(await alternarProcesso(p.id, !p.ativo)))} className="text-[12.5px] text-muted hover:text-ink">
          {p.ativo ? "Arquivar" : "Reativar"}
        </button>
        <button
          type="button"
          onClick={() => confirm(`Apagar o processo ${p.nome}? As demandas que já usam continuam com as etapas delas.`) && iniciar(async () => mostrar(await apagarProcesso(p.id)))}
          className="text-[12.5px] text-bad hover:underline"
        >
          Apagar
        </button>
        {estado?.ok && <small className="text-[12px] text-ok">✓</small>}
        {estado?.erro && <small className="text-[12px] text-bad">{estado.erro}</small>}
      </div>
      <input name="descricao" defaultValue={p.descricao} maxLength={300} placeholder="Descrição (opcional): quando usar este processo" aria-label="Descrição" className={campoPequeno} />
    </form>
  );
}

export function EditorProcessos({ processos, time }: { processos: ProcessoModelo[]; time: Opcao[] }) {
  const [erro, setErro] = useState<string | null>(null);
  const mostrar = (r: Estado) => setErro(r?.erro ?? null);
  const [estado, acao, enviando] = useActionState(salvarProcesso, undefined);
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (estado?.ok) form.current?.reset();
  }, [estado]);

  return (
    <div className="flex max-w-[900px] flex-col gap-3">
      {erro && <Aviso tom="erro">{erro}</Aviso>}
      <form ref={form} action={acao} className="flex flex-wrap items-end gap-2 rounded-xl border border-dashed border-line bg-card p-4">
        <div className="min-w-[220px] flex-1">
          <label htmlFor="novo_nome" className="mb-[5px] block text-[11.5px] uppercase tracking-[0.04em] text-muted">
            Novo processo
          </label>
          <input id="novo_nome" name="nome" required maxLength={120} placeholder="Ex.: Projeto de branding" className={classeEntrada} />
        </div>
        <div className="w-[180px]">
          <Selecao rotulo="Área" id="area" defaultValue="branding">
            {AREAS.map((a) => (
              <option key={a.id} value={a.id}>
                {a.rotulo}
              </option>
            ))}
          </Selecao>
        </div>
        <Botao variante="principal" disabled={enviando}>
          Criar processo
        </Botao>
        {estado?.erro && <small className="w-full text-[12px] text-bad">{estado.erro}</small>}
      </form>

      {processos.map((p) => {
        const duracao = Math.max(0, ...p.etapas.map((e) => e.dias));
        return (
          <section key={p.id} className={`flex flex-col gap-3 rounded-xl border border-line bg-card p-4 ${p.ativo ? "" : "opacity-60"}`}>
            <CabecalhoProcesso p={p} mostrar={mostrar} />
            <div className="text-[12px] text-muted">
              {p.etapas.length} etapa{p.etapas.length === 1 ? "" : "s"} · {duracao} dia{duracao === 1 ? "" : "s"} do início ao fim
              {!p.ativo && " · arquivado (não aparece para escolher)"}
            </div>
            <div>
              {p.etapas.map((e, i) => (
                <LinhaEtapa key={e.id} e={e} i={i} total={p.etapas.length} time={time} mostrar={mostrar} />
              ))}
              <NovaEtapa processoId={p.id} time={time} proximoDia={duracao + (p.etapas.length ? 2 : 1)} />
            </div>
          </section>
        );
      })}
    </div>
  );
}
