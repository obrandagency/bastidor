"use server";

import { revalidatePath } from "next/cache";
import { paraTimestampSP } from "@/lib/dominio/tarefas";
import { pessoaAtual } from "@/lib/sessao";
import { criarClienteServidor } from "@/lib/supabase/server";
import type { Estado } from "@/app/entrar/acoes";

// Lembretes pessoais: a política do banco garante que cada um mexe só nos seus

export type Repetir = "nunca" | "diario" | "dias_uteis" | "semanal";
export type Lembrete = { id: string; texto: string; quando: string; repetir: Repetir; client_id: string | null; task_id: string | null; avisado_em: string | null };

async function exigirTime() {
  const eu = await pessoaAtual();
  return eu && eu.perfil !== "cliente" ? eu : null;
}

const atualizar = () => revalidatePath("/", "layout");

export async function salvarLembrete(d: { id?: string; texto: string; data: string; hora: string; repetir: Repetir; client_id: string | null; task_id: string | null }): Promise<Estado> {
  if (!(await exigirTime())) return { erro: "Sem permissão." };
  const texto = d.texto.trim();
  if (!texto) return { erro: "Escreva o lembrete." };
  if (texto.length > 300) return { erro: "Até 300 caracteres." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.data) || !/^\d{2}:\d{2}$/.test(d.hora)) return { erro: "Escolha o dia e a hora." };
  const dados = { texto, quando: paraTimestampSP(d.data, d.hora), repetir: d.repetir, client_id: d.client_id, task_id: d.task_id, avisado_em: null };
  const supabase = await criarClienteServidor();
  const { error } = d.id ? await supabase.from("lembretes").update(dados).eq("id", d.id) : await supabase.from("lembretes").insert(dados);
  if (error) return { erro: "Não foi possível salvar o lembrete." };
  atualizar();
  return { ok: "Lembrete salvo." };
}

export async function concluirLembrete(id: string): Promise<Estado> {
  if (!(await exigirTime())) return { erro: "Sem permissão." };
  const supabase = await criarClienteServidor();
  const { error } = await supabase.rpc("concluir_lembrete", { p_id: id });
  if (error) return { erro: "Não foi possível concluir." };
  atualizar();
  return undefined;
}

// Adiar: minutos a partir de agora, ou "amanhã às 9h"
export async function adiarLembrete(id: string, minutos: number | "amanha"): Promise<Estado> {
  if (!(await exigirTime())) return { erro: "Sem permissão." };
  let quando: string;
  if (minutos === "amanha") {
    const amanha = new Date(Date.now() + 86_400_000).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
    quando = paraTimestampSP(amanha, "09:00");
  } else quando = new Date(Date.now() + minutos * 60_000).toISOString();
  const supabase = await criarClienteServidor();
  const { error } = await supabase.from("lembretes").update({ quando, avisado_em: null }).eq("id", id);
  if (error) return { erro: "Não foi possível adiar." };
  atualizar();
  return undefined;
}

export async function apagarLembrete(id: string): Promise<Estado> {
  if (!(await exigirTime())) return { erro: "Sem permissão." };
  const supabase = await criarClienteServidor();
  const { error } = await supabase.from("lembretes").delete().eq("id", id);
  if (error) return { erro: "Não foi possível apagar." };
  atualizar();
  return undefined;
}

// Chamado pelo navegador na hora marcada: põe no sino (o pg_cron faz o mesmo a cada minuto)
export async function dispararLembretes(): Promise<void> {
  if (!(await exigirTime())) return;
  const supabase = await criarClienteServidor();
  await supabase.rpc("disparar_lembretes");
}
