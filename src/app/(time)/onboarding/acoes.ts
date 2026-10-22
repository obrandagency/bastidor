"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { BUCKET_ONBOARDING } from "@/lib/constantes";
import { pessoaAtual } from "@/lib/sessao";
import { criarClienteServidor } from "@/lib/supabase/server";
import type { Estado } from "@/app/entrar/acoes";

const texto = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

async function exigirGestao() {
  const eu = await pessoaAtual();
  return eu && (eu.perfil === "socio" || eu.perfil === "adm") ? eu : null;
}

const atualizar = (id?: string) => {
  revalidatePath("/onboarding");
  if (id) revalidatePath(`/onboarding/${id}`);
};

export async function iniciarOnboarding(_: Estado, form: FormData): Promise<Estado> {
  const eu = await exigirGestao();
  if (!eu) return { erro: "Só Sócio e Administrativo iniciam onboarding." };
  const clientId = texto(form, "client_id");
  if (!clientId) return { erro: "Escolha o cliente." };
  const supabase = await criarClienteServidor();
  let etapa = texto(form, "etapa_id");
  if (!etapa) {
    const { data } = await supabase.from("onboarding_etapas").select("id").order("ordem").limit(1).single();
    etapa = data?.id ?? "";
  }
  const { data, error } = await supabase
    .from("onboardings")
    .insert({ client_id: clientId, etapa_id: etapa, inicio: texto(form, "inicio") || undefined, responsavel_id: texto(form, "responsavel_id") || eu.id })
    .select("id")
    .single();
  if (error?.code === "23505") return { erro: "Este cliente já tem onboarding." };
  if (error || !data) return { erro: "Não foi possível iniciar." };
  atualizar();
  revalidatePath(`/clientes/${clientId}`);
  redirect(`/onboarding/${data.id}`);
}

// Botão da Central do cliente (sem estado de formulário; o sucesso redireciona)
export async function iniciarDaCentral(form: FormData): Promise<void> {
  await iniciarOnboarding(undefined, form);
}

export async function moverOnboarding(id: string, etapaId: string): Promise<Estado> {
  if (!(await exigirGestao())) return { erro: "Sem permissão." };
  const supabase = await criarClienteServidor();
  const { error } = await supabase.from("onboardings").update({ etapa_id: etapaId }).eq("id", id);
  if (error) return { erro: "Não foi possível mover." };
  atualizar(id);
  return { ok: "Movido." };
}

export async function salvarInformacoes(_: Estado, form: FormData): Promise<Estado> {
  if (!(await exigirGestao())) return { erro: "Sem permissão." };
  const id = texto(form, "id");
  const supabase = await criarClienteServidor();
  const { error } = await supabase
    .from("onboardings")
    .update({ inicio: texto(form, "inicio"), responsavel_id: texto(form, "responsavel_id") || null })
    .eq("id", id);
  if (error) return { erro: "Não foi possível salvar." };
  atualizar(id);
  return { ok: "Salvo." };
}

export async function excluirOnboarding(_: Estado, form: FormData): Promise<Estado> {
  const eu = await pessoaAtual();
  if (eu?.perfil !== "socio") return { erro: "Só o Sócio exclui onboarding." };
  const id = texto(form, "id");
  const supabase = await criarClienteServidor();
  const { data: docs } = await supabase.from("onboarding_documentos").select("caminho").eq("onboarding_id", id);
  const { error } = await supabase.from("onboardings").delete().eq("id", id);
  if (error) return { erro: "Não foi possível excluir." };
  if (docs?.length) await supabase.storage.from(BUCKET_ONBOARDING).remove(docs.map((d) => d.caminho));
  atualizar();
  redirect("/onboarding");
}

// ---------------------------------------------------------------- tarefas do cliente
export async function marcarTarefa(id: string, onboardingId: string, feito: boolean): Promise<Estado> {
  if (!(await exigirGestao())) return { erro: "Só Sócio e Administrativo marcam tarefas." };
  const supabase = await criarClienteServidor();
  const { error } = await supabase.from("onboarding_tarefas").update({ feito_em: feito ? new Date().toISOString() : null }).eq("id", id);
  if (error) return { erro: "Não foi possível marcar." };
  atualizar(onboardingId);
  return undefined;
}

