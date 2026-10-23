"use client";

import { useActionState, useState } from "react";
import { Aviso, Botao, Campo } from "@/components/formulario";
import { contraste, CONTRASTE_MINIMO, tonsDaCor, type Identidade } from "@/lib/marca";
import { salvarIdentidade } from "./acoes";

const valida = (c: string) => /^#[0-9A-Fa-f]{6}$/.test(c);

export function FormIdentidade({ identidade }: { identidade: Identidade }) {
  const [estado, acao, enviando] = useActionState(salvarIdentidade, undefined);
  const [cor, setCor] = useState(identidade.cor);
  const ok = valida(cor);
  const legivel = ok && contraste(cor, "#FFFFFF") >= CONTRASTE_MINIMO;
  const t = tonsDaCor(ok ? cor.toUpperCase() : identidade.cor);

  return (
    <form action={acao} className="flex flex-col gap-4">
      {estado?.erro && <Aviso tom="erro">{estado.erro}</Aviso>}
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo rotulo="Nome da agência" id="nome_agencia" required maxLength={40} defaultValue={identidade.nome_agencia} dica="Aparece no portal, nos e-mails e nos termos" />
        <Campo rotulo="Nome do sistema" id="nome_sistema" required maxLength={30} defaultValue={identidade.nome_sistema} dica="Aparece no menu, na aba do navegador e nos e-mails" />
      </div>

      <div className="flex flex-col gap-[5px]">
        <label htmlFor="cor" className="text-[11.5px] uppercase tracking-[0.04em] text-muted">
          Cor principal
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <input type="color" aria-label="Escolher cor" value={ok ? cor : identidade.cor} onChange={(e) => setCor(e.target.value.toUpperCase())} className="h-10 w-12 cursor-pointer rounded-lg border border-line bg-card" />
          <input
            id="cor"
            name="cor"
            value={cor}
            onChange={(e) => setCor(e.target.value)}
            maxLength={7}
            className="w-[110px] rounded-lg border border-line bg-card px-2.5 py-2 font-mono uppercase focus:border-accent focus:outline-none"
          />
          <button type="button" onClick={() => setCor("#1E4BFF")} className="text-[12.5px] text-muted hover:text-ink">
            Voltar ao azul original
          </button>
        </div>
        <small className={`text-[12px] ${legivel ? "text-muted" : "text-bad"}`}>
          {!ok ? "Use o formato #RRGGBB." : legivel ? "Botões, links, seleção e gráficos usam esta cor." : "Clara demais para ler no fundo branco. Escolha um tom mais escuro."}
        </small>
      </div>

      {/* Prévia com a cor ainda não salva */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface p-3.5">
        <span className="rounded-lg px-3.5 py-2 font-medium" style={{ background: t.cor, color: t.texto }}>
          Botão
        </span>
        <span className="font-medium underline" style={{ color: t.cor }}>
          Link
        </span>
        <span className="rounded-full px-2.5 py-0.5 text-[12px] font-medium" style={{ background: t.suave, color: t.cor }}>
          Selo
        </span>
        <span className="h-2 w-28 overflow-hidden rounded-full bg-card">
          <i className="block h-full w-2/3 rounded-full" style={{ background: t.cor }} />
        </span>
      </div>

      <div className="flex items-center gap-3">
        <Botao variante="principal" disabled={enviando || !legivel}>
          {enviando ? "Salvando…" : "Salvar"}
        </Botao>
        {estado?.ok && <small className="text-[12.5px] text-ok">{estado.ok} Pode levar alguns segundos para aparecer em tudo.</small>}
      </div>
    </form>
  );
}
