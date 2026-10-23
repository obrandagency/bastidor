import { Painel } from "@/components/painel";
import { FormAcessos } from "../../formularios";
import { lerBriefing, lerCliente, TituloSecao } from "../dados";

export const metadata = { title: "Acessos" };

export default async function Acessos({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [{ gestao }, briefing] = await Promise.all([lerCliente(id), lerBriefing(id)]);
  return (
    <>
      <TituloSecao titulo="Acessos" descricao="Contas e ferramentas do cliente que a agência precisa usar e se já foram liberadas." />
      <div className="max-w-[760px]">
        <Painel icone="chave" tom="cinza" titulo="Acessos">
          {gestao ? (
            <FormAcessos clientId={id} briefing={briefing} />
          ) : (
            <ul>
              {(briefing?.acessos ?? []).map((a) => (
                <li key={a.nome} className="flex items-center gap-2 border-t border-line py-2 first:border-t-0">
                  <span className="flex-1">{a.nome}</span>
                  <span className={`text-[12px] ${a.liberado ? "text-ok" : "font-semibold text-bad"}`}>{a.liberado ? "Liberado" : "Pendente"}</span>
                </li>
              ))}
              {!briefing?.acessos?.length && <li className="text-muted">Nenhum acesso registrado.</li>}
            </ul>
          )}
        </Painel>
      </div>
    </>
  );
}
