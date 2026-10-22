"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { Aviso, Botao, Campo, Selecao, classeEntrada } from "@/components/formulario";
import {
  AREAS,
  ETAPAS_CONTEUDO,
  ETAPAS_DEMANDA,
  FORMATOS,
  podeMover,
  type Etapa,
  type TipoTarefa,
} from "@/lib/dominio/tarefas";
import type { Estado } from "@/app/entrar/acoes";
import type { Nota, Tarefa } from "@/types/banco";
import { agendar, comentar, criarTarefa, desagendar, excluirTarefa, marcarResolvido, notificarClienteAgora, salvarTarefa } from "./acoes";

type Opcao = { id: string; nome: string };

// Painel lateral (.drawer do protótipo). Fecha no Esc, no fundo escuro ou no ✕.
export function Gaveta({ fechar, rotulo, children }: { fechar: string; rotulo: string; children: React.ReactNode }) {
  const router = useRouter();
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => e.key === "Escape" && router.push(fechar, { scroll: false });
    window.addEventListener("keydown", tecla);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", tecla);
      document.body.style.overflow = "";
    };
  }, [fechar, router]);
  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-[rgba(5,7,11,.45)]" onClick={() => router.push(fechar, { scroll: false })}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={rotulo}
        onClick={(e) => e.stopPropagation()}
        className="flex h-full w-[min(560px,100%)] flex-col gap-4 overflow-y-auto bg-bg px-5 pb-[calc(28px+env(safe-area-inset-bottom,0px))] pt-[calc(20px+env(safe-area-inset-top,0px))] shadow-pop"
      >
        {children}
      </div>
    </div>
  );
}

function Retorno({ estado }: { estado: Estado }) {
  if (estado?.erro) return <Aviso tom="erro">{estado.erro}</Aviso>;
  if (estado?.ok) return <small className="text-[12.5px] text-ok">{estado.ok}</small>;
  return null;
}

export function Legenda({ tipo, inicial }: { tipo: TipoTarefa; inicial: string }) {
  const [valor, setValor] = useState(inicial);
  const conteudo = tipo === "conteudo";
  return (
    <div className="flex min-w-0 flex-col gap-[5px]">
      <div className="flex items-baseline justify-between">
        <label htmlFor="texto" className="text-[11.5px] uppercase tracking-[0.04em] text-muted">
          {conteudo ? "Legenda" : "Descrição"}
        </label>
        {conteudo && (
          <span className={`font-mono text-[11.5px] ${valor.length > 2200 ? "font-semibold text-bad" : "text-muted"}`}>
            {valor.length.toLocaleString("pt-BR")}/2.200
          </span>
        )}
      </div>
      <textarea
        id="texto"
        name="texto"
        rows={conteudo ? 6 : 5}
        value={valor}
        onChange={(e) => setValor(e.target.value)}
        placeholder={conteudo ? "" : "O que precisa ser feito, links, observações"}
        className={`${classeEntrada} resize-y leading-[1.55]`}
      />
    </div>
  );
}

// ---------------------------------------------------------------- campos da tarefa
export function FormTarefa({ tarefa, time, clientes }: { tarefa: Tarefa; time: Opcao[]; clientes: Opcao[] }) {
  const [estado, acao, enviando] = useActionState(salvarTarefa, undefined);
  const conteudo = tarefa.tipo === "conteudo";
  const etapas = conteudo ? ETAPAS_CONTEUDO : ETAPAS_DEMANDA;
  return (
    <form action={acao} className="flex flex-col gap-4">
      <input type="hidden" name="id" value={tarefa.id} />
      <input type="hidden" name="tipo" value={tarefa.tipo} />
      <input type="hidden" name="etapa_original" value={tarefa.etapa} />
      <input type="hidden" name="responsavel_original" value={tarefa.responsavel_id ?? ""} />
      <input
        name="titulo"
        aria-label="Título"
        required
        defaultValue={tarefa.titulo}
        className={`${classeEntrada} font-display text-[18px] font-bold`}
      />
      <div className="grid grid-cols-2 gap-3">
        <Selecao rotulo="Etapa" id="etapa" defaultValue={tarefa.etapa}>
          {etapas.map((e) => (
            <option key={e.id} value={e.id} disabled={e.id !== tarefa.etapa && !podeMover(tarefa.etapa, e.id as Etapa)}>
              {e.rotulo}
            </option>
          ))}
        </Selecao>
        <Selecao rotulo="Responsável" id="responsavel_id" defaultValue={tarefa.responsavel_id ?? ""}>
          <option value="">Ninguém</option>
          {time.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nome}
            </option>
          ))}
        </Selecao>
        <Selecao rotulo="Cliente" id="client_id" defaultValue={tarefa.client_id ?? "interno"}>
          {!conteudo && <option value="interno">O.BRAND (interno)</option>}
          {clientes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </Selecao>
        {conteudo ? (
          <Selecao rotulo="Formato" id="formato" defaultValue={tarefa.formato ?? "estatico"}>
            {FORMATOS.map((f) => (
              <option key={f.id} value={f.id}>
                {f.rotulo}
              </option>
            ))}
          </Selecao>
        ) : (
          <Selecao rotulo="Área" id="area" defaultValue={tarefa.area ?? "interno"}>
            {AREAS.map((a) => (
              <option key={a.id} value={a.id}>
                {a.rotulo}
              </option>
            ))}
          </Selecao>
        )}
        <Campo rotulo="Prazo" id="prazo" type="date" defaultValue={tarefa.prazo ?? ""} />
        <Campo
          rotulo="Horas registradas"
          id="horas"
          type="number"
          min={0}
          step={0.5}
          defaultValue={tarefa.horas ?? ""}
          className={`${classeEntrada} font-mono`}
        />
      </div>
      {conteudo && <p className="-mt-2 text-[12px] text-muted">Mudar a etapa passa o conteúdo para o responsável padrão dela.</p>}
      <Legenda tipo={tarefa.tipo} inicial={tarefa.texto} />
      <div className="flex flex-wrap items-center gap-3">
        <Botao variante="principal" disabled={enviando}>
          {enviando ? "Salvando…" : "Salvar"}
        </Botao>
        <Retorno estado={estado} />
      </div>
    </form>
  );
}

