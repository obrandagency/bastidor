import { LogoCliente } from "@/components/tarefa";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BUCKET_ONBOARDING } from "@/lib/constantes";
import { dataBR, diaMes } from "@/lib/datas";
import { dataHoraSP } from "@/lib/dominio/tarefas";
import { exigirTime } from "@/lib/sessao";
import { criarClienteServidor } from "@/lib/supabase/server";
import { Comentarios, Documentos, ExcluirOnboarding, FormInformacoes, ListaTarefas, MoverPara, type TarefaOb } from "./interativos";

export const metadata = { title: "Onboarding" };

const ABAS = [
  ["tarefas", "Tarefas"],
  ["informacoes", "Informações"],
  ["documentos", "Documentos"],
  ["comentarios", "Comentários"],
  ["historico", "Histórico"],
] as const;

export default async function FichaOnboarding({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ aba?: string; etapa?: string }> }) {
  const eu = await exigirTime();
  const gestao = eu.perfil === "socio" || eu.perfil === "adm";
  const { id } = await params;
  const busca = await searchParams;
  const aba = ABAS.some(([a]) => a === busca.aba) ? busca.aba! : "tarefas";
  const supabase = await criarClienteServidor();

  const { data: o } = await supabase.from("onboardings").select("*").eq("id", id).maybeSingle();
  if (!o) notFound();
  const [{ data: cliente }, { data: etapas }, { data: tarefas }, { data: eventos }, { data: docs }, { data: pessoas }] = await Promise.all([
    supabase.from("clients").select("id, nome, cor, logo").eq("id", o.client_id).maybeSingle(),
    supabase.from("onboarding_etapas").select("id, nome, cor, ordem").order("ordem"),
    supabase.from("onboarding_tarefas").select("*").eq("onboarding_id", id).order("ordem").order("created_at"),
    supabase.from("onboarding_eventos").select("*").eq("onboarding_id", id).order("created_at", { ascending: false }),
    supabase.from("onboarding_documentos").select("*").eq("onboarding_id", id).order("created_at", { ascending: false }),
    supabase.from("profiles").select("id, nome, perfil, ativo").neq("perfil", "cliente"),
  ]);
  const listaEtapas = etapas ?? [];
  const nomeDe = new Map((pessoas ?? []).map((p) => [p.id, p.nome]));
  const time = (pessoas ?? []).filter((p) => p.ativo && (p.perfil === "socio" || p.perfil === "adm")).map((p) => ({ id: p.id, nome: p.nome }));
  const atual = listaEtapas.find((e) => e.id === o.etapa_id);
  const selecionada = listaEtapas.find((e) => e.id === busca.etapa) ?? atual ?? listaEtapas[0];
  const tarefasDe = (etapaId: string) => (tarefas ?? []).filter((t) => t.etapa_id === etapaId);
  const quando = (iso: string) => {
    const { data, hora } = dataHoraSP(iso);
    return `${diaMes(data)} ${hora}`;
  };
  const link = (mudar: { aba?: string; etapa?: string }) => {
    const p = new URLSearchParams();
    const final = { aba: aba === "tarefas" ? undefined : aba, etapa: busca.etapa, ...mudar };
    Object.entries(final).forEach(([k, v]) => v && p.set(k, v));
    const q = p.toString();
    return q ? `/onboarding/${id}?${q}` : `/onboarding/${id}`;
  };

  let links = new Map<string, string>();
  if (aba === "documentos" && docs?.length) {
    const { data } = await supabase.storage.from(BUCKET_ONBOARDING).createSignedUrls(docs.map((d) => d.caminho), 3600);
    links = new Map((data ?? []).flatMap((d) => (d.path && d.signedUrl ? [[d.path, d.signedUrl] as [string, string]] : [])));
  }

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Link href="/onboarding" aria-label="Voltar para o Onboarding" className="grid h-10 w-10 place-items-center rounded-full border border-line text-[18px] hover:border-ink">
          ←
        </Link>
        <LogoCliente nome={cliente?.nome ?? "?"} cor={cliente?.cor ?? "#5A6275"} logo={cliente?.logo} classe="h-11 w-11 text-[18px]" />
        <div className="min-w-0">
          <h1 className="text-[22px] font-bold leading-tight">{cliente?.nome}</h1>
          <p className="text-[12.5px] text-muted">
            Início em {dataBR(o.inicio)}
            {o.responsavel_id && nomeDe.get(o.responsavel_id) ? ` · Responsável: ${nomeDe.get(o.responsavel_id)}` : ""}
            {o.concluido_em ? ` · Concluído em ${dataBR(dataHoraSP(o.concluido_em).data)}` : ""}
          </p>
        </div>
        <Link href={`/clientes/${o.client_id}`} className="ml-auto text-[13px] text-accent hover:underline">
          Central do cliente
        </Link>
      </div>

      <nav aria-label="Abas" className="mb-5 flex gap-1 overflow-x-auto border-b border-line">
        {ABAS.map(([a, rotulo]) => (
          <Link
            key={a}
            href={link({ aba: a === "tarefas" ? undefined : a })}
            aria-current={aba === a ? "page" : undefined}
            className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2.5 text-[13.5px] font-medium ${aba === a ? "border-accent text-accent" : "border-transparent text-muted hover:text-ink"}`}
          >
            {rotulo}
          </Link>
        ))}
      </nav>

      {/* Pipeline do projeto: etapas com ✓ quando todas as tarefas estão feitas */}
      <div className="mb-2 text-[11px] uppercase tracking-[0.08em] text-muted">Pipeline do projeto</div>
      <div className="mb-5 flex gap-2.5 overflow-x-auto pb-1">
        {listaEtapas.map((e, i) => {
          const lista = tarefasDe(e.id);
          const completa = lista.length > 0 && lista.every((t) => t.feito_em);
          const eAtual = e.id === o.etapa_id;
          const eSelecionada = e.id === selecionada?.id;
          return (
            <Link
              key={e.id}
              href={link({ etapa: e.id, aba: undefined })}
              aria-current={eSelecionada ? "step" : undefined}
              className={`flex w-[132px] flex-none items-center gap-2 rounded-xl border px-2.5 py-2 ${
                eAtual ? "border-accent bg-accent text-accent-ink" : eSelecionada ? "border-ink bg-card" : "border-line bg-card hover:border-muted"
              }`}
            >
              <span className="h-8 w-[3px] flex-none rounded" style={{ background: eAtual ? "white" : e.cor }} />
              <span className="min-w-0 flex-1">
                <small className={`block text-[10px] uppercase tracking-[0.06em] ${eAtual ? "opacity-80" : "text-muted"}`}>Etapa {i + 1}</small>
                <span className="block truncate text-[12.5px] font-medium">{e.nome}</span>
              </span>
              {completa && <span className={eAtual ? "" : "text-ok"}>✓</span>}
            </Link>
          );
        })}
      </div>

      {aba === "tarefas" && selecionada && (
        <section className="max-w-[760px] rounded-xl border border-line bg-card p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-[15px] font-bold">
              {selecionada.nome}
              {selecionada.id === o.etapa_id && <span className="ml-2 rounded-full bg-accent-soft px-2 py-px text-[11.5px] font-medium text-accent">etapa atual</span>}
            </h2>
            {gestao && selecionada.id !== o.etapa_id && <MoverPara onboardingId={id} etapaId={selecionada.id} nome={selecionada.nome} />}
          </div>
          <ListaTarefas
            key={selecionada.id}
            onboardingId={id}
            etapaId={selecionada.id}
            podeEditar={gestao}
            time={time}
            tarefas={tarefasDe(selecionada.id).map(
              (t): TarefaOb => ({
                id: t.id,
                texto: t.texto,
                feito: !!t.feito_em,
                responsavel_id: t.responsavel_id,
                prazo: t.prazo,
                feitoPor: t.feito_por ? (nomeDe.get(t.feito_por) ?? null) : null,
              }),
            )}
          />
        </section>
      )}

      {aba === "informacoes" && (
        <section className="flex max-w-[760px] flex-col gap-4 rounded-xl border border-line bg-card p-4">
          <dl className="grid grid-cols-[140px_minmax(0,1fr)] gap-y-2 text-[13px]">
            <dt className="text-muted">Cliente</dt>
            <dd>
              <Link href={`/clientes/${o.client_id}`} className="text-accent hover:underline">
                {cliente?.nome}
              </Link>
            </dd>
            <dt className="text-muted">Etapa atual</dt>
            <dd>{atual?.nome}</dd>
            <dt className="text-muted">Progresso</dt>
            <dd>
              {(tarefas ?? []).filter((t) => t.feito_em).length} de {(tarefas ?? []).length} tarefas
            </dd>
          </dl>
          <FormInformacoes id={id} inicio={o.inicio} responsavel={o.responsavel_id} time={time} podeEditar={gestao} />
          {eu.perfil === "socio" && (
            <div className="border-t border-line pt-3">
              <ExcluirOnboarding id={id} />
            </div>
          )}
        </section>
      )}

      {aba === "documentos" && (
        <section className="max-w-[760px]">
          <Documentos
            onboardingId={id}
            podeEditar={gestao}
            documentos={(docs ?? []).map((d) => ({
              id: d.id,
              nome: d.nome,
              tamanho: Number(d.tamanho),
              url: links.get(d.caminho) ?? null,
              autor: (d.autor_id && nomeDe.get(d.autor_id)) || "Alguém",
              data: quando(d.created_at),
            }))}
          />
        </section>
      )}

      {aba === "comentarios" && (
        <section className="max-w-[760px]">
          <Comentarios
            onboardingId={id}
            eu={eu.id}
            socio={eu.perfil === "socio"}
            podeEditar={gestao}
            comentarios={(eventos ?? [])
              .filter((e) => e.tipo === "comentario")
              .map((e) => ({ id: e.id, texto: e.texto, autor_id: e.autor_id, autor: e.autor_nome ?? "Alguém", data: quando(e.created_at) }))}
          />
        </section>
      )}

      {aba === "historico" && (
        <section className="max-w-[760px] rounded-xl border border-line bg-card">
          {(eventos ?? [])
            .filter((e) => e.tipo !== "comentario")
            .map((e) => (
              <div key={e.id} className="flex gap-3 border-t border-line px-4 py-2.5 text-[13px] first:border-t-0">
                <span className="w-[86px] flex-none font-mono text-[11.5px] text-muted">{quando(e.created_at)}</span>
                <span className="min-w-0 flex-1">
                  {e.texto}
                  <span className="text-muted"> · {e.autor_nome ?? "sistema"}</span>
                </span>
              </div>
            ))}
        </section>
      )}
    </>
  );
}
