import "server-only";
import { hojeSP, somarDias } from "@/lib/datas";
import { PARADAS } from "@/lib/dominio/tarefas";
import { enviarEmail } from "@/lib/email/enviar";
import { emailAvisoTime, emailLembrete, emailParaAprovar, emailRelatorioPublicado, emailResumoDiario } from "@/lib/email/modelos";
import { urlDoSite } from "@/lib/sessao";
import { criarClienteAdmin } from "@/lib/supabase/admin";

// Rotinas de e-mail. Rodam no servidor com a service role (leem dados de todos os clientes),
// chamadas pelo agendador do Supabase (/api/cron) ou pelo botão "Notificar o cliente agora".

type Pessoa = { id: string; nome: string; email: string };
type Resultado = { enviados: number; falhas: number; detalhe?: string };

const inicioDeHojeSP = () => `${hojeSP()}T00:00:00-03:00`;

function agrupar<T extends { client_id: string | null }>(itens: T[]) {
  const grupos = new Map<string, T[]>();
  for (const i of itens) if (i.client_id) grupos.set(i.client_id, [...(grupos.get(i.client_id) ?? []), i]);
  return grupos;
}

async function registrar(
  admin: ReturnType<typeof criarClienteAdmin>,
  tipo: string,
  para: Pessoa,
  assunto: string,
  r: { ok: boolean; erro?: string },
  clientId?: string,
) {
  await admin.from("envios_email").insert({
    tipo,
    client_id: clientId ?? null,
    destinatario_id: para.id,
    email: para.email,
    assunto,
    ok: r.ok,
    erro: r.erro ?? null,
  });
}

async function pessoasDoCliente(admin: ReturnType<typeof criarClienteAdmin>, clientId: string) {
  const { data } = await admin.from("profiles").select("id, nome, email").eq("perfil", "cliente").eq("client_id", clientId).eq("ativo", true);
  return (data ?? []) as Pessoa[];
}

// ---------------------------------------------------------------- "Você tem N conteúdos para aprovar"
// Junta num e-mail só tudo o que chegou ao cliente e ainda não foi avisado. Aviso essencial: o cliente não desliga.
export async function avisarClientesParaAprovar(clientId?: string): Promise<Resultado> {
  const admin = criarClienteAdmin();
  let consulta = admin.from("tasks").select("id, titulo, client_id").eq("tipo", "conteudo").eq("etapa", "cliente").is("aviso_cliente_em", null);
  if (clientId) consulta = consulta.eq("client_id", clientId);
  const { data: tarefas } = await consulta;
  const resultado: Resultado = { enviados: 0, falhas: 0 };

  for (const [cid, lista] of agrupar(tarefas ?? [])) {
    const pessoas = await pessoasDoCliente(admin, cid);
    if (pessoas.length === 0) {
      resultado.detalhe = "Cliente sem pessoas cadastradas no portal.";
      continue;
    }
    let algumOk = false;
    for (const p of pessoas) {
      const { assunto, html } = emailParaAprovar(p.nome, lista.map((t) => t.titulo), `${urlDoSite()}/portal`);
      const r = await enviarEmail(p.email, assunto, html);
      await registrar(admin, "para_aprovar", p, assunto, r, cid);
      if (r.ok) resultado.enviados++;
      else resultado.falhas++;
      algumOk ||= r.ok;
    }
    if (algumOk) await admin.from("tasks").update({ aviso_cliente_em: new Date().toISOString() }).in("id", lista.map((t) => t.id));
  }
  return resultado;
}

// ---------------------------------------------------------------- lembrete de aprovação (no máximo 1 por dia por cliente)
export async function enviarLembretes(): Promise<Resultado> {
  const admin = criarClienteAdmin();
  const { data: config } = await admin.from("app_settings").select("dias_lembrete").eq("id", 1).maybeSingle();
  const dias = config?.dias_lembrete ?? 2;
  const corte = new Date(Date.now() - dias * 86_400_000).toISOString();
  const { data: tarefas } = await admin
    .from("tasks")
    .select("id, titulo, client_id")
    .eq("tipo", "conteudo")
    .eq("etapa", "cliente")
    .lte("enviado_cliente_em", corte);
  const resultado: Resultado = { enviados: 0, falhas: 0 };

  for (const [cid, lista] of agrupar(tarefas ?? [])) {
    const { count } = await admin
      .from("envios_email")
      .select("id", { count: "exact", head: true })
      .eq("tipo", "lembrete")
      .eq("client_id", cid)
      .eq("ok", true)
      .gte("created_at", inicioDeHojeSP());
    if (count) continue;
    for (const p of await pessoasDoCliente(admin, cid)) {
      const { assunto, html } = emailLembrete(p.nome, lista.map((t) => t.titulo), dias, `${urlDoSite()}/portal`);
      const r = await enviarEmail(p.email, assunto, html);
      await registrar(admin, "lembrete", p, assunto, r, cid);
      if (r.ok) resultado.enviados++;
      else resultado.falhas++;
    }
  }
  return resultado;
}

