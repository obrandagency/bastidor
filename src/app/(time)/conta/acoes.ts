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
