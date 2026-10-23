import Link from "next/link";
import { CabecalhoPagina } from "@/components/cabecalho-pagina";
import { Painel } from "@/components/painel";
import { Avatar, Miniatura, Prazo } from "@/components/tarefa";
import { diaPorExtenso, diaMes, hojeSP, saudacao, somarMes } from "@/lib/datas";
import {
  area,
  dataHoraSP,
  diasEntre,
  estaAtrasada,
  FINALIZADAS,
  PARADAS,
  rotuloEtapa,
  rotuloFormato,
} from "@/lib/dominio/tarefas";
import { exigirTime } from "@/lib/sessao";
import { criarClienteServidor } from "@/lib/supabase/server";
import type { Pessoa, Tarefa } from "@/types/banco";
import { DetalheTarefa, INTERNO } from "../tarefas/detalhe-tarefa";
import { VistaCalendario, type Ctx } from "./calendario";

export const metadata = { title: "Início" };

type Busca = { aba?: string; mes?: string; pessoa?: string; tarefa?: string };
type Cliente = { id: string; nome: string; nome_curto: string; cor: string };

export default async function Inicio({ searchParams }: { searchParams: Promise<Busca> }) {
  const eu = await exigirTime();
  const busca = await searchParams;
  const hoje = hojeSP();
  const aba = busca.aba === "resumo" ? "resumo" : "cal";
  const mes = /^\d{4}-\d{2}$/.test(busca.mes ?? "") ? busca.mes! : hoje.slice(0, 7);
  const supabase = await criarClienteServidor();

  const link = (mudar: Partial<Busca>) => {
    const p = new URLSearchParams();
    const final = { aba: aba === "resumo" ? "resumo" : undefined, mes: busca.mes, pessoa: busca.pessoa, ...mudar };
    Object.entries(final).forEach(([k, v]) => v && p.set(k, v));
    const q = p.toString();
    return q ? `/inicio?${q}` : "/inicio";
  };

  const [{ data: clientes }, { data: time }] = await Promise.all([
    supabase.from("clients").select("id, nome, nome_curto, cor").returns<Cliente[]>(),
    supabase.from("profiles").select("*").neq("perfil", "cliente").eq("ativo", true).order("nome").returns<Pessoa[]>(),
  ]);
  const clientePor = new Map((clientes ?? []).map((c) => [c.id, c]));
  const pessoaPor = new Map((time ?? []).map((p) => [p.id, p]));
  const clienteDe = (id: string | null) => (id ? clientePor.get(id) : null) ?? INTERNO;
  const ctx = { hoje, link, clienteDe, pessoaPor };

  return (
    <>
      <CabecalhoPagina
        sobretitulo={diaPorExtenso(hoje)}
        titulo={`${saudacao()}, ${eu.nome.split(" ")[0]}`}
        descricao={aba === "cal" ? "Todas as demandas do mês e quem está com cada uma." : "Resumo da operação da agência hoje."}
      />
      <div role="tablist" className="mb-[18px] inline-flex flex-wrap gap-0.5 rounded-[9px] bg-surface p-[3px]">
        {(
          [
            ["cal", "Calendário do mês", link({ aba: undefined })],
            ["resumo", "Resumo do dia", link({ aba: "resumo" })],
          ] as const
        ).map(([id, rotulo, href]) => (
          <Link
            key={id}
            role="tab"
            aria-selected={aba === id}
            href={href}
            className={`rounded-[7px] px-3 py-[5px] text-[12.5px] font-medium ${
              aba === id ? "bg-card text-ink shadow-[0_1px_3px_rgba(0,0,0,.08)]" : "text-muted hover:text-ink"
            }`}
          >
            {rotulo}
          </Link>
        ))}
      </div>

      {aba === "cal" ? <Calendario mes={mes} pessoa={busca.pessoa} time={time ?? []} {...ctx} /> : <Resumo {...ctx} />}

      {busca.tarefa && (
        <DetalheTarefa id={busca.tarefa} fechar={link({ tarefa: undefined })} podeExcluir={eu.perfil === "socio" || eu.perfil === "adm"} />
      )}
    </>
  );
}