// ---------------------------------------------------------------- agendamento (conteúdo aprovado)
export function Agendamento({ tarefa, data, hora }: { tarefa: Tarefa; data: string; hora: string }) {
  const [estado, acao, enviando] = useActionState(agendar, undefined);
  const [estadoTirar, tirar, tirando] = useActionState(desagendar, undefined);
  const agendado = tarefa.etapa === "agendado";
  return (
    <div className="flex flex-col gap-2.5 rounded-xl border border-line bg-surface p-3.5">
      <div className="text-[13px]">
        <b>{agendado ? "Agendado no Pode Postar" : "Aprovado: falta agendar"}</b>
        <p className="text-[12.5px] text-muted">
          {agendado ? "Mude a data ou a hora se o agendamento mudou." : "Depois de agendar no Pode Postar, registre aqui a data e a hora."}
        </p>
      </div>
      <form action={acao} className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="id" value={tarefa.id} />
        <input type="date" name="data" aria-label="Data da publicação" required defaultValue={data} className={`${classeEntrada} !w-[160px]`} />
        <input type="time" name="hora" aria-label="Hora da publicação" required defaultValue={hora} className={`${classeEntrada} !w-[110px]`} />
        <Botao variante="principal" pequeno disabled={enviando}>
          {agendado ? "Salvar horário" : "Agendar"}
        </Botao>
      </form>
      {agendado && (
        <form action={tirar}>
          <input type="hidden" name="id" value={tarefa.id} />
          <Botao pequeno variante="fantasma" disabled={tirando}>
            Tirar do agendamento
          </Botao>
        </form>
      )}
      <Retorno estado={estado ?? estadoTirar} />
    </div>
  );
}

// ---------------------------------------------------------------- comentários e ajustes
export function Comentarios({ taskId, notas, autores }: { taskId: string; notas: Nota[]; autores: Record<string, string> }) {
  const [estado, acao, enviando] = useActionState(comentar, undefined);
  const [, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (estado?.ok) form.current?.reset();
  }, [estado]);

  return (
    <div>
      <div className="mb-2 text-[11.5px] uppercase tracking-[0.04em] text-muted">Ajustes e comentários</div>
      <div className="flex flex-col gap-2">
        {notas.map((n) => (
          <div
            key={n.id}
            className={`flex items-start gap-2.5 rounded-[10px] border px-[11px] py-[9px] ${
              n.tipo === "cliente" ? "border-bad/35 bg-bad-soft" : "border-line"
            } ${n.resolvido ? "opacity-55" : ""}`}
          >
            <input
              type="checkbox"
              aria-label="Resolvido"
              defaultChecked={n.resolvido}
              onChange={(e) => {
                const marcado = e.target.checked;
                iniciar(async () => {
                  const r = await marcarResolvido(n.id, marcado);
                  setErro(r?.erro ?? null);
                });
              }}
              className="mt-1 h-4 w-4 accent-[var(--color-accent)]"
            />
            <div className={`min-w-0 flex-1 text-[13px] [overflow-wrap:anywhere] ${n.resolvido ? "line-through" : ""}`}>
              <p className="whitespace-pre-line">{n.texto}</p>
              <small className="block text-[11.5px] text-muted no-underline">
                {n.tipo === "cliente" ? "Cliente" : "Interno"}
                {n.autor_id && autores[n.autor_id] ? ` · ${autores[n.autor_id]}` : ""}
              </small>
            </div>
          </div>
        ))}
        {notas.length === 0 && <p className="text-[13px] text-muted">Sem comentários.</p>}
      </div>
      {erro && <small className="text-[12px] text-bad">{erro}</small>}
      <form ref={form} action={acao} className="mt-2 flex gap-2">
        <input type="hidden" name="task_id" value={taskId} />
        <input name="texto" aria-label="Comentário interno" placeholder="Comentário interno" required className={classeEntrada} />
        <Botao className="border-ink bg-ink text-bg" disabled={enviando}>
          Adicionar
        </Botao>
      </form>
      {estado?.erro && <small className="text-[12px] text-bad">{estado.erro}</small>}
    </div>
  );
}

