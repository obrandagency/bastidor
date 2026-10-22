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
