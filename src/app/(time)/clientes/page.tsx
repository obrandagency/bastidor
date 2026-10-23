import { LogoCliente } from "@/components/tarefa";
import Link from "next/link";
import { CabecalhoPagina, EstadoVazio } from "@/components/cabecalho-pagina";
import { dataBR, hojeSP } from "@/lib/datas";
import { reais } from "@/lib/dominio/crm";
import { FINALIZADAS } from "@/lib/dominio/tarefas";
import { lerIdentidade } from "@/lib/identidade";
import { Icone } from "@/components/icone";
import { exigirTime } from "@/lib/sessao";
import { criarClienteServidor } from "@/lib/supabase/server";
import type { ClienteCompleto, Contrato } from "@/types/banco";

export const metadata = { title: "Central do cliente" };

export default async function Clientes({ searchParams }: { searchParams: Promise<{ inativos?: string }> }) {
  const eu = await exigirTime();
  const gestao = eu.perfil === "socio" || eu.perfil === "adm";
  const verInativos = (await searchParams).inativos === "1";
  const supabase = await criarClienteServidor();
  const hoje = hojeSP();

  const [{ data: clientes }, { data: contratos }, { data: abertas }, identidade] = await Promise.all([
    supabase.from("clients").select("*").eq("ativo", !verInativos).order("nome").returns<ClienteCompleto[]>(),
    // Criação recebe lista vazia (RLS de contracts)
    supabase.from("contracts").select("*").lte("inicio", hoje).returns<Contrato[]>(),
    supabase.from("tasks").select("client_id, tipo").not("etapa", "in", `(${FINALIZADAS.join(",")})`),
    lerIdentidade(),
  ]);
  // Demandas em aberto e conteúdos em produção por cliente; as sem cliente vão para o cartão "Interna"
  const contagem = new Map<string, { tarefas: number; conteudos: number }>();
  let internas = 0;
  for (const t of abertas ?? []) {
    if (!t.client_id) {
      internas++;
      continue;
    }
    const n = contagem.get(t.client_id) ?? { tarefas: 0, conteudos: 0 };
    if (t.tipo === "demanda") n.tarefas++;
    else n.conteudos++;
    contagem.set(t.client_id, n);
  }
  const vigente = (id: string) =>
    (contratos ?? []).find((k) => k.client_id === id && k.inicio <= hoje && (!k.fim || k.fim >= hoje));
  // Receita recorrente: soma dos contratos vigentes hoje dos clientes ativos
  const recorrente = verInativos ? 0 : (clientes ?? []).reduce((a, c) => a + Number(vigente(c.id)?.valor_mensal ?? 0), 0);

  return (
    <>
      <CabecalhoPagina
        sobretitulo="Clientes"
        titulo="Central do cliente"
        descricao="Tudo o que alguém precisa saber para pegar a conta sem perguntar nada."
        acoes={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={verInativos ? "/clientes" : "/clientes?inativos=1"}
              className="rounded-lg px-3 py-2 text-[13px] text-muted hover:bg-surface hover:text-ink"
            >
              {verInativos ? "Ver ativos" : "Ver inativos"}
            </Link>
            {gestao && (
              <Link href="/clientes/novo" className="rounded-lg border border-accent bg-accent px-3.5 py-2 font-medium text-accent-ink hover:border-accent-hover hover:bg-accent-hover">
                Novo cliente
              </Link>
            )}
          </div>
        }
      />
      {gestao && recorrente > 0 && (
        <div className="mb-4 inline-flex flex-col rounded-xl border border-rail bg-rail px-4 py-3 text-rail-ink">
          <b className="font-display text-[24px] font-bold leading-[1.1] tabular-nums">{reais(recorrente)}</b>
          <span className="text-[12.5px] opacity-75">por mês em contratos vigentes</span>
        </div>
      )}
      {!verInativos && (
        <Link
          href="/tarefas?cliente=interno"
          className="mb-4 flex items-center gap-4 rounded-xl border border-rail bg-rail px-5 py-4 text-rail-ink transition-colors hover:border-accent"
        >
          <span className="grid h-12 w-12 flex-none place-items-center rounded-xl bg-white/10 text-accent">
            <Icone nome="predio" className="!h-6 !w-6" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-2">
              <b className="font-display text-[17px] font-bold">{identidade.nome_agencia}</b>
              <span className="rounded-full bg-accent px-2 py-px text-[10.5px] font-semibold uppercase tracking-[0.06em] text-accent-ink">Interna</span>
            </span>
            <span className="block text-[13px] text-rail-muted">
              Tarefas da própria agência{internas > 0 ? ` · ${internas} em aberto` : ""}
            </span>
          </span>
          <Icone nome="seta" className="text-rail-muted" />
        </Link>
      )}
      {!clientes?.length ? (
        <EstadoVazio icone="clientes" acao={!verInativos && gestao ? { href: "/clientes/novo", rotulo: "Cadastrar cliente" } : undefined}>
          {verInativos ? "Nenhum cliente inativo." : "Nenhum cliente cadastrado ainda."}
        </EstadoVazio>
      ) : (
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,280px),1fr))] gap-4">
          {clientes.map((c) => {
            const k = vigente(c.id);
            const n = contagem.get(c.id) ?? { tarefas: 0, conteudos: 0 };
            return (
              <li key={c.id}>
                <Link href={`/clientes/${c.id}`} className="group flex h-full flex-col rounded-xl border border-line bg-card p-5 transition-colors hover:border-muted">
                  <div className="flex items-start justify-between gap-3">
                    <LogoCliente nome={c.nome} cor={c.cor} logo={c.logo} quadrado classe="h-14 w-14 text-[22px]" />
                    <span className={`rounded-full px-2.5 py-0.5 text-[12px] font-medium ${c.ativo ? "bg-ok-soft text-ok" : "bg-surface text-muted"}`}>
                      {c.ativo ? "Ativo" : "Inativo"}
                    </span>
                  </div>
                  <b className="mt-4 truncate font-display text-[18px] font-bold">{c.nome}</b>
                  <span className="truncate text-[13px] text-muted">{c.segmento || (c.instagram ? `@${c.instagram}` : "Sem segmento")}</span>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <span title="Demandas em aberto" className="inline-flex items-center gap-1 rounded-md bg-accent-soft px-2 py-0.5 text-[12px] font-medium text-accent">
                      <Icone nome="tarefas" className="!h-3.5 !w-3.5" />
                      <span className="font-mono">{n.tarefas}</span>
                      <span className="sr-only">demandas em aberto</span>
                    </span>
                    <span title="Conteúdos em produção" className="inline-flex items-center gap-1 rounded-md bg-andamento-soft px-2 py-0.5 text-[12px] font-medium text-andamento">
                      <Icone nome="roteiros" className="!h-3.5 !w-3.5" />
                      <span className="font-mono">{n.conteudos}</span>
                      <span className="sr-only">conteúdos em produção</span>
                    </span>
                  </div>
                  {gestao && (
                    <div className="mt-3 text-[12.5px] text-muted">
                      {k ? (
                        <>
                          {k.valor_mensal !== null && (
                            <>
                              <span className="font-mono text-ink">{reais(k.valor_mensal)}</span>/mês ·{" "}
                            </>
                          )}
                          <span className="font-mono">{k.conteudos_mes ?? "?"}</span> conteúdos/mês
                          {k.fim && <> · até {dataBR(k.fim)}</>}
                        </>
                      ) : (
                        <span className="font-semibold text-warn">Sem contrato vigente</span>
                      )}
                    </div>
                  )}
                  <span className="min-h-4 flex-1" />
                  <span className="flex items-center justify-between border-t border-line pt-3 text-[13px] text-muted group-hover:text-ink">
                    Ver detalhes
                    <Icone nome="seta" />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
