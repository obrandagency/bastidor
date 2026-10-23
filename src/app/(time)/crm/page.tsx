import Link from "next/link";
import { notFound } from "next/navigation";
import { CabecalhoPagina } from "@/components/cabecalho-pagina";
import { Avatar } from "@/components/tarefa";
import { dataBR, diaMes, hojeSP, mesPorExtenso, somarDias } from "@/lib/datas";
import {
  corDaEtapaLead,
  ETAPAS_LEAD,
  followUpAtrasado,
  leadAberto,
  ORIGENS,
  reais,
  rotuloEtapaLead,
  rotuloOrigem,
  SERVICOS,
} from "@/lib/dominio/crm";
import { dataHoraSP } from "@/lib/dominio/tarefas";
import { exigirTime } from "@/lib/sessao";
import { criarClienteServidor } from "@/lib/supabase/server";
import type { EventoLead, Lead, Pessoa } from "@/types/banco";
import { Gaveta } from "../tarefas/detalhe";
import { Anotar, ExcluirLead, FormLead, VirarCliente } from "./ficha";
import { FiltroResponsavel } from "./filtro";
import { QuadroLeads, type CardLead } from "./quadro-leads";

export const metadata = { title: "CRM" };

type Busca = { aba?: string; resp?: string; lead?: string; novo?: string };

