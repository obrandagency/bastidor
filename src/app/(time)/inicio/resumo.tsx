"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { EstadoVazio } from "@/components/cabecalho-pagina";
import { Icone, IconeQuadrado } from "@/components/icone";
import { Avatar, LogoCliente, SeloEtapa } from "@/components/tarefa";
import { BARRA_DO_TOM, rotuloEtapa, tomDaEtapa, type Etapa } from "@/lib/dominio/tarefas";
import { abrirAviso, marcarTodasLidas } from "../avisos/acoes";

// ---------------------------------------------------------------- tipos (montados no page.tsx)
export type AvisoResumo = { id: number; texto: string; link: string | null; quando: string };
export type ConversaResumo = { canalId: string; canal: string; novas: number };
export type TarefaResumo = {
  id: string;
  titulo: string;
  cliente: { nome: string; cor: string; logo: string | null };
  etapa: Etapa;
  prazo: string | null; // dd/mm
  atrasada: boolean;
  minha: boolean;
  resp: { nome: string; iniciais: string; foto: string | null } | null;
  href: string;
};

const ABAS = [
  ["avisos", "Avisos"],
  ["mensagens", "Mensagens"],
  ["tarefas", "Tarefas"],
] as const;

// ---------------------------------------------------------------- central de avisos
export function CentralAvisos({ avisos, conversas, tarefas }: { avisos: AvisoResumo[]; conversas: ConversaResumo[]; tarefas: TarefaResumo[] }) {
  const [aba, setAba] = useState<(typeof ABAS)[number][0]>(avisos.length ? "avisos" : conversas.length ? "mensagens" : "tarefas");
  const total = avisos.length + conversas.reduce((s, c) => s + c.novas, 0) + tarefas.length;
  const contagem = { avisos: avisos.length, mensagens: conversas.reduce((s, c) => s + c.novas, 0), tarefas: tarefas.length };

  return (
    <section className="rounded-xl border border-line bg-card">
      <div className="flex flex-wrap items-center gap-3 px-5 pt-5">
        <IconeQuadrado nome="sino" tom={total ? "azul" : "verde"} grande />
        <div className="min-w-0 flex-1">
          <h2 className="text-[17px] font-bold">Central de avisos</h2>
          <p className="text-[13px] text-muted">{total ? `${total} ${total === 1 ? "coisa pede" : "coisas pedem"} a sua atenção` : "Tudo em dia"}</p>
        </div>
        {avisos.length > 0 && (
          <form action={marcarTodasLidas}>
            <button className="text-[12.5px] text-muted hover:text-ink">Marcar avisos como lidos</button>
          </form>
        )}
      </div>

      {total === 0 ? (
        <div className="flex flex-col items-center gap-3 px-5 pb-10 pt-6 text-center">
          <span className="grid h-12 w-12 place-items-center rounded-full border-2 border-ok text-ok" aria-hidden="true">
            ✓
          </span>
          <p className="text-[14px] text-muted">Nenhum aviso no momento. Sua operação está atualizada!</p>
        </div>
      ) : (
        <>
          <div role="tablist" className="mx-5 mt-4 flex gap-1 border-b border-line">
            {ABAS.map(([id, rotulo]) => (
              <button
                key={id}
                role="tab"
                type="button"
                aria-selected={aba === id}
                onClick={() => setAba(id)}
                className={`-mb-px flex items-center gap-1.5 border-b-2 px-2.5 py-2 text-[13.5px] font-medium ${aba === id ? "border-accent text-ink" : "border-transparent text-muted hover:text-ink"}`}
              >
                {rotulo}
                {contagem[id] > 0 && <span className={`rounded-full px-1.5 font-mono text-[11px] ${aba === id ? "bg-accent text-accent-ink" : "bg-surface text-muted"}`}>{contagem[id]}</span>}
              </button>
            ))}
          </div>
          <ul className="max-h-[320px] overflow-y-auto px-2 py-2">
            {aba === "avisos" &&
              avisos.map((a) => (
                <li key={a.id}>
                  <form action={abrirAviso}>
                    <input type="hidden" name="id" value={a.id} />
                    <input type="hidden" name="link" value={a.link ?? ""} />
                    <button className="flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-surface">
                      <span className="mt-1.5 h-2 w-2 flex-none rounded-full bg-accent" />
                      <span className="min-w-0 flex-1 text-[13.5px] [overflow-wrap:anywhere]">{a.texto}</span>
                      <span className="flex-none font-mono text-[11.5px] text-muted">{a.quando}</span>
                    </button>
                  </form>
                </li>
              ))}
            {aba === "mensagens" &&
              conversas.map((c) => (
                <li key={c.canalId}>
                  <Link href={`/chat?canal=${c.canalId}`} className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-surface">
                    <Icone nome="chat" className="text-muted" />
                    <span className="min-w-0 flex-1 text-[13.5px]">
                      <b>#{c.canal}</b>
                    </span>
                    <span className="rounded-full bg-accent px-2 font-mono text-[11.5px] text-accent-ink">
                      {c.novas} nova{c.novas > 1 ? "s" : ""}
                    </span>
                  </Link>
                </li>
              ))}
            {aba === "tarefas" &&
              tarefas.map((t) => (
                <li key={t.id}>
                  <Link href={t.href} scroll={false} className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-surface">
                    <LogoCliente nome={t.cliente.nome} cor={t.cliente.cor} logo={t.cliente.logo} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-medium">{t.titulo}</span>
                      <span className="block truncate text-[12px] text-muted">{t.cliente.nome}</span>
                    </span>
                    <span className={`flex-none text-[12px] font-semibold ${t.atrasada ? "text-bad" : "text-warn"}`}>{t.atrasada ? `Atrasada · ${t.prazo}` : "Vence hoje"}</span>
                  </Link>
                </li>
              ))}
            {contagem[aba] === 0 && <li className="px-3 py-6 text-center text-[13px] text-muted">Nada aqui agora.</li>}
          </ul>
        </>
      )}
    </section>
  );
}

