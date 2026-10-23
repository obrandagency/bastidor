import { cookies } from "next/headers";
import { Suspense } from "react";
import { Lembretes } from "@/components/lembretes";
import { MenuLateral } from "@/components/menu-lateral";
import { lerIdentidade } from "@/lib/identidade";
import { exigirTime } from "@/lib/sessao";
import { criarClienteServidor } from "@/lib/supabase/server";
import type { Lembrete } from "./lembretes/acoes";

export default async function LayoutTime({ children }: { children: React.ReactNode }) {
  const pessoa = await exigirTime();
  const supabase = await criarClienteServidor();
  const [{ count }, { data: naoLidas }, identidade, { data: lembretes }, { data: clientes }] = await Promise.all([
    supabase.from("notifications").select("id", { count: "exact", head: true }).is("lida_em", null),
    supabase.rpc("chat_nao_lidas"),
    lerIdentidade(),
    supabase.from("lembretes").select("id, texto, quando, repetir, client_id, task_id, avisado_em").is("concluido_em", null).order("quando").returns<Lembrete[]>(),
    supabase.from("clients").select("id, nome").eq("ativo", true).order("nome"),
  ]);
  const chat = ((naoLidas ?? []) as { total: number }[]).reduce((a, n) => a + Number(n.total), 0);
  return (
    <>
      <MenuLateral
        pessoa={{ nome: pessoa.nome, iniciais: pessoa.iniciais, perfil: pessoa.perfil, foto: pessoa.foto }}
        identidade={identidade}
        avisos={count ?? 0}
        contagens={{ "/chat": chat }}
        recolhidoInicial={(await cookies()).get("menu_recolhido")?.value === "1"}
      >
        {children}
      </MenuLateral>
      {/* Botão flutuante de lembretes (pessoais; usa a tarefa aberta na URL) */}
      <Suspense>
        <Lembretes lembretes={lembretes ?? []} clientes={clientes ?? []} />
      </Suspense>
    </>
  );
}
