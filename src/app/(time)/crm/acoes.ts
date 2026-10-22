"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { pessoaAtual } from "@/lib/sessao";
import { criarClienteServidor } from "@/lib/supabase/server";
import type { EtapaLead } from "@/lib/dominio/crm";
import type { Estado } from "@/app/entrar/acoes";

const texto = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const ouNulo = (v: string) => v || null;

async function exigirGestao() {
  const eu = await pessoaAtual();
  return eu && (eu.perfil === "socio" || eu.perfil === "adm") ? eu : null;
}

const atualizar = () => {
  revalidatePath("/crm");
  revalidatePath("/inicio");
};

function dadosDoForm(form: FormData) {
  return {
    empresa: texto(form, "empresa"),
    contato: ouNulo(texto(form, "contato")),
    whatsapp: ouNulo(texto(form, "whatsapp")),
    segmento: ouNulo(texto(form, "segmento")),
    cidade: ouNulo(texto(form, "cidade")),
    origem: ouNulo(texto(form, "origem")),
    servicos: form.getAll("servicos").map(String),
    valor_mensal: Number(texto(form, "valor_mensal").replace(/\./g, "").replace(",", ".") || 0),
    responsavel_id: ouNulo(texto(form, "responsavel_id")),
    proximo_passo: ouNulo(texto(form, "proximo_passo")),
    proximo_passo_em: ouNulo(texto(form, "proximo_passo_em")),
  };
}

export async function criarLead(_: Estado, form: FormData): Promise<Estado> {
  if (!(await exigirGestao())) return { erro: "Só Sócio e Administrativo usam o CRM." };
  const dados = dadosDoForm(form);
  if (!dados.empresa) return { erro: "Informe a empresa." };
  if (!(dados.valor_mensal >= 0)) return { erro: "Valor mensal inválido." };
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase.from("leads").insert(dados).select("id").single();
  if (error || !data) return { erro: "Não foi possível criar o lead." };
  atualizar();
  redirect(`/crm?lead=${data.id}`);
}

export async function salvarLead(_: Estado, form: FormData): Promise<Estado> {
  if (!(await exigirGestao())) return { erro: "Sem permissão." };
  const id = texto(form, "id");
  const etapa = texto(form, "etapa") as EtapaLead;
  const motivo = texto(form, "motivo_perda");
  const dados = { ...dadosDoForm(form), etapa, motivo_perda: etapa === "perdido" ? motivo : null };
  if (!dados.empresa) return { erro: "Informe a empresa." };
  if (etapa === "perdido" && !motivo) return { erro: "Informe o motivo da perda." };
  if (!(dados.valor_mensal >= 0)) return { erro: "Valor mensal inválido." };
  const supabase = await criarClienteServidor();
  const { error } = await supabase.from("leads").update(dados).eq("id", id);
  if (error) return { erro: "Não foi possível salvar." };
  atualizar();
  return { ok: "Salvo." };
}

export async function moverLead(id: string, etapa: EtapaLead, motivo?: string): Promise<Estado> {
  if (!(await exigirGestao())) return { erro: "Sem permissão." };
  if (etapa === "perdido" && !motivo?.trim()) return { erro: "Informe o motivo da perda." };
  const supabase = await criarClienteServidor();
  const { error } = await supabase
    .from("leads")
    .update({ etapa, ...(etapa === "perdido" ? { motivo_perda: motivo!.trim() } : {}) })
    .eq("id", id);
  if (error) return { erro: "Não foi possível mover." };
  atualizar();
  return { ok: "Movido." };
}

export async function anotar(_: Estado, form: FormData): Promise<Estado> {
  const eu = await exigirGestao();
  if (!eu) return { erro: "Sem permissão." };
  const nota = texto(form, "texto");
  if (!nota) return { erro: "Escreva o que aconteceu." };
  const supabase = await criarClienteServidor();
  const { error } = await supabase
    .from("lead_eventos")
    .insert({ lead_id: texto(form, "lead_id"), tipo: "nota", texto: nota, autor_id: eu.id, autor_nome: eu.nome });
  if (error) return { erro: "Não foi possível registrar." };
  atualizar();
  return { ok: "Registrado." };
}

// Fechado: cria o cliente na Central com o nome do lead e liga os dois
export async function virarCliente(_: Estado, form: FormData): Promise<Estado> {
  const eu = await exigirGestao();
  if (!eu) return { erro: "Sem permissão." };
  const supabase = await criarClienteServidor();
  const { data: lead } = await supabase.from("leads").select("id, empresa, etapa, client_id, valor_mensal").eq("id", texto(form, "id")).maybeSingle();
  if (!lead) return { erro: "Lead não encontrado." };
  if (lead.etapa !== "ganho") return { erro: "Só lead fechado vira cliente." };
  if (lead.client_id) redirect(`/clientes/${lead.client_id}`);

  const { data: cliente, error } = await supabase
    .from("clients")
    .insert({ nome: lead.empresa, nome_curto: lead.empresa.slice(0, 20) })
    .select("id")
    .single();
  if (error || !cliente) return { erro: "Não foi possível criar o cliente." };
  await supabase.from("client_briefs").insert({ client_id: cliente.id });
  // Contrato a partir de hoje com o valor do lead; conteúdos e ajustes por mês ficam "a definir" para o Sócio
  if (eu.perfil === "socio") {
    const { hojeSP } = await import("@/lib/datas");
    await supabase.from("contracts").insert({ client_id: cliente.id, inicio: hojeSP(), valor_mensal: Number(lead.valor_mensal) || null });
  }
  await supabase.from("leads").update({ client_id: cliente.id }).eq("id", lead.id);
  await supabase.from("lead_eventos").insert({ lead_id: lead.id, tipo: "nota", texto: "Virou cliente", autor_id: eu.id, autor_nome: eu.nome });
  revalidatePath("/clientes", "layout");
  atualizar();
  redirect(`/clientes/${cliente.id}`);
}

export async function excluirLead(_: Estado, form: FormData): Promise<Estado> {
  if (!(await exigirGestao())) return { erro: "Sem permissão." };
  const supabase = await criarClienteServidor();
  const { error, count } = await supabase.from("leads").delete({ count: "exact" }).eq("id", texto(form, "id"));
  if (error || !count) return { erro: "Não foi possível excluir." };
  atualizar();
  redirect("/crm");
}
