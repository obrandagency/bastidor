// Etapas, formatos e áreas da Fase 1 (os mesmos valores dos enums do banco)

export type TipoTarefa = "conteudo" | "demanda";
export type EtapaConteudo = "pauta" | "copy" | "layout" | "revisao" | "cliente" | "ajuste" | "aprovado" | "agendado";
export type EtapaDemanda = "a_fazer" | "fazendo" | "validacao" | "concluido";
export type Etapa = EtapaConteudo | EtapaDemanda;
export type Formato = "carrossel" | "reels" | "estatico" | "stories";
export type Area = "trafego_pago" | "atendimento" | "comercial" | "branding" | "financeiro" | "administrativo" | "interno";

export const ETAPAS_CONTEUDO: { id: EtapaConteudo; rotulo: string }[] = [
  { id: "pauta", rotulo: "Pauta" },
  { id: "copy", rotulo: "Copy" },
  { id: "layout", rotulo: "Layout" },
  { id: "revisao", rotulo: "Revisão interna" },
  { id: "cliente", rotulo: "Com o cliente" },
  { id: "ajuste", rotulo: "Ajuste" },
  { id: "aprovado", rotulo: "Aprovado" },
  { id: "agendado", rotulo: "Agendado" },
];

export const ETAPAS_DEMANDA: { id: EtapaDemanda; rotulo: string }[] = [
  { id: "a_fazer", rotulo: "A fazer" },
  { id: "fazendo", rotulo: "Fazendo" },
  { id: "validacao", rotulo: "Em validação" },
  { id: "concluido", rotulo: "Concluído" },
];

export const etapasDo = (tipo: TipoTarefa) => (tipo === "conteudo" ? ETAPAS_CONTEUDO : ETAPAS_DEMANDA);

const ROTULOS = new Map<string, string>([...ETAPAS_CONTEUDO, ...ETAPAS_DEMANDA].map((e) => [e.id, e.rotulo]));
export const rotuloEtapa = (e: Etapa) => ROTULOS.get(e) ?? e;

export const FORMATOS: { id: Formato; rotulo: string }[] = [
  { id: "carrossel", rotulo: "Carrossel" },
  { id: "reels", rotulo: "Reels" },
  { id: "estatico", rotulo: "Estático" },
  { id: "stories", rotulo: "Stories" },
];
export const rotuloFormato = (f: Formato | null) => FORMATOS.find((x) => x.id === f)?.rotulo ?? "";

export const AREAS: { id: Area; rotulo: string; sigla: string }[] = [
  { id: "trafego_pago", rotulo: "Tráfego pago", sigla: "TP" },
  { id: "atendimento", rotulo: "Atendimento", sigla: "AT" },
  { id: "comercial", rotulo: "Comercial", sigla: "CO" },
  { id: "branding", rotulo: "Branding", sigla: "BR" },
  { id: "financeiro", rotulo: "Financeiro", sigla: "FI" },
  { id: "administrativo", rotulo: "Administrativo", sigla: "AD" },
  { id: "interno", rotulo: "Interno", sigla: "IN" },
];
export const area = (a: Area | null) => AREAS.find((x) => x.id === a);

// Para onde a seta do card leva. Ajuste volta para Revisão interna; Aprovado só sai pelo agendamento.
export function proximaEtapa(tipo: TipoTarefa, etapa: Etapa): Etapa | null {
  if (etapa === "ajuste") return "revisao";
  if (etapa === "aprovado" || etapa === "agendado") return null;
  const lista = etapasDo(tipo).map((e) => e.id as Etapa);
  return lista[lista.indexOf(etapa) + 1] ?? null;
}

// Pode soltar o card nesta coluna? (o banco confere de novo)
export function podeMover(de: Etapa, para: Etapa) {
  if (de === para || para === "agendado") return false;
  if (de === "ajuste") return para === "revisao";
  return true;
}

// Fora da mão do time: com o cliente, aprovado, agendado ou concluído
export const PARADAS: Etapa[] = ["cliente", "aprovado", "agendado", "concluido"];
export const FINALIZADAS: Etapa[] = ["aprovado", "agendado", "concluido"];

export function estaAtrasada(t: { prazo: string | null; etapa: Etapa }, hoje: string) {
  return !!t.prazo && t.prazo < hoje && !PARADAS.includes(t.etapa);
}

// Diferença em dias entre duas datas "AAAA-MM-DD"
export function diasEntre(de: string, ate: string) {
  return Math.round((Date.parse(ate) - Date.parse(de)) / 86_400_000);
}

// Cor do selo da etapa (como .st-* no protótipo)
export function corDaEtapa(e: Etapa) {
  if (e === "cliente") return "bg-warn-soft text-warn border-transparent";
  if (e === "ajuste") return "bg-bad-soft text-bad border-transparent";
  if (e === "aprovado" || e === "concluido") return "bg-ok-soft text-ok border-transparent";
  if (e === "agendado") return "bg-accent-soft text-accent border-transparent";
  return "bg-surface text-muted border-line";
}

// Brasil sem horário de verão desde 2019: São Paulo é sempre UTC-3
export const paraTimestampSP = (data: string, hora: string) => `${data}T${hora}:00-03:00`;

export function dataHoraSP(iso: string | null) {
  if (!iso) return { data: "", hora: "" };
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const v = (t: string) => partes.find((p) => p.type === t)?.value ?? "";
  return { data: `${v("year")}-${v("month")}-${v("day")}`, hora: `${v("hour")}:${v("minute")}` };
}
