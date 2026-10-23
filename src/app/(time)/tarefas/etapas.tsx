"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { Aviso, Botao, classeEntrada } from "@/components/formulario";
import { Avatar } from "@/components/tarefa";
import type { Estado } from "@/app/entrar/acoes";
import { adicionarEtapa, aplicarProcesso, editarEtapa, marcarEtapa, removerEtapa } from "./acoes-etapas";

type Pessoa = { id: string; nome: string; iniciais: string; foto: string | null };
export type EtapaDaTarefa = { id: string; nome: string; responsavel_id: string | null; prazo: string | null; feito: boolean; feitoPor: string | null };

const dataCurta = (iso: string) => iso.split("-").reverse().slice(0, 2).join("/");

// Etapas em sequência de uma demanda: só a primeira pendente pode ser concluída; só a última feita pode ser reaberta
export function EtapasTarefa({ taskId, etapas, time, hoje }: { taskId: string; etapas: EtapaDaTarefa[]; time: Pessoa[]; hoje: string }) {
  const [, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [editando, setEditando] = useState<string | null>(null);
  const mostrar = (r: Estado) => setErro(r?.erro ?? null);
  const [estado, acao, enviando] = useActionState(adicionarEtapa, undefined);
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (estado?.ok) form.current?.reset();
  }, [estado]);

  const pessoa = new Map(time.map((p) => [p.id, p]));
  const atual = etapas.findIndex((e) => !e.feito);
  const ultimaFeita = atual === -1 ? etapas.length - 1 : atual - 1;
  const feitas = etapas.filter((e) => e.feito).length;

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <span className="text-[11.5px] uppercase tracking-[0.04em] text-muted">Etapas</span>
        <span className="font-mono text-[11.5px] text-muted">
          {feitas} de {etapas.length}
        </span>
      </div>
      <div className="mb-2.5 h-1.5 overflow-hidden rounded-full bg-surface">
        <i className="block h-full rounded-full bg-accent" style={{ width: `${etapas.length ? (feitas / etapas.length) * 100 : 0}%` }} />
      </div>
      {erro && (
        <div className="mb-2">
          <Aviso tom="erro">{erro}</Aviso>
        </div>
      )}
      <ol className="flex flex-col gap-1.5">
        {etapas.map((e, i) => {
          const r = e.responsavel_id ? pessoa.get(e.responsavel_id) : null;
          const podeMarcar = e.feito ? i === ultimaFeita : i === atual;
          const atrasada = !e.feito && !!e.prazo && e.prazo < hoje;
          return (
            <li
              key={e.id}
              className={`flex flex-wrap items-center gap-2 rounded-lg border px-2.5 py-2 text-[13px] ${
                i === atual ? "border-accent bg-accent-soft" : "border-line bg-card"
              }`}
            >
              <input
                type="checkbox"
                aria-label={e.feito ? `Reabrir ${e.nome}` : `Concluir ${e.nome}`}
                title={podeMarcar ? undefined : e.feito ? "Reabra primeiro as etapas seguintes" : "Conclua as etapas anteriores primeiro"}
                checked={e.feito}
                disabled={!podeMarcar}
                onChange={(ev) => {
                  const v = ev.target.checked;
                  iniciar(async () => mostrar(await marcarEtapa(e.id, v)));
                }}
                className="h-4 w-4 flex-none accent-[var(--color-ok)] disabled:opacity-40"
              />
              {editando === e.id ? (
                <form
                  className="flex min-w-0 flex-1 gap-1.5"
                  onSubmit={(ev) => {
                    ev.preventDefault();
                    const nome = String(new FormData(ev.currentTarget).get("nome") ?? "");
                    iniciar(async () => {
                      const r2 = await editarEtapa(e.id, { nome });
                      mostrar(r2);
                      if (!r2?.erro) setEditando(null);
                    });
                  }}
                >
                  <input name="nome" autoFocus defaultValue={e.nome} aria-label="Nome da etapa" className={`${classeEntrada} !py-1`} />
                  <Botao pequeno variante="principal">
                    Salvar
                  </Botao>
                </form>
              ) : (
                <span className="min-w-[150px] flex-1 [overflow-wrap:anywhere]">
                  <span className={e.feito ? "text-muted line-through" : i === atual ? "font-semibold" : ""}>
                    {i + 1}. {e.nome}
                  </span>
                  {e.feito && e.feitoPor && <small className="ml-1.5 text-[11.5px] text-muted">· {e.feitoPor}</small>}
                  {i === atual && <small className="ml-1.5 text-[11.5px] text-accent">agora</small>}
                </span>
              )}
              {editando !== e.id && (
                <span className="flex flex-wrap items-center gap-1.5 text-[12px]">
                  {r && <Avatar iniciais={r.iniciais} nome={r.nome} foto={r.foto} classe="h-5 w-5 text-[8px]" />}
                  <select
                    aria-label="Responsável"
                    value={e.responsavel_id ?? ""}
                    onChange={(ev) => {
                      const v = ev.target.value || null;
                      iniciar(async () => mostrar(await editarEtapa(e.id, { responsavel_id: v })));
                    }}
                    className="max-w-[120px] rounded border border-line bg-card px-1 py-0.5 text-[12px]"
                  >
                    <option value="">Ninguém</option>
                    {time.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nome}
                      </option>
                    ))}
                  </select>
                  <input
                    type="date"
                    aria-label="Prazo da etapa"
                    value={e.prazo ?? ""}
                    onChange={(ev) => {
                      const v = ev.target.value || null;
                      iniciar(async () => mostrar(await editarEtapa(e.id, { prazo: v })));
                    }}
                    className={`rounded border bg-card px-1 py-0.5 text-[12px] ${atrasada ? "border-bad text-bad" : "border-line"}`}
                    title={e.prazo ? `Prazo ${dataCurta(e.prazo)}` : "Sem prazo"}
                  />
                  <button type="button" onClick={() => setEditando(e.id)} className="text-muted hover:text-ink">
                    Editar
                  </button>
                  {!e.feito && (
                    <button type="button" onClick={() => confirm(`Remover a etapa ${e.nome}?`) && iniciar(async () => mostrar(await removerEtapa(e.id)))} className="text-bad hover:underline">
                      Remover
                    </button>
                  )}
                </span>
              )}
            </li>
          );
        })}
      </ol>
      <form ref={form} action={acao} className="mt-2 flex gap-2">
        <input type="hidden" name="task_id" value={taskId} />
        <input name="nome" required maxLength={120} placeholder="Nova etapa no fim" aria-label="Nova etapa" className={`${classeEntrada} !py-1.5`} />
        <input name="prazo" type="date" aria-label="Prazo da nova etapa" className={`${classeEntrada} !w-[150px] !py-1.5`} />
        <Botao pequeno className="border-ink bg-ink text-bg" disabled={enviando}>
          Adicionar
        </Botao>
      </form>
      {estado?.erro && <small className="text-[12px] text-bad">{estado.erro}</small>}
    </div>
  );
}

