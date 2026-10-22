"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { pessoaAtual } from "@/lib/sessao";
import { criarClienteServidor } from "@/lib/supabase/server";
import { paraTimestampSP, type Etapa, type TipoTarefa } from "@/lib/dominio/tarefas";
import type { Estado } from "@/app/entrar/acoes";

const texto = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const ouNulo = (v: string) => v || null;

// Traduz os erros do banco para a tela. As regras de etapa já vêm em português.
function mensagem(erro: { message: string; code?: string } | null, padrao: string) {
  if (!erro) return padrao;
  if (erro.message.includes("tasks_agendado_tem_data")) return "Para ir para Agendado, registre a data e a hora de publicação.";
  if (erro.message.includes("tasks_etapa_do_tipo")) return "Esta etapa não existe para este tipo de tarefa.";
  if (erro.message.includes("tasks_legenda_ate_2200")) return "A legenda passou de 2.200 caracteres.";
  if (erro.message.includes("tasks_formato_so_em_conteudo")) return "Escolha o formato do conteúdo.";
  if (erro.message.includes("tasks_area_so_em_demanda")) return "Escolha a área da demanda.";
  if (erro.message.includes("tasks_conteudo_tem_cliente")) return "Conteúdo precisa de um cliente.";
  if (erro.code === "23514" || erro.code === "P0001") return erro.message;
  return padrao;
}

async function exigirTimeAcao() {
  const eu = await pessoaAtual();
  return eu && eu.perfil !== "cliente" ? eu : null;
}

const atualizar = () => revalidatePath("/tarefas");

export async function criarTarefa(_: Estado, form: FormData): Promise<Estado> {
  if (!(await exigirTimeAcao())) return { erro: "Sem permissão." };
  const tipo = texto(form, "tipo") as TipoTarefa;
  const clientId = texto(form, "client_id");
  const dados = {
    tipo,
    titulo: texto(form, "titulo"),
    client_id: clientId === "interno" ? null : ouNulo(clientId),
    formato: tipo === "conteudo" ? ouNulo(texto(form, "formato")) : null,
    area: tipo === "demanda" ? ouNulo(texto(form, "area")) : null,
    etapa: (tipo === "conteudo" ? "pauta" : "a_fazer") as Etapa,
    responsavel_id: ouNulo(texto(form, "responsavel_id")),
    prazo: ouNulo(texto(form, "prazo")),
    texto: texto(form, "texto"),
  };
  if (!dados.titulo) return { erro: "Dê um título." };

  const supabase = await criarClienteServidor();
  const { data, error } = await supabase.from("tasks").insert(dados).select("id").single();
  if (error || !data) return { erro: mensagem(error, "Não foi possível criar a tarefa.") };
  atualizar();
  redirect(`/tarefas?aba=${tipo}&tarefa=${data.id}`);
}

export async function salvarTarefa(_: Estado, form: FormData): Promise<Estado> {
  if (!(await exigirTimeAcao())) return { erro: "Sem permissão." };
  const id = texto(form, "id");
  const tipo = texto(form, "tipo") as TipoTarefa;
  const etapa = texto(form, "etapa") as Etapa;
  const etapaOriginal = texto(form, "etapa_original");
  const responsavel = texto(form, "responsavel_id");
  const clientId = texto(form, "client_id");
  const horas = texto(form, "horas");

  const dados: Record<string, unknown> = {
    titulo: texto(form, "titulo"),
    client_id: clientId === "interno" ? null : ouNulo(clientId),
    prazo: ouNulo(texto(form, "prazo")),
    horas: horas === "" ? null : Number(horas.replace(",", ".")),
    texto: texto(form, "texto"),
    ...(tipo === "conteudo" ? { formato: texto(form, "formato") } : { area: texto(form, "area") }),
  };
  if (!dados.titulo) return { erro: "Dê um título." };
  if (dados.horas !== null && !(Number(dados.horas) >= 0)) return { erro: "Horas precisa ser um número." };

  const supabase = await criarClienteServidor();
  // Etapa primeiro: no conteúdo, o banco troca o responsável para o padrão da nova etapa.
  if (etapa && etapa !== etapaOriginal) {
    const { error } = await supabase.from("tasks").update({ etapa }).eq("id", id);
    if (error) return { erro: mensagem(error, "Não foi possível mudar a etapa.") };
  }
  // Responsável só é gravado se a pessoa mudou à mão (senão desfaria o responsável automático)
  if (responsavel !== texto(form, "responsavel_original")) dados.responsavel_id = ouNulo(responsavel);

  const { error } = await supabase.from("tasks").update(dados).eq("id", id);
  if (error) return { erro: mensagem(error, "Não foi possível salvar.") };
  atualizar();
  return { ok: "Salvo." };
}