// ---------------------------------------------------------------- filtros comuns
function Busca({ valor, mudar, placeholder }: { valor: string; mudar: (v: string) => void; placeholder: string }) {
  return (
    <label className="flex min-w-[200px] flex-1 items-center gap-2 rounded-lg border border-line bg-card px-3 py-2 text-muted focus-within:border-accent">
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 flex-none fill-none stroke-current" strokeWidth={1.8} strokeLinecap="round">
        <path d="M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4" />
      </svg>
      <input value={valor} onChange={(e) => mudar(e.target.value)} placeholder={placeholder} aria-label={placeholder} className="min-w-0 flex-1 bg-transparent text-[13.5px] text-ink outline-none placeholder:text-muted" />
    </label>
  );
}

// "Todos | Minhas" em botões arredondados
function Escopo({ minhas, mudar, rotulo }: { minhas: boolean; mudar: (v: boolean) => void; rotulo: [string, string] }) {
  return (
    <div role="group" aria-label="De quem" className="flex flex-none gap-1.5">
      {(
        [
          [false, rotulo[1]],
          [true, rotulo[0]],
        ] as const
      ).map(([valor, texto]) => (
        <button
          key={texto}
          type="button"
          onClick={() => mudar(valor)}
          aria-pressed={minhas === valor}
          className={`rounded-full border px-3.5 py-[7px] text-[13px] font-medium ${minhas === valor ? "border-accent bg-accent text-accent-ink" : "border-line bg-card text-muted hover:text-ink"}`}
        >
          {texto}
        </button>
      ))}
    </div>
  );
}

const filtrar = (lista: TarefaResumo[], termo: string, minhas: boolean) => {
  const t = termo.trim().toLowerCase();
  return lista.filter((x) => (!minhas || x.minha) && (!t || x.titulo.toLowerCase().includes(t) || x.cliente.nome.toLowerCase().includes(t)));
};

function CardTarefa({ t, selo }: { t: TarefaResumo; selo?: boolean }) {
  return (
    <Link href={t.href} scroll={false} className="flex flex-col gap-2 rounded-xl border border-line bg-card p-3 hover:border-muted">
      <span className="text-[14px] font-semibold leading-snug [overflow-wrap:anywhere]">{t.titulo}</span>
      <span className="flex min-w-0 items-center gap-1.5 text-[12.5px] text-muted">
        <LogoCliente nome={t.cliente.nome} cor={t.cliente.cor} logo={t.cliente.logo} classe="h-4 w-4 text-[8px]" />
        <span className="truncate">{t.cliente.nome}</span>
      </span>
      <span className="flex items-center gap-2 text-[12.5px]">
        <span className={`flex items-center gap-1 ${t.atrasada ? "font-semibold text-bad" : "text-muted"}`}>
          <Icone nome="relogio" className="!h-3.5 !w-3.5" />
          {t.prazo ?? "sem prazo"}
        </span>
        {selo && <SeloEtapa etapa={t.etapa} />}
        <span className="flex-1" />
        {t.resp && <Avatar iniciais={t.resp.iniciais} nome={t.resp.nome} foto={t.resp.foto} />}
      </span>
    </Link>
  );
}

