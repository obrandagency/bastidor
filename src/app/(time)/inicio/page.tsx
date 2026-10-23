import Link from "next/link";
import { diaDaSemana, diaPorExtenso, diaMes, hojeSP, mesEAno, semanasDoMes, somarDias, somarMes } from "@/lib/datas";
import { lerIdentidade } from "@/lib/identidade";
import { urlMarca } from "@/lib/marca";
import { pensamentoDoDia } from "@/lib/pensamentos";
import {
  dataHoraSP,
  estaAtrasada,
  ETAPAS_CONTEUDO,
  ETAPAS_DEMANDA,
  FINALIZADAS,
  PARADAS,
  proximaEtapa,
  rotuloEtapa,
} from "@/lib/dominio/tarefas";
import { ROTULO_PERFIL } from "@/lib/permissoes";
import { exigirTime } from "@/lib/sessao";
import { criarClienteServidor } from "@/lib/supabase/server";
import type { Pessoa, Tarefa } from "@/types/banco";
import { DetalheTarefa, INTERNO } from "../tarefas/detalhe-tarefa";
import { CabecalhoDia } from "./cabecalho-dia";
import { CalendarioSemanas, type ItemCalendario } from "./calendario";
import { CentralAvisos, ConteudosProducao, TarefasAtrasadas, TarefasPendentes, type AvisoResumo, type ConversaResumo, type TarefaResumo } from "./resumo";

export const metadata = { title: "Início" };

type Busca = { aba?: string; mes?: string; tarefa?: string };
type Ctx = {
  hoje: string;
  link: (mudar: Partial<Busca>) => string;
  clienteDe: (id: string | null) => { nome: string; nome_curto: string; cor: string };
  pessoaPor: Map<string, Pessoa>;
};
type Cliente = { id: string; nome: string; nome_curto: string; cor: string; logo: string | null };

export default async function Inicio({ searchParams }: { searchParams: Promise<Busca> }) {
  const eu = await exigirTime();
  const busca = await searchParams;
  const hoje = hojeSP();
  // Resumo do dia é a aba padrão; "mensal" abre as semanas do mês
  const aba = busca.aba === "mensal" ? "mensal" : "resumo";
  const mes = /^\d{4}-\d{2}$/.test(busca.mes ?? "") ? busca.mes! : hoje.slice(0, 7);
  const supabase = await criarClienteServidor();

  const link = (mudar: Partial<Busca>) => {
    const p = new URLSearchParams();
    const final = { aba: aba === "mensal" ? "mensal" : undefined, mes: busca.mes, ...mudar };
    Object.entries(final).forEach(([k, v]) => v && p.set(k, v));
    const q = p.toString();
    return q ? `/inicio?${q}` : "/inicio";
  };

  const [{ data: clientes }, { data: time }, identidade] = await Promise.all([
    supabase.from("clients").select("id, nome, nome_curto, cor, logo").returns<Cliente[]>(),
    supabase.from("profiles").select("*").neq("perfil", "cliente").eq("ativo", true).order("nome").returns<Pessoa[]>(),
    lerIdentidade(),
  ]);
  const clientePor = new Map((clientes ?? []).map((c) => [c.id, c]));
  const pessoaPor = new Map((time ?? []).map((p) => [p.id, p]));
  const clienteDe = (id: string | null) => (id ? clientePor.get(id) : null) ?? INTERNO;
  const ctx = { hoje, link, clienteDe, pessoaPor };
  const { diaSemana } = diaDaSemana(hoje);

  return (
    <>
      <CabecalhoDia
        nome={eu.nome.split(" ")[0]}
        diaSemana={diaSemana}
        data={`${diaPorExtenso(hoje).split(", ")[1]} de ${hoje.slice(0, 4)}`}
        pensamento={pensamentoDoDia(hoje)}
        logo={urlMarca(identidade.logo)}
        agencia={identidade.nome_agencia}
      />
      <div role="tablist" className="mb-[18px] inline-flex flex-wrap gap-0.5 rounded-[9px] bg-surface p-[3px]">
        {(
          [
            ["resumo", "Resumo do dia", link({ aba: undefined })],
            ["mensal", "Mensal", link({ aba: "mensal" })],
          ] as const
        ).map(([id, rotulo, href]) => (
          <Link
            key={id}
            role="tab"
            aria-selected={aba === id}
            href={href}
            className={`rounded-[7px] px-3.5 py-[6px] text-[13px] font-medium ${
              aba === id ? "bg-card text-ink shadow-[0_1px_3px_rgba(0,0,0,.08)]" : "text-muted hover:text-ink"
            }`}
          >
            {rotulo}
          </Link>
        ))}
      </div>

      {aba === "mensal" ? <Calendario mes={mes} time={time ?? []} {...ctx} /> : <Resumo eu={eu.id} {...ctx} />}

      {busca.tarefa && (
        <DetalheTarefa id={busca.tarefa} fechar={link({ tarefa: undefined })} podeExcluir={eu.perfil === "socio" || eu.perfil === "adm"} />
      )}
    </>
  );
}

