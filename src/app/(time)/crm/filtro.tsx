"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Selecao } from "@/components/formulario";

export function FiltroResponsavel({ time }: { time: { id: string; nome: string }[] }) {
  const router = useRouter();
  const caminho = usePathname();
  const params = useSearchParams();
  return (
    <div className="w-[200px] max-w-full">
      <Selecao
        rotulo="Responsável"
        id="filtro-resp-crm"
        value={params.get("resp") ?? ""}
        onChange={(e) => {
          const novos = new URLSearchParams(params);
          if (e.target.value) novos.set("resp", e.target.value);
          else novos.delete("resp");
          novos.delete("lead");
          router.push(`${caminho}?${novos}`, { scroll: false });
        }}
      >
        <option value="">Todo o time</option>
        {time.map((p) => (
          <option key={p.id} value={p.id}>
            {p.nome}
          </option>
        ))}
      </Selecao>
    </div>
  );
}
