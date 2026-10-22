import { MenuLateral } from "@/components/menu-lateral";
import type { PerfilTime } from "@/lib/permissoes";

// Etapa 1: pessoa fixa enquanto o login não existe. Na etapa 2 vem do Supabase Auth.
const PESSOA_PROVISORIA: { nome: string; iniciais: string; perfil: PerfilTime } = {
  nome: "Mayara",
  iniciais: "MA",
  perfil: "socio",
};

export default function LayoutTime({ children }: { children: React.ReactNode }) {
  return <MenuLateral pessoa={PESSOA_PROVISORIA}>{children}</MenuLateral>;
}
