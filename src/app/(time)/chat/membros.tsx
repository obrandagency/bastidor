"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Avatar } from "@/components/tarefa";
import { adicionarMembro, adicionarMembros, arquivarCanal, removerMembro } from "./acoes";

type Pessoa = { id: string; nome: string; iniciais: string; foto: string | null; cargo: string };

function useFora(aberto: boolean, fechar: () => void) {
  const caixa = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => !caixa.current?.contains(e.target as Node) && fechar();
    const tecla = (e: KeyboardEvent) => e.key === "Escape" && fechar();
    document.addEventListener("mousedown", fora);
    window.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("mousedown", fora);
      window.removeEventListener("keydown", tecla);
    };
  }, [aberto, fechar]);
  return caixa;
}

// Ícone de pessoas no topo da conversa: quem está no canal; Sócio e Adm adicionam e tiram
export function MembrosCanal({ canalId, todos, membros, time, podeEditar }: { canalId: string; todos: boolean; membros: Pessoa[]; time: Pessoa[]; podeEditar: boolean }) {
  const [aberto, setAberto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  const caixa = useFora(aberto, () => setAberto(false));
  const lista = todos ? time : membros;
  const fora = time.filter((p) => !membros.some((m) => m.id === p.id));
  const rodar = (f: () => Promise<{ erro?: string } | undefined>) => iniciar(async () => setErro((await f())?.erro ?? null));

  return (
    <div ref={caixa} className="relative">
      <button
        type="button"
        onClick={() => setAberto((a) => !a)}
        aria-expanded={aberto}
        aria-label={`Membros do canal (${lista.length})`}
        title="Quem está no canal"
        className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-muted hover:bg-surface hover:text-ink"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" className="h-[18px] w-[18px] fill-none stroke-current" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 6.5M18.5 20a6.5 6.5 0 0 0-3-5.5" />
        </svg>
        <span className="font-mono text-[12px]">{lista.length}</span>
      </button>
      {aberto && (
        <div className="absolute right-0 top-9 z-30 flex max-h-[min(460px,70dvh)] w-[280px] flex-col overflow-hidden rounded-xl border border-line bg-card shadow-pop">
          <div className="border-b border-line px-3.5 py-2.5">
            <b className="text-[13.5px]">Membros</b>
            <p className="text-[12px] text-muted">{todos ? "Este canal é de todo o time." : `${lista.length} pessoa${lista.length === 1 ? "" : "s"}. Só elas veem as mensagens (e Sócio e Adm).`}</p>
          </div>
          <ul className="min-h-0 flex-1 overflow-y-auto py-1">
            {lista.map((p) => (
              <li key={p.id} className="flex items-center gap-2.5 px-3.5 py-1.5">
                <Avatar iniciais={p.iniciais} nome={p.nome} foto={p.foto} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium">{p.nome}</span>
                  {p.cargo && <span className="block truncate text-[11.5px] text-muted">{p.cargo}</span>}
                </span>
                {podeEditar && !todos && (
                  <button
                    type="button"
                    disabled={pendente}
                    onClick={() => confirm(`Tirar ${p.nome} do canal? A pessoa deixa de ver as mensagens.`) && rodar(() => removerMembro(canalId, p.id))}
                    aria-label={`Tirar ${p.nome}`}
                    title="Tirar do canal"
                    className="grid h-6 w-6 place-items-center rounded-md text-muted hover:bg-bad-soft hover:text-bad"
                  >
                    ×
                  </button>
                )}
              </li>
            ))}
          </ul>
          {podeEditar && !todos && fora.length > 0 && (
            <div className="border-t border-line p-2.5">
              <select
                value=""
                disabled={pendente}
                onChange={(e) => e.target.value && rodar(() => adicionarMembro(canalId, e.target.value))}
                aria-label="Adicionar pessoa"
                className="w-full rounded-lg border border-line bg-card px-2 py-1.5 text-[13px]"
              >
                <option value="">+ Adicionar pessoa…</option>
                {fora.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome}
                  </option>
                ))}
              </select>
            </div>
          )}
          {erro && <p className="border-t border-line px-3.5 py-2 text-[12px] text-bad">{erro}</p>}
        </div>
      )}
    </div>
  );
}

