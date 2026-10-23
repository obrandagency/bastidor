import { EmBreve } from "@/components/em-breve";
import { exigirTime } from "@/lib/sessao";

export const metadata = { title: "Integrações" };

export default async function Pagina() {
  await exigirTime(["socio"]);
  return <EmBreve secao="Conta" titulo="Integrações" icone="integracoes" descricao="Conexões com outras ferramentas (Meta, Google, WhatsApp)." />;
}
