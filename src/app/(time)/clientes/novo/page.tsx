import { CabecalhoPagina } from "@/components/cabecalho-pagina";
import { exigirTime } from "@/lib/sessao";
import { FormCliente } from "../formularios";

export const metadata = { title: "Novo cliente" };

export default async function NovoCliente() {
  await exigirTime(["socio", "adm"]);
  return (
    <>
      <CabecalhoPagina sobretitulo="Clientes" titulo="Novo cliente" descricao="Briefing, contrato e pessoas vêm depois, na Central do cliente." />
      <FormCliente />
    </>
  );
}
