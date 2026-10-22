import { MenuLateral } from "@/components/menu-lateral";
import { exigirTime } from "@/lib/sessao";
import { criarClienteServidor } from "@/lib/supabase/server";

export default async function LayoutTime({ children }: { children: React.ReactNode }) {
  const pessoa = await exigirTime();
  const supabase = await criarClienteServidor();
  const [{ count }, { data: naoLidas }] = await Promise.all([
    supabase.from("notifications").select("id", { count: "exact", head: true }).is("lida_em", null),
    supabase.rpc("chat_nao_lidas"),
  ]);
  const chat = ((naoLidas ?? []) as { total: number }[]).reduce((a, n) => a + Number(n.total), 0);
  return (
    <MenuLateral pessoa={{ nome: pessoa.nome, iniciais: pessoa.iniciais, perfil: pessoa.perfil }} avisos={count ?? 0} contagens={{ "/chat": chat }}>
      {children}
    </MenuLateral>
  );
}
