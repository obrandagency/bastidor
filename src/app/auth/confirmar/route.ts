import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { criarClienteServidor } from "@/lib/supabase/server";

// Destino dos links enviados por e-mail (convite, link mágico e nova senha).
// Os modelos de e-mail do Supabase apontam para cá com token_hash e type.
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const tokenHash = url.searchParams.get("token_hash");
  const tipo = url.searchParams.get("type") as EmailOtpType | null;
  const destino = (caminho: string) => NextResponse.redirect(new URL(caminho, url.origin));

  if (!tokenHash || !tipo) return destino("/entrar?erro=link-invalido");

  const supabase = await criarClienteServidor();
  const { data, error } = await supabase.auth.verifyOtp({ type: tipo, token_hash: tokenHash });
  if (error || !data.user) return destino("/entrar?erro=link-invalido");

  const { data: pessoa } = await supabase.from("profiles").select("perfil, ativo").eq("id", data.user.id).maybeSingle();
  if (!pessoa?.ativo) {
    await supabase.auth.signOut();
    return destino("/entrar?erro=sem-acesso");
  }
  if (pessoa.perfil === "cliente") return destino("/portal");
  // Time: convite e "esqueci a senha" levam para criar a senha
  if (tipo === "invite" || tipo === "recovery") return destino("/definir-senha");
  return destino("/inicio");
}
