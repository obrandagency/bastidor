import { EmBreve } from "@/components/em-breve";
import { exigirTime } from "@/lib/sessao";

export const metadata = { title: "Precificação e propostas" };

export default async function Pagina() {
  await exigirTime(["socio", "adm"]);
  return <EmBreve secao="Comercial" titulo="Precificação e propostas" icone="propostas" descricao="Cálculo de preço e propostas para enviar aos leads." />;
}
