"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { pessoaAtual, urlDoSite } from "@/lib/sessao";
import { criarClienteAdmin } from "@/lib/supabase/admin";
import { criarClienteServidor } from "@/lib/supabase/server";
import type { Perfil } from "@/lib/permissoes";
import type { Estado } from "@/app/entrar/acoes";

const PERFIS: Perfil[] = ["socio", "adm", "criacao", "cliente"];
const texto = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const linkConfirmar = async () => `${urlDoSite((await headers()).get("origin"))}/auth/confirmar`;

// Sócio convida qualquer perfil; Adm só pessoas de cliente (a RLS de convites garante o mesmo no banco)
async function podeGerir(perfilAlvo: Perfil) {
  const eu = await pessoaAtual();
  if (!eu) return null;
  if (eu.perfil === "socio" || (eu.perfil === "adm" && perfilAlvo === "cliente")) return eu;
  return null;
}

export async function convidar(_: Estado, form: FormData): Promise<Estado> {
  const nome = texto(form, "nome");
  const email = texto(form, "email").toLowerCase();
  const iniciais = texto(form, "iniciais").toUpperCase();
  const cargo = texto(form, "cargo") || null;
  const perfil = texto(form, "perfil") as Perfil;
  const clientId = perfil === "cliente" ? texto(form, "client_id") || null : null;

  if (!nome || !/^\S+@\S+\.\S+$/.test(email)) return { erro: "Preencha nome e um e-mail válido." };
  if (iniciais.length < 1 || iniciais.length > 3) return { erro: "Iniciais com 1 a 3 letras." };
  if (!PERFIS.includes(perfil)) return { erro: "Escolha o perfil." };
  if (perfil === "cliente" && !clientId) return { erro: "Escolha de qual cliente é esta pessoa." };
  if (!(await podeGerir(perfil))) return { erro: "Você não tem permissão para convidar este perfil." };

  const supabase = await criarClienteServidor();
  const { data: existente } = await supabase.from("convites").select("usuario_criado_em").eq("email", email).maybeSingle();
  if (existente?.usuario_criado_em) return { erro: "Esta pessoa já foi convidada. Use “Reenviar acesso” na lista." };
  if (existente) await supabase.from("convites").delete().eq("email", email);

  const { error: erroConvite } = await supabase
    .from("convites")
    .insert({ email, nome, iniciais, cargo, perfil, client_id: clientId, convidado_por: (await pessoaAtual())!.id });
  if (erroConvite) return { erro: "Não foi possível registrar o convite." };

  const { error } = await criarClienteAdmin().auth.admin.inviteUserByEmail(email, { redirectTo: await linkConfirmar() });
  if (error) {
    await supabase.from("convites").delete().eq("email", email).is("usuario_criado_em", null);
    if (error.code === "email_exists") return { erro: "Este e-mail já tem acesso ao Bastidor." };
    if (error.status === 429) return { erro: "Limite de e-mails atingido. Tente de novo em alguns minutos." };
    return { erro: `O e-mail de convite não saiu (${error.message}).` };
  }

  revalidatePath("/configuracoes");
  revalidatePath("/clientes", "layout");
  return { ok: `Convite enviado para ${email}.` };
}

async function alvo(id: string) {
  const supabase = await criarClienteServidor();
  const { data } = await supabase.from("profiles").select("id, email, perfil, ativo").eq("id", id).maybeSingle();
  return data as { id: string; email: string; perfil: Perfil; ativo: boolean } | null;
}

export async function mudarPerfil(_: Estado, form: FormData): Promise<Estado> {
  const id = texto(form, "id");
  const perfil = texto(form, "perfil") as Perfil;
  if (!["socio", "adm", "criacao"].includes(perfil)) return { erro: "Perfil inválido." };
  const pessoa = await alvo(id);
  if (!pessoa || pessoa.perfil === "cliente") return { erro: "Pessoa não encontrada." };

  const supabase = await criarClienteServidor();
  const { error, count } = await supabase.from("profiles").update({ perfil }, { count: "exact" }).eq("id", id);
  if (error) return { erro: error.message.includes("Sócio ativo") ? "É preciso ter pelo menos um Sócio ativo." : "Sem permissão para mudar o perfil." };
  if (!count) return { erro: "Sem permissão para mudar o perfil." };
  revalidatePath("/configuracoes");
  revalidatePath("/clientes", "layout");
  return { ok: "Perfil atualizado." };
}

