// Rastreador de tempo: formatos de duração (usados no servidor e no navegador)

// 4980 -> "1h 23min"; 2700 -> "45min"; 30 -> "0min"
export function duracao(segundos: number) {
  const min = Math.floor(Math.max(0, segundos) / 60);
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (!h) return `${m}min`;
  return m ? `${h}h ${String(m).padStart(2, "0")}min` : `${h}h`;
}

// 3725 -> "01:02:05" (relógio correndo)
export function relogio(segundos: number) {
  const s = Math.max(0, Math.floor(segundos));
  return [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60].map((n) => String(n).padStart(2, "0")).join(":");
}

export const segundosEntre = (inicio: string, fim: string | null, agora = Date.now()) =>
  Math.max(0, ((fim ? new Date(fim).getTime() : agora) - new Date(inicio).getTime()) / 1000);

// "1h30", "1:30", "90" (minutos), "1,5" (horas) -> minutos; inválido -> null
export function lerDuracao(v: string): number | null {
  const t = v.trim().toLowerCase().replace(/\s+/g, "");
  if (!t) return null;
  let m = t.match(/^(\d+)h(\d{1,2})?(min)?$/) ?? t.match(/^(\d+):(\d{1,2})$/);
  if (m) return Number(m[1]) * 60 + Number(m[2] ?? 0);
  m = t.match(/^(\d+)min$/);
  if (m) return Number(m[1]);
  if (/^\d+([.,]\d+)?$/.test(t)) {
    const n = Number(t.replace(",", "."));
    // Número inteiro grande é minuto ("90"); pequeno ou com vírgula é hora ("1,5", "2")
    return t.includes(",") || t.includes(".") || n <= 12 ? Math.round(n * 60) : n;
  }
  return null;
}
