import type { IconeMenu } from "@/lib/permissoes";

// Ícones fora do menu (painéis e estados vazios)
export type IconeExtra =
  | "alerta" | "relogio" | "calendario" | "pessoas" | "documento" | "paleta" | "chave" | "voz" | "escudo" | "sino" | "foto" | "contrato" | "funil" | "lista"
  | "lampada" | "pasta" | "alvo" | "aprovacao" | "predio" | "camera" | "seta";
export type NomeIcone = IconeMenu | IconeExtra;

// Traços copiados do protótipo
const CAMINHOS: Record<NomeIcone, string> = {
  inicio: "M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z",
  tarefas: "M4 4h4v16H4zM10 4h4v11h-4zM16 4h4v7h-4z",
  criacao: "M4 20l4-1 11-11-3-3L5 16zM14 6l3 3",
  clientes: "M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z",
  portal: "M4 12l5 5L20 6",
  configuracoes:
    "M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z",
  crm: "M3 5h18l-7 8v6l-4 2v-8z",
  chat: "M4 5h16v11H9l-5 4z",
  dashboards: "M4 20V11M10 20V5M16 20v-6M2 20h20",
  onboarding: "M5 21V4M5 4h12l-2 4 2 4H5",
  roteiros: "M4 5h16v14H4zM8 5v14M16 5v14M4 9.5h4M4 14.5h4M16 9.5h4M16 14.5h4",
  churn: "M3 7l6 6 4-4 8 8M21 11v6h-6",
  comercial: "M3 10v4h3l7 4V6l-7 4zM17 9a4 4 0 0 1 0 6",
  vendas: "M12 3v18M16.5 7.5C16 6 14.3 5 12 5c-2.5 0-4.5 1.2-4.5 3.2 0 4.6 9 2.4 9 7 0 2-2 3.3-4.5 3.3-2.4 0-4.2-1-4.8-2.6",
  esteira: "M12 3l9 4.5-9 4.5-9-4.5zM3 12l9 4.5 9-4.5M3 16.5L12 21l9-4.5",
  propostas: "M6 3h8l4 4v14H6zM14 3v4h4M9 13h6M9 17h4M12 9.5h.01",
  academy: "M2 6.5C4.5 5 8 5 12 7c4-2 7.5-2 10-.5V19c-2.5-1.5-6-1.5-10 .5-4-2-7.5-2-10-.5zM12 7v12.5",
  integracoes: "M9 3v5M15 3v5M6 8h12v3a6 6 0 0 1-12 0zM12 17v4",
  alerta: "M12 3l9.5 17h-19zM12 10v4.5M12 17.5v.01",
  relogio: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7.5V12l3 2",
  calendario: "M4 6h16v14H4zM4 10h16M8 3v4M16 3v4",
  pessoas: "M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 6.5M18.5 20a6.5 6.5 0 0 0-3-5.5",
  documento: "M6 3h8l4 4v14H6zM14 3v4h4M9 12h6M9 16h6",
  paleta: "M12 3a9 9 0 1 0 0 18c1.5 0 2-1 1.5-2s0-2 1.5-2H18a3 3 0 0 0 3-3c0-6-4-11-9-11zM7.5 11v.01M10 7v.01M15 7.5v.01",
  chave: "M14.5 9.5a4 4 0 1 0-1 1L21 18v3h-3v-2h-2v-2h-2z",
  voz: "M4 6h16v10H10l-4 4v-4H4zM8 10h8M8 13h5",
  escudo: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z",
  sino: "M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15zM10 20a2 2 0 0 0 4 0",
  foto: "M4 6h16v13H4zM8.5 11a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM20 16l-5-5-8 8",
  contrato: "M6 3h12v18H6zM9 8h6M9 12h6M9 16h3",
  funil: "M3 5h18l-7 8v6l-4 2v-8z",
  lista: "M8 6h12M8 12h12M8 18h12M4 6v.01M4 12v.01M4 18v.01",
  lampada: "M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z",
  pasta: "M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM3 10h18",
  alvo: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10zM12 11v2",
  aprovacao: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM8 12.5l2.5 2.5L16 9.5",
  predio: "M5 21V4h10v17M15 9h4v12M3 21h18M8 8h4M8 12h4M8 16h4",
  camera: "M3 7h12v10H3zM15 10.5l6-3.5v10l-6-3.5",
  seta: "M5 12h14M13 6l6 6-6 6",
};

// Ícone num quadradinho colorido (cards e estados vazios)
const TONS = {
  azul: "bg-accent-soft text-accent",
  violeta: "bg-andamento-soft text-andamento",
  ambar: "bg-warn-soft text-warn",
  verde: "bg-ok-soft text-ok",
  vermelho: "bg-bad-soft text-bad",
  cinza: "bg-surface text-muted",
};
export type TomIcone = keyof typeof TONS;

export function IconeQuadrado({ nome, tom = "azul", grande }: { nome: NomeIcone; tom?: TomIcone; grande?: boolean }) {
  return (
    <span className={`grid flex-none place-items-center rounded-lg ${TONS[tom]} ${grande ? "h-11 w-11" : "h-8 w-8"}`}>
      <Icone nome={nome} className={grande ? "!h-[22px] !w-[22px]" : ""} />
    </span>
  );
}

export function Icone({ nome, className = "" }: { nome: NomeIcone; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={`h-[17px] w-[17px] flex-none fill-none stroke-current ${className}`}
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={CAMINHOS[nome]} />
    </svg>
  );
}
