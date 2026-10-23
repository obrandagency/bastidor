"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { diaMes } from "@/lib/datas";
import { dataHoraSP } from "@/lib/dominio/tarefas";
import { buscarMensagens } from "./acoes";
import { NovoCanal } from "./canais";

export type CanalLista = { id: string; nome: string; cliente: string | null; arquivado: boolean; restrito: boolean; naoLidas: number };
type Filtro = "todos" | "nao-lidas" | "agencia" | "clientes" | "arquivados";
const FILTROS: { id: Filtro; rotulo: string }[] = [
  { id: "todos", rotulo: "Todos" },
  { id: "nao-lidas", rotulo: "Não lidas" },
  { id: "agencia", rotulo: "Agência" },
  { id: "clientes", rotulo: "Clientes" },
  { id: "arquivados", rotulo: "Arquivados" },
];

const icone = (d: string) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 flex-none fill-none stroke-current" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);
const HASH = "M5 9h14M5 15h14M10 4L8 20M16 4l-2 16";
const CADEADO = "M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3";

function Canal({ c, ativo }: { c: CanalLista; ativo: boolean }) {
  return (
    <Link
      href={`/chat?canal=${c.id}`}
      aria-current={ativo ? "page" : undefined}
      title={c.restrito ? "Canal só para alguns membros" : undefined}
      className={`flex items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-[13.5px] ${
        ativo ? "bg-surface font-semibold text-ink" : c.naoLidas ? "font-semibold text-ink hover:bg-surface" : "text-ink/80 hover:bg-surface"
      } ${c.arquivado ? "opacity-60" : ""}`}
    >
      <span className="text-muted">{icone(c.restrito ? CADEADO : HASH)}</span>
      <span className="min-w-0 flex-1 truncate">{c.nome}</span>
      {c.naoLidas > 0 && !ativo && <span className="grid h-5 min-w-5 place-items-center rounded-md bg-accent px-1 font-mono text-[10.5px] text-accent-ink">{c.naoLidas}</span>}
    </Link>
  );
}

