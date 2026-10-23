import { Painel } from "@/components/painel";
import { FormPublico } from "../../formularios";
import { lerBriefing, lerCliente, TituloSecao } from "../dados";
import { Texto } from "../texto";

export const metadata = { title: "Público-alvo" };

export default async function PublicoAlvo({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [{ gestao }, briefing] = await Promise.all([lerCliente(id), lerBriefing(id)]);
  return (
    <>
      <TituloSecao titulo="Público-alvo" descricao="Para quem a marca fala: quem é, o que procura, onde está e o que faz decidir." />
      <div className="max-w-[760px]">
        <Painel icone="alvo" tom="violeta" titulo="Quem é o público">
          {gestao ? <FormPublico clientId={id} briefing={briefing} /> : <Texto rotulo="Público" valor={briefing?.publico} />}
        </Painel>
      </div>
    </>
  );
}
