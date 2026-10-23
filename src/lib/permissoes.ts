// Quem vê cada item do menu. A regra que vale de verdade fica no banco (RLS);
// aqui só decidimos o que aparece na tela.

export type Perfil = "socio" | "adm" | "criacao" | "cliente";
export type PerfilTime = Exclude<Perfil, "cliente">;

export const ROTULO_PERFIL: Record<Perfil, string> = {
  socio: "Sócio",
  adm: "Administrativo",
  criacao: "Criação",
  cliente: "Cliente",
};

export type IconeMenu =
  | "inicio" | "tarefas" | "criacao" | "clientes" | "portal" | "configuracoes" | "crm" | "chat" | "dashboards" | "onboarding" | "roteiros"
  | "churn" | "comercial" | "vendas" | "esteira" | "propostas" | "academy" | "integracoes";

export type ItemMenu = {
  href: string;
  rotulo: string;
  icone: IconeMenu;
  perfis: PerfilTime[];
};

// Grupo que abre e fecha (Clientes, Comercial)
export type GrupoMenu = { grupo: string; icone: IconeMenu; itens: ItemMenu[] };
export type EntradaMenu = ItemMenu | GrupoMenu;

const TIME: PerfilTime[] = ["socio", "adm", "criacao"];
const GESTAO: PerfilTime[] = ["socio", "adm"];

export const MENU: EntradaMenu[] = [
  { href: "/inicio", rotulo: "Início", icone: "inicio", perfis: TIME },
  { href: "/dashboards", rotulo: "Dashboards", icone: "dashboards", perfis: TIME },
  { href: "/chat", rotulo: "Chat", icone: "chat", perfis: TIME },
  { href: "/tarefas", rotulo: "Tarefas", icone: "tarefas", perfis: TIME },
  { href: "/criacao", rotulo: "Criação", icone: "criacao", perfis: TIME },
  { href: "/roteiros", rotulo: "Roteiros", icone: "roteiros", perfis: TIME },
  {
    grupo: "Clientes",
    icone: "clientes",
    itens: [
      { href: "/clientes", rotulo: "Central do cliente", icone: "clientes", perfis: TIME },
      { href: "/onboarding", rotulo: "Onboarding", icone: "onboarding", perfis: TIME },
      { href: "/ver-como-cliente", rotulo: "Ver como cliente", icone: "portal", perfis: GESTAO },
      { href: "/churn", rotulo: "Análise de churn", icone: "churn", perfis: GESTAO },
    ],
  },
  {
    grupo: "Comercial",
    icone: "comercial",
    itens: [
      { href: "/crm", rotulo: "CRM", icone: "crm", perfis: GESTAO },
      { href: "/vendas", rotulo: "Vendas", icone: "vendas", perfis: GESTAO },
      { href: "/produtos", rotulo: "Esteira de produtos", icone: "esteira", perfis: GESTAO },
      { href: "/propostas", rotulo: "Precificação e propostas", icone: "propostas", perfis: GESTAO },
    ],
  },
  { href: "/academy", rotulo: "Academy", icone: "academy", perfis: TIME },
  { href: "/integracoes", rotulo: "Integrações", icone: "integracoes", perfis: ["socio"] },
  { href: "/configuracoes", rotulo: "Configurações", icone: "configuracoes", perfis: ["socio"] },
];

export const eGrupo = (e: EntradaMenu): e is GrupoMenu => "grupo" in e;

// Só o que o perfil pode ver; grupo sem nenhum item visível some
export function menuDoPerfil(perfil: PerfilTime): EntradaMenu[] {
  return MENU.flatMap((e): EntradaMenu[] => {
    if (!eGrupo(e)) return e.perfis.includes(perfil) ? [e] : [];
    const itens = e.itens.filter((i) => i.perfis.includes(perfil));
    return itens.length ? [{ ...e, itens }] : [];
  });
}
