import Link from "next/link";
import { notFound } from "next/navigation";
import { CabecalhoPagina } from "@/components/cabecalho-pagina";
import { Avatar, PontoCliente, SeloEtapa } from "@/components/tarefa";
import { dataBR, hojeSP } from "@/lib/datas";
import {
  area,
  dataHoraSP,
  ETAPAS_CONTEUDO,
  ETAPAS_DEMANDA,
  FINALIZADAS,
  rotuloEtapa,
  rotuloFormato,
  type TipoTarefa,
} from "@/lib/dominio/tarefas";
import { exigirTime } from "@/lib/sessao";
import { criarClienteServidor } from "@/lib/supabase/server";
import type { Evento, Nota, Pessoa, Tarefa } from "@/types/banco";
import { Agendamento, Comentarios, Excluir, FormNovaTarefa, FormTarefa, Gaveta } from "./detalhe";
import { Filtros } from "./filtros";
import { Quadro, type Card } from "./quadro";

export const metadata = { title: "Tarefas · Bastidor" };

type Busca = { aba?: string; cliente?: string; resp?: string; tarefa?: string; nova?: string };

const INTERNO = { nome: "O.BRAND (interno)", cor: "#0A0C12", nome_curto: "INTERNO" };

export default async function Tarefas({ searchParams }: { searchParams: Promise<Busca> }) {
  const eu = await exigirTime();
  const busca = await searchParams;
  const tipo: TipoTarefa = busca.aba === "demanda" ? "demanda" : "conteudo";
  const hoje = hojeSP();
  const supabase = await criarClienteServidor();

  // Endereço desta tela com os filtros atuais, mudando só o que for pedido
  const link = (mudar: Partial<Busca>) => {
    const p = new URLSearchParams();
    const final = { aba: tipo, cliente: busca.cliente, resp: busca.resp, ...mudar };
    Object.entries(final).forEach(([k, v]) => v && p.set(k, v));
    return `/tarefas?${p}`;
  };

  let consulta = supabase.from("tasks").select("*").eq("tipo", tipo).order("prazo", { ascending: true, nullsFirst: false });
  if (busca.cliente === "interno") consulta = consulta.is("client_id", null);
  else if (busca.cliente) consulta = consulta.eq("client_id", busca.cliente);
  if (busca.resp) consulta = consulta.eq("responsavel_id", busca.resp);

  const [{ data: tarefas }, { data: clientes }, { data: time }, { data: ajustes }, abertas] = await Promise.all([
    consulta.returns<Tarefa[]>(),
    supabase.from("clients").select("id, nome, nome_curto, cor, ativo").order("nome"),
    supabase.from("profiles").select("*").neq("perfil", "cliente").eq("ativo", true).order("nome").returns<Pessoa[]>(),
    supabase.from("task_events").select("task_id").eq("origem", "cliente").eq("para_etapa", "ajuste"),
    Promise.all(
      (["conteudo", "demanda"] as const).map((t) =>
        supabase.from("tasks").select("id", { count: "exact", head: true }).eq("tipo", t).not("etapa", "in", `(${FINALIZADAS.join(",")})`),
      ),
    ),
  ]);

  const clientePor = new Map((clientes ?? []).map((c) => [c.id, c]));
  const pessoaPor = new Map((time ?? []).map((p) => [p.id, p]));
  const ajustesPor = new Map<string, number>();
  (ajustes ?? []).forEach((e) => ajustesPor.set(e.task_id, (ajustesPor.get(e.task_id) ?? 0) + 1));
  const clienteDe = (id: string | null) => (id ? clientePor.get(id) : null) ?? INTERNO;

  const cards: Card[] = (tarefas ?? []).map((t) => {
    const r = t.responsavel_id ? pessoaPor.get(t.responsavel_id) : null;
    return {
      id: t.id,
      titulo: t.titulo,
      etapa: t.etapa,
      prazo: t.prazo,
      clienteNome: clienteDe(t.client_id).nome,
      clienteCor: clienteDe(t.client_id).cor,
      detalhe: tipo === "conteudo" ? rotuloFormato(t.formato) : (area(t.area)?.rotulo ?? ""),
      resp: r ? { iniciais: r.iniciais, nome: r.nome } : null,
      ajustesCliente: ajustesPor.get(t.id) ?? 0,
      href: link({ tarefa: t.id }),
    };
  });

  const opcoesClientes = (clientes ?? []).filter((c) => c.ativo).map((c) => ({ id: c.id, nome: c.nome }));
  const opcoesTime = (time ?? []).map((p) => ({ id: p.id, nome: p.nome }));
  const [nConteudo, nDemanda] = abertas.map((r) => r.count ?? 0);

  return (
    <>
      <CabecalhoPagina
        sobretitulo="Operação"
        titulo="Tarefas"
        descricao={
          tipo === "demanda"
            ? "Tudo o que a agência precisa fazer além do conteúdo: tráfego, comercial, financeiro, branding, atendimento."
            : "Arraste os cards entre as etapas ou use a seta para avançar. Cada etapa passa o conteúdo para o responsável certo."
        }
        acoes={
          <Link href={link({ nova: "1" })} scroll={false} className="rounded-lg border border-accent bg-accent px-3.5 py-2 font-medium text-accent-ink hover:brightness-110">
            {tipo === "demanda" ? "+ Nova demanda" : "+ Nova pauta"}
          </Link>
        }
      />

      <div role="tablist" className="mb-4 inline-flex flex-wrap gap-0.5 rounded-[9px] bg-surface p-[3px]">
        {(
          [
            ["conteudo", `Conteúdos · ${nConteudo}`],
            ["demanda", `Demandas da agência · ${nDemanda}`],
          ] as const
        ).map(([aba, rotulo]) => (
          <Link
            key={aba}
            role="tab"
            aria-selected={tipo === aba}
            href={`/tarefas?aba=${aba}`}
            className={`rounded-[7px] px-3 py-[5px] text-[12.5px] font-medium ${
              tipo === aba ? "bg-card text-ink shadow-[0_1px_3px_rgba(0,0,0,.08)]" : "text-muted hover:text-ink"
            }`}
          >
            {rotulo}
          </Link>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap items-end gap-2.5">
        <Filtros clientes={opcoesClientes} time={opcoesTime} comInterno={tipo === "demanda"} />
        <span className="ml-auto self-center rounded-full border border-dashed border-line px-2.5 py-0.5 text-[11.5px] text-muted">
          {cards.length} {tipo === "demanda" ? "demandas" : "conteúdos"}
        </span>
      </div>

      <Quadro
        key={`${tipo}-${busca.cliente ?? ""}-${busca.resp ?? ""}`}
        tipo={tipo}
        colunas={tipo === "conteudo" ? ETAPAS_CONTEUDO : ETAPAS_DEMANDA}
        cards={cards}
        hoje={hoje}
      />

      {busca.nova && (
        <Gaveta fechar={link({})} rotulo={tipo === "demanda" ? "Nova demanda" : "Nova pauta"}>
          <div className="flex justify-end">
            <Link href={link({})} scroll={false} aria-label="Fechar" className="rounded-lg px-3 py-1.5 hover:bg-surface">
              ✕
            </Link>
          </div>
          <FormNovaTarefa
            tipo={tipo}
            time={opcoesTime}
            clientes={opcoesClientes}
            eu={eu.id}
            clienteFiltro={busca.cliente && busca.cliente !== "interno" ? busca.cliente : undefined}
          />
        </Gaveta>
      )}

      {busca.tarefa && (
        <Detalhe
          id={busca.tarefa}
          fechar={link({})}
          podeExcluir={eu.perfil === "socio" || eu.perfil === "adm"}
          clienteDe={clienteDe}
          opcoesTime={opcoesTime}
          opcoesClientes={opcoesClientes}
          ajustes={ajustesPor.get(busca.tarefa) ?? 0}
        />
      )}
    </>
  );
}

async function Detalhe({
  id,
  fechar,
  podeExcluir,
  clienteDe,
  opcoesTime,
  opcoesClientes,
  ajustes,
}: {
  id: string;
  fechar: string;
  podeExcluir: boolean;
  clienteDe: (id: string | null) => { nome: string; cor: string };
  opcoesTime: { id: string; nome: string }[];
  opcoesClientes: { id: string; nome: string }[];
  ajustes: number;
}) {
  const supabase = await criarClienteServidor();
  const [{ data: t }, { data: notas }, { data: eventos }, { data: pessoas }] = await Promise.all([
    supabase.from("tasks").select("*").eq("id", id).maybeSingle<Tarefa>(),
    supabase.from("task_notes").select("*").eq("task_id", id).order("created_at").returns<Nota[]>(),
    supabase.from("task_events").select("*").eq("task_id", id).order("created_at", { ascending: false }).returns<Evento[]>(),
    supabase.from("profiles").select("id, nome, iniciais"),
  ]);
  if (!t) notFound();
  const c = clienteDe(t.client_id);
  const autores = Object.fromEntries((pessoas ?? []).map((p) => [p.id, p.nome]));
  const resp = (pessoas ?? []).find((p) => p.id === t.responsavel_id);
  // Cliente inativo continua aparecendo na tarefa antiga
  const clientes = t.client_id && !opcoesClientes.some((o) => o.id === t.client_id) ? [{ id: t.client_id, nome: c.nome }, ...opcoesClientes] : opcoesClientes;
  const agenda = dataHoraSP(t.publicar_em);

  return (
    <Gaveta fechar={fechar} rotulo={t.tipo === "demanda" ? "Demanda" : "Conteúdo"}>
      <div className="flex flex-wrap items-center gap-2">
        <PontoCliente cor={c.cor} />
        <SeloEtapa etapa={t.etapa} />
        {t.tipo === "demanda" && <span className="text-[11px] font-semibold tracking-[0.03em] text-accent">{area(t.area)?.rotulo}</span>}
        <span className="text-[12.5px] text-muted">{c.nome}</span>
        {ajustes > 0 && (
          <span className="text-[12.5px] font-semibold text-bad">
            ↺ {ajustes} ajuste{ajustes > 1 ? "s" : ""} do cliente
          </span>
        )}
        {resp && (
          <span className="ml-auto flex items-center gap-1.5 text-[12.5px] text-muted">
            <Avatar iniciais={resp.iniciais} nome={resp.nome} />
            {resp.nome}
          </span>
        )}
        <Link href={fechar} scroll={false} aria-label="Fechar" className={`${resp ? "" : "ml-auto"} rounded-lg px-3 py-1.5 hover:bg-surface`}>
          ✕
        </Link>
      </div>

      {t.tipo === "conteudo" && (t.etapa === "aprovado" || t.etapa === "agendado") && (
        <Agendamento key={t.updated_at} tarefa={t} data={agenda.data} hora={agenda.hora} />
      )}

      <FormTarefa key={t.updated_at} tarefa={t} time={opcoesTime} clientes={clientes} />

      <Comentarios taskId={t.id} notas={notas ?? []} autores={autores} />

      <div>
        <div className="mb-2 text-[11.5px] uppercase tracking-[0.04em] text-muted">Histórico</div>
        <ol className="flex flex-col gap-1.5 text-[12.5px]">
          {(eventos ?? []).map((e) => {
            const { data, hora } = dataHoraSP(e.created_at);
            return (
              <li key={e.id} className="flex gap-2">
                <span className="w-[86px] flex-none font-mono text-muted">
                  {dataBR(data).slice(0, 5)} {hora}
                </span>
                <span>
                  {e.de_etapa ? `${rotuloEtapa(e.de_etapa)} → ${rotuloEtapa(e.para_etapa)}` : `Criada em ${rotuloEtapa(e.para_etapa)}`}
                  <span className="text-muted">
                    {" · "}
                    {e.ator_nome ?? "sistema"}
                    {e.origem === "cliente" ? " (cliente)" : ""}
                  </span>
                </span>
              </li>
            );
          })}
        </ol>
      </div>

      {podeExcluir && (
        <div className="mt-auto flex border-t border-line pt-3">
          <Excluir tarefa={t} />
        </div>
      )}
    </Gaveta>
  );
}
