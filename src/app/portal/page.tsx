import { CabecalhoPagina, EstadoVazio } from "@/components/cabecalho-pagina";

export const metadata = { title: "Aprovar conteúdos · Bastidor" };

export default function Aprovar() {
  return (
    <>
      <CabecalhoPagina sobretitulo="Portal do cliente" titulo="Aprovar conteúdos" descricao="Conteúdos esperando a sua aprovação." />
      <EstadoVazio>Nenhum conteúdo para aprovar por enquanto.</EstadoVazio>
    </>
  );
}
