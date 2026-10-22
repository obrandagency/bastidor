"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Selecao } from "@/components/formulario";

type Opcao = { id: string; nome: string };

export function Filtros({ clientes, time, comInterno }: { clientes: Opcao[]; time: Opcao[]; comInterno: boolean }) {
  const router = useRouter();
  const caminho = usePathname();
  const params = useSearchParams();
  const mudar = (chave: string, valor: string) => {
    const novos = new URLSearchParams(params);
    if (valor) novos.set(chave, valor);
    else novos.delete(chave);
    novos.delete("tarefa");
    router.push(`${caminho}?${novos}`, { scroll: false });
  };
  return (
    <>
      <div className="w-[200px] max-w-full">
        <Selecao rotulo="Cliente" id="filtro-cliente" value={params.get("cliente") ?? ""} onChange={(e) => mudar("cliente", e.target.value)}>
          <option value="">Todos os clientes</option>
          {comInterno && <option value="interno">O.BRAND (interno)</option>}
          {clientes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </Selecao>
      </div>
      <div className="w-[200px] max-w-full">
        <Selecao rotulo="Responsável" id="filtro-resp" value={params.get("resp") ?? ""} onChange={(e) => mudar("resp", e.target.value)}>
          <option value="">Todo o time</option>
          {time.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nome}
            </option>
          ))}
        </Selecao>
      </div>
    </>
  );
}
