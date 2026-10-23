import Link from "next/link";
import { CabecalhoPagina } from "@/components/cabecalho-pagina";
import { exigirTime } from "@/lib/sessao";
import { criarClienteServidor } from "@/lib/supabase/server";
import { EditorProcessos, type ProcessoModelo } from "./editor";

export const metadata = { title: "Processos" };

export default async function Processos() {
  await exigirTime(["socio", "adm"]);
  const supabase = await criarClienteServidor();
  const [{ data: processos }, { data: etapas }, { data: time }] = await Promise.all([
    supabase.from("processos").select("id, nome, area, descricao, ativo").order("ativo", { ascending: false }).order("nome"),
    supabase.from("processo_etapas").select("id, processo_id, nome, responsavel_id, dias, ordem").order("ordem").order("nome"),
    supabase.from("profiles").select("id, nome").neq("perfil", "cliente").eq("ativo", true).order("nome"),
  ]);
  const lista: ProcessoModelo[] = (processos ?? []).map((p) => ({
    ...p,
    etapas: (etapas ?? []).filter((e) => e.processo_id === p.id).map((e) => ({ id: e.id, nome: e.nome, responsavel_id: e.responsavel_id, dias: e.dias })),
  }));

  return (
    <>
      <CabecalhoPagina
        sobretitulo="Tarefas"
        titulo="Processos"
        descricao="Demandas com etapas em sequência. Ao criar a demanda, as etapas vêm com responsável e prazo (o dia conta a partir do início; sábado e domingo vão para a sexta). Quando uma etapa termina, a demanda passa para o responsável da próxima."
        acoes={
          <Link href="/tarefas?aba=demanda" className="text-[13px] text-muted hover:text-ink">
            ← Voltar ao quadro
          </Link>
        }
      />
      <EditorProcessos processos={lista} time={(time ?? []).map((p) => ({ id: p.id, nome: p.nome }))} />
    </>
  );
}
