import { CabecalhoPagina, EstadoVazio } from "@/components/cabecalho-pagina";

export const metadata = { title: "Início · Bastidor" };

export default function Inicio() {
  return (
    <>
      <CabecalhoPagina sobretitulo="Operação" titulo="Início" descricao="Calendário do mês com o responsável de cada demanda e o resumo do dia." />
      <EstadoVazio>O calendário do mês chega na etapa 5.</EstadoVazio>
    </>
  );
}
