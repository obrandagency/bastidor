import Link from "next/link";
import { linksDasArtes } from "@/lib/artes";
import { diaMes, hojeSP, mesEAno, somarMes } from "@/lib/datas";
import { area, dataHoraSP, rotuloFormato, type Area, type Formato } from "@/lib/dominio/tarefas";
import { lerIdentidade } from "@/lib/identidade";
import { criarClienteServidor } from "@/lib/supabase/server";
import type { ConteudoPortal, ResumoPortal } from "@/types/banco";
import { Colunas, Numero } from "@/components/graficos";
import { Carrossel, Decisao } from "./interativos";

// Telas do portal, usadas pelo cliente (/portal) e pela equipe em "Ver como cliente" (somenteLeitura)
type Alvo = { clientId?: string; somenteLeitura?: boolean };

const COR_SITUACAO: Record<string, string> = {
  "Aguardando você": "bg-warn-soft text-warn",
  "Em ajuste": "bg-bad-soft text-bad",
  Aprovado: "bg-ok-soft text-ok",
  Publicado: "bg-ok-soft text-ok",
  Agendado: "bg-ok-soft text-ok",
  "Em produção": "bg-andamento-soft text-andamento",
  "Em andamento": "bg-andamento-soft text-andamento",
  Concluído: "bg-ok-soft text-ok",
};

function Selo({ texto }: { texto: string }) {
  return (
    <span className={`inline-flex whitespace-nowrap rounded-full px-[9px] py-px text-[11.5px] font-medium ${COR_SITUACAO[texto] ?? "bg-surface text-muted"}`}>
      {texto}
    </span>
  );
}

function situacaoDe(c: ConteudoPortal) {
  if (c.etapa === "agendado") return c.publicar_em && c.publicar_em <= new Date().toISOString() ? "Publicado" : "Agendado";
  if (c.etapa === "aprovado") return "Aprovado";
  if (c.etapa === "ajuste") return "Em ajuste";
  return "Aguardando você";
}

async function dados(clientId?: string) {
  const supabase = await criarClienteServidor();
  const args = clientId ? { p_client_id: clientId } : {};
  const [{ data: resumo, error }, { data: conteudos }] = await Promise.all([
    supabase.rpc("portal_resumo", args),
    supabase.rpc("portal_conteudos", args),
  ]);
  return { supabase, resumo: resumo as ResumoPortal | null, conteudos: (conteudos ?? []) as ConteudoPortal[], erro: error };
}

export function BarraAjustes({ resumo }: { resumo: ResumoPortal }) {
  if (resumo.ajustes_mes === null) return null;
  const acabou = resumo.ajustes_usados >= resumo.ajustes_mes;
  return (
    <div className={`rounded-lg px-3 py-2 text-[13px] ${acabou ? "bg-warn-soft text-warn" : "bg-surface text-muted"}`}>
      Ajustes do mês:{" "}
      <b className="font-mono font-semibold">
        {resumo.ajustes_usados} de {resumo.ajustes_mes}
      </b>
    </div>
  );
}

// ---------------------------------------------------------------- aprovar conteúdos
export async function TelaAprovar({ clientId, somenteLeitura }: Alvo) {
  const { supabase, resumo, conteudos, erro } = await dados(clientId);
  if (erro || !resumo) return <p className="text-muted">Não foi possível carregar o portal.</p>;
  // O cliente só enxerga a própria linha em clients; a equipe pede pelo id
  const consulta = supabase.from("clients").select("cor");
  const { data: cliente } = await (clientId ? consulta.eq("id", clientId) : consulta.limit(1)).maybeSingle();
  const cor = cliente?.cor ?? "#2563EB";

  const links = await linksDasArtes(conteudos.filter((c) => c.etapa === "cliente").flatMap((c) => c.artes.map((a) => a.caminho)));
  const { data: onboarding } = await supabase.rpc("portal_onboarding", clientId ? { p_client_id: clientId } : {});
  return (
    <VistaAprovar
      resumo={resumo}
      conteudos={conteudos}
      links={links}
      cor={cor}
      somenteLeitura={somenteLeitura}
      onboarding={onboarding as OnboardingPortal | null}
      agencia={(await lerIdentidade()).nome_agencia}
    />
  );
}