export async function alternarAcesso(_: Estado, form: FormData): Promise<Estado> {
  const id = texto(form, "id");
  const pessoa = await alvo(id);
  if (!pessoa) return { erro: "Pessoa não encontrada." };
  if (pessoa.id === (await pessoaAtual())?.id) return { erro: "Você não pode desativar o próprio acesso." };

  const supabase = await criarClienteServidor();
  const { error, count } = await supabase.from("profiles").update({ ativo: !pessoa.ativo }, { count: "exact" }).eq("id", id);
  if (error) return { erro: error.message.includes("Sócio ativo") ? "É preciso ter pelo menos um Sócio ativo." : "Sem permissão." };
  if (!count) return { erro: "Sem permissão." };
  revalidatePath("/configuracoes");
  revalidatePath("/clientes", "layout");
  return { ok: pessoa.ativo ? "Acesso desativado." : "Acesso reativado." };
}

// Quem nunca entrou recebe o convite de novo; quem já entrou recebe link de nova senha (time) ou link mágico (cliente)
export async function reenviarAcesso(_: Estado, form: FormData): Promise<Estado> {
  const pessoa = await alvo(texto(form, "id"));
  if (!pessoa || !pessoa.ativo) return { erro: "Pessoa não encontrada ou desativada." };
  if (!(await podeGerir(pessoa.perfil))) return { erro: "Sem permissão." };

  const admin = criarClienteAdmin();
  const { data } = await admin.auth.admin.getUserById(pessoa.id);
  const redirectTo = await linkConfirmar();
  const supabase = await criarClienteServidor();

  const { error } = !data.user?.email_confirmed_at
    ? await admin.auth.admin.inviteUserByEmail(pessoa.email, { redirectTo })
    : pessoa.perfil === "cliente"
      ? await supabase.auth.signInWithOtp({ email: pessoa.email, options: { shouldCreateUser: false, emailRedirectTo: redirectTo } })
      : await supabase.auth.resetPasswordForEmail(pessoa.email, { redirectTo });

  if (error) return { erro: error.status === 429 ? "Limite de e-mails atingido. Tente em alguns minutos." : "O e-mail não saiu." };
  return { ok: `Enviado para ${pessoa.email}.` };
}

// Responsável padrão de cada etapa de conteúdo (só o Sócio; a RLS de stage_defaults garante o mesmo)
export async function salvarResponsaveisPadrao(_: Estado, form: FormData): Promise<Estado> {
  const eu = await pessoaAtual();
  if (eu?.perfil !== "socio") return { erro: "Só o Sócio muda os responsáveis padrão." };
  const supabase = await criarClienteServidor();
  const etapas = ["pauta", "copy", "layout", "revisao", "cliente", "ajuste", "aprovado", "agendado"];
  for (const etapa of etapas) {
    const { error } = await supabase
      .from("stage_defaults")
      .update({ responsavel_id: texto(form, etapa) || null })
      .eq("etapa", etapa);
    if (error) return { erro: "Não foi possível salvar." };
  }
  revalidatePath("/configuracoes");
  return { ok: "Responsáveis padrão salvos." };
}

export async function salvarDiasLembrete(_: Estado, form: FormData): Promise<Estado> {
  const eu = await pessoaAtual();
  if (eu?.perfil !== "socio") return { erro: "Só o Sócio muda o lembrete." };
  const dias = Number(texto(form, "dias_lembrete"));
  if (!Number.isInteger(dias) || dias < 1 || dias > 30) return { erro: "Use um número de 1 a 30." };
  const supabase = await criarClienteServidor();
  const { error } = await supabase.from("app_settings").update({ dias_lembrete: dias, updated_at: new Date().toISOString() }).eq("id", 1);
  if (error) return { erro: "Não foi possível salvar." };
  revalidatePath("/configuracoes");
  return { ok: "Salvo." };
}
