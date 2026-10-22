import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { criarClienteServidor } from "@/lib/supabase/server";
import type { PerfilTime } from "@/lib/permissoes";
import type { Pessoa } from "@/types/banco";

// Pessoa logada (uma consulta por requisição). Nulo se não há sessão ou perfil ativo.
export const pessoaAtual = cache(async (): Promise<Pessoa | null> => {
  const supabase = await criarClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle<Pessoa>();
  return data && data.ativo ? data : null;
});

// Para telas do time. Cliente vai para o portal; quem não tem perfil ativo volta para a entrada.
export async function exigirTime(perfis?: PerfilTime[]) {
  const pessoa = await pessoaAtual();
  if (!pessoa) redirect("/entrar?erro=sem-acesso");
  if (pessoa.perfil === "cliente") redirect("/portal");
  if (perfis && !perfis.includes(pessoa.perfil)) redirect("/inicio");
  return pessoa as Pessoa & { perfil: PerfilTime };
}

export async function exigirCliente() {
  const pessoa = await pessoaAtual();
  if (!pessoa) redirect("/entrar/cliente?erro=sem-acesso");
  if (pessoa.perfil !== "cliente") redirect("/inicio");
  return pessoa;
}

// Endereço público do sistema, usado nos links enviados por e-mail
export function urlDoSite(origem?: string | null) {
  return (process.env.NEXT_PUBLIC_SITE_URL || origem || "http://localhost:3000").replace(/\/$/, "");
}
