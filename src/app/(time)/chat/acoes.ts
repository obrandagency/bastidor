"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { BUCKET_CHAT } from "@/lib/constantes";
import { pessoaAtual } from "@/lib/sessao";
import { criarClienteServidor } from "@/lib/supabase/server";
import type { Estado } from "@/app/entrar/acoes";
import type { Anexo } from "@/types/banco";

async function exigirTimeAcao() {
  const eu = await pessoaAtual();
  return eu && eu.perfil !== "cliente" ? eu : null;
}

export async function enviarMensagem(canalId: string, texto: string, anexos: Anexo[]): Promise<Estado> {
  const eu = await exigirTimeAcao();
  if (!eu) return { erro: "Sem permissão." };
  if (!texto.trim() && anexos.length === 0) return undefined;
  if (texto.length > 4000) return { erro: "Mensagem muito longa (máximo 4.000 caracteres)." };
  // Anexo só da pasta do próprio canal (o navegador acabou de enviar)
  if (anexos.some((a) => !a.caminho.startsWith(`${canalId}/`))) return { erro: "Anexo inválido." };
  const supabase = await criarClienteServidor();
  const { error } = await supabase.from("chat_mensagens").insert({ canal_id: canalId, autor_id: eu.id, texto: texto.trim(), anexos });
  if (error) return { erro: "Não foi possível enviar." };
  return { ok: "Enviada." };
}

export async function editarMensagem(id: string, texto: string): Promise<Estado> {
  if (!(await exigirTimeAcao())) return { erro: "Sem permissão." };
  if (!texto.trim()) return { erro: "A mensagem não pode ficar vazia." };
  const supabase = await criarClienteServidor();
  const { error, count } = await supabase
    .from("chat_mensagens")
    .update({ texto: texto.trim(), editada_em: new Date().toISOString() }, { count: "exact" })
    .eq("id", id);
  if (error || !count) return { erro: "Não foi possível editar." };
  return { ok: "Editada." };
}

export async function apagarMensagem(id: string): Promise<Estado> {
  if (!(await exigirTimeAcao())) return { erro: "Sem permissão." };
  const supabase = await criarClienteServidor();
  const { data: msg } = await supabase.from("chat_mensagens").select("anexos").eq("id", id).maybeSingle();
  const { error, count } = await supabase.from("chat_mensagens").delete({ count: "exact" }).eq("id", id);
  if (error || !count) return { erro: "Não foi possível apagar." };
  // Só apaga o arquivo se nenhuma outra mensagem (encaminhada) usar o mesmo anexo
  const caminhos: string[] = [];
  for (const a of (msg?.anexos ?? []) as Anexo[]) {
    const { count: usos } = await supabase.from("chat_mensagens").select("id", { count: "exact", head: true }).contains("anexos", [{ caminho: a.caminho }]);
    if (!usos) caminhos.push(a.caminho);
  }
  if (caminhos.length) await supabase.storage.from(BUCKET_CHAT).remove(caminhos);
  return { ok: "Apagada." };
}

// Reação com emoji: liga ou desliga a minha
export async function reagir(mensagemId: string, emoji: string, ligar: boolean): Promise<Estado> {
  const eu = await exigirTimeAcao();
  if (!eu) return { erro: "Sem permissão." };
  if (!emoji || emoji.length > 16) return { erro: "Emoji inválido." };
  const supabase = await criarClienteServidor();
  const { error } = ligar
    ? await supabase.from("chat_reacoes").upsert({ mensagem_id: mensagemId, pessoa_id: eu.id, emoji }, { ignoreDuplicates: true })
    : await supabase.from("chat_reacoes").delete().match({ mensagem_id: mensagemId, pessoa_id: eu.id, emoji });
  if (error) return { erro: "Não foi possível reagir." };
  return undefined;
}

// Encaminhar para outro canal (o banco copia texto, anexos e a origem); o comentário vai antes, como mensagem minha
export async function encaminhar(mensagemId: string, canalId: string, comentario: string): Promise<Estado> {
  const eu = await exigirTimeAcao();
  if (!eu) return { erro: "Sem permissão." };
  if (comentario.length > 4000) return { erro: "Comentário muito longo." };
  const supabase = await criarClienteServidor();
  if (comentario.trim()) {
    const { error } = await supabase.from("chat_mensagens").insert({ canal_id: canalId, autor_id: eu.id, texto: comentario.trim() });
    if (error) return { erro: "Não foi possível encaminhar." };
  }
  const { error } = await supabase.from("chat_mensagens").insert({ canal_id: canalId, autor_id: eu.id, encaminhada_de: mensagemId });
  if (error) return { erro: "Não foi possível encaminhar." };
  revalidatePath("/chat");
  return { ok: "Encaminhada." };
}

// Busca de tarefas para mencionar com # (título ou cliente)
export async function buscarTarefas(termo: string): Promise<{ id: string; titulo: string; cliente: string }[]> {
  if (!(await exigirTimeAcao())) return [];
  const supabase = await criarClienteServidor();
  const t = termo.trim().replace(/[%_,()]/g, " ").slice(0, 40);
  let consulta = supabase.from("tasks").select("id, titulo, clients(nome)").order("updated_at", { ascending: false }).limit(8);
  if (t) consulta = consulta.ilike("titulo", `%${t}%`);
  const { data } = await consulta.returns<{ id: string; titulo: string; clients: { nome: string } | null }[]>();
  return (data ?? []).map((x) => ({ id: x.id, titulo: x.titulo, cliente: x.clients?.nome ?? "Interno" }));
}

export async function marcarLido(canalId: string) {
  const eu = await exigirTimeAcao();
  if (!eu) return;
  const supabase = await criarClienteServidor();
  await supabase.from("chat_leituras").upsert({ pessoa_id: eu.id, canal_id: canalId, lido_em: new Date().toISOString() });
  revalidatePath("/", "layout");
}

// "Ótica Barbosa!" -> "otica-barbosa"
function nomeDeCanal(v: string) {
  return v
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export async function criarCanal(_: Estado, form: FormData): Promise<Estado> {
  const eu = await pessoaAtual();
  if (eu?.perfil !== "socio" && eu?.perfil !== "adm") return { erro: "Só Sócio e Administrativo criam canais." };
  const nome = nomeDeCanal(String(form.get("nome") ?? ""));
  if (!nome) return { erro: "Dê um nome ao canal." };
  const clientId = String(form.get("client_id") ?? "") || null;
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase.from("chat_canais").insert({ nome, client_id: clientId, criado_por: eu.id }).select("id").single();
  if (error?.code === "23505") return { erro: `Já existe o canal #${nome}.` };
  if (error || !data) return { erro: "Não foi possível criar o canal." };
  revalidatePath("/chat");
  redirect(`/chat?canal=${data.id}`);
}

export async function arquivarCanal(_: Estado, form: FormData): Promise<Estado> {
  const eu = await pessoaAtual();
  if (eu?.perfil !== "socio" && eu?.perfil !== "adm") return { erro: "Sem permissão." };
  const supabase = await criarClienteServidor();
  const { error, count } = await supabase.from("chat_canais").update({ arquivado: true }, { count: "exact" }).eq("id", String(form.get("id")));
  if (error || !count) return { erro: "Não foi possível arquivar." };
  revalidatePath("/chat");
  redirect("/chat");
}
