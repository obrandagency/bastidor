import "server-only";
import { lerIdentidade } from "@/lib/identidade";

// O endereço fica fixo (domínio verificado no Resend); o nome que aparece segue a identidade da agência
async function remetente() {
  const id = await lerIdentidade();
  const nome = `${id.nome_sistema} · ${id.nome_agencia}`.replace(/["<>\r\n]/g, "");
  return `"${nome}" <bastidor@obrandagency.com>`;
}

// Envia pelo Resend (API HTTP). Nunca lança erro: devolve o resultado para registrar em envios_email.
export async function enviarEmail(para: string, assunto: string, html: string): Promise<{ ok: boolean; erro?: string }> {
  const chave = process.env.RESEND_API_KEY;
  if (!chave) return { ok: false, erro: "RESEND_API_KEY não configurada" };
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${chave}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: await remetente(), to: [para], subject: assunto, html }),
    });
    if (!r.ok) return { ok: false, erro: `Resend ${r.status}: ${(await r.text()).slice(0, 300)}` };
    return { ok: true };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : "falha de rede" };
  }
}
