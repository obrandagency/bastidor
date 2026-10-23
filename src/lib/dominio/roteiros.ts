// Roteiros de vídeo: formatos, situações e o tipo das cenas

export type Cena = { tempo: string; imagem: string; fala: string; texto_tela: string; audio: string };
export type SituacaoRoteiro = "rascunho" | "revisao" | "aprovado";

export type Roteiro = {
  id: string;
  client_id: string | null;
  task_id: string | null;
  titulo: string;
  formato: string;
  duracao: string;
  objetivo: string;
  referencias: string;
  texto_livre: string;
  cta: string;
  legenda: string;
  situacao: SituacaoRoteiro;
  criado_por: string | null;
  atualizado_por: string | null;
  updated_at: string;
};

export const FORMATOS_VIDEO = [
  { id: "reels", rotulo: "Reels" },
  { id: "stories", rotulo: "Stories" },
  { id: "tiktok", rotulo: "TikTok" },
  { id: "youtube", rotulo: "YouTube" },
  { id: "institucional", rotulo: "Institucional" },
  { id: "outro", rotulo: "Outro" },
];
export const rotuloFormatoVideo = (f: string) => FORMATOS_VIDEO.find((x) => x.id === f)?.rotulo ?? f;

export const SITUACOES_ROTEIRO: { id: SituacaoRoteiro; rotulo: string; classe: string }[] = [
  { id: "rascunho", rotulo: "Rascunho", classe: "bg-surface text-muted" },
  { id: "revisao", rotulo: "Em revisão", classe: "bg-warn-soft text-warn" },
  { id: "aprovado", rotulo: "Aprovado", classe: "bg-ok-soft text-ok" },
];
export const situacaoRoteiro = (s: string) => SITUACOES_ROTEIRO.find((x) => x.id === s) ?? SITUACOES_ROTEIRO[0];

export const COLUNAS_CENA: { id: keyof Cena; rotulo: string; dica: string }[] = [
  { id: "tempo", rotulo: "Tempo", dica: "0-3s" },
  { id: "imagem", rotulo: "Imagem / ação", dica: "O que aparece na tela" },
  { id: "fala", rotulo: "Fala / narração", dica: "O que é dito" },
  { id: "texto_tela", rotulo: "Texto na tela", dica: "Legenda, lettering" },
  { id: "audio", rotulo: "Áudio", dica: "Trilha, efeito" },
];

export const cenaVazia = (): Cena => ({ tempo: "", imagem: "", fala: "", texto_tela: "", audio: "" });
