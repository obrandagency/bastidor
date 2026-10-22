import { CabecalhoPagina, EstadoVazio } from "@/components/cabecalho-pagina";

export const metadata = { title: "Ver como cliente · Bastidor" };

export default function VerComoCliente() {
  return (
    <>
      <CabecalhoPagina sobretitulo="Clientes" titulo="Ver como cliente" descricao="Abre o portal com os dados de um cliente, sem permitir aprovar em nome dele." />
      <EstadoVazio>A visão do portal chega na etapa 6.</EstadoVazio>
    </>
  );
}
