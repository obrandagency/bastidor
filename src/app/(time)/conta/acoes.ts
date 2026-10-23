"use server";

import { revalidatePath } from "next/cache";
import { pessoaAtual } from "@/lib/sessao";
import { criarClienteServidor } from "@/lib/supabase/server";
import type { Estado } from "@/app/entrar/acoes";

export async function salvarPreferencias(_: Estado, form: FormData): Promise<Estado> {
  const eu = await pessoaAtual();
  if (!eu) return { erro: "Entre de novo." };
  const supabase = await criarClienteServidor();
  const { error } = await supabase.from("profiles").update({ emails_opcionais: form.get("emails_opcionais") === "on" }).eq("id", eu.id);
  if (error) return { erro: "Não foi possível salvar." };
  revalidatePath("/conta");
  return { ok: "Preferência salva." };
}

// Foto da pessoa: ela mesma ou o Sócio (a política profiles_editar e a do bucket conferem de novo)
export async function salvarFoto(pessoaId: string, caminho: string | null): Promise<Estado> {
  const eu = await pessoaAtual();
  if (!eu || eu.perfil === "cliente") return { erro: "Sem permissão." };
  if (pessoaId !== eu.id && eu.perfil !== "socio") return { erro: "Só o Sócio troca a foto de outra pessoa." };
  const supabase = await criarClienteServidor();
  const { data: antes } = await supabase.from("profiles").select("foto").eq("id", pessoaId).maybeSingle();
  const { error } = await supabase.from("profiles").update({ foto: caminho }).eq("id", pessoaId);
  if (error) return { erro: "Não foi possível salvar a foto." };
  const { apagarImagemAntiga } = await import("@/lib/marca-servidor");
  await apagarImagemAntiga(supabase, antes?.foto ?? null, caminho);
  revalidatePath("/", "layout");
  return { ok: "Foto salva." };
}
