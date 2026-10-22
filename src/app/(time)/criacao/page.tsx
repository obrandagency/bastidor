import { CabecalhoPagina, EstadoVazio } from "@/components/cabecalho-pagina";

export const metadata = { title: "Criação · Bastidor" };

export default function Criacao() {
  return (
    <>
      <CabecalhoPagina sobretitulo="Operação" titulo="Criação" descricao="Legenda com prévia do feed, artes e ajustes internos e do cliente." />
      <EstadoVazio>A tela de criação chega na etapa 6.</EstadoVazio>
    </>
  );
}
