"use client";

import { useActionState, useState } from "react";
import { Aviso, Botao, Campo, Selecao } from "@/components/formulario";
import { FORMATOS_VIDEO } from "@/lib/dominio/roteiros";
import { criarRoteiro } from "./acoes";

export function NovoRoteiro({ clientes, clienteFiltro }: { clientes: { id: string; nome: string }[]; clienteFiltro?: string }) {
  const [aberto, setAberto] = useState(false);
  const [estado, acao, enviando] = useActionState(criarRoteiro, undefined);
  return (
    <>
      <button onClick={() => setAberto(true)} className="rounded-lg border border-accent bg-accent px-3.5 py-2 font-medium text-accent-ink hover:border-accent-hover hover:bg-accent-hover">
        + Novo roteiro
      </button>
      {aberto && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[rgba(5,7,11,.45)] px-4" onClick={() => setAberto(false)}>
          <form
            role="dialog"
            aria-modal="true"
            aria-label="Novo roteiro"
            action={acao}
            onClick={(e) => e.stopPropagation()}
            className="flex w-full max-w-[440px] flex-col gap-3 rounded-xl bg-card p-5 shadow-pop"
          >
            <h2 className="text-[17px] font-bold">Novo roteiro</h2>
            {estado?.erro && <Aviso tom="erro">{estado.erro}</Aviso>}
            <Campo rotulo="Título" id="titulo" required maxLength={200} autoFocus placeholder="Ex.: Reels lançamento coleção verão" />
            <div className="grid grid-cols-2 gap-3">
              <Selecao rotulo="Cliente" id="client_id" defaultValue={clienteFiltro ?? "interno"}>
                <option value="interno">Interno da agência</option>
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </Selecao>
              <Selecao rotulo="Formato" id="formato" defaultValue="reels">
                {FORMATOS_VIDEO.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.rotulo}
                  </option>
                ))}
              </Selecao>
            </div>
            <div className="flex gap-2">
              <Botao variante="principal" disabled={enviando}>
                {enviando ? "Criando…" : "Criar e escrever"}
              </Botao>
              <Botao type="button" variante="fantasma" onClick={() => setAberto(false)}>
                Cancelar
              </Botao>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
