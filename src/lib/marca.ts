// Identidade visual: endereço das imagens do bucket público "marca" e tons da cor principal.
// Usado no servidor e no navegador (sem segredos).

export type Identidade = { nome_agencia: string; nome_sistema: string; logo: string | null; cor: string };

export const IDENTIDADE_PADRAO: Identidade = { nome_agencia: "O.BRAND", nome_sistema: "Bastidor", logo: null, cor: "#1E4BFF" };
export const BUCKET_MARCA = "marca";

export function urlMarca(caminho: string | null | undefined) {
  if (!caminho) return null;
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${BUCKET_MARCA}/${caminho}`;
}

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

function luminancia(hex: string) {
  const [r, g, b] = rgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contraste(a: string, b: string) {
  const [x, y] = [luminancia(a), luminancia(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}

// Botões, links e seleção usam a cor sobre fundo branco: precisa de pelo menos 3:1 para ler
export const CONTRASTE_MINIMO = 3;

// Cor principal, cor do texto em cima dela e tom claro de fundo (12% da cor sobre branco)
export function tonsDaCor(cor: string) {
  const texto = contraste(cor, "#FFFFFF") >= contraste(cor, "#0A0C12") ? "#FFFFFF" : "#0A0C12";
  const suave = "#" + rgb(cor).map((v) => Math.round(255 - (255 - v) * 0.1).toString(16).padStart(2, "0")).join("");
  return { cor, texto, suave };
}

// Variáveis do tema (globals.css) trocadas pela cor da agência
export function estiloDaCor(cor: string) {
  const t = tonsDaCor(cor);
  return { "--color-accent": t.cor, "--color-accent-ink": t.texto, "--color-accent-soft": t.suave } as React.CSSProperties;
}
