import { cache } from "react";
import { notFound } from "next/navigation";
import { exigirTime } from "@/lib/sessao";
import { criarClienteServidor } from "@/lib/supabase/server";
import type { Briefing, ClienteCompleto } from "@/types/banco";

// Lido uma vez por requisição e usado pelo layout (menu do cliente) e pelas páginas
export const lerCliente = cache(async (id: string) => {
  const eu = await exigirTime();
  const supabase = await criarClienteServidor();
  const { data: cliente } = await supabase.from("clients").select("*").eq("id", id).maybeSingle<ClienteCompleto>();
  if (!cliente) notFound();
  const gestao = eu.perfil === "socio" || eu.perfil === "adm";
  return { eu, gestao, socio: eu.perfil === "socio", cliente, supabase };
});

export const lerBriefing = cache(async (id: string) => {
  const supabase = await criarClienteServidor();
  const { data } = await supabase.from("client_briefs").select("*").eq("client_id", id).maybeSingle<Briefing>();
  return data;
});

// Título de cada página dentro da Central: nome grande com uma linha cinza
export function TituloSecao({ titulo, descricao, acoes }: { titulo: string; descricao?: string; acoes?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
      <div className="min-w-0">
        <h1 className="text-[24px] font-bold leading-[1.1] tracking-[-0.02em] md:text-[28px]">{titulo}</h1>
        {descricao && <p className="mt-1.5 max-w-[70ch] text-[14px] text-muted">{descricao}</p>}
      </div>
      {acoes && <div className="flex flex-wrap items-center gap-2">{acoes}</div>}
    </div>
  );
}
