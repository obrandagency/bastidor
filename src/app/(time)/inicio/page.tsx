import Link from "next/link";
import { IconeQuadrado } from "@/components/icone";
import { CabecalhoPagina } from "@/components/cabecalho-pagina";
import { Painel } from "@/components/painel";
import { Avatar, Miniatura, Prazo } from "@/components/tarefa";
import { diaDaSemana, diaPorExtenso, diaMes, hojeSP, mesEAno, saudacao, semanasDoMes, somarDias, somarMes } from "@/lib/datas";
import {
  area,
  dataHoraSP,
  diasEntre,
  estaAtrasada,
  FINALIZADAS,
  PARADAS,
  proximaEtapa,
  rotuloEtapa,
  rotuloFormato,
} from "@/lib/dominio/tarefas";
import { ROTULO_PERFIL } from "@/lib/permissoes";
import { exigirTime } from "@/lib/sessao";
import { criarClienteServidor } from "@/lib/supabase/server";
import type { Pessoa, Tarefa } from "@/types/banco";
import { DetalheTarefa, INTERNO } from "../tarefas/detalhe-tarefa";
import { CalendarioSemanas, type ItemCalendario } from "./calendario";

export const metadata = { title: "Início" };

type Busca = { aba?: string; mes?: string; pessoa?: string; tarefa?: string };
type Ctx = {
  hoje: string;
  link: (mudar: Partial<Busca>) => string;
  clienteDe: (id: string | null) => { nome: string; nome_curto: string; cor: string };
  pessoaPor: Map<string, Pessoa>;
};
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
        descricao={aba === "cal" ? "Cada semana do mês, com o que cada pessoa tem em cada dia." : "Resumo da operação da agência hoje."}
      />
      <div role="tablist" className="mb-[18px] inline-flex flex-wrap gap-0.5 rounded-[9px] bg-surface p-[3px]">
        {(
          [
            ["cal", "Semanas do mês", link({ aba: undefined })],
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

// ---------------------------------------------------------------- calendário do mês, por semanas
async function Calendario({ mes, pessoa, time, hoje, link, clienteDe, pessoaPor }: Ctx & { mes: string; pessoa?: string; time: Pessoa[] }) {
  const supabase = await criarClienteServidor();
  const semanas = semanasDoMes(mes);
  const inicio = semanas[0][0];
  const fim = semanas[semanas.length - 1][6];
  const depois = somarDias(fim, 1);
  // Cada tarefa aparece no dia do prazo, ou no dia da publicação se já estiver agendada
  const [{ data: porPrazo }, { data: porPublicacao }, { data: leads }, { data: etapasDoMes }, { data: logos }] = await Promise.all([
    supabase.from("tasks").select("*").gte("prazo", inicio).lte("prazo", fim).returns<Tarefa[]>(),
    supabase
      .from("tasks")
      .select("*")
      .eq("etapa", "agendado")
      .gte("publicar_em", `${inicio}T00:00:00-03:00`)
      .lt("publicar_em", `${depois}T00:00:00-03:00`)
      .returns<Tarefa[]>(),
    supabase
      .from("leads")
      .select("id, empresa, proximo_passo, proximo_passo_em, responsavel_id")
      .not("etapa", "in", "(ganho,perdido)")
      .gte("proximo_passo_em", inicio)
      .lte("proximo_passo_em", fim),
    // Etapas de processo aparecem no dia do prazo delas, para quem é o responsável da etapa
    supabase
      .from("tarefa_etapas")
      .select("id, nome, prazo, responsavel_id, feito_em, tasks!inner(id, titulo, client_id, tipo)")
      .gte("prazo", inicio)
      .lte("prazo", fim)
      .returns<{ id: string; nome: string; prazo: string; responsavel_id: string | null; feito_em: string | null; tasks: { id: string; titulo: string; client_id: string | null; tipo: string } }[]>(),
    supabase.from("clients").select("id, logo"),
  ]);
  const logoDe = new Map((logos ?? []).map((c) => [c.id, c.logo as string | null]));
  const cliente = (id: string | null) => {
    const c = clienteDe(id);
    return { nome: c.nome, cor: c.cor, logo: id ? (logoDe.get(id) ?? null) : null };
  };
  const diaDe = (t: Tarefa) => (t.etapa === "agendado" && t.publicar_em ? dataHoraSP(t.publicar_em).data : t.prazo);
  const tarefas = [...new Map([...(porPrazo ?? []), ...(porPublicacao ?? [])].map((t) => [t.id, t])).values()].filter((t) => {
    const d = diaDe(t);
    return !!d && d >= inicio && d <= fim;
  });

  const itens: ItemCalendario[] = [
    ...tarefas.map((t): ItemCalendario => {
      const feito = FINALIZADAS.includes(t.etapa);
      const proxima = proximaEtapa(t.tipo, t.etapa);
      const marcar: ItemCalendario["marcar"] =
        t.tipo === "demanda"
          ? feito
            ? { tipo: "reabrir", para: "fazendo", rotulo: "Reabrir (volta para Fazendo)" }
            : { tipo: "concluir", para: "concluido", rotulo: "Concluir" }
          : !feito && proxima && t.etapa !== "cliente"
            ? { tipo: "avancar", para: proxima, rotulo: `Avançar para ${rotuloEtapa(proxima)}` }
            : undefined;
      return {
        chave: `t${t.id}`,
        tipo: "tarefa",
        id: t.id,
        dia: diaDe(t)!,
        pessoaId: t.responsavel_id,
        cliente: cliente(t.client_id),
        titulo: t.titulo,
        etapa: t.etapa,
        feito,
        atrasado: estaAtrasada(t, hoje),
        recorrente: !!t.recorrencia_id,
        marcar,
        href: link({ tarefa: t.id }),
      };
    }),
    ...(etapasDoMes ?? []).map(
      (e): ItemCalendario => ({
        chave: `e${e.id}`,
        tipo: "etapa",
        id: e.id,
        dia: e.prazo,
        pessoaId: e.responsavel_id,
        cliente: cliente(e.tasks.client_id),
        titulo: e.nome,
        sub: e.tasks.titulo,
        feito: !!e.feito_em,
        atrasado: !e.feito_em && e.prazo < hoje,
        marcar: { tipo: "etapa", rotulo: e.feito_em ? "Reabrir etapa" : "Concluir etapa" },
        href: link({ tarefa: e.tasks.id }),
      }),
    ),
    ...(leads ?? []).map(
      (l): ItemCalendario => ({
        chave: `l${l.id}`,
        tipo: "crm",
        id: l.id,
        dia: l.proximo_passo_em as string,
        pessoaId: l.responsavel_id,
        cliente: { nome: l.empresa, cor: "#6B7280", logo: null },
        titulo: l.proximo_passo || "Follow-up",
        feito: false,
        atrasado: (l.proximo_passo_em as string) < hoje,
        href: `/crm?lead=${l.id}`,
      }),
    ),
  ].filter((it) => !pessoa || it.pessoaId === pessoa);

  const dias = semanas.map((sem) => sem.map((iso) => ({ iso, ...diaDaSemana(iso), doMes: iso.startsWith(mes), hoje: iso === hoje })));
  const semanaDeHoje = semanas.findIndex((sem) => sem.includes(hoje));
  const pessoas = (pessoa ? time.filter((p) => p.id === pessoa) : time).map((p) => ({
    id: p.id,
    nome: p.nome,
    cargo: p.cargo || ROTULO_PERFIL[p.perfil],
    iniciais: p.iniciais,
    foto: p.foto,
  }));
  const tarefasDoMes = tarefas.filter((t) => diaDe(t)!.startsWith(mes));
  const contagem = (id: string) => tarefasDoMes.filter((t) => t.responsavel_id === id).length;
  const atrasadas = itens.filter((it) => it.atrasado && it.tipo !== "crm").length;
  const botaoPessoa = "inline-flex items-center gap-[7px] rounded-full border px-3 py-1 text-[12.5px]";

  return (
    <>
      <div className="mb-3.5 flex flex-wrap gap-2">
        <Link href={link({ pessoa: undefined })} className={`${botaoPessoa} ${!pessoa ? "border-accent bg-accent-soft font-semibold" : "border-line bg-card hover:border-muted"}`}>
          Todo o time · {tarefasDoMes.length}
        </Link>
        {time.map((p) => (
          <Link
            key={p.id}
            href={link({ pessoa: p.id })}
            className={`${botaoPessoa} !pl-1 ${pessoa === p.id ? "border-accent bg-accent-soft font-semibold" : "border-line bg-card hover:border-muted"}`}
          >
            <Avatar iniciais={p.iniciais} foto={p.foto} classe="h-[22px] w-[22px] text-[9px]" />
            {p.nome.split(" ")[0]} · {contagem(p.id)}
          </Link>
        ))}
      </div>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2.5">
        <div>
          <h2 className="text-[18px] font-bold capitalize">{mesEAno(mes)}</h2>
          <div className="text-[12.5px] text-muted">
            {tarefasDoMes.length} tarefa{tarefasDoMes.length === 1 ? "" : "s"} no mês
            {pessoa && pessoaPor.get(pessoa) ? ` com ${pessoaPor.get(pessoa)!.nome}` : ""}
            {atrasadas > 0 && (
              <span className="font-semibold text-bad">
                {" "}
                · {atrasadas} atrasada{atrasadas > 1 ? "s" : ""}
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-1.5">
          {(
            [
              ["‹", "Mês anterior", somarMes(mes, -1)],
              ["Hoje", "Mês atual", undefined],
              ["›", "Próximo mês", somarMes(mes, 1)],
            ] as const
          ).map(([rotulo, aria, alvo]) => (
            <Link key={aria} href={link({ mes: alvo })} aria-label={aria} className="rounded-lg border border-line bg-card px-2.5 py-[5px] text-[12.5px] font-medium hover:border-ink">
              {rotulo}
            </Link>
          ))}
        </div>
      </div>

      <CalendarioSemanas key={`${mes}-${pessoa ?? ""}`} semanas={dias} itens={itens} pessoas={pessoas} abertaInicial={semanaDeHoje >= 0 ? semanaDeHoje : 0} />
    </>
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
        {(
          [
            [lista.length, "tarefas em aberto", "tarefas", "azul"],
            [atrasadas.length, "atrasadas", "alerta", "vermelho"],
            [esperando.length, "esperando o cliente", "relogio", "ambar"],
            [emAjuste, "em ajuste", "criacao", "violeta"],
          ] as const
        ).map(([n, rotulo, icone, tom]) => (
          <div key={rotulo} className="flex items-center gap-3 rounded-xl border border-line bg-card px-4 py-3.5">
            <IconeQuadrado nome={icone} tom={tom} grande />
            <div>
              <b className={`block font-display text-[28px] font-bold leading-[1.1] tabular-nums ${tom === "vermelho" && n > 0 ? "text-bad" : ""}`}>{n}</b>
              <span className="text-[12.5px] text-muted">{rotulo}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,340px),1fr))] gap-4">
        <Painel icone="alerta" tom="vermelho" titulo="Precisa de atenção hoje" semPadding extra={<Link href="/tarefas" className="text-[12.5px] text-muted hover:text-ink">Abrir tarefas</Link>}>
          {[...atrasadas, ...venceHoje].map((t) => linha(t, <Prazo prazo={t.prazo} etapa={t.etapa} hoje={hoje} />))}
          {atrasadas.length + venceHoje.length === 0 && vazio("Nada atrasado nem vencendo hoje.")}
        </Painel>

        <Painel icone="relogio" tom="ambar" titulo="Esperando o cliente" semPadding>
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
          <Painel icone="lista" tom="violeta" titulo="Etapas de processo para hoje" semPadding>
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
          <Painel icone="funil" tom="azul" titulo="Follow-ups do CRM" semPadding extra={<Link href="/crm" className="text-[12.5px] text-muted hover:text-ink">Abrir CRM</Link>}>
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

        <Painel icone="calendario" tom="verde" titulo="Próximas publicações" semPadding>
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