export default async function Crm({ searchParams }: { searchParams: Promise<Busca> }) {
  const eu = await exigirTime(["socio", "adm"]);
  const busca = await searchParams;
  const aba = busca.aba === "lista" || busca.aba === "origem" ? busca.aba : "funil";
  const hoje = hojeSP();
  const supabase = await criarClienteServidor();

  const link = (mudar: Partial<Busca>) => {
    const p = new URLSearchParams();
    const final = { aba: aba === "funil" ? undefined : aba, resp: busca.resp, ...mudar };
    Object.entries(final).forEach(([k, v]) => v && p.set(k, v));
    const q = p.toString();
    return q ? `/crm?${q}` : "/crm";
  };

  let consulta = supabase.from("leads").select("*").order("updated_at", { ascending: false });
  if (busca.resp) consulta = consulta.eq("responsavel_id", busca.resp);
  const [{ data: leadsBrutos }, { data: time }] = await Promise.all([
    consulta.returns<Lead[]>(),
    supabase.from("profiles").select("*").in("perfil", ["socio", "adm"]).eq("ativo", true).order("nome").returns<Pessoa[]>(),
  ]);
  const leads = leadsBrutos ?? [];
  const pessoaPor = new Map((time ?? []).map((p) => [p.id, p]));

  const abertos = leads.filter((l) => leadAberto(l.etapa));
  const ganhos = leads.filter((l) => l.etapa === "ganho");
  const perdidos = leads.filter((l) => l.etapa === "perdido");
  const ganhosNoMes = ganhos.filter((l) => l.fechado_em?.startsWith(hoje.slice(0, 7)));
  const conversao = ganhos.length + perdidos.length ? Math.round((ganhos.length / (ganhos.length + perdidos.length)) * 100) : 0;
  const atrasados = abertos.filter((l) => followUpAtrasado(l, hoje));
  const soma = (ls: Lead[]) => ls.reduce((a, l) => a + Number(l.valor_mensal), 0);

  const quando = (d: string) => (d < hoje ? `atrasado ${Math.round((Date.parse(hoje) - Date.parse(d)) / 86_400_000)}d` : d === hoje ? "hoje" : diaMes(d));
  const cards: CardLead[] = leads.map((l) => {
    const r = l.responsavel_id ? pessoaPor.get(l.responsavel_id) : null;
    return {
      id: l.id,
      empresa: l.empresa,
      etapa: l.etapa,
      segmento: l.segmento,
      contato: l.contato,
      cidade: l.cidade,
      valor: Number(l.valor_mensal),
      origem: rotuloOrigem(l.origem),
      proximo:
        l.proximo_passo || l.proximo_passo_em
          ? {
              texto: l.proximo_passo ?? "Próximo passo",
              quando: l.proximo_passo_em ? quando(l.proximo_passo_em) : "sem data",
              atrasado: followUpAtrasado(l, hoje),
              hoje: l.proximo_passo_em === hoje,
            }
          : null,
      motivo: l.motivo_perda,
      resp: r ? { iniciais: r.iniciais, nome: r.nome, foto: r.foto } : null,
      href: link({ lead: l.id }),
    };
  });
  const opcoesTime = (time ?? []).map((p) => ({ id: p.id, nome: p.nome }));

  const estatisticas: [string, string, string][] = [
    [reais(soma(abertos)), `por mês em negociação · ${abertos.length} lead${abertos.length === 1 ? "" : "s"}`, "border-ink bg-ink text-bg"],
    [String(ganhosNoMes.length), `fechados em ${mesPorExtenso(hoje).split(" ")[0]} · ${reais(soma(ganhosNoMes))}/mês`, "border-line bg-card"],
    [`${conversao}%`, "taxa de conversão", "border-line bg-card"],
    [String(atrasados.length), "follow-ups atrasados", atrasados.length ? "border-line bg-card [&_b]:text-bad" : "border-line bg-card"],
  ];

  return (
    <>
      <CabecalhoPagina
        sobretitulo="Clientes"
        titulo="CRM"
        descricao="Funil comercial da agência: do primeiro contato ao contrato assinado."
        acoes={
          <Link href={link({ novo: "1" })} scroll={false} className="rounded-lg border border-accent bg-accent px-3.5 py-2 font-medium text-accent-ink hover:brightness-110">
            + Novo lead
          </Link>
        }
      />

      <div className="mb-[18px] grid grid-cols-[repeat(auto-fit,minmax(min(100%,190px),1fr))] gap-3">
        {estatisticas.map(([n, rotulo, estilo]) => (
          <div key={rotulo} className={`rounded-xl border px-4 py-3.5 ${estilo}`}>
            <b className="block font-display text-[26px] font-bold leading-[1.1] tabular-nums md:text-[30px]">{n}</b>
            <span className="text-[12.5px] opacity-75">{rotulo}</span>
          </div>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap items-end gap-2.5">
        <div role="tablist" className="inline-flex flex-wrap gap-0.5 self-center rounded-[9px] bg-surface p-[3px]">
          {(
            [
              ["funil", "Funil"],
              ["lista", "Lista"],
              ["origem", "Origem dos leads"],
            ] as const
          ).map(([id, rotulo]) => (
            <Link
              key={id}
              role="tab"
              aria-selected={aba === id}
              href={link({ aba: id === "funil" ? undefined : id })}
              className={`rounded-[7px] px-3 py-[5px] text-[12.5px] font-medium ${aba === id ? "bg-card text-ink shadow-[0_1px_3px_rgba(0,0,0,.08)]" : "text-muted hover:text-ink"}`}
            >
              {rotulo}
            </Link>
          ))}
        </div>
        <div className="ml-auto">
          <FiltroResponsavel time={opcoesTime} />
        </div>
      </div>

      {aba === "funil" && <QuadroLeads key={busca.resp ?? ""} cards={cards} />}

      {aba === "lista" && (
        <section className="overflow-x-auto rounded-xl border border-line bg-card">
          <table className="w-full min-w-[720px] text-left text-[13px]">
            <thead className="border-b border-line bg-surface text-[11px] uppercase tracking-[0.08em] text-muted">
              <tr>
                <th className="px-4 py-2.5 font-medium">Empresa</th>
                <th className="px-2 py-2.5 font-medium">Etapa</th>
                <th className="px-2 py-2.5 text-right font-medium">Valor/mês</th>
                <th className="px-2 py-2.5 font-medium">Origem</th>
                <th className="px-2 py-2.5 font-medium">Resp.</th>
                <th className="px-4 py-2.5 font-medium">Próximo passo</th>
              </tr>
            </thead>
            <tbody>
              {[...leads]
                .sort((a, b) => ETAPAS_LEAD.findIndex((e) => e.id === a.etapa) - ETAPAS_LEAD.findIndex((e) => e.id === b.etapa))
                .map((l) => {
                  const r = l.responsavel_id ? pessoaPor.get(l.responsavel_id) : null;
                  return (
                    <tr key={l.id} className="border-t border-line first:border-t-0 hover:bg-surface">
                      <td className="px-4 py-2.5">
                        <Link href={link({ lead: l.id })} scroll={false} className="font-semibold hover:underline">
                          {l.empresa}
                        </Link>
                        <div className="text-[12px] text-muted">{[l.contato, l.cidade].filter(Boolean).join(" · ")}</div>
                      </td>
                      <td className="px-2 py-2.5">
                        <span className={`inline-flex whitespace-nowrap rounded-full border px-[9px] py-px text-[11.5px] font-medium ${corDaEtapaLead(l.etapa)}`}>
                          {rotuloEtapaLead(l.etapa)}
                        </span>
                      </td>
                      <td className="px-2 py-2.5 text-right font-mono">{reais(l.valor_mensal)}</td>
                      <td className="px-2 py-2.5">{rotuloOrigem(l.origem)}</td>
                      <td className="px-2 py-2.5">{r && <Avatar iniciais={r.iniciais} nome={r.nome} foto={r.foto} />}</td>
                      <td className="px-4 py-2.5 text-[12.5px]">
                        {leadAberto(l.etapa) && (l.proximo_passo || l.proximo_passo_em) ? (
                          <>
                            {l.proximo_passo ?? "Próximo passo"}
                            {l.proximo_passo_em && (
                              <span className={followUpAtrasado(l, hoje) ? "font-semibold text-bad" : "text-muted"}> · {quando(l.proximo_passo_em)}</span>
                            )}
                          </>
                        ) : (
                          <span className="text-muted">·</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              {leads.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-[18px] text-muted">
                    Nenhum lead ainda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      )}

      {aba === "origem" && <Origens leads={leads} />}

      {busca.novo && (
        <Gaveta fechar={link({})} rotulo="Novo lead">
          <div className="flex justify-end">
            <Link href={link({})} scroll={false} aria-label="Fechar" className="rounded-lg px-3 py-1.5 hover:bg-surface">
              ✕
            </Link>
          </div>
          <FormLead time={opcoesTime} eu={eu.id} amanha={somarDias(hoje, 1)} />
        </Gaveta>
      )}

      {busca.lead && <FichaLead id={busca.lead} fechar={link({})} time={opcoesTime} eu={eu.id} amanha={somarDias(hoje, 1)} />}
    </>
  );
}

function Origens({ leads }: { leads: Lead[] }) {
  const porOrigem = [...ORIGENS, { id: null, rotulo: "Sem origem" }]
    .map((o) => {
      const ls = leads.filter((l) => l.origem === o.id);
      return { rotulo: o.rotulo, total: ls.length, ganhos: ls.filter((l) => l.etapa === "ganho").length };
    })
    .filter((o) => o.total > 0)
    .sort((a, b) => b.total - a.total);
  const maior = Math.max(1, ...porOrigem.map((o) => o.total));
  const porServico = SERVICOS.map((s) => ({ rotulo: s.rotulo, total: leads.filter((l) => l.servicos.includes(s.id)).length })).filter((s) => s.total > 0);

  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,340px),1fr))] gap-4">
      <section className="rounded-xl border border-line bg-card">
        <div className="flex items-center justify-between border-b border-line px-4 py-3.5">
          <h2 className="text-[15px] font-bold">De onde vêm os leads</h2>
          <span className="text-[12px] text-muted">quantidade</span>
        </div>
        <div className="flex flex-col gap-2.5 px-4 py-3.5">
          {porOrigem.map((o) => (
            <div key={o.rotulo} className="grid grid-cols-[110px_minmax(0,1fr)_30px] items-center gap-2.5 text-[12.5px]">
              <span className="truncate">{o.rotulo}</span>
              <span className="h-2.5 overflow-hidden rounded-full bg-surface">
                <i className="block h-full rounded-full bg-accent" style={{ width: `${(o.total / maior) * 100}%` }} />
              </span>
              <span className="text-right font-mono">{o.total}</span>
            </div>
          ))}
          {porOrigem.length === 0 && <p className="text-[13px] text-muted">Nenhum lead ainda.</p>}
        </div>
      </section>
      <section className="rounded-xl border border-line bg-card">
        <h2 className="border-b border-line px-4 py-3.5 text-[15px] font-bold">Conversão por origem</h2>
        {porOrigem.map((o) => (
          <div key={o.rotulo} className="flex items-center gap-3 border-t border-line px-4 py-[11px] first:border-t-0">
            <span className="min-w-0 flex-1 font-medium">{o.rotulo}</span>
            <span className="font-mono text-[12px] text-muted">
              {o.ganhos} de {o.total} fechados
            </span>
          </div>
        ))}
      </section>
      {porServico.length > 0 && (
        <section className="rounded-xl border border-line bg-card">
          <h2 className="border-b border-line px-4 py-3.5 text-[15px] font-bold">Serviços procurados</h2>
          {porServico.map((s) => (
            <div key={s.rotulo} className="flex items-center gap-3 border-t border-line px-4 py-[11px] first:border-t-0">
              <span className="min-w-0 flex-1 font-medium">{s.rotulo}</span>
              <span className="font-mono text-[12px] text-muted">{s.total}</span>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}

async function FichaLead({ id, fechar, time, eu, amanha }: { id: string; fechar: string; time: { id: string; nome: string }[]; eu: string; amanha: string }) {
  const supabase = await criarClienteServidor();
  const [{ data: lead }, { data: eventos }] = await Promise.all([
    supabase.from("leads").select("*").eq("id", id).maybeSingle<Lead>(),
    supabase.from("lead_eventos").select("*").eq("lead_id", id).order("created_at", { ascending: false }).returns<EventoLead[]>(),
  ]);
  if (!lead) notFound();
  return (
    <Gaveta fechar={fechar} rotulo="Lead">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`inline-flex whitespace-nowrap rounded-full border px-[9px] py-px text-[11.5px] font-medium ${corDaEtapaLead(lead.etapa)}`}>
          {rotuloEtapaLead(lead.etapa)}
        </span>
        <span className="font-mono font-medium">{reais(lead.valor_mensal)}/mês</span>
        <span className="text-[12.5px] text-muted">entrou em {dataBR(dataHoraSP(lead.created_at).data)}</span>
        <Link href={fechar} scroll={false} aria-label="Fechar" className="ml-auto rounded-lg px-3 py-1.5 hover:bg-surface">
          ✕
        </Link>
      </div>

      {lead.etapa === "ganho" &&
        (lead.client_id ? (
          <div className="rounded-xl bg-ok-soft p-3.5 text-[13px]">
            <b className="text-ok">Cliente.</b>{" "}
            <Link href={`/clientes/${lead.client_id}`} className="text-accent hover:underline">
              Abrir na Central do cliente
            </Link>
          </div>
        ) : (
          <VirarCliente id={lead.id} />
        ))}

      <FormLead key={lead.updated_at} lead={lead} time={time} eu={eu} amanha={amanha} />

      <div>
        <div className="mb-2 text-[11.5px] uppercase tracking-[0.04em] text-muted">Histórico</div>
        <div className="flex flex-col gap-2">
          {(eventos ?? []).map((e) => {
            const { data, hora } = dataHoraSP(e.created_at);
            return (
              <div key={e.id} className={`rounded-[10px] border border-line px-[11px] py-[9px] text-[13px] ${e.tipo === "etapa" ? "bg-surface" : ""}`}>
                <p className="whitespace-pre-line [overflow-wrap:anywhere]">{e.texto}</p>
                <small className="block text-[11.5px] text-muted">
                  {diaMes(data)} {hora}
                  {e.autor_nome ? ` · ${e.autor_nome}` : ""}
                </small>
              </div>
            );
          })}
          {!eventos?.length && <p className="text-[13px] text-muted">Nenhuma interação registrada.</p>}
        </div>
        <Anotar leadId={lead.id} />
      </div>

      <div className="mt-auto flex border-t border-line pt-3">
        <ExcluirLead id={lead.id} empresa={lead.empresa} />
      </div>
    </Gaveta>
  );
}
