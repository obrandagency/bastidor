// Modelos dos e-mails (HTML simples, que funciona nos clientes de e-mail). Cores do protótipo.

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function moldura(titulo: string, corpo: string, botao?: { texto: string; link: string }, rodape?: string) {
  return `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#F4F6FB;font-family:Arial,Helvetica,sans-serif;color:#0A0C12">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4F6FB;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#FFFFFF;border:1px solid #E2E6EF;border-radius:12px">
<tr><td style="padding:22px 24px 0"><span style="display:inline-block;width:26px;height:26px;line-height:26px;text-align:center;border-radius:7px;background:#1E4BFF;color:#fff;font-weight:bold">B</span>
<span style="font-weight:bold;font-size:16px;vertical-align:middle;margin-left:6px">Bastidor</span></td></tr>
<tr><td style="padding:18px 24px 4px"><h1 style="margin:0;font-size:20px;line-height:1.25">${titulo}</h1></td></tr>
<tr><td style="padding:8px 24px 4px;font-size:14px;line-height:1.55">${corpo}</td></tr>
${botao ? `<tr><td style="padding:14px 24px 6px"><a href="${esc(botao.link)}" style="display:inline-block;background:#1E4BFF;color:#ffffff;text-decoration:none;padding:11px 18px;border-radius:8px;font-weight:bold;font-size:14px">${esc(botao.texto)}</a></td></tr>` : ""}
<tr><td style="padding:16px 24px 22px;font-size:12px;color:#5A6275">${rodape ?? "O.BRAND · enviado pelo Bastidor"}</td></tr>
</table></td></tr></table></body></html>`;
}

const lista = (itens: string[]) =>
  `<ul style="padding-left:18px;margin:8px 0">${itens.map((t) => `<li style="margin:3px 0">${esc(t)}</li>`).join("")}</ul>`;

const rodapeTime = (site: string) => `Para não receber estes e-mails, desligue em <a href="${esc(site)}/conta" style="color:#5A6275">Minha conta</a>.`;

export function emailParaAprovar(nomePessoa: string, titulos: string[], linkPortal: string) {
  const n = titulos.length;
  return {
    assunto: n === 1 ? "Você tem 1 conteúdo para aprovar" : `Você tem ${n} conteúdos para aprovar`,
    html: moldura(
      n === 1 ? "Você tem 1 conteúdo para aprovar" : `Você tem ${n} conteúdos para aprovar`,
      `Olá, ${esc(nomePessoa.split(" ")[0])}! A O.BRAND enviou para a sua aprovação:${lista(titulos)}Aprove ou peça ajuste direto pelo portal, pelo celular ou computador.`,
      { texto: "Abrir o portal", link: linkPortal },
    ),
  };
}

export function emailLembrete(nomePessoa: string, titulos: string[], dias: number, linkPortal: string) {
  return {
    assunto: "Lembrete: conteúdos esperando a sua aprovação",
    html: moldura(
      "Conteúdos esperando a sua aprovação",
      `Olá, ${esc(nomePessoa.split(" ")[0])}! ${titulos.length === 1 ? "Este conteúdo está" : "Estes conteúdos estão"} com você há ${dias} dia${dias > 1 ? "s" : ""} ou mais:${lista(titulos)}Quanto antes a aprovação, mais folga para publicar no dia certo.`,
      { texto: "Aprovar agora", link: linkPortal },
    ),
  };
}

export function emailAvisoTime(tipo: string, texto: string, link: string, site: string) {
  const titulos: Record<string, string> = {
    cliente_aprovou: "Cliente aprovou",
    ajuste_pedido: "Cliente pediu ajuste",
    responsavel: "Você recebeu uma tarefa",
  };
  const titulo = titulos[tipo] ?? "Aviso do Bastidor";
  return {
    assunto: texto.length > 90 ? `${texto.slice(0, 87)}…` : texto,
    html: moldura(titulo, esc(texto).replace(/\n/g, "<br>"), { texto: "Abrir no Bastidor", link }, rodapeTime(site)),
  };
}

export function emailResumoDiario(nome: string, venceAmanha: string[], atrasadas: string[], site: string, followups: string[] = []) {
  const partes = [
    atrasadas.length ? `<b style="color:#C93838">Atrasadas (${atrasadas.length})</b>${lista(atrasadas)}` : "",
    venceAmanha.length ? `<b>Vencem amanhã (${venceAmanha.length})</b>${lista(venceAmanha)}` : "",
    followups.length ? `<b>Follow-ups do CRM, hoje e atrasados (${followups.length})</b>${lista(followups)}` : "",
  ].join("");
  return {
    assunto: atrasadas.length
      ? `Bom dia! ${atrasadas.length} tarefa${atrasadas.length > 1 ? "s" : ""} atrasada${atrasadas.length > 1 ? "s" : ""}`
      : venceAmanha.length
        ? "Bom dia! Tarefas que vencem amanhã"
        : "Bom dia! Follow-ups do CRM para hoje",
    html: moldura(`Bom dia, ${esc(nome.split(" ")[0])}`, partes, { texto: "Abrir minhas tarefas", link: `${site}/inicio?aba=resumo` }, rodapeTime(site)),
  };
}

export function emailRelatorioPublicado(nomePessoa: string, mesExtenso: string, linkPortal: string) {
  return {
    assunto: `Seu relatório de ${mesExtenso} está disponível`,
    html: moldura(
      `Relatório de ${esc(mesExtenso)}`,
      `Olá, ${esc(nomePessoa.split(" ")[0])}! O relatório de métricas de ${esc(mesExtenso)} foi revisado pela O.BRAND e já está no portal: alcance, seguidores, engajamento, tráfego pago e a nossa leitura do mês.`,
      { texto: "Ver o relatório", link: linkPortal },
    ),
  };
}
