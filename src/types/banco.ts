import type { Area, Etapa, Formato, TipoTarefa } from "@/lib/dominio/tarefas";
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

export type Tarefa = {
  id: string;
  tipo: TipoTarefa;
  client_id: string | null;
  titulo: string;
  formato: Formato | null;
  area: Area | null;
  etapa: Etapa;
  responsavel_id: string | null;
  prazo: string | null;
  texto: string;
  publicar_em: string | null;
  enviado_cliente_em: string | null;
  aviso_cliente_em: string | null;
  horas: number | null;
  created_at: string;
  updated_at: string;
};

export type Nota = {
  id: string;
  task_id: string;
  tipo: "interno" | "cliente";
  texto: string;
  autor_id: string | null;
  resolvido: boolean;
  created_at: string;
};

export type Evento = {
  id: number;
  task_id: string;
  de_etapa: Etapa | null;
  para_etapa: Etapa;
  ator_nome: string | null;
  origem: "time" | "cliente" | "sistema";
  created_at: string;
};

export type Arte = {
  id: string;
  task_id: string;
  caminho: string;
  tipo_midia: "imagem" | "video";
  ordem: number;
};

// Devolvido pelas funções do portal (só campos que o cliente pode ver)
export type ConteudoPortal = {
  id: string;
  titulo: string;
  formato: Formato;
  etapa: Etapa;
  legenda: string;
  prazo: string | null;
  publicar_em: string | null;
  enviado_cliente_em: string | null;
  atualizado_em: string;
  artes: { caminho: string; tipo: "imagem" | "video" }[];
  pedidos_ajuste: { texto: string; em: string }[];
};

export type ResumoPortal = {
  cliente: string;
  mes: string;
  conteudos_mes: number | null;
  ajustes_mes: number | null;
  ajustes_usados: number;
  entregues: number;
  em_producao: number;
  aguardando: number;
};
