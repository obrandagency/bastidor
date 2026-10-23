import { notFound } from "next/navigation";
import type { Cena, Roteiro } from "@/lib/dominio/roteiros";
import { urlMarca } from "@/lib/marca";
import { exigirTime } from "@/lib/sessao";
import { criarClienteServidor } from "@/lib/supabase/server";
import { DocumentoRoteiro, type Docs } from "./documento";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await criarClienteServidor();
  const { data } = await supabase.from("roteiros").select("titulo").eq("id", id).maybeSingle();
  // O título vira o nome sugerido do arquivo PDF
  return { title: { absolute: data ? `Roteiro - ${data.titulo}` : "Roteiro" } };
}

// Página A4 para imprimir ou salvar em PDF, no timbrado da agência (imagem de fundo em todas as páginas)
export default async function ImprimirRoteiro({ params }: { params: Promise<{ id: string }> }) {
  await exigirTime();
  const { id } = await params;
  const supabase = await criarClienteServidor();
  const [{ data: r }, { data: cenas }, { data: docs }] = await Promise.all([
    supabase.from("roteiros").select("*").eq("id", id).maybeSingle<Roteiro>(),
    supabase.from("roteiro_cenas").select("tempo, imagem, fala, texto_tela, audio").eq("roteiro_id", id).order("ordem").returns<Cena[]>(),
    supabase.from("identidade").select("nome_agencia, logo, cor, timbrado, margem_topo, margem_base, rodape").maybeSingle<Docs>(),
  ]);
  if (!r) notFound();
  const { data: cliente } = r.client_id ? await supabase.from("clients").select("nome").eq("id", r.client_id).maybeSingle() : { data: null };
  return <DocumentoRoteiro r={r} cenas={cenas ?? []} docs={docs} cliente={cliente?.nome ?? null} timbrado={urlMarca(docs?.timbrado)} logo={urlMarca(docs?.logo)} />;
}

