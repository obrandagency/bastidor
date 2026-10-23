"use client";

import { useActionState, useState } from "react";
import { Aviso, Botao, Selecao, classeEntrada } from "@/components/formulario";
import { criarCanal } from "./acoes";

type PessoaCanal = { id: string; nome: string };

// Novo canal (Sócio e Adm): nome, cliente opcional e quem participa (quem cria já entra)
export function NovoCanal({ clientes, pessoas, eu, fechar }: { clientes: { id: string; nome: string }[]; pessoas: PessoaCanal[]; eu: string; fechar: () => void }) {
  const [estado, acao, enviando] = useActionState(criarCanal, undefined);
  const [marcados, setMarcados] = useState<string[]>(pessoas.map((p) => p.id));
  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-[rgba(5,7,11,.45)] px-4" onClick={fechar}>
      <form
        role="dialog"
        aria-modal="true"
        aria-label="Novo canal"
        action={acao}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[90dvh] w-full max-w-[440px] flex-col gap-3 overflow-y-auto rounded-xl bg-card p-5 shadow-pop"
      >
        <h2 className="text-[17px] font-bold">Novo canal</h2>
        <label className="flex flex-col gap-[5px] text-[11.5px] uppercase tracking-[0.04em] text-muted">
          Nome
          <input name="nome" autoFocus required placeholder="ex.: designers" className={`${classeEntrada} font-mono text-[13px] normal-case tracking-normal text-ink`} />
        </label>
        <Selecao rotulo="Cliente (opcional)" id="client_id" defaultValue="">
          <option value="">Nenhum (canal da agência)</option>
          {clientes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </Selecao>
        <fieldset className="flex flex-col gap-1.5">
          <legend className="mb-1 flex w-full items-center justify-between text-[11.5px] uppercase tracking-[0.04em] text-muted">
            Quem participa
            <span className="flex gap-2 normal-case tracking-normal">
              <button type="button" onClick={() => setMarcados(pessoas.map((p) => p.id))} className="text-accent hover:underline">
                Todos
              </button>
              <button type="button" onClick={() => setMarcados([eu])} className="text-accent hover:underline">
                Só eu
              </button>
            </span>
          </legend>
          {pessoas.map((p) => (
            <label key={p.id} className="flex items-center gap-2 text-[13.5px]">
              <input
                type="checkbox"
                name="membros"
                value={p.id}
                checked={p.id === eu || marcados.includes(p.id)}
                disabled={p.id === eu}
                onChange={(e) => setMarcados((m) => (e.target.checked ? [...m, p.id] : m.filter((x) => x !== p.id)))}
                className="h-4 w-4"
              />
              {p.nome}
              {p.id === eu && <small className="text-muted">(você)</small>}
            </label>
          ))}
        </fieldset>
        {estado?.erro && <Aviso tom="erro">{estado.erro}</Aviso>}
        <div className="flex gap-2">
          <Botao variante="principal" disabled={enviando}>
            {enviando ? "Criando…" : "Criar canal"}
          </Botao>
          <Botao type="button" variante="fantasma" onClick={fechar}>
            Cancelar
          </Botao>
        </div>
      </form>
    </div>
  );
}
