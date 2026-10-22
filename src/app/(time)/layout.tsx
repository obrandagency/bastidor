import { MenuLateral } from "@/components/menu-lateral";
import { exigirTime } from "@/lib/sessao";

export default async function LayoutTime({ children }: { children: React.ReactNode }) {
  const pessoa = await exigirTime();
  return (
    <MenuLateral pessoa={{ nome: pessoa.nome, iniciais: pessoa.iniciais, perfil: pessoa.perfil }}>{children}</MenuLateral>
  );
}
