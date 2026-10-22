// Funil comercial (os mesmos valores dos enums do banco)

export type EtapaLead = "novo" | "contato" | "reuniao" | "proposta" | "negociacao" | "ganho" | "perdido";
export type OrigemLead = "indicacao" | "instagram" | "trafego_pago" | "site" | "evento" | "prospeccao";
export type Servico = "social_media" | "trafego_pago" | "branding" | "identidade_visual" | "video" | "endomarketing" | "outros";

export const ETAPAS_LEAD: { id: EtapaLead; rotulo: string }[] = [
  { id: "novo", rotulo: "Novo lead" },
  { id: "contato", rotulo: "Primeiro contato" },
  { id: "reuniao", rotulo: "Reunião marcada" },
  { id: "proposta", rotulo: "Proposta enviada" },
  { id: "negociacao", rotulo: "Negociação" },
  { id: "ganho", rotulo: "Fechado" },
  { id: "perdido", rotulo: "Perdido" },
];
export const rotuloEtapaLead = (e: EtapaLead) => ETAPAS_LEAD.find((x) => x.id === e)?.rotulo ?? e;

export const ORIGENS: { id: OrigemLead; rotulo: string }[] = [
  { id: "indicacao", rotulo: "Indicação" },
  { id: "instagram", rotulo: "Instagram" },
  { id: "trafego_pago", rotulo: "Tráfego pago" },
  { id: "site", rotulo: "Site" },
  { id: "evento", rotulo: "Evento" },
  { id: "prospeccao", rotulo: "Prospecção ativa" },
];
export const rotuloOrigem = (o: OrigemLead | null) => ORIGENS.find((x) => x.id === o)?.rotulo ?? "Sem origem";

export const SERVICOS: { id: Servico; rotulo: string }[] = [
  { id: "social_media", rotulo: "Social media" },
  { id: "trafego_pago", rotulo: "Tráfego pago" },
  { id: "branding", rotulo: "Branding" },
  { id: "identidade_visual", rotulo: "Identidade visual" },
  { id: "video", rotulo: "Vídeo" },
  { id: "endomarketing", rotulo: "Endomarketing" },
  { id: "outros", rotulo: "Outros" },
];

export const leadAberto = (e: EtapaLead) => e !== "ganho" && e !== "perdido";

// Próxima etapa pela seta do card (Perdido só por escolha, nunca pela seta)
export function proximaEtapaLead(e: EtapaLead): EtapaLead | null {
  const ordem: EtapaLead[] = ["novo", "contato", "reuniao", "proposta", "negociacao", "ganho"];
  const i = ordem.indexOf(e);
  return i >= 0 && i < ordem.length - 1 ? ordem[i + 1] : null;
}

export function followUpAtrasado(l: { etapa: EtapaLead; proximo_passo_em: string | null }, hoje: string) {
  return leadAberto(l.etapa) && !!l.proximo_passo_em && l.proximo_passo_em < hoje;
}

const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
export const reais = (v: number | string | null) => moeda.format(Number(v ?? 0));

export function corDaEtapaLead(e: EtapaLead) {
  if (e === "ganho") return "bg-ok-soft text-ok border-transparent";
  if (e === "perdido") return "bg-bad-soft text-bad border-transparent";
  if (e === "negociacao" || e === "proposta") return "bg-accent-soft text-accent border-transparent";
  return "bg-surface text-muted border-line";
}