// ---------------------------------------------------------------- calendário do mês, por semanas
async function Calendario({ mes, time, hoje, link, clienteDe }: Ctx & { mes: string; time: Pessoa[] }) {
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
        categoria: t.tipo,
        clienteId: t.client_id,
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
        categoria: "etapa",
        clienteId: e.tasks.client_id,
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
        categoria: "crm",
        clienteId: null,
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
  ];

  const dias = semanas.map((sem) => sem.map((iso) => ({ iso, ...diaDaSemana(iso), doMes: iso.startsWith(mes), hoje: iso === hoje })));
  const semanaDeHoje = semanas.findIndex((sem) => sem.includes(hoje));
  const pessoas = time.map((p) => ({
    id: p.id,
    nome: p.nome,
    cargo: p.cargo || ROTULO_PERFIL[p.perfil],
    iniciais: p.iniciais,
    foto: p.foto,
  }));
  // Clientes que aparecem no mês (para o filtro da barra)
  const clientesDoMes = [...new Map(itens.filter((it) => it.clienteId).map((it) => [it.clienteId!, it.cliente.nome])).entries()]
    .map(([id, nome]) => ({ id, nome }))
    .sort((a, b) => a.nome.localeCompare(b.nome));

  return (
    <CalendarioSemanas
      key={mes}
      mes={mesEAno(mes)}
      navegacao={{ anterior: link({ mes: somarMes(mes, -1) }), atual: link({ mes: undefined }), proximo: link({ mes: somarMes(mes, 1) }) }}
      semanas={dias}
      itens={itens}
      pessoas={pessoas}
      clientes={clientesDoMes}
      abertaInicial={semanaDeHoje >= 0 ? semanaDeHoje : 0}
    />
  );
}

// ---------------------------------------------------------------- resumo do dia
async function Resumo({ eu, hoje, link, clienteDe, pessoaPor }: Ctx & { eu: string }) {
  const supabase = await criarClienteServidor();
  const [{ data: abertas }, { data: avisos }, { data: naoLidas }, { data: canais }, { data: logos }] = await Promise.all([
    supabase.from("tasks").select("*").not("etapa", "in", `(${FINALIZADAS.join(",")})`).order("prazo").returns<Tarefa[]>(),
    // Central de avisos: avisos não lidos (só os da própria pessoa, pela RLS) e mensagens novas do chat
    supabase.from("notifications").select("id, texto, link, created_at").is("lida_em", null).order("created_at", { ascending: false }).limit(30),
    supabase.rpc("chat_nao_lidas"),
    supabase.from("chat_canais").select("id, nome"),
    supabase.from("clients").select("id, logo"),
  ]);
  const lista = abertas ?? [];
  const logoDe = new Map((logos ?? []).map((c) => [c.id, c.logo as string | null]));
  const nomeCanal = new Map((canais ?? []).map((c) => [c.id, c.nome as string]));
  const resumo = (t: Tarefa): TarefaResumo => {
    const c = clienteDe(t.client_id);
    const r = t.responsavel_id ? pessoaPor.get(t.responsavel_id) : null;
    return {
      id: t.id,
      titulo: t.titulo,
      cliente: { nome: c.nome, cor: c.cor, logo: t.client_id ? (logoDe.get(t.client_id) ?? null) : null },
      etapa: t.etapa,
      prazo: t.prazo ? diaMes(t.prazo) : null,
      atrasada: estaAtrasada(t, hoje),
      minha: t.responsavel_id === eu,
      resp: r ? { nome: r.nome, iniciais: r.iniciais, foto: r.foto } : null,
      href: link({ tarefa: t.id }),
    };
  };
  const minhasUrgentes = lista
    .filter((t) => t.responsavel_id === eu && !PARADAS.includes(t.etapa) && !!t.prazo && t.prazo <= hoje)
    .map(resumo);
  const avisosResumo: AvisoResumo[] = (avisos ?? []).map((a) => {
    const { data, hora } = dataHoraSP(a.created_at);
    return { id: a.id, texto: a.texto, link: a.link, quando: data === hoje ? hora : `${diaMes(data)} ${hora}` };
  });
  const conversas: ConversaResumo[] = ((naoLidas ?? []) as { canal_id: string; total: number }[])
    .filter((n) => Number(n.total) > 0 && nomeCanal.has(n.canal_id))
    .map((n) => ({ canalId: n.canal_id, canal: nomeCanal.get(n.canal_id)!, novas: Number(n.total) }));

  // Ordem pedida em 07/11: atrasadas, pendentes, avisos, conteúdos em produção
  return (
    <div className="flex flex-col gap-4">
      <TarefasAtrasadas tarefas={lista.filter((t) => estaAtrasada(t, hoje)).map(resumo)} />
      <TarefasPendentes tarefas={lista.filter((t) => t.tipo === "demanda").map(resumo)} etapas={ETAPAS_DEMANDA.filter((e) => e.id !== "concluido")} />
      <CentralAvisos avisos={avisosResumo} conversas={conversas} tarefas={minhasUrgentes} />
      <ConteudosProducao conteudos={lista.filter((t) => t.tipo === "conteudo").map(resumo)} etapas={ETAPAS_CONTEUDO.filter((e) => !FINALIZADAS.includes(e.id))} />
    </div>
  );
}
