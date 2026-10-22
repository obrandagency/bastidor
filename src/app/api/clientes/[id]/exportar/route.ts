import { NextResponse, type NextRequest } from "next/server";
import { BUCKET_ARTES } from "@/lib/constantes";
import { hojeSP } from "@/lib/datas";
import { pessoaAtual } from "@/lib/sessao";
import { criarClienteServidor } from "@/lib/supabase/server";

// LGPD: exporta todos os dados de um cliente em JSON (só Sócio). Artes vêm como links válidos por 7 dias.
export const dynamic = "force-dynamic";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const eu = await pessoaAtual();
  if (eu?.perfil !== "socio") return NextResponse.json({ erro: "Só o Sócio exporta dados de cliente." }, { status: 403 });
  const { id } = await params;
  const supabase = await criarClienteServidor();

  const { data: cliente } = await supabase.from("clients").select("*").eq("id", id).maybeSingle();
  if (!cliente) return NextResponse.json({ erro: "Cliente não encontrado." }, { status: 404 });

  const { data: tarefas } = await supabase.from("tasks").select("*").eq("client_id", id);
  const ids = (tarefas ?? []).map((t) => t.id);
  const porTarefa = <T,>(r: { data: T[] | null }) => r.data ?? [];
  const [contratos, briefing, atas, pessoas, convites, notas, eventos, artes, envios] = await Promise.all([
    supabase.from("contracts").select("*").eq("client_id", id),
    supabase.from("client_briefs").select("*").eq("client_id", id),
    supabase.from("meeting_notes").select("*").eq("client_id", id),
    supabase.from("profiles").select("id, nome, email, iniciais, cargo, ativo, created_at").eq("client_id", id),
    supabase.from("convites").select("email, nome, perfil, usuario_criado_em, created_at").eq("client_id", id),
    ids.length ? supabase.from("task_notes").select("*").in("task_id", ids) : Promise.resolve({ data: [] }),
    ids.length ? supabase.from("task_events").select("*").in("task_id", ids) : Promise.resolve({ data: [] }),
    ids.length ? supabase.from("task_assets").select("*").in("task_id", ids) : Promise.resolve({ data: [] }),
    supabase.from("envios_email").select("tipo, email, assunto, ok, created_at").eq("client_id", id),
  ]);
  const listaArtes = porTarefa(artes as { data: { caminho: string }[] | null });
  const { data: links } = listaArtes.length
    ? await supabase.storage.from(BUCKET_ARTES).createSignedUrls(listaArtes.map((a) => a.caminho), 7 * 24 * 3600)
    : { data: [] };

  const exportacao = {
    exportado_em: new Date().toISOString(),
    exportado_por: eu.email,
    cliente,
    contratos: contratos.data,
    briefing: briefing.data,
    atas: atas.data,
    pessoas: pessoas.data,
    convites: convites.data,
    tarefas,
    comentarios_e_ajustes: porTarefa(notas as { data: unknown[] | null }),
    historico_de_etapas: porTarefa(eventos as { data: unknown[] | null }),
    artes: listaArtes.map((a) => ({ ...a, link_7_dias: links?.find((l) => l.path === a.caminho)?.signedUrl ?? null })),
    emails_enviados: envios.data,
  };
  const nome = `bastidor-${String(cliente.nome_curto).toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${hojeSP()}.json`;
  return new NextResponse(JSON.stringify(exportacao, null, 2), {
    headers: { "Content-Type": "application/json; charset=utf-8", "Content-Disposition": `attachment; filename="${nome}"` },
  });
}
