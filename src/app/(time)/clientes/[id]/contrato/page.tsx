import { notFound } from "next/navigation";
import { Linha, Painel } from "@/components/painel";
import { dataBR, hojeSP, mesPorExtenso } from "@/lib/datas";
import { reais } from "@/lib/dominio/crm";
import type { Contrato } from "@/types/banco";
import { EdicaoContrato } from "../../formularios";
import { lerCliente, TituloSecao } from "../dados";

export const metadata = { title: "Contrato" };

export default async function ContratoCliente({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { gestao, socio, supabase } = await lerCliente(id);
  if (!gestao) notFound(); // Criação não vê contrato
  const hoje = hojeSP();
  const [{ data: contratos }, { data: ajustes }] = await Promise.all([
    supabase.from("contracts").select("*").eq("client_id", id).order("inicio", { ascending: false }).returns<Contrato[]>(),
    supabase.rpc("ajustes_do_mes", { p_client_id: id }),
  ]);
  const vigente = (contratos ?? []).find((k) => k.inicio <= hoje && (!k.fim || k.fim >= hoje)) ?? null;
  const outros = (contratos ?? []).filter((k) => k.id !== vigente?.id);
  const usados = (ajustes as number | null) ?? 0;

  return (
    <>
      <TituloSecao titulo="Contrato" descricao="Valor, conteúdos e ajustes por mês e vigência. Criação e cliente não veem esta página." />
      <div className="max-w-[760px]">
        <Painel icone="contrato" tom="verde" titulo="Contrato vigente" semPadding>
          {vigente ? (
            <div>
              {vigente.valor_mensal !== null && <Linha rotulo="Valor mensal">{reais(vigente.valor_mensal)}</Linha>}
              <Linha rotulo="Conteúdos por mês">{vigente.conteudos_mes ?? <span className="text-warn">a definir</span>}</Linha>
              <Linha rotulo={`Ajustes em ${mesPorExtenso(hoje)}`}>
                {vigente.ajustes_mes === null ? (
                  <span className="text-warn">{usados} de a definir</span>
                ) : (
                  <span className={usados >= vigente.ajustes_mes ? "text-bad" : ""}>
                    {usados} de {vigente.ajustes_mes}
                  </span>
                )}
              </Linha>
              <Linha rotulo="Vigência">
                {dataBR(vigente.inicio)} a {vigente.fim ? dataBR(vigente.fim) : "sem data de fim"}
              </Linha>
            </div>
          ) : (
            <p className="px-4 py-[18px] text-[13px] text-muted">Sem contrato vigente hoje.</p>
          )}
          {outros.length > 0 && (
            <div className="border-t border-line px-4 py-2.5 text-[12.5px] text-muted">
              Outros contratos: {outros.map((k) => `${dataBR(k.inicio)} a ${k.fim ? dataBR(k.fim) : "sem fim"}`).join(" · ")}
            </div>
          )}
          {socio && <EdicaoContrato clientId={id} contrato={vigente ?? undefined} />}
        </Painel>
      </div>
    </>
  );
}
