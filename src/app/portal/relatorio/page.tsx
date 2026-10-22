import { CabecalhoPagina, EstadoVazio } from "@/components/cabecalho-pagina";

export const metadata = { title: "Relatório de entregas · Bastidor" };

export default function Relatorio() {
  return (
    <>
      <CabecalhoPagina sobretitulo="Portal do cliente" titulo="Relatório de entregas" descricao="O que foi entregue no mês e quantos ajustes foram usados." />
      <EstadoVazio>O relatório chega na etapa 6.</EstadoVazio>
    </>
  );
}
