"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Aviso, Botao, Campo, Selecao, classeEntrada } from "@/components/formulario";
import { ETAPAS_LEAD, ORIGENS, SERVICOS, type EtapaLead } from "@/lib/dominio/crm";
import type { Estado } from "@/app/entrar/acoes";
import type { Lead } from "@/types/banco";
import { anotar, criarLead, excluirLead, salvarLead, virarCliente } from "./acoes";

type Opcao = { id: string; nome: string };

function Retorno({ estado }: { estado: Estado }) {
  if (estado?.erro) return <Aviso tom="erro">{estado.erro}</Aviso>;
  if (estado?.ok) return <small className="text-[12.5px] text-ok">{estado.ok}</small>;
  return null;
}

// Serve para lead novo (sem `lead`) e para editar
export function FormLead({ lead, time, eu, amanha }: { lead?: Lead; time: Opcao[]; eu: string; amanha: string }) {
  const [estado, acao, enviando] = useActionState(lead ? salvarLead : criarLead, undefined);
  const [etapa, setEtapa] = useState<EtapaLead>(lead?.etapa ?? "novo");
  const aberto = etapa !== "ganho" && etapa !== "perdido";
  return (
    <form action={acao} className="flex flex-col gap-4">
      {lead && <input type="hidden" name="id" value={lead.id} />}
      {!lead && <h2 className="text-[20px] font-bold">Novo lead</h2>}
      {estado?.erro && <Aviso tom="erro">{estado.erro}</Aviso>}
      <input
        name="empresa"
        aria-label="Empresa"
        placeholder="Empresa"
        required
        autoFocus={!lead}
        defaultValue={lead?.empresa}
        className={`${classeEntrada} font-display text-[18px] font-bold`}
      />
      <div className="grid grid-cols-2 gap-3">
        <Campo rotulo="Contato" id="contato" defaultValue={lead?.contato ?? ""} />
        <Campo rotulo="WhatsApp" id="whatsapp" type="tel" defaultValue={lead?.whatsapp ?? ""} placeholder="(19) 9 0000-0000" />
        <Campo rotulo="Segmento" id="segmento" defaultValue={lead?.segmento ?? ""} placeholder="Ex.: Saúde" />
        <Campo rotulo="Cidade" id="cidade" defaultValue={lead?.cidade ?? ""} />
        <Selecao rotulo="Origem" id="origem" defaultValue={lead?.origem ?? ""}>
          <option value="">Escolha</option>
          {ORIGENS.map((o) => (
            <option key={o.id} value={o.id}>
              {o.rotulo}
            </option>
          ))}
        </Selecao>
        <Campo
          rotulo="Valor mensal (R$)"
          id="valor_mensal"
          type="number"
          min={0}
          step={100}
          defaultValue={lead?.valor_mensal ?? ""}
          className={`${classeEntrada} font-mono`}
        />
        {lead ? (
          <Selecao rotulo="Etapa" id="etapa" value={etapa} onChange={(e) => setEtapa(e.target.value as EtapaLead)}>
            {ETAPAS_LEAD.map((e) => (
              <option key={e.id} value={e.id}>
                {e.rotulo}
              </option>
            ))}
          </Selecao>
        ) : (
          <input type="hidden" name="etapa" value="novo" />
        )}
        <Selecao rotulo="Responsável" id="responsavel_id" defaultValue={lead?.responsavel_id ?? eu}>
          <option value="">Ninguém</option>
          {time.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nome}
            </option>
          ))}
        </Selecao>
      </div>

      <fieldset className="flex flex-col gap-[5px]">
        <legend className="mb-[5px] text-[11.5px] uppercase tracking-[0.04em] text-muted">Serviços de interesse</legend>
        <div className="flex flex-wrap gap-2">
          {SERVICOS.map((s) => (
            <label
              key={s.id}
              className="flex cursor-pointer items-center gap-1.5 rounded-[10px] border border-line bg-card px-2.5 py-1.5 text-[12.5px] has-[:checked]:border-ink has-[:checked]:shadow-[0_0_0_1px_var(--color-ink)]"
            >
              <input type="checkbox" name="servicos" value={s.id} defaultChecked={lead?.servicos.includes(s.id)} className="sr-only" />
              {s.rotulo}
            </label>
          ))}
        </div>
      </fieldset>

      {etapa === "perdido" && (
        <Campo rotulo="Motivo da perda" id="motivo_perda" required defaultValue={lead?.motivo_perda ?? ""} placeholder="Ex.: preço, timing, escolheu outra agência" />
      )}
      {aberto && (
        <div className="grid grid-cols-[minmax(0,1fr)_150px] gap-3">
          <Campo rotulo="Próximo passo" id="proximo_passo" defaultValue={lead?.proximo_passo ?? ""} placeholder="Ex.: ligar para fechar" />
          <Campo rotulo="Quando" id="proximo_passo_em" type="date" defaultValue={lead?.proximo_passo_em ?? (lead ? "" : amanha)} />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Botao variante="principal" disabled={enviando}>
          {enviando ? "Salvando…" : lead ? "Salvar" : "Criar lead"}
        </Botao>
        {lead && <Retorno estado={estado} />}
      </div>
    </form>
  );
}

export function VirarCliente({ id }: { id: string }) {
  const [estado, acao, enviando] = useActionState(virarCliente, undefined);
  return (
    <form action={acao} className="flex flex-wrap items-center gap-3 rounded-xl bg-ok-soft p-3.5">
      <input type="hidden" name="id" value={id} />
      <div className="min-w-0 flex-1 text-[13px]">
        <b className="text-ok">Fechado!</b> Transforme em cliente para liberar pauta, Central do cliente e portal de aprovação.
      </div>
      <Botao variante="principal" pequeno disabled={enviando}>
        {enviando ? "Criando…" : "Virar cliente"}
      </Botao>
      {estado?.erro && <small className="w-full text-[12.5px] text-bad">{estado.erro}</small>}
    </form>
  );
}

export function Anotar({ leadId }: { leadId: string }) {
  const [estado, acao, enviando] = useActionState(anotar, undefined);
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (estado?.ok) form.current?.reset();
  }, [estado]);
  return (
    <form ref={form} action={acao} className="mt-2 flex gap-2">
      <input type="hidden" name="lead_id" value={leadId} />
      <input name="texto" required aria-label="Registrar contato" placeholder="Registrar ligação, reunião, mensagem" className={classeEntrada} />
      <Botao className="border-ink bg-ink text-bg" disabled={enviando}>
        Registrar
      </Botao>
      {estado?.erro && <small className="text-[12px] text-bad">{estado.erro}</small>}
    </form>
  );
}

export function ExcluirLead({ id, empresa }: { id: string; empresa: string }) {
  const [estado, acao, enviando] = useActionState(excluirLead, undefined);
  return (
    <form
      action={acao}
      onSubmit={(e) => {
        if (!confirm(`Excluir o lead ${empresa}? Não dá para desfazer.`)) e.preventDefault();
      }}
      className="ml-auto flex items-center gap-2"
    >
      <input type="hidden" name="id" value={id} />
      {estado?.erro && <small className="text-[12px] text-bad">{estado.erro}</small>}
      <Botao variante="fantasma" className="text-bad" disabled={enviando}>
        Excluir lead
      </Botao>
    </form>
  );
}
