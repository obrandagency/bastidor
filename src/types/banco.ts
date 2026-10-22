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
