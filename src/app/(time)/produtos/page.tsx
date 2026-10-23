import { EmBreve } from "@/components/em-breve";
import { exigirTime } from "@/lib/sessao";

export const metadata = { title: "Esteira de produtos" };

export default async function Pagina() {
  await exigirTime(["socio", "adm"]);
  return <EmBreve secao="Comercial" titulo="Esteira de produtos" icone="esteira" descricao="Os serviços da agência, do primeiro contato ao produto de maior valor." />;
}