// Demanda sem etapas: escolher um processo e a data de início
export function UsarProcesso({ taskId, processos, hoje }: { taskId: string; processos: { id: string; nome: string }[]; hoje: string }) {
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  if (!processos.length) return null;
  return (
    <form
      className="flex flex-wrap items-end gap-2 rounded-lg border border-dashed border-line p-3"
      onSubmit={(ev) => {
        ev.preventDefault();
        const f = new FormData(ev.currentTarget);
        iniciar(async () => setErro((await aplicarProcesso(taskId, String(f.get("processo_id")), String(f.get("inicio"))))?.erro ?? null));
      }}
    >
      <label className="flex min-w-[180px] flex-1 flex-col gap-[5px] text-[11.5px] uppercase tracking-[0.04em] text-muted">
        Usar um processo
        <select name="processo_id" required defaultValue="" className={`${classeEntrada} !py-1.5 normal-case tracking-normal text-ink`}>
          <option value="" disabled>
            Escolha
          </option>
          {processos.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nome}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-[5px] text-[11.5px] uppercase tracking-[0.04em] text-muted">
        Início
        <input name="inicio" type="date" required defaultValue={hoje} className={`${classeEntrada} !py-1.5 normal-case tracking-normal text-ink`} />
      </label>
      <Botao pequeno variante="principal" disabled={pendente}>
        Aplicar
      </Botao>
      {erro && <small className="w-full text-[12px] text-bad">{erro}</small>}
    </form>
  );
}
