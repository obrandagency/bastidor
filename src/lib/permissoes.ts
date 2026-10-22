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

export type IconeMenu = "inicio" | "tarefas" | "criacao" | "clientes" | "portal" | "configuracoes" | "crm";

export type ItemMenu = {
  href: string;
  rotulo: string;
  icone: IconeMenu;
  perfis: PerfilTime[];
};

export const MENU: { grupo: string; itens: ItemMenu[] }[] = [
  {
    grupo: "Operação",
    itens: [
      { href: "/inicio", rotulo: "Início", icone: "inicio", perfis: ["socio", "adm", "criacao"] },
      { href: "/tarefas", rotulo: "Tarefas", icone: "tarefas", perfis: ["socio", "adm", "criacao"] },
      { href: "/criacao", rotulo: "Criação", icone: "criacao", perfis: ["socio", "adm", "criacao"] },
    ],
  },
  {
    grupo: "Clientes",
    itens: [
      { href: "/crm", rotulo: "CRM", icone: "crm", perfis: ["socio", "adm"] },
      { href: "/clientes", rotulo: "Central do cliente", icone: "clientes", perfis: ["socio", "adm", "criacao"] },
      { href: "/ver-como-cliente", rotulo: "Ver como cliente", icone: "portal", perfis: ["socio", "adm"] },
    ],
  },
  {
    grupo: "Conta",
    itens: [{ href: "/configuracoes", rotulo: "Configurações", icone: "configuracoes", perfis: ["socio"] }],
  },
];

export function menuDoPerfil(perfil: PerfilTime) {
  return MENU.map((g) => ({ ...g, itens: g.itens.filter((i) => i.perfis.includes(perfil)) })).filter(
    (g) => g.itens.length > 0,
  );
}
