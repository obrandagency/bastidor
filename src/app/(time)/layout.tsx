import { MenuLateral } from "@/components/menu-lateral";
import { lerIdentidade } from "@/lib/identidade";
import { exigirTime } from "@/lib/sessao";
import { criarClienteServidor } from "@/lib/supabase/server";

export default async function LayoutTime({ children }: { children: React.ReactNode }) {
  const pessoa = await exigirTime();
  const supabase = await criarClienteServidor();
  const [{ count }, { data: naoLidas }, identidade] = await Promise.all([
    supabase.from("notifications").select("id", { count: "exact", head: true }).is("lida_em", null),
    supabase.rpc("chat_nao_lidas"),
    lerIdentidade(),
  ]);
  const chat = ((naoLidas ?? []) as { total: number }[]).reduce((a, n) => a + Number(n.total), 0);
  return (
    <MenuLateral pessoa={{ nome: pessoa.nome, iniciais: pessoa.iniciais, perfil: pessoa.perfil, foto: pessoa.foto }}
      identidade={identidade} avisos={count ?? 0} contagens={{ "/chat": chat }}>
      {children}
    </MenuLateral>
  );
}
