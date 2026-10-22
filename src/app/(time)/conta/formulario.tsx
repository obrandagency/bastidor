"use client";

import { useActionState } from "react";
import { Botao } from "@/components/formulario";
import { salvarPreferencias } from "./acoes";

export function FormPreferencias({ emailsOpcionais }: { emailsOpcionais: boolean }) {
  const [estado, acao, enviando] = useActionState(salvarPreferencias, undefined);
  return (
    <form action={acao} className="flex flex-col gap-3">
      <label className="flex items-start gap-2.5">
        <input type="checkbox" name="emails_opcionais" defaultChecked={emailsOpcionais} className="mt-1 h-4 w-4 accent-[var(--color-accent)]" />
        <span>
          Receber avisos por e-mail
          <small className="block text-[12.5px] text-muted">
            Aprovações, pedidos de ajuste, tarefas que chegaram para você e o resumo diário das 8h. Os avisos continuam no sino do sistema.
          </small>
        </span>
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <Botao variante="principal" pequeno disabled={enviando}>
          {enviando ? "Salvando…" : "Salvar"}
        </Botao>
        {estado?.ok && <small className="text-[12.5px] text-ok">{estado.ok}</small>}
        {estado?.erro && <small className="text-[12.5px] text-bad">{estado.erro}</small>}
      </div>
    </form>
  );
}
