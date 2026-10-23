import Link from "next/link";
import { CabecalhoPagina } from "@/components/cabecalho-pagina";
import { hojeSP } from "@/lib/datas";
import { exigirTime } from "@/lib/sessao";
import { criarClienteServidor } from "@/lib/supabase/server";
import type { Pessoa } from "@/types/banco";
import { QuadroOnboarding, type CardOnboarding } from "./quadro";

export const metadata = { title: "Onboarding" };

export default async function Onboarding() {
  const eu = await exigirTime();
  const gestao = eu.perfil === "socio" || eu.perfil === "adm";
  const supabase = await criarClienteServidor();

  const [{ data: etapas }, { data: onboardings }, { data: tarefas }, { data: eventos }, { data: docs }, { data: clientes }, { data: time }] = await Promise.all([
    supabase.from("onboarding_etapas").select("id, nome, cor").order("ordem"),
    supabase.from("onboardings").select("id, client_id, etapa_id, inicio, responsavel_id"),
    supabase.from("onboarding_tarefas").select("onboarding_id, feito_em"),
    supabase.from("onboarding_eventos").select("onboarding_id").eq("tipo", "comentario"),
    supabase.from("onboarding_documentos").select("onboarding_id"),
    supabase.from("clients").select("id, nome, cor, ativo, logo").order("nome"),
    supabase.from("profiles").select("*").in("perfil", ["socio", "adm"]).eq("ativo", true).order("nome").returns<Pessoa[]>(),
  ]);
  const clientePor = new Map((clientes ?? []).map((c) => [c.id, c]));
  const pessoaPor = new Map((time ?? []).map((p) => [p.id, p]));
  const contar = <T extends { onboarding_id: string }>(lista: T[] | null, id: string, filtro: (x: T) => boolean = () => true) =>
    (lista ?? []).filter((x) => x.onboarding_id === id && filtro(x)).length;

  const cards: CardOnboarding[] = (onboardings ?? []).map((o) => {
    const c = clientePor.get(o.client_id);
    const r = o.responsavel_id ? pessoaPor.get(o.responsavel_id) : null;
    return {
      id: o.id,
      etapaId: o.etapa_id,
      cliente: c?.nome ?? "Cliente",
      cor: c?.cor ?? "#5A6275",
      logo: c?.logo ?? null,
      inicio: o.inicio,
      feitas: contar(tarefas, o.id, (t) => !!t.feito_em),
      total: contar(tarefas, o.id),
      comentarios: contar(eventos, o.id),
      documentos: contar(docs, o.id),
      resp: r ? { iniciais: r.iniciais, nome: r.nome, foto: r.foto } : null,
    };
  });
  const comOnboarding = new Set((onboardings ?? []).map((o) => o.client_id));

  return (
    <>
      <CabecalhoPagina
        sobretitulo="Clientes"
        titulo="Onboarding"
        descricao="Os primeiros passos de cada cliente novo, etapa a etapa."
        acoes={
          eu.perfil === "socio" && (
            <Link href="/configuracoes/onboarding" className="rounded-lg border border-line bg-card px-3.5 py-2 font-medium hover:border-ink">
              Editar etapas e tarefas
            </Link>
          )
        }
      />
      <QuadroOnboarding
        etapas={etapas ?? []}
        cards={cards}
        podeEditar={gestao}
        clientesSemOnboarding={(clientes ?? []).filter((c) => c.ativo && !comOnboarding.has(c.id)).map((c) => ({ id: c.id, nome: c.nome }))}
        time={(time ?? []).map((p) => ({ id: p.id, nome: p.nome }))}
        eu={eu.id}
        hoje={hojeSP()}
      />
    </>
  );
}