// ---------------------------------------------------------------- avisos do time (aprovou, pediu ajuste, você recebeu)
export async function enviarAvisosPendentes(): Promise<Resultado> {
  const admin = criarClienteAdmin();
  const doisDias = new Date(Date.now() - 2 * 86_400_000).toISOString();
  const { data: avisos } = await admin
    .from("notifications")
    .select("id, destinatario_id, tipo, texto, link")
    .is("email_enviado_em", null)
    .gte("created_at", doisDias)
    .order("created_at")
    .limit(100);
  if (!avisos?.length) return { enviados: 0, falhas: 0 };

  const ids = [...new Set(avisos.map((a) => a.destinatario_id))];
  const { data: pessoas } = await admin.from("profiles").select("id, nome, email, ativo, emails_opcionais, perfil").in("id", ids);
  const porId = new Map((pessoas ?? []).map((p) => [p.id, p]));
  const site = urlDoSite();
  const resultado: Resultado = { enviados: 0, falhas: 0 };

  for (const a of avisos) {
    const p = porId.get(a.destinatario_id);
    // Marca como tratado mesmo sem enviar (desativado ou e-mails desligados), para não tentar de novo
    if (p && p.ativo && p.emails_opcionais && p.perfil !== "cliente") {
      const { assunto, html } = emailAvisoTime(a.tipo, a.texto, `${site}${a.link ?? "/inicio"}`, site);
      const r = await enviarEmail(p.email, assunto, html);
      await registrar(admin, `aviso_${a.tipo}`, p, assunto, r);
      if (r.ok) resultado.enviados++;
      else resultado.falhas++;
    }
    await admin.from("notifications").update({ email_enviado_em: new Date().toISOString() }).eq("id", a.id);
  }
  return resultado;
}

// ---------------------------------------------------------------- resumo diário das 8h (um e-mail por pessoa)
export async function enviarResumoDiario(): Promise<Resultado> {
  const admin = criarClienteAdmin();
  const hoje = hojeSP();
  const amanha = somarDias(hoje, 1);
  const { data: time } = await admin
    .from("profiles")
    .select("id, nome, email")
    .neq("perfil", "cliente")
    .eq("ativo", true)
    .eq("emails_opcionais", true);
  const { data: tarefas } = await admin
    .from("tasks")
    .select("titulo, responsavel_id, prazo, etapa")
    .not("etapa", "in", `(${PARADAS.join(",")})`)
    .lte("prazo", amanha)
    .neq("prazo", hoje);
  const { data: leads } = await admin
    .from("leads")
    .select("empresa, proximo_passo, proximo_passo_em, responsavel_id")
    .not("etapa", "in", "(ganho,perdido)")
    .lte("proximo_passo_em", hoje);
  const resultado: Resultado = { enviados: 0, falhas: 0 };

  for (const p of (time ?? []) as Pessoa[]) {
    const minhas = (tarefas ?? []).filter((t) => t.responsavel_id === p.id);
    const atrasadas = minhas.filter((t) => t.prazo! < hoje).map((t) => t.titulo);
    const venceAmanha = minhas.filter((t) => t.prazo === amanha).map((t) => t.titulo);
    const followups = (leads ?? [])
      .filter((l) => l.responsavel_id === p.id)
      .map((l) => `${l.empresa}: ${l.proximo_passo ?? "próximo passo"}${l.proximo_passo_em! < hoje ? " (atrasado)" : ""}`);
    if (!atrasadas.length && !venceAmanha.length && !followups.length) continue;
    const { count } = await admin
      .from("envios_email")
      .select("id", { count: "exact", head: true })
      .eq("tipo", "resumo")
      .eq("destinatario_id", p.id)
      .gte("created_at", inicioDeHojeSP());
    if (count) continue;
    const { assunto, html } = emailResumoDiario(p.nome, venceAmanha, atrasadas, urlDoSite(), followups);
    const r = await enviarEmail(p.email, assunto, html);
    await registrar(admin, "resumo", p, assunto, r);
    if (r.ok) resultado.enviados++;
    else resultado.falhas++;
  }
  return resultado;
}

// ---------------------------------------------------------------- "Seu relatório de outubro está disponível"
export async function avisarRelatorioPublicado(clientId: string, mes: string, mesExtenso: string): Promise<Resultado> {
  const admin = criarClienteAdmin();
  const resultado: Resultado = { enviados: 0, falhas: 0 };
  for (const p of await pessoasDoCliente(admin, clientId)) {
    const { assunto, html } = emailRelatorioPublicado(p.nome, mesExtenso, `${urlDoSite()}/portal/metricas?mes=${mes.slice(0, 7)}`);
    const r = await enviarEmail(p.email, assunto, html);
    await registrar(admin, "relatorio", p, assunto, r, clientId);
    if (r.ok) resultado.enviados++;
    else resultado.falhas++;
  }
  return resultado;
}
