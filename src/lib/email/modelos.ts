// Modelos dos e-mails (HTML simples, que funciona nos clientes de e-mail). Nome, logo e cor vêm da identidade da agência.
import { tonsDaCor, urlMarca, type Identidade } from "@/lib/marca";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function moldura(id: Identidade, titulo: string, corpo: string, botao?: { texto: string; link: string }, rodape?: string) {
  const { cor, texto: corTexto } = tonsDaCor(id.cor);
  const logo = urlMarca(id.logo);
  const marca = logo
    ? `<img src="${esc(logo)}" alt="${esc(id.nome_agencia)}" height="32" style="height:32px;width:auto;vertical-align:middle;border:0">`
    : `<span style="display:inline-block;width:26px;height:26px;line-height:26px;text-align:center;border-radius:7px;background:${cor};color:${corTexto};font-weight:bold">${esc(id.nome_sistema.charAt(0).toUpperCase())}</span>`;
  return `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#FAFAFA;font-family:Arial,Helvetica,sans-serif;color:#111111">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FAFAFA;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#FFFFFF;border:1px solid #E5E7EB;border-radius:12px">
<tr><td style="padding:22px 24px 0">${marca}
<span style="font-weight:bold;font-size:16px;vertical-align:middle;margin-left:6px">${esc(id.nome_sistema)}</span></td></tr>
<tr><td style="padding:18px 24px 4px"><h1 style="margin:0;font-size:20px;line-height:1.25">${titulo}</h1></td></tr>
<tr><td style="padding:8px 24px 4px;font-size:14px;line-height:1.55">${corpo}</td></tr>
${botao ? `<tr><td style="padding:14px 24px 6px"><a href="${esc(botao.link)}" style="display:inline-block;background:${cor};color:${corTexto};text-decoration:none;padding:11px 18px;border-radius:8px;font-weight:bold;font-size:14px">${esc(botao.texto)}</a></td></tr>` : ""}
<tr><td style="padding:16px 24px 22px;font-size:12px;color:#6B7280">${rodape ?? `${esc(id.nome_agencia)} · enviado pelo ${esc(id.nome_sistema)}`}</td></tr>
</table></td></tr></table></body></html>`;
}

const lista = (itens: string[]) =>
  `<ul style="padding-left:18px;margin:8px 0">${itens.map((t) => `<li style="margin:3px 0">${esc(t)}</li>`).join("")}</ul>`;

const rodapeTime = (site: string) => `Para não receber estes e-mails, desligue em <a href="${esc(site)}/conta" style="color:#6B7280">Minha conta</a>.`;

export function emailParaAprovar(id: Identidade, nomePessoa: string, titulos: string[], linkPortal: string) {
  const n = titulos.length;
  return {
    assunto: n === 1 ? "Você tem 1 conteúdo para aprovar" : `Você tem ${n} conteúdos para aprovar`,
    html: moldura(id, 
      n === 1 ? "Você tem 1 conteúdo para aprovar" : `Você tem ${n} conteúdos para aprovar`,
      `Olá, ${esc(nomePessoa.split(" ")[0])}! A ${esc(id.nome_agencia)} enviou para a sua aprovação:${lista(titulos)}Aprove ou peça ajuste direto pelo portal, pelo celular ou computador.`,
      { texto: "Abrir o portal", link: linkPortal },
    ),
  };
}

export function emailLembrete(id: Identidade, nomePessoa: string, titulos: string[], dias: number, linkPortal: string) {
  return {
    assunto: "Lembrete: conteúdos esperando a sua aprovação",
    html: moldura(id, 
      "Conteúdos esperando a sua aprovação",
      `Olá, ${esc(nomePessoa.split(" ")[0])}! ${titulos.length === 1 ? "Este conteúdo está" : "Estes conteúdos estão"} com você há ${dias} dia${dias > 1 ? "s" : ""} ou mais:${lista(titulos)}Quanto antes a aprovação, mais folga para publicar no dia certo.`,
      { texto: "Aprovar agora", link: linkPortal },
    ),
  };
}

export function emailAvisoTime(id: Identidade, tipo: string, texto: string, link: string, site: string) {
  const titulos: Record<string, string> = {
    cliente_aprovou: "Cliente aprovou",
    ajuste_pedido: "Cliente pediu ajuste",
    responsavel: "Você recebeu uma tarefa",
    etapa_vez: "Sua vez numa etapa",
  };
  const titulo = titulos[tipo] ?? `Aviso do ${id.nome_sistema}`;
  return {
    assunto: texto.length > 90 ? `${texto.slice(0, 87)}…` : texto,
    html: moldura(id, titulo, esc(texto).replace(/\n/g, "<br>"), { texto: `Abrir no ${id.nome_sistema}`, link }, rodapeTime(site)),
  };
}

export function emailResumoDiario(id: Identidade, nome: string, venceAmanha: string[], atrasadas: string[], site: string, followups: string[] = []) {
  const partes = [
    atrasadas.length ? `<b style="color:#C62828">Atrasadas (${atrasadas.length})</b>${lista(atrasadas)}` : "",
    venceAmanha.length ? `<b>Vencem amanhã (${venceAmanha.length})</b>${lista(venceAmanha)}` : "",
    followups.length ? `<b>Follow-ups do CRM, hoje e atrasados (${followups.length})</b>${lista(followups)}` : "",
  ].join("");
  return {
    assunto: atrasadas.length
      ? `Bom dia! ${atrasadas.length} tarefa${atrasadas.length > 1 ? "s" : ""} atrasada${atrasadas.length > 1 ? "s" : ""}`
      : venceAmanha.length
        ? "Bom dia! Tarefas que vencem amanhã"
        : "Bom dia! Follow-ups do CRM para hoje",
    html: moldura(id, `Bom dia, ${esc(nome.split(" ")[0])}`, partes, { texto: "Abrir minhas tarefas", link: `${site}/inicio?aba=resumo` }, rodapeTime(site)),
  };
}

export function emailRelatorioPublicado(id: Identidade, nomePessoa: string, mesExtenso: string, linkPortal: string) {
  return {
    assunto: `Seu relatório de ${mesExtenso} está disponível`,
    html: moldura(id, 
      `Relatório de ${esc(mesExtenso)}`,
      `Olá, ${esc(nomePessoa.split(" ")[0])}! O relatório de métricas de ${esc(mesExtenso)} foi revisado pela ${esc(id.nome_agencia)} e já está no portal: alcance, seguidores, engajamento, tráfego pago e a nossa leitura do mês.`,
      { texto: "Ver o relatório", link: linkPortal },
    ),
  };
}
