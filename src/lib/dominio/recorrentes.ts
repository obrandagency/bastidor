// Tarefas recorrentes: textos da regra (a conta das datas fica no banco, função ocorrencias)
import type { Area, Formato, TipoTarefa } from "./tarefas";

export type Frequencia = "semanal" | "quinzenal" | "mensal";

export type Recorrencia = {
  id: string;
  tipo: TipoTarefa;
  client_id: string | null;
  titulo: string;
  formato: Formato | null;
  area: Area | null;
  responsavel_id: string | null;
  texto: string;
  frequencia: Frequencia;
  dias_semana: number[] | null;
  dia_mes: number | null;
  antecedencia: number;
  inicio: string;
  fim: string | null;
  ativa: boolean;
};

export const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const DIAS_LONGOS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
export const ULTIMO_DIA = 31;

function lista(itens: string[]) {
  return itens.length > 1 ? `${itens.slice(0, -1).join(", ")} e ${itens.at(-1)}` : (itens[0] ?? "");
}

export function descreverRegra(r: Pick<Recorrencia, "frequencia" | "dias_semana" | "dia_mes">) {
  if (r.frequencia === "mensal") return r.dia_mes === ULTIMO_DIA ? "Todo último dia do mês" : `Todo dia ${r.dia_mes} do mês`;
  const dias = lista([...(r.dias_semana ?? [])].sort().map((d) => DIAS_LONGOS[d]));
  return r.frequencia === "quinzenal" ? `A cada 15 dias: ${dias}` : `Toda semana: ${dias}`;
}