export function Excluir({ tarefa }: { tarefa: Tarefa }) {
  const [estado, acao, enviando] = useActionState(excluirTarefa, undefined);
  return (
    <form
      action={acao}
      onSubmit={(e) => {
        if (!confirm(`Excluir "${tarefa.titulo}"? Não dá para desfazer.`)) e.preventDefault();
      }}
      className="ml-auto flex items-center gap-2"
    >
      <input type="hidden" name="id" value={tarefa.id} />
      <input type="hidden" name="tipo" value={tarefa.tipo} />
      {estado?.erro && <small className="text-[12px] text-bad">{estado.erro}</small>}
      <Botao variante="fantasma" className="text-bad" disabled={enviando}>
        Excluir
      </Botao>
    </form>
  );
}

// ---------------------------------------------------------------- nova tarefa
export function FormNovaTarefa({
  tipo,
  time,
  clientes,
  eu,
  clienteFiltro,
}: {
  tipo: TipoTarefa;
  time: Opcao[];
  clientes: Opcao[];
  eu: string;
  clienteFiltro?: string;
}) {
  const [estado, acao, enviando] = useActionState(criarTarefa, undefined);
  const conteudo = tipo === "conteudo";
  return (
    <form action={acao} className="flex flex-col gap-4">
      <input type="hidden" name="tipo" value={tipo} />
      <h2 className="text-[20px] font-bold">{conteudo ? "Nova pauta" : "Nova demanda"}</h2>
      {estado?.erro && <Aviso tom="erro">{estado.erro}</Aviso>}
      <Campo rotulo="Título" id="titulo" required autoFocus />
      <div className="grid grid-cols-2 gap-3">
        <Selecao rotulo="Cliente" id="client_id" required defaultValue={clienteFiltro ?? (conteudo ? "" : "interno")}>
          {conteudo ? (
            <option value="" disabled>
              Escolha
            </option>
          ) : (
            <option value="interno">O.BRAND (interno)</option>
          )}
          {clientes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </Selecao>
        {conteudo ? (
          <Selecao rotulo="Formato" id="formato" defaultValue="estatico">
            {FORMATOS.map((f) => (
              <option key={f.id} value={f.id}>
                {f.rotulo}
              </option>
            ))}
          </Selecao>
        ) : (
          <Selecao rotulo="Área" id="area" defaultValue="atendimento">
            {AREAS.map((a) => (
              <option key={a.id} value={a.id}>
                {a.rotulo}
              </option>
            ))}
          </Selecao>
        )}
        <Campo rotulo="Prazo" id="prazo" type="date" />
        {!conteudo && (
          <Selecao rotulo="Responsável" id="responsavel_id" defaultValue={eu}>
            {time.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
          </Selecao>
        )}
      </div>
      {conteudo && <p className="-mt-2 text-[12px] text-muted">Começa em Pauta, com o responsável padrão da etapa.</p>}
      <Legenda tipo={tipo} inicial="" />
      <div>
        <Botao variante="principal" disabled={enviando}>
          {enviando ? "Criando…" : conteudo ? "Criar pauta" : "Criar demanda"}
        </Botao>
      </div>
    </form>
  );
}

// Com o cliente: dispara agora o e-mail "conteúdos para aprovar" em vez de esperar as 17h
export function NotificarCliente({ tarefa }: { tarefa: Tarefa }) {
  const [estado, acao, enviando] = useActionState(notificarClienteAgora, undefined);
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-warn-soft bg-warn-soft/50 p-3.5">
      <div className="text-[13px]">
        <b>Com o cliente</b>
        <p className="text-[12.5px] text-muted">
          {tarefa.aviso_cliente_em ? "O cliente já foi avisado por e-mail." : "O cliente recebe o e-mail às 17h com tudo o que foi enviado hoje."}
        </p>
      </div>
      <form action={acao} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="id" value={tarefa.id} />
        <Botao pequeno disabled={enviando}>
          {enviando ? "Enviando…" : "Notificar o cliente agora"}
        </Botao>
        <Retorno estado={estado} />
      </form>
    </div>
  );
}
