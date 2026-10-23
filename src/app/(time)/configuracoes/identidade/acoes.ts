"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { contraste, CONTRASTE_MINIMO } from "@/lib/marca";
import { pessoaAtual } from "@/lib/sessao";
import { criarClienteServidor } from "@/lib/supabase/server";
import type { Estado } from "@/app/entrar/acoes";

const texto = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

async function exigirSocio() {
  const eu = await pessoaAtual();
  return eu?.perfil === "socio" ? eu : null;
}

// Nome, logo e cor aparecem em todas as telas, na entrada e nos e-mails
function atualizarTudo() {
  revalidateTag("identidade");
  revalidatePath("/", "layout");
}

export async function salvarIdentidade(_: Estado, form: FormData): Promise<Estado> {
  if (!(await exigirSocio())) return { erro: "Só o Sócio muda a identidade." };
  const nome_agencia = texto(form, "nome_agencia");
  const nome_sistema = texto(form, "nome_sistema");
  const cor = texto(form, "cor").toUpperCase();
  if (!nome_agencia || nome_agencia.length > 40) return { erro: "Nome da agência com 1 a 40 caracteres." };
  if (!nome_sistema || nome_sistema.length > 30) return { erro: "Nome do sistema com 1 a 30 caracteres." };
  if (!/^#[0-9A-F]{6}$/.test(cor)) return { erro: "Cor inválida. Use o formato #RRGGBB." };
  if (contraste(cor, "#FFFFFF") < CONTRASTE_MINIMO) return { erro: "Essa cor é clara demais: links e botões ficariam difíceis de ler no fundo branco. Escolha um tom mais escuro." };
  const supabase = await criarClienteServidor();
  const { error } = await supabase.from("identidade").update({ nome_agencia, nome_sistema, cor }).eq("id", true);
  if (error) return { erro: "Não foi possível salvar." };
  atualizarTudo();
  return { ok: "Identidade salva." };
}

export async function salvarLogoAgencia(caminho: string | null): Promise<Estado> {
  if (!(await exigirSocio())) return { erro: "Só o Sócio troca o logo." };
  const supabase = await criarClienteServidor();
  const { data: antes } = await supabase.from("identidade").select("logo").maybeSingle();
  const { error } = await supabase.from("identidade").update({ logo: caminho }).eq("id", true);
  if (error) return { erro: "Não foi possível salvar o logo." };
  const { apagarImagemAntiga } = await import("@/lib/marca-servidor");
  await apagarImagemAntiga(supabase, antes?.logo ?? null, caminho);
  atualizarTudo();
  return { ok: "Logo salvo." };
}
