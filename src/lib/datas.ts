// Datas sempre no fuso de São Paulo e no formato brasileiro

const FUSO = "America/Sao_Paulo";

// "AAAA-MM-DD" de hoje em São Paulo
export function hojeSP() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: FUSO }).format(new Date());
}

// "2026-10-23" -> "23/10/2026"
export function dataBR(iso: string | null | undefined) {
  if (!iso) return "";
  const [a, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${a}`;
}

// "2026-10-23" -> "23/10"
export function diaMes(iso: string | null | undefined) {
  return dataBR(iso).slice(0, 5);
}

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

// "2026-10-23" -> "outubro de 2026"
export function mesPorExtenso(iso: string) {
  const [a, m] = iso.split("-");
  return `${MESES[Number(m) - 1]} de ${a}`;
}

const DIAS_SEMANA = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];
export const DIAS_CURTOS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

// Contas de calendário em UTC, para o fuso do servidor não mudar o dia
const utc = (iso: string) => new Date(`${iso.slice(0, 10)}T00:00:00Z`);
const isoDe = (d: Date) => d.toISOString().slice(0, 10);

// "2026-10-23" -> "sexta-feira, 23 de outubro"
export function diaPorExtenso(iso: string) {
  const d = utc(iso);
  return `${DIAS_SEMANA[d.getUTCDay()]}, ${d.getUTCDate()} de ${MESES[d.getUTCMonth()]}`;
}

// "Bom dia", "Boa tarde" ou "Boa noite" pela hora de São Paulo
export function saudacao() {
  const hora = Number(new Intl.DateTimeFormat("en-US", { timeZone: FUSO, hour: "numeric", hourCycle: "h23" }).format(new Date()));
  return hora < 12 ? "Bom dia" : hora < 18 ? "Boa tarde" : "Boa noite";
}

// "2026-10" -> "2026-11" (passo = 1) ou "2026-09" (passo = -1)
export function somarMes(mes: string, passo: number) {
  const d = utc(`${mes}-01`);
  d.setUTCMonth(d.getUTCMonth() + passo);
  return isoDe(d).slice(0, 7);
}

// Dias da grade do mês: começa no domingo antes do dia 1 e termina no sábado depois do último dia
export function diasDaGrade(mes: string) {
  const inicio = utc(`${mes}-01`);
  inicio.setUTCDate(1 - inicio.getUTCDay());
  const fim = utc(`${somarMes(mes, 1)}-01`);
  fim.setUTCDate(fim.getUTCDate() - 1);
  fim.setUTCDate(fim.getUTCDate() + (6 - fim.getUTCDay()));
  const dias: string[] = [];
  for (const d = inicio; d <= fim; d.setUTCDate(d.getUTCDate() + 1)) dias.push(isoDe(d));
  return dias;
}

// "2026-10" -> "outubro 2026"
export function mesEAno(mes: string) {
  const [a, m] = mes.split("-");
  return `${MESES[Number(m) - 1]} ${a}`;
}

// "2026-10-23" + 1 -> "2026-10-24"
export function somarDias(iso: string, dias: number) {
  const d = utc(iso);
  d.setUTCDate(d.getUTCDate() + dias);
  return isoDe(d);
}

// Semanas do mês, de segunda a domingo (inclui os dias do mês anterior e do seguinte que completam as pontas)
export function semanasDoMes(mes: string) {
  const inicio = utc(`${mes}-01`);
  inicio.setUTCDate(inicio.getUTCDate() - ((inicio.getUTCDay() + 6) % 7));
  const fim = utc(`${somarMes(mes, 1)}-01`);
  fim.setUTCDate(fim.getUTCDate() - 1);
  fim.setUTCDate(fim.getUTCDate() + ((7 - fim.getUTCDay()) % 7));
  const semanas: string[][] = [];
  for (const d = inicio; d <= fim; d.setUTCDate(d.getUTCDate() + 1)) {
    if ((d.getUTCDay() + 6) % 7 === 0) semanas.push([]);
    semanas[semanas.length - 1].push(isoDe(d));
  }
  return semanas;
}

const DIAS_LONGOS = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];

// "2026-11-02" -> { diaSemana: "Segunda-feira", data: "02 de novembro" }
export function diaDaSemana(iso: string) {
  const d = utc(iso);
  return { diaSemana: DIAS_LONGOS[d.getUTCDay()], data: `${iso.slice(8, 10)} de ${MESES[d.getUTCMonth()]}` };
}
