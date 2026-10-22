import { CabecalhoPagina, EstadoVazio } from "@/components/cabecalho-pagina";

export const metadata = { title: "Tarefas · Bastidor" };

export default function Tarefas() {
  return (
    <>
      <CabecalhoPagina sobretitulo="Operação" titulo="Tarefas" descricao="Conteúdos em 8 etapas e demandas da agência em 4 etapas." />
      <EstadoVazio>Os quadros de conteúdos e demandas chegam na etapa 4.</EstadoVazio>
    </>
  );
}
