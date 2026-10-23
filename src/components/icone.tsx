import type { IconeMenu } from "@/lib/permissoes";

// Traços copiados do protótipo
const CAMINHOS: Record<IconeMenu, string> = {
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
};

export function Icone({ nome, className = "" }: { nome: IconeMenu; className?: string }) {
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
