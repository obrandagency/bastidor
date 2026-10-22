"use client";

import { useRouter } from "next/navigation";
import { Selecao } from "@/components/formulario";

export function SeletorClienteCriacao({ atual, clientes }: { atual: string; clientes: { id: string; nome: string }[] }) {
  const router = useRouter();
  return (
    <div className="w-[240px] max-w-full">
      <Selecao rotulo="Cliente" id="cliente-criacao" value={atual} onChange={(e) => router.push(`/criacao?cliente=${e.target.value}`)}>
        {clientes.map((c) => (
          <option key={c.id} value={c.id}>
            {c.nome}
          </option>
        ))}
      </Selecao>
    </div>
  );
}