// ---------------------------------------------------------------- primeiros passos (onboarding)
export type OnboardingPortal = {
  inicio: string;
  concluido_em: string | null;
  etapa_atual: number;
  etapas: { nome: string; ordem: number; tarefas: { texto: string; feito: boolean }[] }[];
};

export function PrimeirosPassos({ onboarding, agencia }: { onboarding: OnboardingPortal; agencia: string }) {
  const etapas = onboarding.etapas ?? [];
  const todas = etapas.flatMap((e) => e.tarefas);
  const feitas = todas.filter((t) => t.feito).length;
  const pct = todas.length ? Math.round((feitas / todas.length) * 100) : 0;
  const atual = etapas.find((e) => e.ordem === onboarding.etapa_atual);
  return (
    <section className="mb-5 rounded-xl border border-line bg-card p-4">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-[16px] font-bold">Seus primeiros passos com a {agencia}</h2>
        <span className="text-[12.5px] text-muted">
          <b className="font-mono font-semibold text-ink">{pct}%</b> · {feitas} de {todas.length} itens
        </span>
      </div>
      <div className="mb-3.5 h-1.5 overflow-hidden rounded-full bg-surface">
        <i className="block h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
      </div>
      <ol className="mb-3 flex gap-1.5 overflow-x-auto pb-1">
        {etapas.map((e, i) => {
          const passou = e.ordem < onboarding.etapa_atual;
          const agora = e.ordem === onboarding.etapa_atual;
          return (
            <li
              key={e.ordem}
              aria-current={agora ? "step" : undefined}
              className={`flex flex-none items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] ${
                agora ? "bg-accent text-accent-ink" : passou ? "bg-ok-soft text-ok" : "bg-surface text-muted"
              }`}
            >
              <span className="font-mono text-[10.5px]">{passou ? "✓" : i + 1}</span>
              {e.nome}
            </li>
          );
        })}
      </ol>
      {atual && atual.tarefas.length > 0 && (
        <div>
          <div className="mb-1.5 text-[11px] uppercase tracking-[0.08em] text-muted">Agora: {atual.nome}</div>
          <ul className="flex flex-col gap-1 text-[13px]">
            {atual.tarefas.map((t, i) => (
              <li key={i} className="flex gap-2">
                <span className={t.feito ? "text-ok" : "text-muted"} aria-label={t.feito ? "feito" : "a fazer"}>
                  {t.feito ? "✓" : "○"}
                </span>
                <span className={t.feito ? "text-muted line-through" : ""}>{t.texto}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

// Desenho da tela de aprovação (sem consultas)
export function VistaAprovar({
  resumo,
  conteudos,
  links,
  cor,
  somenteLeitura,
  onboarding,
  agencia,
}: {
  resumo: ResumoPortal;
  conteudos: ConteudoPortal[];
  links: Map<string, string>;
  cor: string;
  somenteLeitura?: boolean;
  onboarding?: OnboardingPortal | null;
  agencia?: string;
}) {
  const paraAprovar = conteudos.filter((c) => c.etapa === "cliente");
  const recentes = conteudos
    .filter((c) => c.etapa !== "cliente")
    .sort((a, b) => b.atualizado_em.localeCompare(a.atualizado_em))
    .slice(0, 12);

  return (
    <>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[25px] font-bold leading-[1.1] md:text-[30px]">Aprovar conteúdos</h1>
          <p className="mt-1.5 text-muted">
            {paraAprovar.length === 0
              ? "Nada esperando a sua aprovação agora."
              : `${paraAprovar.length} conteúdo${paraAprovar.length > 1 ? "s" : ""} esperando a sua aprovação.`}
          </p>
        </div>
        <BarraAjustes resumo={resumo} />
      </div>
      {onboarding && !onboarding.concluido_em && <PrimeirosPassos onboarding={onboarding} agencia={agencia ?? "agência"} />}

      <div className="flex flex-col gap-4">
        {paraAprovar.map((c) => (
          <article key={c.id} className="grid gap-4 rounded-xl border border-line bg-card p-4 md:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
            <Carrossel cor={cor} midias={c.artes.flatMap((a) => (links.get(a.caminho) ? [{ url: links.get(a.caminho)!, tipo: a.tipo }] : []))} />
            <div className="flex min-w-0 flex-col gap-3">
              <div>
                <div className="text-[12.5px] text-muted">
                  {rotuloFormato(c.formato)}
                  {c.prazo && <> · previsto para {diaMes(c.prazo)}</>}
                </div>
                <h2 className="mt-0.5 text-[18px] font-bold leading-tight">{c.titulo}</h2>
              </div>
              <div>
                <div className="mb-1 text-[11.5px] uppercase tracking-[0.04em] text-muted">Legenda</div>
                <p className="max-h-[320px] overflow-y-auto whitespace-pre-wrap text-[13.5px] [overflow-wrap:anywhere]">
                  {c.legenda || <span className="text-muted">Sem legenda.</span>}
                </p>
              </div>
              <div className="mt-auto">
                <Decisao id={c.id} usados={resumo.ajustes_usados} limite={resumo.ajustes_mes} somenteLeitura={somenteLeitura} />
              </div>
            </div>
          </article>
        ))}
      </div>

      <section className="mt-8">
        <h2 className="mb-3 text-[15px] font-bold">Histórico recente</h2>
        <div className="rounded-xl border border-line bg-card">
          {recentes.map((c) => (
            <div key={c.id} className="flex flex-col gap-1 border-t border-line px-4 py-[11px] first:border-t-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="min-w-0 flex-1 font-medium [overflow-wrap:anywhere]">{c.titulo}</span>
                {c.etapa === "agendado" && c.publicar_em && (
                  <span className="font-mono text-[12px] text-muted">
                    {diaMes(dataHoraSP(c.publicar_em).data)} {dataHoraSP(c.publicar_em).hora}
                  </span>
                )}
                <Selo texto={situacaoDe(c)} />
              </div>
              {c.etapa === "ajuste" && c.pedidos_ajuste.length > 0 && (
                <p className="text-[12.5px] text-muted">Seu pedido: {c.pedidos_ajuste[c.pedidos_ajuste.length - 1].texto}</p>
              )}
            </div>
          ))}
          {recentes.length === 0 && <p className="px-4 py-[18px] text-[13px] text-muted">Nada por aqui ainda.</p>}
        </div>
      </section>
    </>
  );
}

// ---------------------------------------------------------------- relatório de entregas
export async function TelaRelatorio({ clientId, mes, base }: Alvo & { mes?: string; base: string }) {
  const atual = hojeSP().slice(0, 7);
  const m = /^\d{4}-\d{2}$/.test(mes ?? "") ? mes! : atual;
  const supabase = await criarClienteServidor();
  const args = { ...(clientId ? { p_client_id: clientId } : {}), p_mes: `${m}-01` };
  const [{ data: resumoBruto, error }, { data: lista }, { data: servicos }] = await Promise.all([
    supabase.rpc("portal_resumo", args),
    supabase.rpc("portal_relatorio", args),
    supabase.rpc("portal_servicos", args),
  ]);
  if (error || !resumoBruto) return <p className="text-muted">Não foi possível carregar o relatório.</p>;
  const resumo = resumoBruto as ResumoPortal;
  const itens = (lista ?? []) as { id: string; titulo: string; formato: Formato; dia: string; situacao: string }[];
  const outros = (servicos ?? []) as { titulo: string; area: Area; situacao: string }[];
  const total = resumo.conteudos_mes ?? 0;
  const pct = total > 0 ? Math.min(100, Math.round((resumo.entregues / total) * 100)) : 0;
  const linkMes = (alvo: string) => `${base}${base.includes("?") ? "&" : "?"}mes=${alvo}`;

  return (
    <>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[25px] font-bold leading-[1.1] md:text-[30px]">Relatório de entregas</h1>
          <p className="mt-1.5 capitalize text-muted">{mesEAno(m)}</p>
        </div>
        <div className="flex gap-1.5">
          <Link href={linkMes(somarMes(m, -1))} aria-label="Mês anterior" className="rounded-lg border border-line bg-card px-2.5 py-[5px] text-[12.5px] font-medium hover:border-ink">
            ‹
          </Link>
          <Link href={linkMes(atual)} className="rounded-lg border border-line bg-card px-2.5 py-[5px] text-[12.5px] font-medium hover:border-ink">
            Este mês
          </Link>
          {m < atual && (
            <Link href={linkMes(somarMes(m, 1))} aria-label="Próximo mês" className="rounded-lg border border-line bg-card px-2.5 py-[5px] text-[12.5px] font-medium hover:border-ink">
              ›
            </Link>
          )}
        </div>
      </div>

      <div className="mb-[18px] grid grid-cols-[repeat(auto-fit,minmax(min(100%,200px),1fr))] gap-3">
        <div className="rounded-xl border border-ink bg-ink px-4 py-3.5 text-bg">
          <b className="block font-display text-[30px] font-bold leading-[1.1] tabular-nums">
            {resumo.entregues}
            {total > 0 && <span className="text-[18px] opacity-70"> de {total}</span>}
          </b>
          <span className="text-[12.5px] opacity-75">publicados ou agendados</span>
          {total > 0 && (
            <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-white/20" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
              <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
            </div>
          )}
        </div>
        <div className="rounded-xl border border-line bg-card px-4 py-3.5">
          <b className="block font-display text-[30px] font-bold leading-[1.1] tabular-nums">{resumo.em_producao}</b>
          <span className="text-[12.5px] text-muted">em produção</span>
        </div>
        <div className="rounded-xl border border-line bg-card px-4 py-3.5">
          <b className="block font-display text-[30px] font-bold leading-[1.1] tabular-nums">
            {resumo.ajustes_usados}
            {resumo.ajustes_mes !== null && <span className="text-[18px] text-muted"> de {resumo.ajustes_mes}</span>}
          </b>
          <span className="text-[12.5px] text-muted">ajustes usados</span>
        </div>
      </div>

      <section className="mb-6 rounded-xl border border-line bg-card">
        <h2 className="border-b border-line px-4 py-3.5 text-[15px] font-bold">Conteúdos do mês</h2>
        {itens.map((c) => (
          <div key={c.id} className="flex flex-wrap items-center gap-2 border-t border-line px-4 py-[11px] first:border-t-0">
            <span className="w-[46px] font-mono text-[12px] text-muted">{diaMes(c.dia)}</span>
            <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">
              {c.titulo}
              <span className="text-[12.5px] text-muted"> · {rotuloFormato(c.formato)}</span>
            </span>
            <Selo texto={c.situacao} />
          </div>
        ))}
        {itens.length === 0 && <p className="px-4 py-[18px] text-[13px] text-muted">Nenhum conteúdo neste mês.</p>}
      </section>

      {outros.length > 0 && (
        <section className="rounded-xl border border-line bg-card">
          <h2 className="border-b border-line px-4 py-3.5 text-[15px] font-bold">Outros serviços do mês</h2>
          {outros.map((s, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2 border-t border-line px-4 py-[11px] first:border-t-0">
              <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">{s.titulo}</span>
              <span className="text-[11px] font-semibold tracking-[0.03em] text-accent">{area(s.area)?.rotulo}</span>
              <Selo texto={s.situacao} />
            </div>
          ))}
        </section>
      )}
    </>
  );
}

// ---------------------------------------------------------------- métricas do mês (só relatório publicado)
export type RelatorioPortal = {
  mes: string;
  alcance: number | null;
  novos_seguidores: number | null;
  engajamento: number | null;
  visitas_perfil: number | null;
  cliques_link: number | null;
  alcance_semanas: number[];
  investimento: number | null;
  resultados: number | null;
  resultado_rotulo: string | null;
  leitura: string;
  alcance_anterior: number | null;
  novos_anterior: number | null;
  instagram: string | null;
  destaques: { id: string; titulo: string; formato: Formato; arte: string | null }[];
};

export async function TelaMetricas({ clientId, mes, base }: Alvo & { mes?: string; base: string }) {
  const supabase = await criarClienteServidor();
  const args = { ...(clientId ? { p_client_id: clientId } : {}), ...(/^\d{4}-\d{2}$/.test(mes ?? "") ? { p_mes: `${mes}-01` } : {}) };
  const { data, error } = await supabase.rpc("portal_metricas", args);
  if (error || !data) return <p className="text-muted">Não foi possível carregar as métricas.</p>;
  const { relatorio, meses } = data as { relatorio: RelatorioPortal | null; meses: string[] };
  const links = await linksDasArtes((relatorio?.destaques ?? []).flatMap((d) => (d.arte ? [d.arte] : [])));
  return <VistaMetricas relatorio={relatorio} meses={meses} links={links} base={base} />;
}

const nf = (n: number | null | undefined) => (n === null || n === undefined ? "·" : n.toLocaleString("pt-BR"));

function Variacao({ atual, anterior }: { atual: number | null; anterior: number | null }) {
  if (atual === null || !anterior) return null;
  const d = Math.round(((atual - anterior) / anterior) * 100);
  return (
    <span className={`ml-1 font-semibold ${d >= 0 ? "text-ok" : "text-bad"}`}>
      {d >= 0 ? "▲ +" : "▼ "}
      {d}%
    </span>
  );
}

export function VistaMetricas({
  relatorio,
  meses,
  links,
  base,
}: {
  relatorio: RelatorioPortal | null;
  meses: string[];
  links: Map<string, string>;
  base: string;
}) {
  const linkMes = (m: string) => `${base}${base.includes("?") ? "&" : "?"}mes=${m.slice(0, 7)}`;
  const seletor = meses.length > 1 && (
    <nav aria-label="Meses" className="flex flex-wrap gap-1.5">
      {meses.map((m) => (
        <Link
          key={m}
          href={linkMes(m)}
          aria-current={relatorio?.mes === m ? "page" : undefined}
          className={`rounded-full border px-3 py-1 text-[12.5px] capitalize ${relatorio?.mes === m ? "border-accent bg-accent-soft font-semibold" : "border-line bg-card hover:border-muted"}`}
        >
          {mesEAno(m.slice(0, 7))}
        </Link>
      ))}
    </nav>
  );

  if (!relatorio)
    return (
      <div className="flex flex-col gap-4">
        <div className="rounded-xl border border-line bg-card px-5 py-10 text-center">
          <h1 className="text-[20px] font-bold">Relatório do mês em preparação</h1>
          <p className="mt-1.5 text-muted">A agência está revisando os números. Você recebe um e-mail quando ele estiver disponível.</p>
        </div>
        {seletor}
      </div>
    );

  const custo = relatorio.investimento && relatorio.resultados ? relatorio.investimento / relatorio.resultados : null;
  const reais = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const temTrafego = relatorio.investimento !== null || relatorio.resultados !== null;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-[0.12em] text-muted">Relatório mensal · revisado pela agência</div>
          <h1 className="mt-1 text-[25px] font-bold capitalize leading-[1.1] md:text-[30px]">{mesEAno(relatorio.mes.slice(0, 7))}</h1>
        </div>
        {seletor}
      </div>

      <div>
        <div className="mb-2 text-[11.5px] uppercase tracking-[0.04em] text-muted">Instagram{relatorio.instagram ? ` @${relatorio.instagram}` : ""}</div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Numero valor={nf(relatorio.alcance)} rotulo={<>contas alcançadas<Variacao atual={relatorio.alcance} anterior={relatorio.alcance_anterior} /></>} />
          <Numero
            valor={relatorio.novos_seguidores === null ? "·" : `${relatorio.novos_seguidores >= 0 ? "+" : ""}${nf(relatorio.novos_seguidores)}`}
            rotulo={<>novos seguidores<Variacao atual={relatorio.novos_seguidores} anterior={relatorio.novos_anterior} /></>}
          />
          <Numero valor={relatorio.engajamento === null ? "·" : `${String(relatorio.engajamento).replace(".", ",")}%`} rotulo="taxa de engajamento" />
          <Numero valor={nf(relatorio.visitas_perfil)} rotulo={`visitas ao perfil${relatorio.cliques_link !== null ? ` · ${nf(relatorio.cliques_link)} cliques no link` : ""}`} />
        </div>
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,320px),1fr))] gap-4">
        {relatorio.alcance_semanas.length > 0 && (
          <section className="rounded-xl border border-line bg-card">
            <div className="flex items-center justify-between border-b border-line px-4 py-3.5">
              <h2 className="text-[15px] font-bold">Alcance por semana</h2>
              <span className="text-[12px] text-muted">contas alcançadas</span>
            </div>
            <div className="px-4 py-3.5">
              <Colunas itens={relatorio.alcance_semanas.map((v, i) => ({ rotulo: `Sem. ${i + 1}`, valor: v }))} />
            </div>
          </section>
        )}
        {temTrafego && (
          <section className="rounded-xl border border-line bg-card">
            <div className="flex items-center justify-between border-b border-line px-4 py-3.5">
              <h2 className="text-[15px] font-bold">Tráfego pago</h2>
              <span className="text-[12px] text-muted">Meta Ads</span>
            </div>
            {[
              ["Investimento", relatorio.investimento !== null ? reais(relatorio.investimento) : "·"],
              [`Resultados${relatorio.resultado_rotulo ? ` (${relatorio.resultado_rotulo})` : ""}`, nf(relatorio.resultados)],
              ["Custo por resultado", custo !== null ? reais(custo) : "·"],
            ].map(([r, v]) => (
              <div key={r} className="flex items-center gap-3 border-t border-line px-4 py-[11px] first:border-t-0">
                <span className="min-w-0 flex-1">{r}</span>
                <b className="font-mono font-medium">{v}</b>
              </div>
            ))}
          </section>
        )}
      </div>

      {relatorio.destaques.length > 0 && (
        <div>
          <div className="mb-2 text-[11.5px] uppercase tracking-[0.04em] text-muted">Destaques do mês</div>
          <div className="grid grid-cols-3 gap-3 sm:max-w-[520px]">
            {relatorio.destaques.map((d) => {
              const url = d.arte ? links.get(d.arte) : null;
              return (
                <figure key={d.id} className="min-w-0">
                  {url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={url} alt={d.titulo} className="aspect-[4/5] w-full rounded-lg border border-line object-cover" />
                  ) : (
                    <div className="aspect-[4/5] w-full rounded-lg bg-surface" />
                  )}
                  <figcaption className="mt-1.5 line-clamp-2 text-[12px]">{d.titulo}</figcaption>
                </figure>
              );
            })}
          </div>
        </div>
      )}

      {relatorio.leitura && (
        <div className="rounded-xl bg-accent-soft px-4 py-3.5">
          <b className="text-[13px] text-accent">Leitura da agência</b>
          <p className="mt-1 whitespace-pre-line text-[13.5px]">{relatorio.leitura}</p>
        </div>
      )}
    </div>
  );
}
