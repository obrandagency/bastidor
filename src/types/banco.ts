import type { Perfil } from "@/lib/permissoes";

export type Pessoa = {
  id: string;
  nome: string;
  email: string;
  iniciais: string;
  cargo: string | null;
  perfil: Perfil;
  client_id: string | null;
  emails_opcionais: boolean;
  ativo: boolean;
};

export type Convite = {
  email: string;
  nome: string;
  iniciais: string;
  cargo: string | null;
  perfil: Perfil;
  client_id: string | null;
  usuario_criado_em: string | null;
  created_at: string;
};

export type Cliente = {
  id: string;
  nome: string;
  nome_curto: string;
  cor: string;
  ativo: boolean;
};

export type ClienteCompleto = Cliente & {
  instagram: string | null;
  drive_url: string | null;
};

export type Acesso = { nome: string; liberado: boolean };

export type Briefing = {
  client_id: string;
  negocio: string;
  publico: string;
  objetivo: string;
  tom_voz: string[];
  evitar: string;
  cores: string[];
  acessos: Acesso[];
  updated_at: string;
};

export type Contrato = {
  id: string;
  client_id: string;
  inicio: string;
  fim: string | null;
  conteudos_mes: number;
  ajustes_mes: number;
};

export type Ata = {
  id: string;
  client_id: string;
  data: string;
  resumo: string;
  autor_id: string | null;
};
