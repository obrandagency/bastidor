"use client";

import { useActionState, useState } from "react";
import { Aviso, Botao, Selecao, classeEntrada } from "@/components/formulario";
import { arquivarCanal, criarCanal } from "./acoes";

export function NovoCanal({ clientes }: { clientes: { id: string; nome: string }[] }) {
  const [aberto, setAberto] = useState(false);
  const [estado, acao, enviando] = useActionState(criarCanal, undefined);
  if (!aberto)
    return (
      <button onClick={() => setAberto(true)} className="rounded-lg px-2.5 py-[7px] text-left text-[13px] text-accent hover:bg-accent-soft">
        + Novo canal
      </button>
    );
  return (
    <form action={acao} className="flex flex-col gap-2 rounded-lg border border-line p-2.5">
      <input name="nome" autoFocus required placeholder="nome-do-canal" aria-label="Nome do canal" className={`${classeEntrada} !py-1.5 font-mono text-[12.5px]`} />
      <Selecao rotulo="Cliente (opcional)" id="client_id" defaultValue="">
        <option value="">Nenhum</option>
        {clientes.map((c) => (
          <option key={c.id} value={c.id}>
            {c.nome}
          </option>
        ))}
      </Selecao>
      {estado?.erro && <Aviso tom="erro">{estado.erro}</Aviso>}
      <div className="flex gap-1.5">
        <Botao pequeno variante="principal" disabled={enviando}>
          Criar
        </Botao>
        <Botao type="button" pequeno variante="fantasma" onClick={() => setAberto(false)}>
          Cancelar
        </Botao>
      </div>
    </form>
  );
}

export function ArquivarCanal({ id, nome }: { id: string; nome: string }) {
  const [estado, acao, enviando] = useActionState(arquivarCanal, undefined);
  return (
    <form
      action={acao}
      onSubmit={(e) => {
        if (!confirm(`Arquivar #${nome}? As mensagens ficam guardadas, mas ninguém escreve mais nele.`)) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button disabled={enviando} className="text-[12px] text-muted hover:text-bad">
        Arquivar canal
      </button>
      {estado?.erro && <small className="block text-[12px] text-bad">{estado.erro}</small>}
    </form>
  );
}
