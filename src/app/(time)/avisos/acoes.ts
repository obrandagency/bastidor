"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { criarClienteServidor } from "@/lib/supabase/server";

// A RLS só deixa marcar os próprios avisos (e só a coluna lida_em)
export async function abrirAviso(form: FormData) {
  const supabase = await criarClienteServidor();
  await supabase.from("notifications").update({ lida_em: new Date().toISOString() }).eq("id", Number(form.get("id")));
  revalidatePath("/", "layout");
  const link = String(form.get("link") ?? "");
  // Só caminhos internos ("//site.com" e "/\\site.com" levariam para fora)
  redirect(/^\/(?![/\\])/.test(link) ? link : "/avisos");
}

export async function marcarTodasLidas() {
  const supabase = await criarClienteServidor();
  await supabase.from("notifications").update({ lida_em: new Date().toISOString() }).is("lida_em", null);
  revalidatePath("/", "layout");
}
