"use server";

import { revalidatePath } from "next/cache";
import { pessoaAtual } from "@/lib/sessao";
import { criarClienteServidor } from "@/lib/supabase/server";
import type { Estado } from "@/app/entrar/acoes";

// Etapas de uma demanda (cópia do processo). O banco garante a sequência e passa a demanda adiante.

async function exigirTime() {
  const eu = await pessoaAtual();
  return eu && eu.perfil !== "cliente" ? eu : null;
}

const erroDoBanco = (e: { message: string; code?: string }, padrao: string) => (e.code === "23514" || e.code === "P0001" ? e.message : padrao);

function atualizar() {
  revalidatePath("/tarefas");
  revalidatePath("/inicio");
}

export async function aplicarProcesso(taskId: string, processoId: string, inicio: string): Promise<Estado> {
  if (!(await exigirTime())) return { erro: "Sem permissão." };
  if (!processoId || !/^\d{4}-\d{2}-\d{2}$/.test(inicio)) return { erro: "Escolha o processo e a data de início." };
  const supabase = await criarClienteServidor();
  const { error } = await supabase.rpc("aplicar_processo", { p_task: taskId, p_processo: processoId, p_inicio: inicio });
  if (error) return { erro: erroDoBanco(error, "Não foi possível aplicar o processo.") };
  atualizar();
  return { ok: "Processo aplicado." };
}

export async function marcarEtapa(id: string, feito: boolean): Promise<Estado> {
  if (!(await exigirTime())) return { erro: "Sem permissão." };
  const supabase = await criarClienteServidor();
  const { error } = await supabase.from("tarefa_etapas").update({ feito_em: feito ? new Date().toISOString() : null }).eq("id", id);
  if (error) return { erro: erroDoBanco(error, "Não foi possível marcar.") };
  atualizar();
  return undefined;
}

export async function editarEtapa(id: string, mudancas: { nome?: string; responsavel_id?: string | null; prazo?: string | null }): Promise<Estado> {
  if (!(await exigirTime())) return { erro: "Sem permissão." };
  if (mudancas.nome !== undefined && !mudancas.nome.trim()) return { erro: "Dê um nome à etapa." };
  const supabase = await criarClienteServidor();
  const { error } = await supabase.from("tarefa_etapas").update(mudancas).eq("id", id);
  if (error) return { erro: erroDoBanco(error, "Não foi possível salvar.") };
  atualizar();
  return undefined;
}

export async function adicionarEtapa(_: Estado, form: FormData): Promise<Estado> {
  if (!(await exigirTime())) return { erro: "Sem permissão." };
  const taskId = String(form.get("task_id") ?? "");
  const nome = String(form.get("nome") ?? "").trim();
  if (!nome) return { erro: "Dê um nome à etapa." };
  const supabase = await criarClienteServidor();
  const { data: ultima } = await supabase.from("tarefa_etapas").select("ordem").eq("task_id", taskId).order("ordem", { ascending: false }).limit(1).maybeSingle();
  const { error } = await supabase.from("tarefa_etapas").insert({ task_id: taskId, nome, ordem: (ultima?.ordem ?? 0) + 1, prazo: String(form.get("prazo") ?? "") || null });
  if (error) return { erro: erroDoBanco(error, "Não foi possível adicionar.") };
  atualizar();
  return { ok: "Etapa adicionada." };
}

export async function removerEtapa(id: string): Promise<Estado> {
  if (!(await exigirTime())) return { erro: "Sem permissão." };
  const supabase = await criarClienteServidor();
  const { error } = await supabase.from("tarefa_etapas").delete().eq("id", id);
  if (error) return { erro: erroDoBanco(error, "Não foi possível remover.") };
  atualizar();
  return undefined;
}
