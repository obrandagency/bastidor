"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { pessoaAtual } from "@/lib/sessao";
import { criarClienteServidor } from "@/lib/supabase/server";
import type { TipoTarefa } from "@/lib/dominio/tarefas";
import type { Estado } from "@/app/entrar/acoes";

const texto = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const ouNulo = (v: string) => v || null;

async function exigirGestao() {
  const eu = await pessoaAtual();
  return eu && (eu.perfil === "socio" || eu.perfil === "adm") ? eu : null;
}

function mensagem(erro: { message: string; code?: string }) {
  if (erro.message.includes("recorrencias_regra")) return "Escolha os dias da semana ou o dia do mês.";
  if (erro.message.includes("recorrencias_formato")) return "Escolha o formato do conteúdo.";
  if (erro.message.includes("recorrencias_area")) return "Escolha a área da demanda.";
  if (erro.message.includes("recorrencias_conteudo_tem_cliente")) return "Conteúdo precisa de um cliente.";
  if (erro.message.includes("recorrencias_legenda")) return "A legenda passou de 2.200 caracteres.";
  if (erro.message.includes("recorrencias_periodo")) return "O fim precisa ser depois do início.";
  if (erro.message.includes("antecedencia")) return "Antecedência entre 0 e 60 dias.";
  return "Não foi possível salvar.";
}

export async function salvarRecorrencia(_: Estado, form: FormData): Promise<Estado> {
  if (!(await exigirGestao())) return { erro: "Só Sócio e Administrativo criam tarefas recorrentes." };
  const id = texto(form, "id");
  const tipo = texto(form, "tipo") as TipoTarefa;
  const frequencia = texto(form, "frequencia");
  const clientId = texto(form, "client_id");
  const dados = {
    tipo,
    titulo: texto(form, "titulo"),
    client_id: clientId === "interno" ? null : ouNulo(clientId),
    formato: tipo === "conteudo" ? ouNulo(texto(form, "formato")) : null,
    area: tipo === "demanda" ? ouNulo(texto(form, "area")) : null,
    responsavel_id: ouNulo(texto(form, "responsavel_id")),
    texto: texto(form, "texto"),
    frequencia,
    processo_id: tipo === "demanda" ? ouNulo(texto(form, "processo_id")) : null,
    dias_semana: frequencia === "mensal" ? null : form.getAll("dias_semana").map(Number),
    dia_mes: frequencia === "mensal" ? Number(texto(form, "dia_mes")) || null : null,
    antecedencia: Number(texto(form, "antecedencia") || "7"),
    inicio: texto(form, "inicio") || undefined,
    fim: ouNulo(texto(form, "fim")),
  };
  if (!dados.titulo) return { erro: "Dê um título." };
  if (frequencia !== "mensal" && !dados.dias_semana?.length) return { erro: "Escolha pelo menos um dia da semana." };

  const supabase = await criarClienteServidor();
  const { data, error } = id
    ? await supabase.from("recorrencias").update(dados).eq("id", id).select("id").single()
    : await supabase.from("recorrencias").insert(dados).select("id").single();
  if (error || !data) return { erro: error ? mensagem(error) : "Não foi possível salvar." };
  // Gera já o que estiver dentro da antecedência, sem esperar a rotina das 6h
  await supabase.rpc("gerar_recorrentes", { p_id: data.id });
  revalidatePath("/tarefas", "layout");
  redirect("/tarefas/recorrentes");
}

export async function pausarRecorrencia(id: string, ativa: boolean): Promise<Estado> {
  if (!(await exigirGestao())) return { erro: "Sem permissão." };
  const supabase = await criarClienteServidor();
  const { error } = await supabase.from("recorrencias").update({ ativa }).eq("id", id);
  if (error) return { erro: "Não foi possível mudar." };
  if (ativa) await supabase.rpc("gerar_recorrentes", { p_id: id });
  revalidatePath("/tarefas", "layout");
  return undefined;
}

export async function apagarRecorrencia(id: string): Promise<Estado> {
  if (!(await exigirGestao())) return { erro: "Sem permissão." };
  const supabase = await criarClienteServidor();
  const { error } = await supabase.from("recorrencias").delete().eq("id", id);
  if (error) return { erro: "Não foi possível apagar." };
  revalidatePath("/tarefas", "layout");
  return undefined;
}