export async function moverTarefa(id: string, etapa: Etapa): Promise<Estado> {
  if (!(await exigirTimeAcao())) return { erro: "Sem permissão." };
  const supabase = await criarClienteServidor();
  const { error } = await supabase.from("tasks").update({ etapa }).eq("id", id);
  if (error) return { erro: mensagem(error, "Não foi possível mover.") };
  atualizar();
  return { ok: "Movido." };
}

export async function agendar(_: Estado, form: FormData): Promise<Estado> {
  if (!(await exigirTimeAcao())) return { erro: "Sem permissão." };
  const data = texto(form, "data");
  const hora = texto(form, "hora");
  if (!data || !hora) return { erro: "Escolha a data e a hora da publicação." };
  const supabase = await criarClienteServidor();
  const { error } = await supabase
    .from("tasks")
    .update({ publicar_em: paraTimestampSP(data, hora) })
    .eq("id", texto(form, "id"));
  if (error) return { erro: mensagem(error, "Não foi possível agendar.") };
  atualizar();
  return { ok: "Agendado." };
}

export async function desagendar(_: Estado, form: FormData): Promise<Estado> {
  if (!(await exigirTimeAcao())) return { erro: "Sem permissão." };
  const supabase = await criarClienteServidor();
  const { error } = await supabase.from("tasks").update({ etapa: "aprovado" }).eq("id", texto(form, "id"));
  if (error) return { erro: mensagem(error, "Não foi possível tirar do agendamento.") };
  atualizar();
  return { ok: "Voltou para Aprovado." };
}

export async function comentar(_: Estado, form: FormData): Promise<Estado> {
  const eu = await exigirTimeAcao();
  if (!eu) return { erro: "Sem permissão." };
  const comentario = texto(form, "texto");
  if (!comentario) return { erro: "Escreva o comentário." };
  const supabase = await criarClienteServidor();
  const { error } = await supabase
    .from("task_notes")
    .insert({ task_id: texto(form, "task_id"), tipo: "interno", texto: comentario, autor_id: eu.id });
  if (error) return { erro: "Não foi possível comentar." };
  atualizar();
  return { ok: "Comentário adicionado." };
}

export async function marcarResolvido(id: string, resolvido: boolean): Promise<Estado> {
  const eu = await exigirTimeAcao();
  if (!eu) return { erro: "Sem permissão." };
  const supabase = await criarClienteServidor();
  const { error } = await supabase
    .from("task_notes")
    .update({ resolvido, resolvido_por: resolvido ? eu.id : null, resolvido_em: resolvido ? new Date().toISOString() : null })
    .eq("id", id);
  if (error) return { erro: "Não foi possível atualizar." };
  atualizar();
  return { ok: resolvido ? "Resolvido." : "Reaberto." };
}

export async function excluirTarefa(_: Estado, form: FormData): Promise<Estado> {
  const eu = await pessoaAtual();
  if (eu?.perfil !== "socio" && eu?.perfil !== "adm") return { erro: "Só Sócio e Administrativo excluem tarefas." };
  const supabase = await criarClienteServidor();
  const { error, count } = await supabase.from("tasks").delete({ count: "exact" }).eq("id", texto(form, "id"));
  if (error || !count) return { erro: "Não foi possível excluir." };
  atualizar();
  redirect(`/tarefas?aba=${texto(form, "tipo")}`);
}

// "Notificar o cliente agora": manda na hora o e-mail que sairia às 17h, com tudo o que está esperando aprovação
export async function notificarClienteAgora(_: Estado, form: FormData): Promise<Estado> {
  if (!(await exigirTimeAcao())) return { erro: "Sem permissão." };
  const supabase = await criarClienteServidor();
  const { data: t } = await supabase.from("tasks").select("client_id, etapa").eq("id", texto(form, "id")).maybeSingle();
  if (!t?.client_id || t.etapa !== "cliente") return { erro: "Este conteúdo não está com o cliente." };
  const { avisarClientesParaAprovar } = await import("@/lib/notificacoes");
  const r = await avisarClientesParaAprovar(t.client_id);
  atualizar();
  if (r.enviados > 0) return { ok: `E-mail enviado para ${r.enviados} pessoa${r.enviados > 1 ? "s" : ""} do cliente.` };
  if (r.falhas > 0) return { erro: "O e-mail não saiu. Confira a chave do Resend na Vercel." };
  return { ok: r.detalhe ?? "O cliente já tinha sido avisado deste conteúdo." };
}
