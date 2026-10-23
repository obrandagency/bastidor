import { notFound } from "next/navigation";
import type { Cena, Roteiro } from "@/lib/dominio/roteiros";
import { exigirTime } from "@/lib/sessao";
import { criarClienteServidor } from "@/lib/supabase/server";
import { EditorRoteiro } from "./editor";

export const metadata = { title: "Roteiro" };

export default async function PaginaRoteiro({ params }: { params: Promise<{ id: string }> }) {
  const eu = await exigirTime();
  const { id } = await params;
  const supabase = await criarClienteServidor();
  const { data: r } = await supabase.from("roteiros").select("*").eq("id", id).maybeSingle<Roteiro>();
  if (!r) notFound();
  const [{ data: cenas }, { data: clientes }, { data: conteudo }] = await Promise.all([
    supabase.from("roteiro_cenas").select("tempo, imagem, fala, texto_tela, audio").eq("roteiro_id", id).order("ordem").returns<Cena[]>(),
    supabase.from("clients").select("id, nome, ativo").order("nome"),
    r.task_id ? supabase.from("tasks").select("id, titulo").eq("id", r.task_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const opcoes = (clientes ?? []).filter((c) => c.ativo || c.id === r.client_id).map((c) => ({ id: c.id, nome: c.nome }));

  return (
    <EditorRoteiro
      key={r.updated_at}
      id={id}
      clientes={opcoes}
      conteudo={conteudo}
      podeApagar={eu.perfil === "socio" || eu.perfil === "adm" || r.criado_por === eu.id}
      inicial={{
        titulo: r.titulo,
        client_id: r.client_id,
        formato: r.formato,
        duracao: r.duracao,
        objetivo: r.objetivo,
        referencias: r.referencias,
        texto_livre: r.texto_livre,
        cta: r.cta,
        legenda: r.legenda,
        situacao: r.situacao,
        cenas: cenas ?? [],
      }}
    />
  );
}
