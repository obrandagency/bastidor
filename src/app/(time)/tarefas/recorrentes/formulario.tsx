"use client";

import { useActionState, useState, useTransition } from "react";
import { Aviso, Botao, Campo, Selecao } from "@/components/formulario";
import { AREAS, FORMATOS, type TipoTarefa } from "@/lib/dominio/tarefas";
import { DIAS_SEMANA, ULTIMO_DIA, type Frequencia, type Recorrencia } from "@/lib/dominio/recorrentes";
import { Legenda } from "../detalhe";
import { apagarRecorrencia, pausarRecorrencia, salvarRecorrencia } from "./acoes";

type Opcao = { id: string; nome: string };

export function FormRecorrencia({ inicial, time, clientes, hoje }: { inicial: Partial<Recorrencia>; time: Opcao[]; clientes: Opcao[]; hoje: string }) {
  const [estado, acao, enviando] = useActionState(salvarRecorrencia, undefined);
  const [tipo, setTipo] = useState<TipoTarefa>(inicial.tipo ?? "demanda");
  const [frequencia, setFrequencia] = useState<Frequencia>(inicial.frequencia ?? "mensal");
  const conteudo = tipo === "conteudo";
  const dias = new Set(inicial.dias_semana ?? [1]);

  return (
    <form action={acao} className="flex flex-col gap-4">
      {inicial.id && <input type="hidden" name="id" value={inicial.id} />}
      <h2 className="text-[20px] font-bold">{inicial.id ? "Editar tarefa recorrente" : "Nova tarefa recorrente"}</h2>
      {estado?.erro && <Aviso tom="erro">{estado.erro}</Aviso>}

      <div role="radiogroup" aria-label="Tipo" className="inline-flex gap-0.5 self-start rounded-[9px] bg-surface p-[3px]">
        {(
          [
            ["demanda", "Demanda"],
            ["conteudo", "Conteúdo"],
          ] as const
        ).map(([valor, rotulo]) => (
          <label key={valor} className={`cursor-pointer rounded-[7px] px-3 py-[5px] text-[12.5px] font-medium ${tipo === valor ? "bg-card shadow-[0_1px_3px_rgba(0,0,0,.08)]" : "text-muted"}`}>
            <input type="radio" name="tipo" value={valor} checked={tipo === valor} onChange={() => setTipo(valor)} className="sr-only" />
            {rotulo}
          </label>
        ))}
      </div>

      <Campo
        rotulo="Título"
        id="titulo"
        required
        maxLength={200}
        defaultValue={inicial.titulo ?? ""}
        dica="Use {mês}, {mês anterior} ou {data} para preencher sozinho. Ex.: Relatório de {mês anterior}"
      />

      <div className="grid grid-cols-2 gap-3">
        <Selecao key={tipo} rotulo="Cliente" id="client_id" required defaultValue={inicial.client_id ?? (conteudo ? "" : "interno")}>
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
          <Selecao rotulo="Formato" id="formato" defaultValue={inicial.formato ?? "estatico"}>
            {FORMATOS.map((f) => (
              <option key={f.id} value={f.id}>
                {f.rotulo}
              </option>
            ))}
          </Selecao>
        ) : (
          <Selecao rotulo="Área" id="area" defaultValue={inicial.area ?? "administrativo"}>
            {AREAS.map((a) => (
              <option key={a.id} value={a.id}>
                {a.rotulo}
              </option>
            ))}
          </Selecao>
        )}
        <Selecao rotulo="Responsável" id="responsavel_id" defaultValue={inicial.responsavel_id ?? ""}>
          <option value="">{conteudo ? "Padrão da etapa Pauta" : "Ninguém"}</option>
          {time.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nome}
            </option>
          ))}
        </Selecao>
        <Campo
          rotulo="Antecedência (dias)"
          id="antecedencia"
          type="number"
          min={0}
          max={60}
          required
          defaultValue={inicial.antecedencia ?? 7}
          dica="Quantos dias antes do prazo a tarefa aparece"
        />
      </div>

      <fieldset className="flex flex-col gap-3 rounded-xl border border-line p-3.5">
        <legend className="px-1 text-[11.5px] uppercase tracking-[0.04em] text-muted">Repetição</legend>
        <Selecao rotulo="Frequência" id="frequencia" value={frequencia} onChange={(e) => setFrequencia(e.target.value as Frequencia)}>
          <option value="semanal">Toda semana</option>
          <option value="quinzenal">A cada 15 dias</option>
          <option value="mensal">Todo mês</option>
        </Selecao>
        {frequencia === "mensal" ? (
          <Selecao rotulo="Dia do mês" id="dia_mes" defaultValue={inicial.dia_mes ?? 5}>
            {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
              <option key={d} value={d}>
                Dia {d}
              </option>
            ))}
            <option value={ULTIMO_DIA}>Último dia do mês</option>
          </Selecao>
        ) : (
          <div className="flex flex-col gap-[5px]">
            <span className="text-[11.5px] uppercase tracking-[0.04em] text-muted">Dias da semana</span>
            <div className="flex flex-wrap gap-1.5">
              {DIAS_SEMANA.map((rotulo, i) => (
                <label key={i} className="cursor-pointer">
                  <input type="checkbox" name="dias_semana" value={i} defaultChecked={dias.has(i)} className="peer sr-only" />
                  <span className="block rounded-lg border border-line px-2.5 py-1.5 text-[12.5px] peer-checked:border-accent peer-checked:bg-accent peer-checked:text-accent-ink peer-focus-visible:ring-2 peer-focus-visible:ring-accent">
                    {rotulo}
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo="Começa em" id="inicio" type="date" defaultValue={inicial.inicio ?? hoje} required />
          <Campo rotulo="Termina em (opcional)" id="fim" type="date" defaultValue={inicial.fim ?? ""} />
        </div>
        <p className="text-[12px] text-muted">Prazo em sábado ou domingo vai para a sexta anterior.</p>
      </fieldset>

      <Legenda key={tipo} tipo={tipo} inicial={inicial.texto ?? ""} />

      <div>
        <Botao variante="principal" disabled={enviando}>
          {enviando ? "Salvando…" : "Salvar"}
        </Botao>
      </div>
      {inicial.id && <p className="text-[12px] text-muted">Mudanças valem para as próximas. As tarefas já criadas não mudam.</p>}
    </form>
  );
}

export function AcoesRecorrencia({ id, ativa }: { id: string; ativa: boolean }) {
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  return (
    <span className="flex items-center gap-3 text-[12.5px]">
      <button disabled={pendente} onClick={() => iniciar(async () => setErro((await pausarRecorrencia(id, !ativa))?.erro ?? null))} className="text-muted hover:text-ink">
        {ativa ? "Pausar" : "Retomar"}
      </button>
      <button
        disabled={pendente}
        onClick={() =>
          confirm("Apagar esta tarefa recorrente? As tarefas já criadas continuam no quadro.") &&
          iniciar(async () => setErro((await apagarRecorrencia(id))?.erro ?? null))
        }
        className="text-bad hover:underline"
      >
        Apagar
      </button>
      {erro && <small className="text-bad">{erro}</small>}
    </span>
  );
}
