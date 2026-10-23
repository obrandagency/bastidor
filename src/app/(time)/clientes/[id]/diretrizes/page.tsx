import { Painel } from "@/components/painel";
import { FormBriefing, FormIdentidade, FormTom } from "../../formularios";
import { lerBriefing, lerCliente, TituloSecao } from "../dados";
import { Texto } from "../texto";

export const metadata = { title: "Diretrizes" };

export default async function Diretrizes({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [{ gestao, cliente }, briefing] = await Promise.all([lerCliente(id), lerBriefing(id)]);

  return (
    <>
      <TituloSecao titulo="Diretrizes" descricao="O negócio, como a marca fala e as cores. Tudo o que alguém precisa para criar sem perguntar." />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Painel icone="documento" tom="azul" titulo="Briefing">
          {gestao ? (
            <FormBriefing clientId={id} briefing={briefing} />
          ) : (
            <div className="flex flex-col gap-3">
              <Texto rotulo="O negócio" valor={briefing?.negocio} />
              <Texto rotulo="Objetivo com o marketing" valor={briefing?.objetivo} />
            </div>
          )}
        </Painel>

        <Painel icone="voz" tom="violeta" titulo="Tom de voz">
          {gestao ? (
            <FormTom clientId={id} briefing={briefing} />
          ) : (
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <span className="text-[11.5px] uppercase tracking-[0.04em] text-muted">Como a marca soa</span>
                <div className="flex flex-wrap gap-1.5">
                  {briefing?.tom_voz?.length ? (
                    briefing.tom_voz.map((t) => (
                      <span key={t} className="rounded-full bg-accent-soft px-2.5 py-0.5 text-[12.5px] font-medium text-accent">
                        {t}
                      </span>
                    ))
                  ) : (
                    <span className="text-muted">Não preenchido.</span>
                  )}
                </div>
              </div>
              <Texto rotulo="O que evitar" valor={briefing?.evitar} />
            </div>
          )}
        </Painel>

        <div className="xl:col-span-2">
          <Painel icone="paleta" tom="ambar" titulo="Identidade visual">
            {gestao ? (
              <FormIdentidade clientId={id} briefing={briefing} />
            ) : (
              <div className="flex flex-wrap gap-3">
                {briefing?.cores?.length ? (
                  briefing.cores.map((c) => (
                    <div key={c} className="flex flex-col items-center gap-1">
                      <i className="h-11 w-11 rounded-lg border border-line" style={{ background: c }} />
                      <span className="font-mono text-[11.5px]">{c}</span>
                    </div>
                  ))
                ) : (
                  <span className="text-muted">Nenhuma cor cadastrada.</span>
                )}
              </div>
            )}
            <p className="mt-3 text-[12.5px] text-muted">
              Logo, fontes e manual de marca ficam em{" "}
              <a href={`/clientes/${id}/materiais`} className="text-accent hover:underline">
                Materiais
              </a>
              {cliente.drive_url ? " (pasta no Drive)" : ""}.
            </p>
          </Painel>
        </div>
      </div>
    </>
  );
}
