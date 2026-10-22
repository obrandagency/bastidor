import { CabecalhoPagina, EstadoVazio } from "@/components/cabecalho-pagina";

export const metadata = { title: "Central do cliente · Bastidor" };

export default function Clientes() {
  return (
    <>
      <CabecalhoPagina sobretitulo="Clientes" titulo="Central do cliente" descricao="Briefing, tom de voz, identidade, acessos, contrato e atas." />
      <EstadoVazio>O cadastro de clientes chega na etapa 3.</EstadoVazio>
    </>
  );
}
