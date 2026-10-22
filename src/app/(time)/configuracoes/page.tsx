import { CabecalhoPagina, EstadoVazio } from "@/components/cabecalho-pagina";

export const metadata = { title: "Configurações · Bastidor" };

export default function Configuracoes() {
  return (
    <>
      <CabecalhoPagina sobretitulo="Conta" titulo="Configurações" descricao="Pessoas, perfis, responsável padrão por etapa e lembretes." />
      <EstadoVazio>Pessoas e perfis chegam na etapa 2.</EstadoVazio>
    </>
  );
}
