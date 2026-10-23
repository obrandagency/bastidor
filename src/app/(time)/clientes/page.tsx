import { LogoCliente } from "@/components/tarefa";
import Link from "next/link";
import { CabecalhoPagina, EstadoVazio } from "@/components/cabecalho-pagina";
import { dataBR, hojeSP } from "@/lib/datas";
import { reais } from "@/lib/dominio/crm";
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

  const [{ data: clientes }, { data: contratos }] = await Promise.all([
    supabase.from("clients").select("*").eq("ativo", !verInativos).order("nome").returns<ClienteCompleto[]>(),
    // Criação recebe lista vazia (RLS de contracts)
    supabase.from("contracts").select("*").lte("inicio", hoje).returns<Contrato[]>(),
  ]);
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
      {!clientes?.length ? (
        <EstadoVazio icone="clientes" acao={!verInativos && gestao ? { href: "/clientes/novo", rotulo: "Cadastrar cliente" } : undefined}>
          {verInativos ? "Nenhum cliente inativo." : "Nenhum cliente cadastrado ainda."}
        </EstadoVazio>
      ) : (
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,280px),1fr))] gap-3">
          {clientes.map((c) => {
            const k = vigente(c.id);
            return (
              <li key={c.id}>
                <Link
                  href={`/clientes/${c.id}`}
                  className="flex h-full flex-col gap-1.5 rounded-xl border border-line bg-card px-4 py-3.5 hover:border-muted"
                >
                  <div className="flex items-center gap-2">
                    <LogoCliente nome={c.nome} cor={c.cor} logo={c.logo} />
                    <span className="truncate font-medium">{c.nome}</span>
                  </div>
                  <div className="text-[12.5px] text-muted">
                    <span className="font-mono text-[11.5px] tracking-[0.04em]">{c.nome_curto}</span>
                    {c.instagram && <> · @{c.instagram}</>}
                  </div>
                  {gestao && (
                    <div className="mt-auto pt-1.5 text-[12.5px] text-muted">
                      {k ? (
                        <>
                          {k.valor_mensal !== null && (
                            <>
                              <span className="font-mono text-ink">{reais(k.valor_mensal)}</span>/mês ·{" "}
                            </>
                          )}
                          <span className="font-mono">{k.conteudos_mes ?? "?"}</span> conteúdos ·{" "}
                          <span className="font-mono">{k.ajustes_mes ?? "?"}</span> ajustes/mês
                          {k.fim && <> · até {dataBR(k.fim)}</>}
                        </>
                      ) : (
                        <span className="font-semibold text-warn">Sem contrato vigente</span>
                      )}
                    </div>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