// ---------------------------------------------------------------- calendário do mês
async function Calendario({ mes, pessoa, time, hoje, link, clienteDe, pessoaPor }: Ctx & { mes: string; pessoa?: string; time: Pessoa[] }) {
  const supabase = await criarClienteServidor();
  const inicio = `${mes}-01`;
  const proximo = `${somarMes(mes, 1)}-01`;
  // Cada demanda aparece no dia do prazo, ou no dia da publicação se já estiver agendada
  const [{ data: porPrazo }, { data: porPublicacao }] = await Promise.all([
    supabase.from("tasks").select("*").gte("prazo", inicio).lt("prazo", proximo).returns<Tarefa[]>(),
    supabase
      .from("tasks")
      .select("*")
      .eq("etapa", "agendado")
      .gte("publicar_em", `${inicio}T00:00:00-03:00`)
      .lt("publicar_em", `${proximo}T00:00:00-03:00`)
      .returns<Tarefa[]>(),
  ]);
  const diaDe = (t: Tarefa) => (t.etapa === "agendado" && t.publicar_em ? dataHoraSP(t.publicar_em).data : t.prazo);
  const todas = [...new Map([...(porPrazo ?? []), ...(porPublicacao ?? [])].map((t) => [t.id, t])).values()].filter(
    (t) => diaDe(t)?.startsWith(mes),
  );
  const { data: leads } = await supabase
    .from("leads")
    .select("id, empresa, proximo_passo, proximo_passo_em, responsavel_id")
    .not("etapa", "in", "(ganho,perdido)")
    .gte("proximo_passo_em", inicio)
    .lt("proximo_passo_em", proximo);
  // Etapas de processo aparecem no dia do prazo delas, para quem é o responsável da etapa
  const { data: etapasDoMes } = await supabase
    .from("tarefa_etapas")
    .select("id, nome, prazo, responsavel_id, feito_em, tasks!inner(id, titulo, client_id)")
    .gte("prazo", inicio)
    .lt("prazo", proximo)
    .returns<{ id: string; nome: string; prazo: string; responsavel_id: string | null; feito_em: string | null; tasks: { id: string; titulo: string; client_id: string | null } }[]>();
  const etapas = (etapasDoMes ?? []).map((e) => ({
    id: e.id,
    taskId: e.tasks.id,
    nome: e.nome,
    titulo: e.tasks.titulo,
    clienteId: e.tasks.client_id,
    dia: e.prazo,
    responsavel_id: e.responsavel_id,
    feito: !!e.feito_em,
  }));
  const followups = (leads ?? []).map((l) => ({
    id: l.id,
    empresa: l.empresa,
    texto: l.proximo_passo,
    dia: l.proximo_passo_em as string,
    responsavel_id: l.responsavel_id,
  }));
  return (
    <VistaCalendario
      mes={mes}
      pessoa={pessoa}
      time={time}
      todas={todas}
      diaDe={diaDe}
      hoje={hoje}
      link={link}
      clienteDe={clienteDe}
      pessoaPor={pessoaPor}
      followups={followups}
      etapas={etapas}
    />
  );
}