// Janela para marcar várias pessoas de uma vez e colocar no canal
function AdicionarPessoas({ canalId, nome, fora, fechar }: { canalId: string; nome: string; fora: Pessoa[]; fechar: () => void }) {
  const [marcados, setMarcados] = useState<string[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-[rgba(5,7,11,.45)] px-4" onClick={fechar}>
      <div role="dialog" aria-modal="true" aria-label="Adicionar pessoas" onClick={(e) => e.stopPropagation()} className="flex max-h-[85dvh] w-full max-w-[400px] flex-col gap-3 rounded-xl bg-card p-5 shadow-pop">
        <h2 className="text-[17px] font-bold">Adicionar pessoas em #{nome}</h2>
        {fora.length === 0 ? (
          <p className="text-[13.5px] text-muted">Todo o time já está neste canal.</p>
        ) : (
          <>
            <div className="flex justify-end gap-3 text-[12.5px]">
              <button type="button" onClick={() => setMarcados(fora.map((p) => p.id))} className="text-accent hover:underline">
                Marcar todos
              </button>
              <button type="button" onClick={() => setMarcados([])} className="text-muted hover:text-ink">
                Limpar
              </button>
            </div>
            <ul className="min-h-0 flex-1 overflow-y-auto">
              {fora.map((p) => (
                <li key={p.id}>
                  <label className="flex cursor-pointer items-center gap-2.5 rounded-lg px-1.5 py-1.5 hover:bg-surface">
                    <input
                      type="checkbox"
                      checked={marcados.includes(p.id)}
                      onChange={(e) => setMarcados((m) => (e.target.checked ? [...m, p.id] : m.filter((x) => x !== p.id)))}
                      className="h-4 w-4"
                    />
                    <Avatar iniciais={p.iniciais} nome={p.nome} foto={p.foto} />
                    <span className="min-w-0">
                      <span className="block truncate text-[13.5px] font-medium">{p.nome}</span>
                      {p.cargo && <span className="block truncate text-[11.5px] text-muted">{p.cargo}</span>}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </>
        )}
        {erro && <p className="text-[12.5px] text-bad">{erro}</p>}
        <div className="flex gap-2">
          {fora.length > 0 && (
            <button
              type="button"
              disabled={pendente || !marcados.length}
              onClick={() =>
                iniciar(async () => {
                  const r = await adicionarMembros(canalId, marcados);
                  if (r?.erro) setErro(r.erro);
                  else fechar();
                })
              }
              className="rounded-lg border border-accent bg-accent px-3.5 py-2 font-medium text-accent-ink hover:border-accent-hover hover:bg-accent-hover disabled:opacity-60"
            >
              {pendente ? "Adicionando…" : marcados.length ? `Adicionar ${marcados.length}` : "Adicionar"}
            </button>
          )}
          <button type="button" onClick={fechar} className="rounded-lg px-3.5 py-2 hover:bg-surface">
            {fora.length ? "Cancelar" : "Fechar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// "⋯" ao lado do nome do canal (Sócio e Adm): adicionar pessoas e arquivar
export function MenuCanal({ id, nome, fora, podeAdicionar }: { id: string; nome: string; fora: Pessoa[]; podeAdicionar: boolean }) {
  const [aberto, setAberto] = useState(false);
  const [adicionando, setAdicionando] = useState(false);
  const caixa = useFora(aberto, () => setAberto(false));
  const [, iniciar] = useTransition();
  return (
    <div ref={caixa} className="relative">
      <button type="button" onClick={() => setAberto((a) => !a)} aria-label="Opções do canal" aria-expanded={aberto} className="grid h-7 w-7 place-items-center rounded-lg bg-surface text-muted hover:text-ink">
        <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 fill-current">
          <circle cx="5" cy="12" r="1.7" />
          <circle cx="12" cy="12" r="1.7" />
          <circle cx="19" cy="12" r="1.7" />
        </svg>
      </button>
      {aberto && (
        <div role="menu" className="absolute left-0 top-9 z-30 w-[180px] overflow-hidden rounded-lg border border-line bg-card py-1 text-[13px] shadow-pop">
          {podeAdicionar && (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setAberto(false);
                setAdicionando(true);
              }}
              className="w-full px-3 py-1.5 text-left hover:bg-surface"
            >
              Adicionar pessoas
            </button>
          )}
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              if (!confirm(`Arquivar #${nome}? As mensagens ficam guardadas, mas ninguém escreve mais nele.`)) return;
              const f = new FormData();
              f.set("id", id);
              iniciar(async () => void (await arquivarCanal(undefined, f)));
            }}
            className="w-full px-3 py-1.5 text-left text-bad hover:bg-surface"
          >
            Arquivar canal
          </button>
        </div>
      )}
      {adicionando && <AdicionarPessoas canalId={id} nome={nome} fora={fora} fechar={() => setAdicionando(false)} />}
    </div>
  );
}