export async function adicionarTarefa(_: Estado, form: FormData): Promise<Estado> {
  if (!(await exigirGestao())) return { erro: "Sem permissão." };
  const onboardingId = texto(form, "onboarding_id");
  const etapaId = texto(form, "etapa_id");
  const t = texto(form, "texto");
  if (!t) return { erro: "Escreva a tarefa." };
  const supabase = await criarClienteServidor();
  const { count } = await supabase.from("onboarding_tarefas").select("id", { count: "exact", head: true }).eq("onboarding_id", onboardingId).eq("etapa_id", etapaId);
  const { error } = await supabase.from("onboarding_tarefas").insert({ onboarding_id: onboardingId, etapa_id: etapaId, texto: t, ordem: (count ?? 0) + 1 });
  if (error) return { erro: "Não foi possível adicionar." };
  atualizar(onboardingId);
  return { ok: "Adicionada." };
}

export async function editarTarefa(id: string, onboardingId: string, mudancas: { texto?: string; responsavel_id?: string | null; prazo?: string | null }): Promise<Estado> {
  if (!(await exigirGestao())) return { erro: "Sem permissão." };
  if (mudancas.texto !== undefined && !mudancas.texto.trim()) return { erro: "A tarefa não pode ficar vazia." };
  const supabase = await criarClienteServidor();
  const { error } = await supabase.from("onboarding_tarefas").update(mudancas).eq("id", id);
  if (error) return { erro: "Não foi possível salvar." };
  atualizar(onboardingId);
  return undefined;
}

export async function removerTarefa(id: string, onboardingId: string): Promise<Estado> {
  if (!(await exigirGestao())) return { erro: "Sem permissão." };
  const supabase = await criarClienteServidor();
  const { error } = await supabase.from("onboarding_tarefas").delete().eq("id", id);
  if (error) return { erro: "Não foi possível remover." };
  atualizar(onboardingId);
  return undefined;
}

// ---------------------------------------------------------------- comentários e documentos
export async function comentar(_: Estado, form: FormData): Promise<Estado> {
  const eu = await exigirGestao();
  if (!eu) return { erro: "Só Sócio e Administrativo comentam." };
  const id = texto(form, "onboarding_id");
  const t = texto(form, "texto");
  if (!t) return { erro: "Escreva o comentário." };
  const supabase = await criarClienteServidor();
  const { error } = await supabase.from("onboarding_eventos").insert({ onboarding_id: id, tipo: "comentario", texto: t, autor_id: eu.id, autor_nome: eu.nome });
  if (error) return { erro: "Não foi possível comentar." };
  atualizar(id);
  return { ok: "Comentado." };
}

export async function apagarComentario(id: number, onboardingId: string): Promise<Estado> {
  const supabase = await criarClienteServidor();
  const { error, count } = await supabase.from("onboarding_eventos").delete({ count: "exact" }).eq("id", id);
  if (error || !count) return { erro: "Não foi possível apagar." };
  atualizar(onboardingId);
  return undefined;
}

// O arquivo já foi enviado ao Storage pelo navegador; aqui só registra
export async function registrarDocumento(onboardingId: string, doc: { caminho: string; nome: string; tipo: string; tamanho: number }): Promise<Estado> {
  const eu = await exigirGestao();
  if (!eu) return { erro: "Sem permissão." };
  if (!doc.caminho.startsWith(`${onboardingId}/`)) return { erro: "Arquivo inválido." };
  const supabase = await criarClienteServidor();
  const { error } = await supabase.from("onboarding_documentos").insert({ onboarding_id: onboardingId, ...doc, autor_id: eu.id });
  if (error) {
    await supabase.storage.from(BUCKET_ONBOARDING).remove([doc.caminho]);
    return { erro: "Não foi possível registrar o documento." };
  }
  atualizar(onboardingId);
  return undefined;
}

export async function removerDocumento(id: string, onboardingId: string): Promise<Estado> {
  if (!(await exigirGestao())) return { erro: "Sem permissão." };
  const supabase = await criarClienteServidor();
  const { data: doc } = await supabase.from("onboarding_documentos").select("caminho").eq("id", id).maybeSingle();
  const { error } = await supabase.from("onboarding_documentos").delete().eq("id", id);
  if (error || !doc) return { erro: "Não foi possível remover." };
  await supabase.storage.from(BUCKET_ONBOARDING).remove([doc.caminho]);
  atualizar(onboardingId);
  return undefined;
}

