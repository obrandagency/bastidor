import { EmBreve } from "@/components/em-breve";
import { exigirTime } from "@/lib/sessao";

export const metadata = { title: "Vendas" };

export default async function Pagina() {
  await exigirTime(["socio", "adm"]);
  return <EmBreve secao="Comercial" titulo="Vendas" icone="vendas" descricao="Vendas fechadas, metas e resultados do comercial." />;
}
