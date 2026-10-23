import type { IconeMenu } from "@/lib/permissoes";

// Ícones fora do menu (painéis e estados vazios)
export type IconeExtra =
  | "alerta" | "relogio" | "calendario" | "pessoas" | "documento" | "paleta" | "chave" | "voz" | "escudo" | "sino" | "foto" | "contrato" | "funil" | "lista";
export type NomeIcone = IconeMenu | IconeExtra;

// Traços copiados do protótipo
const CAMINHOS: Record<NomeIcone, string> = {
  inicio: "M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z",
  tarefas: "M4 4h4v16H4zM10 4h4v11h-4zM16 4h4v7h-4z",
  criacao: "M4 20l4-1 11-11-3-3L5 16zM14 6l3 3",
  clientes: "M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z",
  portal: "M4 12l5 5L20 6",
  configuracoes: "M6 11h12v10H6zM8 11V7a4 4 0 0 1 8 0v4",
  crm: "M3 5h18l-7 8v6l-4 2v-8z",
  chat: "M4 5h16v11H9l-5 4z",
  dashboards: "M4 20V11M10 20V5M16 20v-6M2 20h20",
  onboarding: "M5 21V4M5 4h12l-2 4 2 4H5",
  roteiros: "M4 5h16v14H4zM8 5v14M16 5v14M4 9.5h4M4 14.5h4M16 9.5h4M16 14.5h4",
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
