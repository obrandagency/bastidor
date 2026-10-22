import { MenuLateral } from "@/components/menu-lateral";
import { exigirTime } from "@/lib/sessao";
import { criarClienteServidor } from "@/lib/supabase/server";

export default async function LayoutTime({ children }: { children: React.ReactNode }) {
  const pessoa = await exigirTime();
  const supabase = await criarClienteServidor();
  const { count } = await supabase.from("notifications").select("id", { count: "exact", head: true }).is("lida_em", null);
  return (
    <MenuLateral pessoa={{ nome: pessoa.nome, iniciais: pessoa.iniciais, perfil: pessoa.perfil }} avisos={count ?? 0}>
      {children}
    </MenuLateral>
  );
}
