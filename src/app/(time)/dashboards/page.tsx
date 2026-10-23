import Link from "next/link";
import { CabecalhoPagina } from "@/components/cabecalho-pagina";
import { BarrasHorizontais, Numero } from "@/components/graficos";
import { Painel } from "@/components/painel";
import { hojeSP, mesEAno, somarMes } from "@/lib/datas";
import { AREAS, dataHoraSP, estaAtrasada, ETAPAS_CONTEUDO, FINALIZADAS } from "@/lib/dominio/tarefas";
import { exigirTime } from "@/lib/sessao";
import { criarClienteServidor } from "@/lib/supabase/server";
import type { Evento, Pessoa, Tarefa } from "@/types/banco";

export const metadata = { title: "Dashboards" };

// Indicadores calculados em tempo real a partir das tarefas e do histórico de etapas
export default async function Dashboards({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  await exigirTime();
  const hoje = hojeSP();
  const atual = hoje.slice(0, 7);
  const pedido = (await searchParams).mes;
  const mes = /^\d{4}-\d{2}$/.test(pedido ?? "") && pedido! <= atual ? pedido! : atual;
  const inicio = `${mes}-01`;
  const proximo = `${somarMes(mes, 1)}-01`;
  const inicioTs = `${inicio}T00:00:00-03:00`;
  const proximoTs = `${proximo}T00:00:00-03:00`;
  const supabase = await criarClienteServidor();

  const [{ data: tarefasBrutas }, { data: eventosBrutos }, { data: clientes }, { data: time }] = await Promise.all([
    supabase.from("tasks").select("*").returns<Tarefa[]>(),
    supabase
      .from("task_events")
      .select("*")
      .in("para_etapa", ["cliente", "aprovado", "ajuste"])
      .lt("created_at", proximoTs)
      .returns<Evento[]>(),
    supabase.from("clients").select("id, nome, cor").eq("ativo", true).order("nome"),
    supabase.from("profiles").select("*").neq("perfil", "cliente").eq("ativo", true).order("nome").returns<Pessoa[]>(),
  ]);
  const tarefas = tarefasBrutas ?? [];
  const eventos = eventosBrutos ?? [];
  const tarefaPor = new Map(tarefas.map((t) => [t.id, t]));
  const noMes = (iso: string) => iso >= inicioTs && iso < proximoTs;
  const dia = (t: Tarefa) => (t.etapa === "agendado" && t.publicar_em ? dataHoraSP(t.publicar_em).data : t.prazo);

  const conteudos = tarefas.filter((t) => t.tipo === "conteudo");
  const doMes = conteudos.filter((t) => (dia(t) ?? "").startsWith(mes));
  const atrasadas = tarefas.filter((t) => estaAtrasada(t, hoje));

  // Pedidos de ajuste do cliente (o mesmo critério do contador do contrato)
  const ajustesCliente = eventos.filter((e) => e.origem === "cliente" && e.para_etapa === "ajuste");
  const ajustesNoMes = ajustesCliente.filter((e) => noMes(e.created_at));
  const comAjuste = new Set(ajustesCliente.map((e) => e.task_id));

  // Aprovados de primeira: aprovados no mês sem nenhum pedido de ajuste do cliente
  const aprovadosNoMes = [...new Set(eventos.filter((e) => e.para_etapa === "aprovado" && noMes(e.created_at)).map((e) => e.task_id))];
  const dePrimeira = aprovadosNoMes.filter((id) => !comAjuste.has(id)).length;
  const pctPrimeira = aprovadosNoMes.length ? Math.round((dePrimeira / aprovadosNoMes.length) * 100) : null;

  // Tempo de aprovação: do último envio ao cliente até a aprovação dele, por cliente
  const dias: Record<string, number[]> = {};
  for (const e of eventos.filter((x) => x.para_etapa === "aprovado" && x.origem === "cliente" && noMes(x.created_at))) {
    const envio = eventos
      .filter((x) => x.task_id === e.task_id && x.para_etapa === "cliente" && x.created_at < e.created_at)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
    const cid = tarefaPor.get(e.task_id)?.client_id;
    if (envio && cid) (dias[cid] ??= []).push((Date.parse(e.created_at) - Date.parse(envio.created_at)) / 86_400_000);
  }

  const abertas = tarefas.filter((t) => !FINALIZADAS.includes(t.etapa));
  const nomeCliente = new Map((clientes ?? []).map((c) => [c.id, c]));

  const porEtapa = ETAPAS_CONTEUDO.map((e) => ({ rotulo: e.rotulo, valor: conteudos.filter((t) => t.etapa === e.id).length }));
  const ajustesPorCliente = (clientes ?? [])
    .map((c) => ({ rotulo: c.nome, cor: c.cor, valor: ajustesNoMes.filter((e) => tarefaPor.get(e.task_id)?.client_id === c.id).length }))
    .filter((x) => x.valor > 0)
    .sort((a, b) => b.valor - a.valor);
  const porArea = AREAS.map((a) => ({ rotulo: a.rotulo, valor: abertas.filter((t) => t.tipo === "demanda" && t.area === a.id).length }))
    .filter((x) => x.valor > 0)
    .sort((a, b) => b.valor - a.valor);
  const porPessoa = (time ?? [])
    .map((p) => ({ rotulo: p.nome, valor: abertas.filter((t) => t.responsavel_id === p.id).length }))
    .sort((a, b) => b.valor - a.valor);
  const tempoAprovacao = Object.entries(dias)
    .map(([cid, lista]) => {
      const media = lista.reduce((a, d) => a + d, 0) / lista.length;
      return { rotulo: nomeCliente.get(cid)?.nome ?? "Cliente", cor: nomeCliente.get(cid)?.cor, valor: Math.round(media * 10) / 10, detalhe: "dias" };
    })
    .sort((a, b) => b.valor - a.valor);
  const horasPorCliente = (clientes ?? [])
    .map((c) => ({
      rotulo: c.nome,
      cor: c.cor,
      valor: Math.round(tarefas.filter((t) => t.client_id === c.id && (dia(t) ?? "").startsWith(mes)).reduce((a, t) => a + Number(t.horas ?? 0), 0) * 10) / 10,
      detalhe: "h",
    }))
    .filter((x) => x.valor > 0)
    .sort((a, b) => b.valor - a.valor);

  const linkMes = (m: string) => (m === atual ? "/dashboards" : `/dashboards?mes=${m}`);
  const botao = "rounded-lg border border-line bg-card px-2.5 py-[5px] text-[12.5px] font-medium hover:border-ink";

  return (
    <>
      <CabecalhoPagina
        sobretitulo="Operação"
        titulo="Dashboards"
        descricao="Indicadores calculados em tempo real a partir das tarefas e das aprovações."
        acoes={
          <div className="flex items-center gap-1.5">
            <Link href={linkMes(somarMes(mes, -1))} aria-label="Mês anterior" className={botao}>
              ‹
            </Link>
            <span className="min-w-[120px] text-center text-[13px] font-semibold capitalize">{mesEAno(mes)}</span>
            {mes < atual ? (
              <Link href={linkMes(somarMes(mes, 1))} aria-label="Próximo mês" className={botao}>
                ›
              </Link>
            ) : (
              <span className={`${botao} invisible`}>›</span>
            )}
          </div>
        }
      />

      <div className="mb-[18px] grid grid-cols-[repeat(auto-fit,minmax(min(100%,170px),1fr))] gap-3">
        <Numero destaque valor={String(doMes.length)} rotulo={`conteúdos em ${mesEAno(mes).split(" ")[0]}`} />
        <Numero
          valor={pctPrimeira === null ? "·" : `${pctPrimeira}%`}
          rotulo={pctPrimeira === null ? "aprovados de primeira (sem aprovações no mês)" : `aprovados de primeira · ${dePrimeira} de ${aprovadosNoMes.length}`}
        />
        <Numero valor={String(atrasadas.length)} rotulo="em atraso agora" alerta={atrasadas.length > 0} />
        <Numero valor={String(ajustesNoMes.length)} rotulo="ajustes pedidos por clientes" />
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,340px),1fr))] gap-4">
        <Painel icone="tarefas" tom="azul" titulo="Funil de produção" extra={<span className="text-[12px] text-muted">conteúdos por etapa, agora</span>}>
          <BarrasHorizontais itens={porEtapa} />
        </Painel>
        <Painel icone="alerta" tom="vermelho" titulo="Ajustes por cliente" extra={<span className="text-[12px] text-muted">pedidos pelo portal no mês</span>}>
          <BarrasHorizontais itens={ajustesPorCliente} vazio="Nenhum pedido de ajuste no mês." />
        </Painel>
        <Painel icone="relogio" tom="ambar" titulo="Tempo de aprovação" extra={<span className="text-[12px] text-muted">média por cliente</span>}>
          <BarrasHorizontais itens={tempoAprovacao} vazio="Nenhuma aprovação pelo portal no mês." />
        </Painel>
        <Painel icone="pessoas" tom="violeta" titulo="Carga por pessoa" extra={<span className="text-[12px] text-muted">tarefas abertas, agora</span>}>
          <BarrasHorizontais itens={porPessoa} />
        </Painel>
        <Painel icone="lista" tom="azul" titulo="Demandas da agência por área" extra={<span className="text-[12px] text-muted">em aberto, agora</span>}>
          <BarrasHorizontais itens={porArea} vazio="Nenhuma demanda em aberto." />
        </Painel>
        <Painel icone="relogio" tom="cinza" titulo="Horas registradas por cliente" extra={<span className="text-[12px] text-muted">tarefas do mês</span>}>
          <BarrasHorizontais itens={horasPorCliente} vazio="Nenhuma hora registrada no mês." />
        </Painel>
        <Painel icone="clientes" tom="azul" titulo="Por cliente" semPadding extra={<span className="text-[12px] text-muted">conteúdos do mês</span>}>
          {(clientes ?? []).map((c) => {
            const lista = doMes.filter((t) => t.client_id === c.id);
            if (lista.length === 0) return null;
            const prontos = lista.filter((t) => t.etapa === "aprovado" || t.etapa === "agendado").length;
            const atraso = lista.some((t) => estaAtrasada(t, hoje));
            return (
              <div key={c.id} className="flex items-center gap-3 border-t border-line px-4 py-[11px] first:border-t-0">
                <span className="h-2 w-2 flex-none rounded-full" style={{ background: c.cor }} />
                <span className="min-w-0 flex-1 truncate font-medium">{c.nome}</span>
                <span className="font-mono text-[12px] text-muted">
                  {prontos}/{lista.length} prontos
                </span>
                {atraso && <span className="rounded-full bg-bad-soft px-[9px] py-px text-[11.5px] font-medium text-bad">⚠ atraso</span>}
              </div>
            );
          })}
          {doMes.length === 0 && <p className="px-4 py-[18px] text-[13px] text-muted">Nenhum conteúdo no mês.</p>}
        </Painel>
      </div>
    </>
  );
}
