import { CabecalhoPagina, EstadoVazio } from "@/components/cabecalho-pagina";
import type { NomeIcone } from "@/components/icone";

// Tela de um módulo que já está no menu mas ainda não foi construído
export function EmBreve({ secao, titulo, descricao, icone }: { secao: string; titulo: string; descricao: string; icone: NomeIcone }) {
  return (
    <>
      <CabecalhoPagina sobretitulo={secao} titulo={titulo} descricao={descricao} />
      <EstadoVazio icone={icone} acao={{ href: "/inicio", rotulo: "Voltar ao Início" }}>
        Em construção. Este módulo já tem lugar no menu e será montado numa próxima etapa.
      </EstadoVazio>
    </>
  );
}
