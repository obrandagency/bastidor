"use server";

import { revalidatePath } from "next/cache";
import { criarClienteServidor } from "@/lib/supabase/server";
import type { Estado } from "@/app/entrar/acoes";

// As regras (só o próprio cliente, só conteúdo esperando aprovação) ficam nas funções do banco
export async function aprovar(id: string): Promise<Estado> {
  const supabase = await criarClienteServidor();
  const { error } = await supabase.rpc("portal_aprovar", { p_task_id: id });
  if (error) return { erro: error.code === "23514" || error.code === "42501" ? error.message : "Não foi possível aprovar. Tente de novo." };
  revalidatePath("/portal", "layout");
  return { ok: "Aprovado. Obrigado!" };
}

export async function pedirAjuste(id: string, texto: string): Promise<Estado> {
  if (!texto.trim()) return { erro: "Descreva o que precisa mudar." };
  const supabase = await criarClienteServidor();
  const { error } = await supabase.rpc("portal_pedir_ajuste", { p_task_id: id, p_texto: texto });
  if (error) return { erro: error.code === "23514" || error.code === "42501" ? error.message : "Não foi possível enviar o pedido. Tente de novo." };
  revalidatePath("/portal", "layout");
  return { ok: "Pedido de ajuste enviado para a equipe." };
}