export function ListaCanais({
  canais,
  atual,
  gestao,
  eu,
  clientes,
  pessoas,
}: {
  canais: CanalLista[];
  atual: string | null;
  gestao: boolean;
  eu: string;
  clientes: { id: string; nome: string }[];
  pessoas: { id: string; nome: string }[];
}) {
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [menuFiltro, setMenuFiltro] = useState(false);
  const [novo, setNovo] = useState(false);
  const [recolhida, setRecolhida] = useState(false);
  const [achadas, setAchadas] = useState<Awaited<ReturnType<typeof buscarMensagens>>>([]);
  const filtroRef = useRef<HTMLDivElement>(null);

  // A lista recolhida fica lembrada neste navegador
  useEffect(() => {
    try {
      setRecolhida(localStorage.getItem("chat_lista_recolhida") === "1");
    } catch {}
  }, []);
  const alternarLista = (v: boolean) => {
    setRecolhida(v);
    try {
      localStorage.setItem("chat_lista_recolhida", v ? "1" : "0");
    } catch {}
  };

  // Pesquisa nas mensagens (a partir de 2 letras)
  useEffect(() => {
    const t = setTimeout(() => (busca.trim().length >= 2 ? buscarMensagens(busca).then(setAchadas) : setAchadas([])), 250);
    return () => clearTimeout(t);
  }, [busca]);

  useEffect(() => {
    if (!menuFiltro) return;
    const fora = (e: MouseEvent) => !filtroRef.current?.contains(e.target as Node) && setMenuFiltro(false);
    document.addEventListener("mousedown", fora);
    return () => document.removeEventListener("mousedown", fora);
  }, [menuFiltro]);

  if (recolhida)
    return (
      <nav aria-label="Canais" className="hidden h-full flex-col items-center gap-2 border-r border-line p-2 md:flex">
        <button type="button" onClick={() => alternarLista(false)} aria-label="Mostrar canais" title="Mostrar canais" className="grid h-8 w-8 place-items-center rounded-lg border border-line text-muted hover:text-ink">
          {icone("M10 7l5 5-5 5")}
        </button>
      </nav>
    );

  const termo = busca.trim().toLowerCase();
  const visiveis = canais.filter((c) => {
    if (filtro === "arquivados" ? !c.arquivado : c.arquivado) return false;
    if (filtro === "nao-lidas" && !c.naoLidas) return false;
    if (filtro === "agencia" && c.cliente) return false;
    if (filtro === "clientes" && !c.cliente) return false;
    return !termo || c.nome.toLowerCase().includes(termo) || (c.cliente ?? "").toLowerCase().includes(termo);
  });
  const grupos = [
    ["Canais da agência", visiveis.filter((c) => !c.cliente)],
    ["Canais de clientes", visiveis.filter((c) => c.cliente)],
  ] as const;

  return (
    <nav aria-label="Canais" className="flex min-h-0 flex-col border-b border-line md:h-full md:border-b-0 md:border-r">
      <div className="flex items-center gap-1.5 p-2.5">
        <label className="flex min-w-0 flex-1 items-center gap-1.5 rounded-lg bg-surface px-2.5 py-1.5 text-muted focus-within:ring-2 focus-within:ring-accent-soft">
          {icone("M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4")}
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Pesquisar…" aria-label="Pesquisar canais e mensagens" className="min-w-0 flex-1 bg-transparent text-[13px] text-ink outline-none placeholder:text-muted" />
        </label>
        {gestao && (
          <button type="button" onClick={() => setNovo(true)} aria-label="Novo canal" title="Novo canal" className="grid h-8 w-8 flex-none place-items-center rounded-lg text-muted hover:bg-surface hover:text-ink">
            {icone("M12 5v14M5 12h14")}
          </button>
        )}
        <div ref={filtroRef} className="relative flex-none">
          <button
            type="button"
            onClick={() => setMenuFiltro((m) => !m)}
            aria-label="Filtrar canais"
            aria-expanded={menuFiltro}
            title="Filtrar"
            className={`grid h-8 w-8 place-items-center rounded-lg border ${filtro !== "todos" ? "border-accent bg-accent-soft text-accent" : "border-line text-muted hover:text-ink"}`}
          >
            {icone("M4 5h16l-6 7.5V19l-4 1.5v-8z")}
          </button>
          {menuFiltro && (
            <div role="menu" className="absolute right-0 top-9 z-30 flex w-[150px] flex-col overflow-hidden rounded-lg border border-line bg-card py-1 text-[13px] shadow-pop">
              {FILTROS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  role="menuitemradio"
                  aria-checked={filtro === f.id}
                  onClick={() => {
                    setFiltro(f.id);
                    setMenuFiltro(false);
                  }}
                  className={`flex w-full items-center justify-between px-3 py-1.5 text-left hover:bg-surface ${filtro === f.id ? "font-semibold text-accent" : ""}`}
                >
                  <span>{f.rotulo}</span>
                  {filtro === f.id && <span aria-hidden="true">✓</span>}
                </button>
              ))}
            </div>
          )}
        </div>
        <button type="button" onClick={() => alternarLista(true)} aria-label="Recolher canais" title="Recolher canais" className="hidden h-8 w-8 flex-none place-items-center rounded-lg border border-line text-muted hover:text-ink md:grid">
          {icone("M14 7l-5 5 5 5")}
        </button>
      </div>

      <div className="flex max-h-[220px] flex-col gap-3 overflow-y-auto px-2.5 pb-3 md:max-h-none md:flex-1">
        {grupos.map(([titulo, lista]) =>
          lista.length ? (
            <div key={titulo}>
              <div className="px-2.5 pb-1 pt-1 text-[10.5px] uppercase tracking-[0.12em] text-muted">{titulo}</div>
              {lista.map((c) => (
                <Canal key={c.id} c={c} ativo={c.id === atual} />
              ))}
            </div>
          ) : null,
        )}
        {!visiveis.length && <p className="px-2.5 py-2 text-[12.5px] text-muted">Nenhum canal {filtro === "todos" ? "com esse nome" : "nesse filtro"}.</p>}

        {achadas.length > 0 && (
          <div>
            <div className="px-2.5 pb-1 pt-1 text-[10.5px] uppercase tracking-[0.12em] text-muted">Mensagens</div>
            {achadas.map((m) => {
              const { data, hora } = dataHoraSP(m.created_at);
              const texto = m.texto.replace(/#\[([^\]]*)\]\([0-9a-f-]{36}\)/g, "#$1");
              const i = texto.toLowerCase().indexOf(termo);
              const ini = Math.max(0, i - 30);
              return (
                <Link key={m.id} href={`/chat?canal=${m.canal_id}&msg=${m.id}`} className="block rounded-lg px-2.5 py-2 text-[12.5px] hover:bg-surface">
                  <span className="text-muted">
                    #{m.canal} · {m.autor} · {diaMes(data)} {hora}
                  </span>
                  <span className="mt-0.5 line-clamp-2 block">
                    {ini > 0 && "…"}
                    {i >= 0 ? (
                      <>
                        {texto.slice(ini, i)}
                        <mark className="rounded bg-accent-soft px-0.5 text-ink">{texto.slice(i, i + termo.length)}</mark>
                        {texto.slice(i + termo.length, i + termo.length + 80)}
                      </>
                    ) : (
                      texto.slice(0, 110)
                    )}
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {novo && <NovoCanal clientes={clientes} pessoas={pessoas} eu={eu} fechar={() => setNovo(false)} />}
    </nav>
  );
}
