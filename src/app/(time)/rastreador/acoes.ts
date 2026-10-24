"use server";

import { revalidatePath } from "next/cache";
import type { Estado } from "@/app/entrar/acoes";
import { paraTimestampSP } from "@/lib/dominio/tarefas";
import { lerDuracao } from "@/lib/dominio/tempo";
import { pessoaAtual } from "@/lib/sessao";
import { criarClienteServidor } from "@/lib/supabase/server";

const texto = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const atualizar = () => revalidatePath("/", "layout");

async function exigirTime() {
  const eu = await pessoaAtual();
  return eu && eu.perfil !== "cliente" ? eu : null;
}

// Liga a contagem nesta tarefa (a que estiver ligada para sozinha)
export async function iniciarContagem(taskId: string): Promise<Estado> {
  if (!(await exigirTime())) return { erro: "Sem permissão." };
  const supabase = await criarClienteServidor();
  const { error } = await supabase.rpc("iniciar_contagem", { p_task: taskId });
  if (error) return { erro: "Não foi possível iniciar a contagem." };
  atualizar();
  return { ok: "Contando." };
}

export async function pararContagem(): Promise<Estado> {
  if (!(await exigirTime())) return { erro: "Sem permissão." };
  const supabase = await criarClienteServidor();
  const { error } = await supabase.rpc("parar_contagem");
  if (error) return { erro: "Não foi possível parar a contagem." };
  atualizar();
  return { ok: "Parado." };
}

// Data, hora de início e duração -> início e fim no fuso de São Paulo
function periodo(form: FormData) {
  const data = texto(form, "data");
  const hora = texto(form, "hora") || "09:00";
  const minutos = lerDuracao(texto(form, "duracao"));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data) || !/^\d{2}:\d{2}$/.test(hora)) return { erro: "Informe a data e a hora." };
  if (!minutos || minutos < 1) return { erro: "Informe a duração (ex.: 1h30, 45min ou 1,5)." };
  const inicio = new Date(paraTimestampSP(data, hora));
  return { inicio: inicio.toISOString(), fim: new Date(inicio.getTime() + minutos * 60000).toISOString(), minutos };
}

// "Esqueci de ligar": lança tempo já feito, sempre em nome de quem lança
export async function lancarTempo(_: Estado, form: FormData): Promise<Estado> {
  const eu = await exigirTime();
  if (!eu) return { erro: "Sem permissão." };
  const p = periodo(form);
  if ("erro" in p) return { erro: p.erro };
  if (p.minutos > 12 * 60) return { erro: "Lance no máximo 12 horas de uma vez." };
  const supabase = await criarClienteServidor();
  const { error } = await supabase.from("tempo_registros").insert({
    task_id: texto(form, "task_id"),
    pessoa_id: eu.id,
    inicio: p.inicio,
    fim: p.fim,
    manual: true,
    nota: texto(form, "nota") || null,
  });
  if (error) return { erro: error.message.includes("futuro") ? "Não dá para lançar tempo no futuro." : "Não foi possível lançar o tempo." };
  atualizar();
  return { ok: "Tempo lançado." };
}

// Só o Sócio corrige ou apaga uma contagem
export async function corrigirContagem(_: Estado, form: FormData): Promise<Estado> {
  const eu = await pessoaAtual();
  if (eu?.perfil !== "socio") return { erro: "Só o Sócio corrige contagens." };
  const p = periodo(form);
  if ("erro" in p) return { erro: p.erro };
  if (p.minutos > 24 * 60) return { erro: "Uma contagem tem no máximo 24 horas." };
  const supabase = await criarClienteServidor();
  const { error, count } = await supabase
    .from("tempo_registros")
    .update({ inicio: p.inicio, fim: p.fim, nota: texto(form, "nota") || null }, { count: "exact" })
    .eq("id", texto(form, "id"));
  if (error || !count) return { erro: "Não foi possível corrigir." };
  atualizar();
  return { ok: "Corrigido." };
}

export async function apagarContagem(id: string): Promise<Estado> {
  const eu = await pessoaAtual();
  if (eu?.perfil !== "socio") return { erro: "Só o Sócio apaga contagens." };
  const supabase = await criarClienteServidor();
  const { error, count } = await supabase.from("tempo_registros").delete({ count: "exact" }).eq("id", id);
  if (error || !count) return { erro: "Não foi possível apagar." };
  atualizar();
  return { ok: "Apagada." };
}