function LinhaTarefa({ t }: { t: TarefaResumo }) {
  return (
    <Link href={t.href} scroll={false} className="flex items-center gap-3 border-t border-line px-3 py-2.5 first:border-t-0 hover:bg-surface">
      <LogoCliente nome={t.cliente.nome} cor={t.cliente.cor} logo={t.cliente.logo} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13.5px] font-medium">{t.titulo}</span>
        <span className="block truncate text-[12px] text-muted">{t.cliente.nome}</span>
      </span>
      <SeloEtapa etapa={t.etapa} />
      <span className={`w-[52px] flex-none text-right font-mono text-[12px] ${t.atrasada ? "font-semibold text-bad" : "text-muted"}`}>{t.prazo ?? "–"}</span>
      {t.resp ? <Avatar iniciais={t.resp.iniciais} nome={t.resp.nome} foto={t.resp.foto} /> : <span className="w-[26px]" />}
    </Link>
  );
}

// ---------------------------------------------------------------- tarefas atrasadas (conteúdos e demandas)
export function TarefasAtrasadas({ tarefas, todos }: { tarefas: TarefaResumo[]; todos?: boolean }) {
  const [busca, setBusca] = useState("");
  const [minhas, setMinhas] = useState(!todos);
  const lista = useMemo(() => filtrar(tarefas, busca, minhas), [tarefas, busca, minhas]);

  return (
    <section className="rounded-xl border border-line bg-card p-5">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <IconeQuadrado nome="relogio" tom="vermelho" />
        <h2 className="text-[17px] font-bold">Tarefas atrasadas</h2>
        <span className={`rounded-full px-2 font-mono text-[12px] ${lista.length ? "bg-bad-soft text-bad" : "bg-surface text-muted"}`}>{lista.length}</span>
        <span className="flex-1" />
        <Link href="/tarefas" className="text-[13px] text-muted hover:text-ink">
          Abrir tarefas →
        </Link>
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        <Busca valor={busca} mudar={setBusca} placeholder="Buscar tarefa ou cliente…" />
        <Escopo minhas={minhas} mudar={setMinhas} rotulo={["Minhas", "Todos"]} />
      </div>
      {lista.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-6 text-center">
          <IconeQuadrado nome="relogio" tom="verde" grande />
          <b className="mt-1 text-[15px]">Nada atrasado!</b>
          <p className="text-[13.5px] text-muted">{busca ? "Nenhuma tarefa atrasada com essa busca." : minhas ? "Nenhuma tarefa sua passou do prazo." : "Nenhuma tarefa do time passou do prazo."}</p>
        </div>
      ) : (
        <div className="rounded-xl border border-line">{lista.map((t) => <LinhaTarefa key={t.id} t={t} />)}</div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------- tarefas pendentes (demandas abertas)
export function TarefasPendentes({
  tarefas,
  etapas,
  todos,
  verTodas = "/tarefas?aba=demanda",
}: {
  tarefas: TarefaResumo[];
  etapas: { id: Etapa; rotulo: string }[];
  todos?: boolean; // abre em "Todos" (Central do cliente)
  verTodas?: string;
}) {
  const [busca, setBusca] = useState("");
  const [minhas, setMinhas] = useState(!todos);
  const [vista, setVista] = useState<"grade" | "lista">("grade");
  const lista = useMemo(() => filtrar(tarefas, busca, minhas), [tarefas, busca, minhas]);

  return (
    <section className="rounded-xl border border-line bg-card p-5">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <IconeQuadrado nome="alerta" tom="ambar" />
        <h2 className="text-[17px] font-bold">Tarefas pendentes</h2>
        <span className="rounded-full bg-surface px-2 font-mono text-[12px] text-muted">{lista.length}</span>
        <span className="flex-1" />
        <div className="flex overflow-hidden rounded-lg border border-line" role="group" aria-label="Ver como">
          {(
            [
              ["grade", "Grade", "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z"],
              ["lista", "Lista", "M8 6h12M8 12h12M8 18h12M4 6v.01M4 12v.01M4 18v.01"],
            ] as const
          ).map(([id, rotulo, d]) => (
            <button key={id} type="button" onClick={() => setVista(id)} aria-pressed={vista === id} aria-label={rotulo} title={rotulo} className={`grid h-8 w-9 place-items-center ${vista === id ? "bg-rail text-rail-ink" : "text-muted hover:text-ink"}`}>
              <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 fill-none stroke-current" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                <path d={d} />
              </svg>
            </button>
          ))}
        </div>
        <Link href={verTodas} className="text-[13px] text-muted hover:text-ink">
          Ver todas →
        </Link>
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        <Busca valor={busca} mudar={setBusca} placeholder="Buscar tarefa ou cliente…" />
        <Escopo minhas={minhas} mudar={setMinhas} rotulo={["Minhas", "Todos"]} />
      </div>
      {lista.length === 0 ? (
        <EstadoVazio icone="tarefas">{busca ? "Nenhuma tarefa com essa busca." : minhas ? "Nenhuma demanda pendente com você." : "Nenhuma demanda pendente."}</EstadoVazio>
      ) : vista === "lista" ? (
        <div className="rounded-xl border border-line">{lista.map((t) => <LinhaTarefa key={t.id} t={t} />)}</div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,220px),1fr))] gap-3">
          {etapas.map((e) => {
            const da = lista.filter((t) => t.etapa === e.id);
            if (!da.length) return null;
            return (
              <div key={e.id} className={`flex min-w-0 flex-col gap-2 rounded-xl border border-t-[3px] border-line bg-surface p-2.5 ${BARRA_DO_TOM[tomDaEtapa(e.id)]}`}>
                <div className="flex items-center justify-between px-1 text-[13.5px] font-semibold">
                  {e.rotulo}
                  <span className="font-mono text-[11.5px] text-muted">{da.length}</span>
                </div>
                {da.map((t) => (
                  <CardTarefa key={t.id} t={t} />
                ))}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------- conteúdos em produção
export function ConteudosProducao({
  conteudos,
  etapas,
  todos,
  verQuadro = "/tarefas?aba=conteudo",
}: {
  conteudos: TarefaResumo[];
  etapas: { id: Etapa; rotulo: string }[];
  todos?: boolean;
  verQuadro?: string;
}) {
  const [busca, setBusca] = useState("");
  const [meus, setMeus] = useState(!todos);
  const [etapa, setEtapa] = useState<Etapa | null>(null);
  const base = useMemo(() => filtrar(conteudos, busca, meus), [conteudos, busca, meus]);
  const lista = etapa ? base.filter((c) => c.etapa === etapa) : base;

  return (
    <section className="rounded-xl border border-line bg-card p-5">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <IconeQuadrado nome="roteiros" tom="violeta" />
        <h2 className="text-[17px] font-bold">Conteúdos em produção</h2>
        <span className="rounded-full bg-surface px-2 font-mono text-[12px] text-muted">{base.length}</span>
        <span className="flex-1" />
        <Link href={verQuadro} className="text-[13px] text-muted hover:text-ink">
          Ver quadro →
        </Link>
      </div>
      <div className="mb-3 flex flex-wrap gap-2">
        <Busca valor={busca} mudar={setBusca} placeholder="Buscar conteúdo ou cliente…" />
        <Escopo minhas={meus} mudar={setMeus} rotulo={["Meus", "Todos"]} />
      </div>
      <div className="mb-4 flex flex-wrap gap-1.5">
        <button type="button" onClick={() => setEtapa(null)} className={`rounded-full px-3 py-1 text-[12.5px] font-medium ${!etapa ? "bg-rail text-rail-ink" : "bg-surface text-muted hover:text-ink"}`}>
          Todos <span className="font-mono">{base.length}</span>
        </button>
        {etapas.map((e) => {
          const n = base.filter((c) => c.etapa === e.id).length;
          if (!n) return null;
          return (
            <button key={e.id} type="button" onClick={() => setEtapa(e.id)} className={`rounded-full px-3 py-1 text-[12.5px] font-medium ${etapa === e.id ? "bg-rail text-rail-ink" : "bg-surface text-muted hover:text-ink"}`}>
              {rotuloEtapa(e.id)} <span className="font-mono">{n}</span>
            </button>
          );
        })}
      </div>
      {lista.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <IconeQuadrado nome="roteiros" tom="cinza" grande />
          <b className="mt-1 text-[15px]">Tudo em dia!</b>
          <p className="text-[13.5px] text-muted">Nenhum conteúdo ativo para este filtro no momento.</p>
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,240px),1fr))] gap-3">
          {lista.map((c) => (
            <CardTarefa key={c.id} t={c} selo />
          ))}
        </div>
      )}
    </section>
  );
}
