import { EmBreve } from "@/components/em-breve";
import { exigirTime } from "@/lib/sessao";

export const metadata = { title: "Academy" };

export default async function Pagina() {
  await exigirTime();
  return <EmBreve secao="Academy" titulo="Academy" icone="academy" descricao="Treinamentos, processos e materiais de estudo do time." />;
}
