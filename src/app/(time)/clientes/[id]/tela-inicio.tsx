import { IconeQuadrado, type NomeIcone, type TomIcone } from "@/components/icone";
import { Avatar, LogoCliente } from "@/components/tarefa";
import { ETAPAS_CONTEUDO, ETAPAS_DEMANDA, FINALIZADAS } from "@/lib/dominio/tarefas";
import { ConteudosProducao, TarefasPendentes, type TarefaResumo } from "../../inicio/resumo";

// Desenho do Início do cliente (os dados vêm prontos do page.tsx)
export function TelaInicioCliente({
  id,
  cliente,
  frase,
  pendentes,
  guia,
  numeros,
  demandas,
  conteudos,
  tempo,
  horasMes,
  mes,
}: {
  id: string;
  cliente: { nome: string; cor: string; logo: string | null };
  frase: string;
  pendentes: number;
  guia: React.ReactNode;
  numeros: [number | string, string, NomeIcone, TomIcone][];
  demandas: TarefaResumo[];
  conteudos: TarefaResumo[];
  tempo: { pessoa: { id: string; nome: string; iniciais: string; foto: string | null } | null; horas: number }[];
  horasMes: number;
  mes: string;
}) {
  const maior = Math.max(1, ...tempo.map((x) => x.horas));
  return (
    <div className="flex flex-col gap-4">
      {/* Cabeçalho preto com o resumo da conta */}
      <section className="relative flex flex-wrap items-center gap-4 overflow-hidden rounded-xl bg-rail p-5 text-rail-ink md:p-6">
        <span aria-hidden="true" className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full bg-accent/25 blur-3xl" />
        <LogoCliente nome={cliente.nome} cor={cliente.cor} logo={cliente.logo} quadrado classe="h-14 w-14 text-[22px]" />
        <div className="relative min-w-[200px] flex-1">
          <h1 className="font-display text-[24px] font-bold leading-tight md:text-[28px]">{cliente.nome}</h1>
          <p className="mt-0.5 text-[14px] text-rail-muted">Você tem {frase}.</p>
        </div>
        <div className="relative flex w-full items-baseline gap-2 rounded-xl border border-white/10 bg-white/5 px-5 py-2.5 sm:block sm:w-auto sm:text-center">
          <b className="block font-display text-[28px] font-bold leading-none text-accent tabular-nums">{pendentes}</b>
          <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-rail-muted">pendentes</span>
        </div>
      </section>

      {guia}

      {/* Números do cliente */}
      <section className="grid grid-cols-2 gap-3 rounded-xl bg-rail p-3 md:grid-cols-3 md:p-4">
        {numeros.map(([n, rotulo, icone, tom]) => (
          <div key={rotulo} className="flex flex-col gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-4">
            <IconeQuadrado nome={icone} tom={tom} />
            <div>
              <b className={`block font-display text-[28px] font-bold leading-none tabular-nums ${tom === "vermelho" && Number(n) > 0 ? "text-bad-soft" : "text-rail-ink"}`}>{n}</b>
              <span className="mt-1 block text-[13px] text-rail-muted">{rotulo}</span>
            </div>
          </div>
        ))}
      </section>

      <div className="grid grid-cols-1 items-stretch gap-4 xl:grid-cols-2">
        <TarefasPendentes
          tarefas={demandas}
          etapas={ETAPAS_DEMANDA.filter((e) => e.id !== "concluido")}
          todos
          verTodas={`/tarefas?aba=demanda&cliente=${id}`}
        />
        <section className="rounded-xl border border-line bg-card p-5">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <IconeQuadrado nome="relogio" tom="cinza" />
            <h2 className="text-[17px] font-bold">Tempo por pessoa</h2>
            <span className="text-[13px] text-muted">{mes}</span>
            <span className="flex-1" />
            <span className="rounded-full bg-accent-soft px-2.5 py-0.5 font-mono text-[12.5px] font-semibold text-accent">{horasMes.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} h</span>
          </div>
          {tempo.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <IconeQuadrado nome="relogio" tom="cinza" grande />
              <p className="text-[13.5px] text-muted">Nenhuma hora registrada neste mês. As horas vêm do rastreador de tempo das tarefas.</p>
            </div>
          ) : (
            <ul className="flex flex-col gap-3.5">
              {tempo.map(({ pessoa, horas }) => (
                <li key={pessoa?.id ?? "sem"} className="flex items-center gap-3">
                  {pessoa ? <Avatar iniciais={pessoa.iniciais} nome={pessoa.nome} foto={pessoa.foto} /> : <span className="grid h-[26px] w-[26px] place-items-center rounded-full border border-dashed border-line text-[11px] text-muted">?</span>}
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center justify-between gap-2 text-[13.5px]">
                      <span className="truncate">{pessoa?.nome ?? "Sem responsável"}</span>
                      <b className="font-mono text-[13px] font-semibold">{horas.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} h</b>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-surface">
                      <div className="h-full rounded-full bg-accent" style={{ width: `${(horas / maior) * 100}%` }} />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <ConteudosProducao
        conteudos={conteudos}
        etapas={ETAPAS_CONTEUDO.filter((e) => !FINALIZADAS.includes(e.id))}
        todos
        verQuadro={`/tarefas?aba=conteudo&cliente=${id}`}
      />
    </div>
  );
}
