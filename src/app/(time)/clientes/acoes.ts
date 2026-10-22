"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { pessoaAtual } from "@/lib/sessao";
import { criarClienteServidor } from "@/lib/supabase/server";
import type { Estado } from "@/app/entrar/acoes";
import type { Acesso } from "@/types/banco";

const texto = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const lista = (f: FormData, k: string): string[] => {
  try {
    const v = JSON.parse(String(f.get(k) ?? "[]"));
    return Array.isArray(v) ? v.map((x) => String(x).trim()).filter(Boolean) : [];
  } catch {
    return [];
  }
};
const HEX = /^#[0-9A-Fa-f]{6}$/;

// "3.500", "3500", "3.500,50" e "3500.50" -> número; vazio -> nulo. Ponto só é milhar se vier com 3 dígitos.
function lerValor(v: string) {
  const limpo = v.replace(/[R$\s]/g, "");
  if (!limpo) return null;
  return Number(limpo.includes(",") ? limpo.replace(/\./g, "").replace(",", ".") : limpo.replace(/\.(?=\d{3}(\D|$))/g, ""));
}

async function exigirGestao() {
  const eu = await pessoaAtual();
  return eu && (eu.perfil === "socio" || eu.perfil === "adm") ? eu : null;
}

// "@oticabarbosa", "instagram.com/oticabarbosa/" ou "oticabarbosa" -> "oticabarbosa"
function limparInstagram(v: string) {
  return v.replace(/^https?:\/\/(www\.)?instagram\.com\//i, "").replace(/^@/, "").replace(/[/?#].*$/, "").trim() || null;
}

// ---------------------------------------------------------------- cadastro
export async function salvarCliente(_: Estado, form: FormData): Promise<Estado> {
  if (!(await exigirGestao())) return { erro: "Só Sócio e Administrativo cadastram clientes." };
  const id = texto(form, "id");
  const dados = {
    nome: texto(form, "nome"),
    nome_curto: texto(form, "nome_curto"),
    instagram: limparInstagram(texto(form, "instagram")),
    cor: texto(form, "cor").toUpperCase(),
    drive_url: texto(form, "drive_url") || null,
    ativo: id ? form.get("ativo") === "on" : true,
  };
  if (!dados.nome || !dados.nome_curto) return { erro: "Preencha o nome e o nome curto." };
  if (!HEX.test(dados.cor)) return { erro: "A cor precisa estar no formato #RRGGBB." };
  if (dados.drive_url && !/^https?:\/\//.test(dados.drive_url)) return { erro: "O link do Drive precisa começar com https://" };

  const supabase = await criarClienteServidor();
  let clientId = id;
  if (id) {
    const { error, count } = await supabase.from("clients").update(dados, { count: "exact" }).eq("id", id);
    if (error || !count) return { erro: "Não foi possível salvar o cliente." };
  } else {
    const { data, error } = await supabase.from("clients").insert(dados).select("id").single();
    if (error || !data) return { erro: "Não foi possível cadastrar o cliente." };
    clientId = data.id;
    await supabase.from("client_briefs").insert({ client_id: clientId });
  }
  revalidatePath("/clientes", "layout");
  redirect(`/clientes/${clientId}`);
}

// ---------------------------------------------------------------- briefing, tom de voz, identidade e acessos
export async function salvarBriefing(_: Estado, form: FormData): Promise<Estado> {
  const eu = await exigirGestao();
  if (!eu) return { erro: "Só Sócio e Administrativo editam a Central do cliente." };
  const clientId = texto(form, "client_id");
  const grupo = texto(form, "grupo");

  let dados: Record<string, unknown>;
  if (grupo === "briefing") {
    dados = { negocio: texto(form, "negocio"), publico: texto(form, "publico"), objetivo: texto(form, "objetivo") };
  } else if (grupo === "tom") {
    dados = { tom_voz: lista(form, "tom_voz"), evitar: texto(form, "evitar") };
  } else if (grupo === "identidade") {
    const cores = lista(form, "cores").map((c) => c.toUpperCase());
    if (cores.some((c) => !HEX.test(c))) return { erro: "Use cores no formato #RRGGBB." };
    dados = { cores };
  } else if (grupo === "acessos") {
    let acessos: Acesso[] = [];
    try {
      acessos = (JSON.parse(String(form.get("acessos") ?? "[]")) as Acesso[])
        .map((a) => ({ nome: String(a.nome).trim(), liberado: Boolean(a.liberado) }))
        .filter((a) => a.nome);
    } catch {
      return { erro: "Lista de acessos inválida." };
    }
    dados = { acessos };
  } else {
    return { erro: "Formulário desconhecido." };
  }

  const supabase = await criarClienteServidor();
  const { error } = await supabase
    .from("client_briefs")
    .upsert({ client_id: clientId, ...dados, updated_at: new Date().toISOString(), updated_by: eu.id });
  if (error) return { erro: "Não foi possível salvar." };
  revalidatePath(`/clientes/${clientId}`);
  return { ok: "Salvo." };
}

// ---------------------------------------------------------------- contrato (só Sócio edita)
export async function salvarContrato(_: Estado, form: FormData): Promise<Estado> {
  const eu = await pessoaAtual();
  if (eu?.perfil !== "socio") return { erro: "Só o Sócio edita contratos." };
  const id = texto(form, "id");
  const clientId = texto(form, "client_id");
  const dados = {
    client_id: clientId,
    inicio: texto(form, "inicio"),
    fim: texto(form, "fim") || null,
    conteudos_mes: Number(texto(form, "conteudos_mes")),
    ajustes_mes: Number(texto(form, "ajustes_mes")),
    valor_mensal: lerValor(texto(form, "valor_mensal")),
  };
  if (!dados.inicio) return { erro: "Informe o início do contrato." };
  if (dados.fim && dados.fim < dados.inicio) return { erro: "O fim precisa ser depois do início." };
  if (![dados.conteudos_mes, dados.ajustes_mes].every((n) => Number.isInteger(n) && n >= 0))
    return { erro: "Conteúdos e ajustes por mês precisam ser números inteiros." };
  if (dados.valor_mensal !== null && !(dados.valor_mensal >= 0)) return { erro: "Valor mensal inválido." };

  const supabase = await criarClienteServidor();
  const { error } = id
    ? await supabase.from("contracts").update(dados).eq("id", id)
    : await supabase.from("contracts").insert(dados);
  if (error?.code === "23P01") return { erro: "Já existe um contrato valendo nesse período. Ajuste o fim do anterior." };
  if (error) return { erro: "Não foi possível salvar o contrato." };
  revalidatePath(`/clientes/${clientId}`);
  revalidatePath("/clientes");
  return { ok: "Contrato salvo." };
}

export async function apagarContrato(_: Estado, form: FormData): Promise<Estado> {
  const eu = await pessoaAtual();
  if (eu?.perfil !== "socio") return { erro: "Só o Sócio apaga contratos." };
  const supabase = await criarClienteServidor();
  const { error } = await supabase.from("contracts").delete().eq("id", texto(form, "id"));
  if (error) return { erro: "Não foi possível apagar." };
  revalidatePath(`/clientes/${texto(form, "client_id")}`);
  revalidatePath("/clientes");
  return { ok: "Contrato apagado." };
}

// ---------------------------------------------------------------- atas
export async function adicionarAta(_: Estado, form: FormData): Promise<Estado> {
  const eu = await exigirGestao();
  if (!eu) return { erro: "Só Sócio e Administrativo registram atas." };
  const clientId = texto(form, "client_id");
  const data = texto(form, "data");
  const resumo = texto(form, "resumo");
  if (!data || !resumo) return { erro: "Informe a data e o resumo da reunião." };
  const supabase = await criarClienteServidor();
  const { error } = await supabase.from("meeting_notes").insert({ client_id: clientId, data, resumo, autor_id: eu.id });
  if (error) return { erro: "Não foi possível salvar a ata." };
  revalidatePath(`/clientes/${clientId}`);
  return { ok: "Ata salva." };
}

export async function apagarAta(_: Estado, form: FormData): Promise<Estado> {
  if (!(await exigirGestao())) return { erro: "Sem permissão." };
  const supabase = await criarClienteServidor();
  const { error } = await supabase.from("meeting_notes").delete().eq("id", texto(form, "id"));
  if (error) return { erro: "Não foi possível apagar." };
  revalidatePath(`/clientes/${texto(form, "client_id")}`);
  return { ok: "Ata apagada." };
}

// ---------------------------------------------------------------- LGPD: apagar cliente e todos os dados (só Sócio)
export async function apagarCliente(_: Estado, form: FormData): Promise<Estado> {
  const eu = await pessoaAtual();
  if (eu?.perfil !== "socio") return { erro: "Só o Sócio apaga clientes." };
  const clientId = texto(form, "client_id");
  const supabase = await criarClienteServidor();
  const { data: cliente } = await supabase.from("clients").select("nome").eq("id", clientId).maybeSingle();
  if (!cliente) return { erro: "Cliente não encontrado." };
  if (texto(form, "confirmacao") !== cliente.nome) return { erro: `Digite exatamente "${cliente.nome}" para confirmar.` };

  const { criarClienteAdmin } = await import("@/lib/supabase/admin");
  const { BUCKET_ARTES } = await import("@/lib/constantes");
  const admin = criarClienteAdmin();

  // 1. Artes no Storage (pastas client_id/task_id/arquivo)
  const { data: pastas } = await admin.storage.from(BUCKET_ARTES).list(clientId, { limit: 1000 });
  for (const pasta of pastas ?? []) {
    const { data: arquivos } = await admin.storage.from(BUCKET_ARTES).list(`${clientId}/${pasta.name}`, { limit: 1000 });
    const caminhos = (arquivos ?? []).map((a) => `${clientId}/${pasta.name}/${a.name}`);
    if (caminhos.length) await admin.storage.from(BUCKET_ARTES).remove(caminhos);
  }
  // 1b. Anexos dos canais de chat ligados ao cliente (os canais e mensagens saem em cascata)
  const { BUCKET_CHAT } = await import("@/lib/constantes");
  const { data: canais } = await admin.from("chat_canais").select("id").eq("client_id", clientId);
  for (const canal of canais ?? []) {
    const { data: arquivos } = await admin.storage.from(BUCKET_CHAT).list(canal.id, { limit: 1000 });
    const caminhos = (arquivos ?? []).map((a) => `${canal.id}/${a.name}`);
    if (caminhos.length) await admin.storage.from(BUCKET_CHAT).remove(caminhos);
  }
  // 2. Logins das pessoas do cliente (o perfil some junto)
  const { data: pessoas } = await admin.from("profiles").select("id").eq("client_id", clientId);
  for (const p of pessoas ?? []) await admin.auth.admin.deleteUser(p.id);
  // 3. O cliente e, em cascata, contratos, briefing, atas, tarefas, comentários, histórico, convites e avisos
  const { error } = await admin.from("clients").delete().eq("id", clientId);
  if (error) return { erro: "Não foi possível apagar o cliente." };

  revalidatePath("/clientes", "layout");
  redirect("/clientes");
}
