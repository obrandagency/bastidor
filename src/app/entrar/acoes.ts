"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { criarClienteServidor } from "@/lib/supabase/server";
import { urlDoSite } from "@/lib/sessao";

export type Estado = { erro?: string; ok?: string } | undefined;

const emailDe = (f: FormData) => String(f.get("email") ?? "").trim().toLowerCase();
const confirmar = async () => `${urlDoSite((await headers()).get("origin"))}/auth/confirmar`;

export async function entrar(_: Estado, form: FormData): Promise<Estado> {
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: emailDe(form),
    password: String(form.get("senha") ?? ""),
  });
  if (error) return { erro: "E-mail ou senha incorretos." };

  const { data: pessoa } = await supabase.from("profiles").select("perfil, ativo").eq("id", data.user.id).maybeSingle();
  if (!pessoa?.ativo) {
    await supabase.auth.signOut();
    return { erro: "Seu acesso não está ativo. Fale com a agência." };
  }
  redirect(pessoa.perfil === "cliente" ? "/portal" : "/inicio");
}

// Mesma resposta exista ou não o e-mail, para não revelar quem tem acesso
export async function pedirLinkCliente(_: Estado, form: FormData): Promise<Estado> {
  const supabase = await criarClienteServidor();
  const { error } = await supabase.auth.signInWithOtp({
    email: emailDe(form),
    options: { shouldCreateUser: false, emailRedirectTo: await confirmar() },
  });
  if (error?.status === 429) return { erro: "Muitos pedidos seguidos. Espere um minuto e tente de novo." };
  return { ok: "Se este e-mail tiver acesso ao portal, você vai receber um link para entrar. Confira a caixa de entrada e o spam." };
}

export async function esqueciSenha(_: Estado, form: FormData): Promise<Estado> {
  const supabase = await criarClienteServidor();
  const { error } = await supabase.auth.resetPasswordForEmail(emailDe(form), { redirectTo: await confirmar() });
  if (error?.status === 429) return { erro: "Muitos pedidos seguidos. Espere um minuto e tente de novo." };
  return { ok: "Se este e-mail tiver acesso, você vai receber um link para criar uma nova senha." };
}

export async function definirSenha(_: Estado, form: FormData): Promise<Estado> {
  const senha = String(form.get("senha") ?? "");
  if (senha.length < 8) return { erro: "A senha precisa ter pelo menos 8 caracteres." };
  if (senha !== form.get("confirmacao")) return { erro: "As duas senhas não são iguais." };
  const supabase = await criarClienteServidor();
  const { error } = await supabase.auth.updateUser({ password: senha });
  if (error) {
    if (error.code === "same_password") return { erro: "Escolha uma senha diferente da atual." };
    if (error.code === "weak_password") return { erro: "Senha fraca. Use letras e números, com pelo menos 8 caracteres." };
    return { erro: "Não foi possível salvar a senha. Abra o link do e-mail de novo." };
  }
  redirect("/");
}

export async function sair() {
  const supabase = await criarClienteServidor();
  await supabase.auth.signOut();
  redirect("/entrar");
}
