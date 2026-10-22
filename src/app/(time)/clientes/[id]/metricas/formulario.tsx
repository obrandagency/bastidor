"use client";

import { useActionState, useState } from "react";
import { Aviso, Botao, Campo, classeEntrada } from "@/components/formulario";
import { despublicar, salvarMetricas } from "./acoes";

type Relatorio = {
  alcance: number | null;
  novos_seguidores: number | null;
  engajamento: number | null;
  visitas_perfil: number | null;
  cliques_link: number | null;
  alcance_semanas: number[];
  investimento: number | null;
  resultados: number | null;
  resultado_rotulo: string | null;
  destaques: string[];
  leitura: string;
  publicado_em: string | null;
} | null;

const br = (n: number | null | undefined) => (n === null || n === undefined ? "" : String(n).replace(".", ","));

export function FormMetricas({
  clientId,
  mes,
  relatorio,
  candidatos,
}: {
  clientId: string;
  mes: string;
  relatorio: Relatorio;
  candidatos: { id: string; titulo: string; dia: string }[];
}) {
  const [estado, acao, enviando] = useActionState(salvarMetricas, undefined);
  const [estadoTirar, tirar, tirando] = useActionState(despublicar, undefined);
  const [destaques, setDestaques] = useState<string[]>(relatorio?.destaques ?? []);
  const publicado = !!relatorio?.publicado_em;
  const secao = "flex flex-col gap-3 rounded-xl border border-line bg-card p-4";
  const titulo = "text-[15px] font-bold";

  return (
    <div className="flex max-w-[860px] flex-col gap-4">
      <form action={acao} className="flex flex-col gap-4">
        <input type="hidden" name="client_id" value={clientId} />
        <input type="hidden" name="mes" value={mes} />

        <section className={secao}>
          <h2 className={titulo}>Instagram</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Campo rotulo="Contas alcançadas" id="alcance" inputMode="numeric" defaultValue={br(relatorio?.alcance)} />
            <Campo rotulo="Novos seguidores" id="novos_seguidores" inputMode="numeric" defaultValue={br(relatorio?.novos_seguidores)} />
            <Campo rotulo="Engajamento (%)" id="engajamento" inputMode="decimal" placeholder="3,8" defaultValue={br(relatorio?.engajamento)} />
            <Campo rotulo="Visitas ao perfil" id="visitas_perfil" inputMode="numeric" defaultValue={br(relatorio?.visitas_perfil)} />
            <Campo rotulo="Cliques no link" id="cliques_link" inputMode="numeric" defaultValue={br(relatorio?.cliques_link)} />
          </div>
          <div>
            <span className="text-[11.5px] uppercase tracking-[0.04em] text-muted">Alcance por semana</span>
            <div className="mt-[5px] grid grid-cols-5 gap-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <input
                  key={i}
                  name={`semana_${i}`}
                  inputMode="numeric"
                  aria-label={`Semana ${i}`}
                  placeholder={`Sem. ${i}`}
                  defaultValue={br(relatorio?.alcance_semanas?.[i - 1])}
                  className={`${classeEntrada} font-mono`}
                />
              ))}
            </div>
          </div>
        </section>

        <section className={secao}>
          <h2 className={titulo}>Tráfego pago</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Campo rotulo="Investimento (R$)" id="investimento" inputMode="decimal" defaultValue={br(relatorio?.investimento)} />
            <Campo rotulo="Resultados" id="resultados" inputMode="numeric" defaultValue={br(relatorio?.resultados)} />
            <Campo rotulo="O que é o resultado" id="resultado_rotulo" placeholder="agendamentos" defaultValue={relatorio?.resultado_rotulo ?? ""} />
          </div>
          <p className="text-[12px] text-muted">Deixe em branco se o cliente não tem tráfego pago. O custo por resultado é calculado sozinho.</p>
        </section>

        <section className={secao}>
          <h2 className={titulo}>Destaques do mês</h2>
          <p className="-mt-2 text-[12.5px] text-muted">Até 3 conteúdos agendados ou publicados no mês.</p>
          {candidatos.length === 0 ? (
            <p className="text-[13px] text-muted">Nenhum conteúdo agendado neste mês.</p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {candidatos.map((c) => {
                const marcado = destaques.includes(c.id);
                return (
                  <label key={c.id} className={`flex items-center gap-2.5 rounded-lg px-2 py-1.5 ${!marcado && destaques.length >= 3 ? "opacity-50" : "hover:bg-surface"}`}>
                    <input
                      type="checkbox"
                      name="destaques"
                      value={c.id}
                      checked={marcado}
                      disabled={!marcado && destaques.length >= 3}
                      onChange={() => setDestaques(marcado ? destaques.filter((d) => d !== c.id) : [...destaques, c.id])}
                      className="h-4 w-4 accent-[var(--color-accent)]"
                    />
                    <span className="min-w-0 flex-1 truncate">{c.titulo}</span>
                    <span className="font-mono text-[12px] text-muted">{c.dia}</span>
                  </label>
                );
              })}
            </div>
          )}
        </section>

        <section className={secao}>
          <h2 className={titulo}>Leitura da agência</h2>
          <textarea
            name="leitura"
            rows={5}
            defaultValue={relatorio?.leitura ?? ""}
            placeholder="O que aconteceu no mês e a recomendação para o próximo."
            aria-label="Leitura da agência"
            className={`${classeEntrada} resize-y leading-[1.55]`}
          />
        </section>

        {(estado?.erro || estado?.ok) && <Aviso tom={estado.erro ? "erro" : "ok"}>{estado.erro ?? estado.ok}</Aviso>}
        <div className="flex flex-wrap items-center gap-2">
          <Botao name="acao" value="rascunho" disabled={enviando}>
            Salvar rascunho
          </Botao>
          <Botao name="acao" value="publicar" variante="principal" disabled={enviando}>
            {enviando ? "Salvando…" : publicado ? "Salvar e manter publicado" : "Publicar e avisar o cliente"}
          </Botao>
          <span className={`ml-auto rounded-full px-[9px] py-px text-[11.5px] font-medium ${publicado ? "bg-ok-soft text-ok" : "bg-surface text-muted"}`}>
            {publicado ? "Publicado no portal" : "Rascunho"}
          </span>
        </div>
      </form>

      {publicado && (
        <form action={tirar} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="client_id" value={clientId} />
          <input type="hidden" name="mes" value={mes} />
          <Botao pequeno variante="fantasma" disabled={tirando}>
            Tirar do portal (voltar para rascunho)
          </Botao>
          {estadoTirar?.ok && <small className="text-[12.5px] text-ok">{estadoTirar.ok}</small>}
          {estadoTirar?.erro && <small className="text-[12.5px] text-bad">{estadoTirar.erro}</small>}
        </form>
      )}
    </div>
  );
}
