import { EmBreve } from "@/components/em-breve";
import { exigirTime } from "@/lib/sessao";

export const metadata = { title: "Análise de churn" };

export default async function Pagina() {
  await exigirTime(["socio", "adm"]);
  return <EmBreve secao="Clientes" titulo="Análise de churn" icone="churn" descricao="Quais clientes saíram, por quê e quem corre risco de sair." />;
}
