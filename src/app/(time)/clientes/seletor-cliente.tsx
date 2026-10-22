"use client";

import { useRouter } from "next/navigation";
import { Selecao } from "@/components/formulario";

export function SeletorCliente({ atual, clientes }: { atual: string; clientes: { id: string; nome: string }[] }) {
  const router = useRouter();
  return (
    <div className="w-[260px] max-w-full">
      <Selecao rotulo="Cliente" id="cliente" value={atual} onChange={(e) => router.push(`/clientes/${e.target.value}`)}>
        {clientes.map((c) => (
          <option key={c.id} value={c.id}>
            {c.nome}
          </option>
        ))}
      </Selecao>
    </div>
  );
}
