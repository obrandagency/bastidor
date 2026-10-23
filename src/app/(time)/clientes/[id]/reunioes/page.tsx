import { Painel } from "@/components/painel";
import { dataBR, hojeSP } from "@/lib/datas";
import type { Ata } from "@/types/banco";
import { BotaoApagarAta, FormAta } from "../../formularios";
import { lerCliente, TituloSecao } from "../dados";

export const metadata = { title: "Reuniões" };

export default async function Reunioes({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { gestao, supabase } = await lerCliente(id);
  const [{ data: atas }, { data: pessoas }] = await Promise.all([
    supabase.from("meeting_notes").select("*").eq("client_id", id).order("data", { ascending: false }).returns<Ata[]>(),
    supabase.from("profiles").select("id, nome").neq("perfil", "cliente"),
  ]);
  const autor = new Map((pessoas ?? []).map((p) => [p.id, p.nome]));
  return (
    <>
      <TituloSecao titulo="Reuniões" descricao="Atas das conversas com o cliente: o que foi decidido e o que ficou combinado." />
      <div className="max-w-[860px]">
        <Painel icone="camera" tom="azul" titulo="Atas de reunião" semPadding>
          <div className="flex flex-col gap-2 px-4 py-3.5">
            {(atas ?? []).map((a) => (
              <div key={a.id} className="flex items-start gap-2.5 rounded-[10px] border border-line px-[11px] py-[9px]">
                <div className="min-w-0 flex-1 text-[13.5px] [overflow-wrap:anywhere]">
                  <p className="whitespace-pre-line">{a.resumo}</p>
                  <small className="block text-[11.5px] text-muted">
                    {dataBR(a.data)}
                    {a.autor_id && autor.get(a.autor_id) ? ` · ${autor.get(a.autor_id)}` : ""}
                  </small>
                </div>
                {gestao && <BotaoApagarAta id={a.id} clientId={id} />}
              </div>
            ))}
            {!atas?.length && <p className="text-[13px] text-muted">Nenhuma ata ainda.</p>}
          </div>
          {gestao && <FormAta clientId={id} hoje={hojeSP()} />}
        </Painel>
      </div>
    </>
  );
}
