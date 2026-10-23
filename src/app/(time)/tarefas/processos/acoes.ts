"use server";

import { revalidatePath } from "next/cache";
import { pessoaAtual } from "@/lib/sessao";
import { criarClienteServidor } from "@/lib/supabase/server";
import type { Estado } from "@/app/entrar/acoes";

// Modelos de processo: só Sócio e Adm

const texto = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

async function exigirGestao() {
  const eu = await pessoaAtual();
  return eu && (eu.perfil === "socio" || eu.perfil === "adm") ? eu : null;
}

const atualizar = () => revalidatePath("/tarefas", "layout");

export async function salvarProcesso(_: Estado, form: FormData): Promise<Estado> {
  if (!(await exigirGestao())) return { erro: "Só Sócio e Administrativo editam processos." };
  const id = texto(form, "id");
  const dados = { nome: texto(form, "nome"), area: texto(form, "area"), descricao: texto(form, "descricao") };
  if (!dados.nome) return { erro: "Dê um nome ao processo." };
  const supabase = await criarClienteServidor();
  const { error } = id ? await supabase.from("processos").update(dados).eq("id", id) : await supabase.from("processos").insert(dados);
  if (error) return { erro: "Não foi possível salvar." };
  atualizar();
  return { ok: "Salvo." };
}

export async function alternarProcesso(id: string, ativo: boolean): Promise<Estado> {
  if (!(await exigirGestao())) return { erro: "Sem permissão." };
  const supabase = await criarClienteServidor();
  const { error } = await supabase.from("processos").update({ ativo }).eq("id", id);
  if (error) return { erro: "Não foi possível mudar." };
  atualizar();
  return undefined;
}

export async function apagarProcesso(id: string): Promise<Estado> {
  if (!(await exigirGestao())) return { erro: "Sem permissão." };
  const supabase = await criarClienteServidor();
  const { error } = await supabase.from("processos").delete().eq("id", id);
  if (error) return { erro: "Não foi possível apagar." };
  atualizar();
  return undefined;
}

export async function salvarEtapaProcesso(_: Estado, form: FormData): Promise<Estado> {
  if (!(await exigirGestao())) return { erro: "Sem permissão." };
  const id = texto(form, "id");
  const dias = Number(texto(form, "dias") || "0");
  const dados = { nome: texto(form, "nome"), responsavel_id: texto(form, "responsavel_id") || null, dias };
  if (!dados.nome) return { erro: "Dê um nome à etapa." };
  if (!Number.isInteger(dias) || dias < 0 || dias > 365) return { erro: "Dias entre 0 e 365." };
  const supabase = await criarClienteServidor();
  if (id) {
    const { error } = await supabase.from("processo_etapas").update(dados).eq("id", id);
    if (error) return { erro: "Não foi possível salvar." };
  } else {
    const processoId = texto(form, "processo_id");
    const { data: ultima } = await supabase.from("processo_etapas").select("ordem").eq("processo_id", processoId).order("ordem", { ascending: false }).limit(1).maybeSingle();
    const { error } = await supabase.from("processo_etapas").insert({ ...dados, processo_id: processoId, ordem: (ultima?.ordem ?? 0) + 1 });
    if (error) return { erro: "Não foi possível adicionar." };
  }
  atualizar();
  return { ok: "Salvo." };
}

export async function moverEtapaProcesso(id: string, direcao: -1 | 1): Promise<Estado> {
  if (!(await exigirGestao())) return { erro: "Sem permissão." };
  const supabase = await criarClienteServidor();
  const { data: atual } = await supabase.from("processo_etapas").select("processo_id").eq("id", id).maybeSingle();
  if (!atual) return undefined;
  const { data: etapas } = await supabase.from("processo_etapas").select("id, ordem").eq("processo_id", atual.processo_id).order("ordem").order("nome");
  const lista = etapas ?? [];
  const i = lista.findIndex((e) => e.id === id);
  const j = i + direcao;
  if (i < 0 || j < 0 || j >= lista.length) return undefined;
  // Renumera tudo para não depender de ordens repetidas
  const nova = [...lista];
  [nova[i], nova[j]] = [nova[j], nova[i]];
  await Promise.all(nova.map((e, k) => supabase.from("processo_etapas").update({ ordem: k + 1 }).eq("id", e.id)));
  atualizar();
  return undefined;
}

export async function apagarEtapaProcesso(id: string): Promise<Estado> {
  if (!(await exigirGestao())) return { erro: "Sem permissão." };
  const supabase = await criarClienteServidor();
  const { error } = await supabase.from("processo_etapas").delete().eq("id", id);
  if (error) return { erro: "Não foi possível apagar." };
  atualizar();
  return undefined;
}
