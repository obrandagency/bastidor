"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { Aviso, Botao, Campo, Selecao, classeEntrada } from "@/components/formulario";
import { BUCKET_ONBOARDING } from "@/lib/constantes";
import { criarClienteNavegador } from "@/lib/supabase/client";
import type { Estado } from "@/app/entrar/acoes";
import {
  adicionarTarefa,
  apagarComentario,
  comentar,
  editarTarefa,
  excluirOnboarding,
  marcarTarefa,
  moverOnboarding,
  registrarDocumento,
  removerDocumento,
  removerTarefa,
  salvarInformacoes,
} from "../acoes";

type Opcao = { id: string; nome: string };
export type TarefaOb = { id: string; texto: string; feito: boolean; responsavel_id: string | null; prazo: string | null; feitoPor: string | null };

function useErro() {
  const [erro, setErro] = useState<string | null>(null);
  return { erro, setErro, mostrar: (r: Estado) => setErro(r?.erro ?? null) };
}

// ---------------------------------------------------------------- tarefas da etapa
export function ListaTarefas({
  onboardingId,
  etapaId,
  tarefas,
  time,
  podeEditar,
}: {
  onboardingId: string;
  etapaId: string;
  tarefas: TarefaOb[];
  time: Opcao[];
  podeEditar: boolean;
}) {
  const [, iniciar] = useTransition();
  const { erro, mostrar } = useErro();
  const [editando, setEditando] = useState<string | null>(null);
  const [estado, acao, adicionando] = useActionState(adicionarTarefa, undefined);
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (estado?.ok) form.current?.reset();
  }, [estado]);
  const feitas = tarefas.filter((t) => t.feito).length;

  return (
    <div className="flex flex-col gap-2">
      <div className="mb-1 text-[12.5px]">
        <b className="uppercase tracking-[0.04em]">{tarefas.length} tarefas</b> <span className="text-muted">({feitas} concluídas)</span>
      </div>
      {erro && <Aviso tom="erro">{erro}</Aviso>}
      {tarefas.map((t) => (
        <div key={t.id} className="group flex flex-wrap items-center gap-2.5 rounded-lg bg-surface px-3 py-2">
          <input
            type="checkbox"
            aria-label={t.feito ? "Reabrir tarefa" : "Concluir tarefa"}
            defaultChecked={t.feito}
            disabled={!podeEditar}
            onChange={(e) => {
              const v = e.target.checked;
              iniciar(async () => mostrar(await marcarTarefa(t.id, onboardingId, v)));
            }}
            className="h-4 w-4 flex-none accent-[var(--color-ok)]"
          />
          {editando === t.id ? (
            <form
              className="flex min-w-0 flex-1 gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                const v = String(new FormData(e.currentTarget).get("texto") ?? "");
                iniciar(async () => {
                  const r = await editarTarefa(t.id, onboardingId, { texto: v });
                  mostrar(r);
                  if (!r?.erro) setEditando(null);
                });
              }}
            >
              <input name="texto" autoFocus defaultValue={t.texto} aria-label="Texto da tarefa" className={`${classeEntrada} !py-1`} />
              <Botao pequeno variante="principal">
                Salvar
              </Botao>
            </form>
          ) : (
            <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">
              <span className={t.feito ? "text-muted line-through" : ""}>{t.texto}</span>
              {t.feito && t.feitoPor && <small className="ml-1.5 text-[11.5px] text-muted">· {t.feitoPor}</small>}
            </span>
          )}
          {podeEditar && editando !== t.id && (
            <span className="flex flex-wrap items-center gap-2 text-[12px]">
              <select
                aria-label="Responsável"
                defaultValue={t.responsavel_id ?? ""}
                onChange={(e) => {
                  const v = e.target.value || null;
                  iniciar(async () => mostrar(await editarTarefa(t.id, onboardingId, { responsavel_id: v })));
                }}
                className="rounded border border-line bg-card px-1 py-0.5 text-[12px]"
              >
                <option value="">Sem responsável</option>
                {time.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome}
                  </option>
                ))}
              </select>
              <input
                type="date"
                aria-label="Prazo"
                defaultValue={t.prazo ?? ""}
                onChange={(e) => {
                  const v = e.target.value || null;
                  iniciar(async () => mostrar(await editarTarefa(t.id, onboardingId, { prazo: v })));
                }}
                className="rounded border border-line bg-card px-1 py-0.5 text-[12px]"
              />
              <button onClick={() => setEditando(t.id)} className="text-muted hover:text-ink">
                Editar
              </button>
              <button
                onClick={() => confirm("Remover esta tarefa?") && iniciar(async () => mostrar(await removerTarefa(t.id, onboardingId)))}
                className="text-bad hover:underline"
              >
                Remover
              </button>
            </span>
          )}
        </div>
      ))}
      {tarefas.length === 0 && <p className="text-[13px] text-muted">Nenhuma tarefa nesta etapa.</p>}
      {podeEditar && (
        <form ref={form} action={acao} className="mt-1 flex gap-2">
          <input type="hidden" name="onboarding_id" value={onboardingId} />
          <input type="hidden" name="etapa_id" value={etapaId} />
          <input name="texto" required placeholder="Nova tarefa nesta etapa" aria-label="Nova tarefa" className={classeEntrada} />
          <Botao className="border-ink bg-ink text-bg" disabled={adicionando}>
            Adicionar
          </Botao>
        </form>
      )}
    </div>
  );
}

