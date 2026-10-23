"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Cena, SituacaoRoteiro } from "@/lib/dominio/roteiros";
import { pessoaAtual } from "@/lib/sessao";
import { criarClienteServidor } from "@/lib/supabase/server";
import type { Estado } from "@/app/entrar/acoes";

const texto = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

async function exigirTime() {
  const eu = await pessoaAtual();
  return eu && eu.perfil !== "cliente" ? eu : null;
}

// Novo roteiro avulso (formulário da lista) ou a partir de um conteúdo do quadro (task_id)
export async function criarRoteiro(_: Estado, form: FormData): Promise<Estado> {
  if (!(await exigirTime())) return { erro: "Sem permissão." };
  const clientId = texto(form, "client_id");
  const dados = {
    titulo: texto(form, "titulo"),
    client_id: clientId && clientId !== "interno" ? clientId : null,
    formato: texto(form, "formato") || "reels",
    task_id: texto(form, "task_id") || null,
  };
  if (!dados.titulo) return { erro: "Dê um título ao roteiro." };
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase.from("roteiros").insert(dados).select("id").single();
  if (error || !data) return { erro: "Não foi possível criar o roteiro." };
  // Começa com três cenas em branco para facilitar
  await supabase.from("roteiro_cenas").insert([1, 2, 3].map((ordem) => ({ roteiro_id: data.id, ordem })));
  revalidatePath("/roteiros");
  if (dados.task_id) revalidatePath("/tarefas");
  redirect(`/roteiros/${data.id}`);
}

// Botão "Criar roteiro" no detalhe de um conteúdo de vídeo
export async function criarRoteiroDoConteudo(form: FormData): Promise<void> {
  await criarRoteiro(undefined, form);
}

export type DadosRoteiro = {
  titulo: string;
  client_id: string | null;
  formato: string;
  duracao: string;
  objetivo: string;
  referencias: string;
  texto_livre: string;
  cta: string;
  legenda: string;
  situacao: SituacaoRoteiro;
  cenas: Cena[];
};

// Salva tudo de uma vez: campos e cenas (as cenas são regravadas na ordem da tela)
export async function salvarRoteiro(id: string, d: DadosRoteiro): Promise<Estado> {
  if (!(await exigirTime())) return { erro: "Sem permissão." };
  if (!d.titulo.trim()) return { erro: "Dê um título ao roteiro." };
  if (d.cenas.length > 200) return { erro: "Até 200 cenas por roteiro." };
  const supabase = await criarClienteServidor();
  const { cenas, ...campos } = d;
  const { error } = await supabase.from("roteiros").update({ ...campos, titulo: campos.titulo.trim() }).eq("id", id);
  if (error) return { erro: error.message.includes("check") ? "Algum campo passou do tamanho máximo." : "Não foi possível salvar." };
  const { error: e2 } = await supabase.rpc("salvar_roteiro_cenas", { p_roteiro: id, p_cenas: cenas });
  if (e2) return { erro: "Não foi possível salvar as cenas (alguma passou do tamanho máximo?)." };
  revalidatePath("/roteiros");
  revalidatePath(`/roteiros/${id}`);
  return { ok: "Salvo." };
}

export async function apagarRoteiro(id: string): Promise<Estado> {
  if (!(await exigirTime())) return { erro: "Sem permissão." };
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase.from("roteiros").delete().eq("id", id).select("id");
  if (error || !data?.length) return { erro: "Só Sócio, Administrativo ou quem criou apaga o roteiro." };
  revalidatePath("/roteiros");
  redirect("/roteiros");
}

export async function duplicarRoteiro(id: string): Promise<Estado> {
  if (!(await exigirTime())) return { erro: "Sem permissão." };
  const supabase = await criarClienteServidor();
  const { data: r } = await supabase.from("roteiros").select("*").eq("id", id).maybeSingle();
  if (!r) return { erro: "Roteiro não encontrado." };
  const { data: novo, error } = await supabase
    .from("roteiros")
    .insert({
      client_id: r.client_id,
      titulo: `${r.titulo} (cópia)`.slice(0, 200),
      formato: r.formato,
      duracao: r.duracao,
      objetivo: r.objetivo,
      referencias: r.referencias,
      texto_livre: r.texto_livre,
      cta: r.cta,
      legenda: r.legenda,
    })
    .select("id")
    .single();
  if (error || !novo) return { erro: "Não foi possível duplicar." };
  const { data: cenas } = await supabase.from("roteiro_cenas").select("ordem, tempo, imagem, fala, texto_tela, audio").eq("roteiro_id", id);
  if (cenas?.length) await supabase.from("roteiro_cenas").insert(cenas.map((c) => ({ ...c, roteiro_id: novo.id })));
  revalidatePath("/roteiros");
  redirect(`/roteiros/${novo.id}`);
}