// ---------------------------------------------------------------- resumo do dia
async function Resumo({ hoje, link, clienteDe, pessoaPor }: Ctx) {
  const supabase = await criarClienteServidor();
  const [{ data: abertas }, { data: proximas }, { data: followups }, { data: etapasHoje }] = await Promise.all([
    supabase.from("tasks").select("*").not("etapa", "in", `(${FINALIZADAS.join(",")})`).order("prazo").returns<Tarefa[]>(),
    supabase
      .from("tasks")
      .select("*")
      .eq("etapa", "agendado")
      .gte("publicar_em", new Date().toISOString())
      .order("publicar_em")
      .limit(6)
      .returns<Tarefa[]>(),
    supabase
      .from("leads")
      .select("id, empresa, proximo_passo, proximo_passo_em, responsavel_id")
      .not("etapa", "in", "(ganho,perdido)")
      .lte("proximo_passo_em", hoje)
      .order("proximo_passo_em"),
    supabase
      .from("tarefa_etapas")
      .select("id, nome, prazo, responsavel_id, tasks!inner(id, titulo, client_id, etapa)")
      .is("feito_em", null)
      .lte("prazo", hoje)
      .neq("tasks.etapa", "concluido")
      .order("prazo")
      .returns<{ id: string; nome: string; prazo: string; responsavel_id: string | null; tasks: { id: string; titulo: string; client_id: string | null } }[]>(),
  ]);
  const lista = abertas ?? [];
  const atrasadas = lista.filter((t) => estaAtrasada(t, hoje));
  const venceHoje = lista.filter((t) => t.prazo === hoje && !PARADAS.includes(t.etapa));
  const esperando = lista
    .filter((t) => t.etapa === "cliente")
    .sort((a, b) => (a.enviado_cliente_em ?? "").localeCompare(b.enviado_cliente_em ?? ""));
  const emAjuste = lista.filter((t) => t.etapa === "ajuste").length;

  const linha = (t: Tarefa, direita: React.ReactNode) => {
    const c = clienteDe(t.client_id);
    const r = t.responsavel_id ? pessoaPor.get(t.responsavel_id) : null;
    const detalhe = t.tipo === "conteudo" ? rotuloFormato(t.formato) : area(t.area)?.rotulo;
    return (
      <Link key={t.id} href={link({ tarefa: t.id })} scroll={false} className="flex min-w-0 items-center gap-3 border-t border-line px-4 py-[11px] first:border-t-0 hover:bg-surface">
        <Miniatura cor={c.cor} sigla={t.tipo === "demanda" ? area(t.area)?.sigla : undefined} />
        <div className="min-w-0 flex-1">
          <div className="font-medium [overflow-wrap:anywhere]">{t.titulo}</div>
          <div className="text-[12.5px] text-muted">
            {c.nome} · {detalhe} · {rotuloEtapa(t.etapa)}
          </div>
        </div>
        {r && <Avatar iniciais={r.iniciais} nome={r.nome} foto={r.foto} />}
        <span className="text-[12px]">{direita}</span>
      </Link>
    );
  };
  const vazio = (texto: string) => <p className="px-4 py-[18px] text-[13px] text-muted">{texto}</p>;

  return (
    <>
      <div className="mb-[18px] grid grid-cols-[repeat(auto-fit,minmax(min(100%,170px),1fr))] gap-3">
        {[
          [lista.length, "tarefas em aberto", "border-ink bg-ink text-bg"],
          [atrasadas.length, "atrasadas", atrasadas.length ? "border-line bg-card [&_b]:text-bad" : "border-line bg-card"],
          [esperando.length, "esperando o cliente", "border-line bg-card"],
          [emAjuste, "em ajuste", "border-line bg-card"],
        ].map(([n, rotulo, estilo]) => (
          <div key={rotulo as string} className={`rounded-xl border px-4 py-3.5 ${estilo}`}>
            <b className="block font-display text-[30px] font-bold leading-[1.1] tabular-nums">{n}</b>
            <span className="text-[12.5px] opacity-75">{rotulo}</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,340px),1fr))] gap-4">
        <Painel titulo="Precisa de atenção hoje" semPadding extra={<Link href="/tarefas" className="text-[12.5px] text-muted hover:text-ink">Abrir tarefas</Link>}>
          {[...atrasadas, ...venceHoje].map((t) => linha(t, <Prazo prazo={t.prazo} etapa={t.etapa} hoje={hoje} />))}
          {atrasadas.length + venceHoje.length === 0 && vazio("Nada atrasado nem vencendo hoje.")}
        </Painel>

        <Painel titulo="Esperando o cliente" semPadding>
          {esperando.map((t) => {
            const dias = t.enviado_cliente_em ? diasEntre(dataHoraSP(t.enviado_cliente_em).data, hoje) : 0;
            return linha(
              t,
              <span className={dias >= 2 ? "font-semibold text-bad" : "text-muted"}>
                {dias === 0 ? "enviado hoje" : `há ${dias} dia${dias > 1 ? "s" : ""}`}
              </span>,
            );
          })}
          {esperando.length === 0 && vazio("Nenhum conteúdo com o cliente.")}
        </Painel>

        {(etapasHoje ?? []).length > 0 && (
          <Painel titulo="Etapas de processo para hoje" semPadding>
            {(etapasHoje ?? []).map((e) => {
              const r = e.responsavel_id ? pessoaPor.get(e.responsavel_id) : null;
              const dias = diasEntre(e.prazo, hoje);
              return (
                <Link key={e.id} href={link({ tarefa: e.tasks.id })} scroll={false} className="flex min-w-0 items-center gap-3 border-t border-line px-4 py-[11px] first:border-t-0 hover:bg-surface">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium [overflow-wrap:anywhere]">{e.nome}</div>
                    <div className="text-[12.5px] text-muted">
                      {clienteDe(e.tasks.client_id).nome} · {e.tasks.titulo}
                    </div>
                  </div>
                  {r && <Avatar iniciais={r.iniciais} nome={r.nome} foto={r.foto} />}
                  <span className={`text-[12px] font-semibold ${dias > 0 ? "text-bad" : "text-warn"}`}>{dias > 0 ? `Atrasada ${dias}d` : "Hoje"}</span>
                </Link>
              );
            })}
          </Painel>
        )}

        {(followups ?? []).length > 0 && (
          <Painel titulo="Follow-ups do CRM" semPadding extra={<Link href="/crm" className="text-[12.5px] text-muted hover:text-ink">Abrir CRM</Link>}>
            {(followups ?? []).map((f) => {
              const r = f.responsavel_id ? pessoaPor.get(f.responsavel_id) : null;
              const dias = diasEntre(f.proximo_passo_em!, hoje);
              return (
                <Link key={f.id} href={`/crm?lead=${f.id}`} className="flex min-w-0 items-center gap-3 border-t border-line px-4 py-[11px] first:border-t-0 hover:bg-surface">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium [overflow-wrap:anywhere]">{f.empresa}</div>
                    <div className="text-[12.5px] text-muted">{f.proximo_passo ?? "Próximo passo"}</div>
                  </div>
                  {r && <Avatar iniciais={r.iniciais} nome={r.nome} foto={r.foto} />}
                  <span className={`text-[12px] ${dias > 0 ? "font-semibold text-bad" : "font-semibold text-warn"}`}>
                    {dias > 0 ? `Atrasado ${dias}d` : "Hoje"}
                  </span>
                </Link>
              );
            })}
          </Painel>
        )}

        <Painel titulo="Próximas publicações" semPadding>
          {(proximas ?? []).map((t) => {
            const { data, hora } = dataHoraSP(t.publicar_em);
            return linha(t, <span className="font-mono">{diaMes(data)} {hora}</span>);
          })}
          {!proximas?.length && vazio("Nada agendado.")}
        </Painel>
      </div>
    </>
  );
}