export function MoverPara({ onboardingId, etapaId, nome }: { onboardingId: string; etapaId: string; nome: string }) {
  const [pendente, iniciar] = useTransition();
  const { erro, mostrar } = useErro();
  return (
    <div className="flex items-center gap-2">
      <Botao pequeno variante="principal" disabled={pendente} onClick={() => iniciar(async () => mostrar(await moverOnboarding(onboardingId, etapaId)))}>
        Mover cliente para {nome}
      </Botao>
      {erro && <small className="text-[12px] text-bad">{erro}</small>}
    </div>
  );
}

// ---------------------------------------------------------------- informações
export function FormInformacoes({ id, inicio, responsavel, time, podeEditar }: { id: string; inicio: string; responsavel: string | null; time: Opcao[]; podeEditar: boolean }) {
  const [estado, acao, enviando] = useActionState(salvarInformacoes, undefined);
  return (
    <form action={acao} className="grid max-w-[520px] grid-cols-2 gap-3">
      <input type="hidden" name="id" value={id} />
      <Campo rotulo="Início" id="inicio" type="date" defaultValue={inicio} disabled={!podeEditar} required />
      <Selecao rotulo="Responsável" id="responsavel_id" defaultValue={responsavel ?? ""} disabled={!podeEditar}>
        <option value="">Ninguém</option>
        {time.map((p) => (
          <option key={p.id} value={p.id}>
            {p.nome}
          </option>
        ))}
      </Selecao>
      {podeEditar && (
        <div className="col-span-2 flex items-center gap-3">
          <Botao pequeno variante="principal" disabled={enviando}>
            Salvar
          </Botao>
          {estado?.ok && <small className="text-[12.5px] text-ok">{estado.ok}</small>}
          {estado?.erro && <small className="text-[12.5px] text-bad">{estado.erro}</small>}
        </div>
      )}
    </form>
  );
}

export function ExcluirOnboarding({ id }: { id: string }) {
  const [estado, acao, enviando] = useActionState(excluirOnboarding, undefined);
  return (
    <form
      action={acao}
      onSubmit={(e) => {
        if (!confirm("Excluir este onboarding com tarefas, documentos e comentários? Não dá para desfazer.")) e.preventDefault();
      }}
      className="flex items-center gap-2"
    >
      <input type="hidden" name="id" value={id} />
      <Botao pequeno variante="fantasma" className="text-bad" disabled={enviando}>
        Excluir onboarding
      </Botao>
      {estado?.erro && <small className="text-[12px] text-bad">{estado.erro}</small>}
    </form>
  );
}

// ---------------------------------------------------------------- documentos
const TIPOS = [
  "image/jpeg", "image/png", "image/webp", "application/pdf", "text/plain", "application/zip",
  "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint", "application/vnd.openxmlformats-officedocument.presentationml.presentation",
];
const tamanho = (b: number) => (b > 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1).replace(".", ",")} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