// ---------------------------------------------------------------- modelo (só Sócio)
async function exigirSocio() {
  const eu = await pessoaAtual();
  return eu?.perfil === "socio" ? eu : null;
}

export async function salvarEtapa(_: Estado, form: FormData): Promise<Estado> {
  if (!(await exigirSocio())) return { erro: "Só o Sócio edita o modelo." };
  const id = texto(form, "id");
  const nome = texto(form, "nome");
  const cor = texto(form, "cor").toUpperCase();
  if (!nome) return { erro: "Dê um nome à etapa." };
  if (!/^#[0-9A-F]{6}$/.test(cor)) return { erro: "Cor inválida." };
  const supabase = await criarClienteServidor();
  if (id) {
    const { error } = await supabase.from("onboarding_etapas").update({ nome, cor }).eq("id", id);
    if (error) return { erro: "Não foi possível salvar." };
  } else {
    const { data: ultima } = await supabase.from("onboarding_etapas").select("ordem").order("ordem", { ascending: false }).limit(1).maybeSingle();
    // Nova etapa entra antes da última (a última é sempre a de conclusão)
    const ordemFinal = ultima?.ordem ?? 0;
    await supabase.from("onboarding_etapas").update({ ordem: ordemFinal + 1 }).eq("ordem", ordemFinal);
    const { error } = await supabase.from("onboarding_etapas").insert({ nome, cor, ordem: ordemFinal });
    if (error) return { erro: "Não foi possível criar." };
  }
  revalidatePath("/configuracoes/onboarding");
  atualizar();
  return { ok: "Salvo." };
}

export async function moverEtapa(id: string, direcao: -1 | 1): Promise<Estado> {
  if (!(await exigirSocio())) return { erro: "Sem permissão." };
  const supabase = await criarClienteServidor();
  const { data: etapas } = await supabase.from("onboarding_etapas").select("id, ordem").order("ordem");
  const lista = etapas ?? [];
  const i = lista.findIndex((e) => e.id === id);
  const j = i + direcao;
  if (i < 0 || j < 0 || j >= lista.length) return undefined;
  await supabase.from("onboarding_etapas").update({ ordem: lista[j].ordem }).eq("id", lista[i].id);
  await supabase.from("onboarding_etapas").update({ ordem: lista[i].ordem }).eq("id", lista[j].id);
  revalidatePath("/configuracoes/onboarding");
  atualizar();
  return undefined;
}

export async function apagarEtapa(id: string): Promise<Estado> {
  if (!(await exigirSocio())) return { erro: "Sem permissão." };
  const supabase = await criarClienteServidor();
  const { error } = await supabase.from("onboarding_etapas").delete().eq("id", id);
  if (error?.code === "23503") return { erro: "Há clientes ou tarefas nessa etapa. Mova os clientes e tente de novo." };
  if (error) return { erro: "Não foi possível apagar." };
  revalidatePath("/configuracoes/onboarding");
  atualizar();
  return undefined;
}

export async function salvarTarefaModelo(_: Estado, form: FormData): Promise<Estado> {
  if (!(await exigirSocio())) return { erro: "Sem permissão." };
  const id = texto(form, "id");
  const t = texto(form, "texto");
  if (!t) return { erro: "Escreva a tarefa." };
  const supabase = await criarClienteServidor();
  if (id) {
    const { error } = await supabase.from("onboarding_modelo").update({ texto: t }).eq("id", id);
    if (error) return { erro: "Não foi possível salvar." };
  } else {
    const etapaId = texto(form, "etapa_id");
    const { count } = await supabase.from("onboarding_modelo").select("id", { count: "exact", head: true }).eq("etapa_id", etapaId);
    const { error } = await supabase.from("onboarding_modelo").insert({ etapa_id: etapaId, texto: t, ordem: (count ?? 0) + 1 });
    if (error) return { erro: "Não foi possível adicionar." };
  }
  revalidatePath("/configuracoes/onboarding");
  return { ok: "Salvo." };
}

export async function apagarTarefaModelo(id: string): Promise<Estado> {
  if (!(await exigirSocio())) return { erro: "Sem permissão." };
  const supabase = await criarClienteServidor();
  const { error } = await supabase.from("onboarding_modelo").delete().eq("id", id);
  if (error) return { erro: "Não foi possível apagar." };
  revalidatePath("/configuracoes/onboarding");
  return undefined;
}
