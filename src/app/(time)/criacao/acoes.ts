"use server";

import { revalidatePath } from "next/cache";
import { BUCKET_ARTES } from "@/lib/constantes";
import { pessoaAtual } from "@/lib/sessao";
import { criarClienteServidor } from "@/lib/supabase/server";
import type { Estado } from "@/app/entrar/acoes";

async function exigirTimeAcao() {
  const eu = await pessoaAtual();
  return eu && eu.perfil !== "cliente" ? eu : null;
}

const atualizar = () => {
  revalidatePath("/criacao");
  revalidatePath("/tarefas");
};

export async function salvarLegenda(id: string, texto: string): Promise<Estado> {
  if (!(await exigirTimeAcao())) return { erro: "Sem permissão." };
  if (texto.length > 2200) return { erro: "A legenda passou de 2.200 caracteres." };
  const supabase = await criarClienteServidor();
  const { error } = await supabase.from("tasks").update({ texto }).eq("id", id);
  if (error) return { erro: "Não foi possível salvar a legenda." };
  atualizar();
  return { ok: "Legenda salva." };
}

// O arquivo já foi enviado ao Storage pelo navegador; aqui só registramos na tarefa
export async function registrarArte(taskId: string, caminho: string, tipo: "imagem" | "video"): Promise<Estado> {
  const eu = await exigirTimeAcao();
  if (!eu) return { erro: "Sem permissão." };
  if (caminho.split("/")[1] !== taskId) return { erro: "Caminho de arquivo inválido." };
  const supabase = await criarClienteServidor();
  const { count } = await supabase.from("task_assets").select("id", { count: "exact", head: true }).eq("task_id", taskId);
  const { error } = await supabase.from("task_assets").insert({ task_id: taskId, caminho, tipo_midia: tipo, ordem: count ?? 0, criado_por: eu.id });
  if (error) {
    await supabase.storage.from(BUCKET_ARTES).remove([caminho]);
    return { erro: "Não foi possível registrar a arte." };
  }
  atualizar();
  return { ok: "Arte enviada." };
}

export async function removerArte(id: string): Promise<Estado> {
  if (!(await exigirTimeAcao())) return { erro: "Sem permissão." };
  const supabase = await criarClienteServidor();
  const { data: arte } = await supabase.from("task_assets").select("caminho").eq("id", id).maybeSingle();
  if (!arte) return { erro: "Arte não encontrada." };
  const { error } = await supabase.from("task_assets").delete().eq("id", id);
  if (error) return { erro: "Não foi possível remover." };
  await supabase.storage.from(BUCKET_ARTES).remove([arte.caminho]);
  atualizar();
  return { ok: "Arte removida." };
}

// Troca a arte de posição com a vizinha (ordem do carrossel)
export async function moverArte(id: string, direcao: -1 | 1): Promise<Estado> {
  if (!(await exigirTimeAcao())) return { erro: "Sem permissão." };
  const supabase = await criarClienteServidor();
  const { data: arte } = await supabase.from("task_assets").select("task_id").eq("id", id).maybeSingle();
  if (!arte) return { erro: "Arte não encontrada." };
  const { data: todas } = await supabase.from("task_assets").select("id").eq("task_id", arte.task_id).order("ordem").order("created_at");
  const ids = (todas ?? []).map((a) => a.id);
  const i = ids.indexOf(id);
  const j = i + direcao;
  if (i < 0 || j < 0 || j >= ids.length) return undefined;
  [ids[i], ids[j]] = [ids[j], ids[i]];
  for (const [ordem, aid] of ids.entries()) await supabase.from("task_assets").update({ ordem }).eq("id", aid);
  atualizar();
  return undefined;
}