export function Documentos({
  onboardingId,
  documentos,
  podeEditar,
}: {
  onboardingId: string;
  documentos: { id: string; nome: string; tamanho: number; url: string | null; autor: string; data: string }[];
  podeEditar: boolean;
}) {
  const router = useRouter();
  const [enviando, setEnviando] = useState<string | null>(null);
  const [, iniciar] = useTransition();
  const { erro, setErro, mostrar } = useErro();

  async function enviar(arquivos: FileList | null) {
    if (!arquivos?.length) return;
    setErro(null);
    const supabase = criarClienteNavegador();
    for (const f of [...arquivos]) {
      if (!TIPOS.includes(f.type)) {
        setErro(`${f.name}: tipo de arquivo não aceito.`);
        continue;
      }
      if (f.size > 25 * 1024 * 1024) {
        setErro(`${f.name} passa de 25 MB.`);
        continue;
      }
      setEnviando(f.name);
      const caminho = `${onboardingId}/${crypto.randomUUID()}-${f.name.normalize("NFD").replace(/[^\w.-]+/g, "_").slice(-80)}`;
      const { error } = await supabase.storage.from(BUCKET_ONBOARDING).upload(caminho, f, { contentType: f.type });
      if (error) {
        setErro(`${f.name}: não foi possível enviar.`);
        continue;
      }
      mostrar(await registrarDocumento(onboardingId, { caminho, nome: f.name, tipo: f.type, tamanho: f.size }));
    }
    setEnviando(null);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-2.5">
      {erro && <Aviso tom="erro">{erro}</Aviso>}
      {podeEditar && (
        <label className="cursor-pointer self-start rounded-lg border border-line px-3 py-[6px] text-[13px] font-medium hover:border-ink">
          {enviando ? `Enviando ${enviando}…` : "+ Enviar documentos"}
          <input type="file" multiple accept={TIPOS.join(",")} disabled={!!enviando} onChange={(e) => enviar(e.target.files)} className="sr-only" />
        </label>
      )}
      <ul className="rounded-xl border border-line">
        {documentos.map((d) => (
          <li key={d.id} className="flex flex-wrap items-center gap-2.5 border-t border-line px-3.5 py-2.5 text-[13px] first:border-t-0">
            <span aria-hidden="true">📎</span>
            {d.url ? (
              <a href={d.url} target="_blank" rel="noreferrer" className="min-w-[160px] flex-1 font-medium text-accent [overflow-wrap:anywhere] hover:underline">
                {d.nome}
              </a>
            ) : (
              <span className="min-w-[160px] flex-1 [overflow-wrap:anywhere]">{d.nome}</span>
            )}
            <span className="font-mono text-[11.5px] text-muted">{tamanho(d.tamanho)}</span>
            <span className="text-[12px] text-muted">
              {d.autor} · {d.data}
            </span>
            {podeEditar && (
              <button
                onClick={() => confirm(`Remover ${d.nome}?`) && iniciar(async () => mostrar(await removerDocumento(d.id, onboardingId)))}
                className="text-[12px] text-bad hover:underline"
              >
                Remover
              </button>
            )}
          </li>
        ))}
        {documentos.length === 0 && <li className="px-3.5 py-4 text-[13px] text-muted">Nenhum documento. Contrato, proposta, briefing preenchido…</li>}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------- comentários
export function Comentarios({
  onboardingId,
  comentarios,
  eu,
  socio,
  podeEditar,
}: {
  onboardingId: string;
  comentarios: { id: number; texto: string; autor_id: string | null; autor: string; data: string }[];
  eu: string;
  socio: boolean;
  podeEditar: boolean;
}) {
  const [estado, acao, enviando] = useActionState(comentar, undefined);
  const [, iniciar] = useTransition();
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (estado?.ok) form.current?.reset();
  }, [estado]);
  return (
    <div className="flex flex-col gap-2.5">
      {podeEditar && (
        <form ref={form} action={acao} className="flex gap-2">
          <input type="hidden" name="onboarding_id" value={onboardingId} />
          <textarea name="texto" required rows={2} placeholder="Comentário para o time" aria-label="Comentário" className={`${classeEntrada} resize-y`} />
          <Botao className="self-end border-ink bg-ink text-bg" disabled={enviando}>
            Comentar
          </Botao>
        </form>
      )}
      {estado?.erro && <Aviso tom="erro">{estado.erro}</Aviso>}
      {comentarios.map((c) => (
        <div key={c.id} className="rounded-[10px] border border-line px-3 py-2.5 text-[13px]">
          <p className="whitespace-pre-line [overflow-wrap:anywhere]">{c.texto}</p>
          <small className="mt-1 flex gap-2 text-[11.5px] text-muted">
            {c.autor} · {c.data}
            {(c.autor_id === eu || socio) && (
              <button onClick={() => confirm("Apagar este comentário?") && iniciar(async () => void (await apagarComentario(c.id, onboardingId)))} className="text-bad hover:underline">
                Apagar
              </button>
            )}
          </small>
        </div>
      ))}
      {comentarios.length === 0 && <p className="text-[13px] text-muted">Nenhum comentário.</p>}
    </div>
  );
}
