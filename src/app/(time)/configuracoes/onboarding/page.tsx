import Link from "next/link";
import { CabecalhoPagina } from "@/components/cabecalho-pagina";
import { exigirTime } from "@/lib/sessao";
import { criarClienteServidor } from "@/lib/supabase/server";
import { EditorModelo } from "./editor";

export const metadata = { title: "Modelo de onboarding" };

export default async function ModeloOnboarding() {
  await exigirTime(["socio"]);
  const supabase = await criarClienteServidor();
  const [{ data: etapas }, { data: modelo }] = await Promise.all([
    supabase.from("onboarding_etapas").select("id, nome, cor, ordem").order("ordem"),
    supabase.from("onboarding_modelo").select("id, etapa_id, texto, ordem").order("ordem"),
  ]);
  return (
    <>
      <CabecalhoPagina
        sobretitulo="Configurações"
        titulo="Modelo de onboarding"
        descricao="Etapas e tarefas que todo cliente novo recebe. Mudanças aqui valem para os próximos onboardings; os que já começaram mudam na ficha de cada cliente. A última etapa marca o onboarding como concluído."
        acoes={
          <Link href="/onboarding" className="text-[13px] text-accent hover:underline">
            Ver o quadro
          </Link>
        }
      />
      <EditorModelo
        etapas={(etapas ?? []).map((e) => ({
          id: e.id,
          nome: e.nome,
          cor: e.cor,
          tarefas: (modelo ?? []).filter((t) => t.etapa_id === e.id).map((t) => ({ id: t.id, texto: t.texto })),
        }))}
      />
    </>
  );
}
