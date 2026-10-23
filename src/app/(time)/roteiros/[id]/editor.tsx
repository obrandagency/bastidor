"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, useTransition } from "react";
import { Aviso, Botao, classeEntrada } from "@/components/formulario";
import { cenaVazia, COLUNAS_CENA, FORMATOS_VIDEO, SITUACOES_ROTEIRO, type Cena, type SituacaoRoteiro } from "@/lib/dominio/roteiros";
import { apagarRoteiro, duplicarRoteiro, salvarRoteiro, type DadosRoteiro } from "../acoes";

type Opcao = { id: string; nome: string };

const rotulo = "text-[11.5px] uppercase tracking-[0.04em] text-muted";
const area = `${classeEntrada} resize-y leading-[1.5] [field-sizing:content] min-h-[64px]`;

export function EditorRoteiro({
  id,
  inicial,
  clientes,
  conteudo,
  podeApagar,
}: {
  id: string;
  inicial: DadosRoteiro;
  clientes: Opcao[];
  conteudo: { id: string; titulo: string } | null;
  podeApagar: boolean;
}) {
  const [d, setD] = useState<DadosRoteiro>(inicial);
  const [sujo, setSujo] = useState(false);
  const [aviso, setAviso] = useState<{ tom: "erro" | "ok"; texto: string } | null>(null);
  const [salvando, iniciar] = useTransition();

  const mudar = <K extends keyof DadosRoteiro>(k: K, v: DadosRoteiro[K]) => {
    setD((x) => ({ ...x, [k]: v }));
    setSujo(true);
  };
  const mudarCena = (i: number, k: keyof Cena, v: string) => mudar("cenas", d.cenas.map((c, j) => (j === i ? { ...c, [k]: v } : c)));
  const moverCena = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= d.cenas.length) return;
    const nova = [...d.cenas];
    [nova[i], nova[j]] = [nova[j], nova[i]];
    mudar("cenas", nova);
  };

  const salvar = useCallback(() => {
    iniciar(async () => {
      const r = await salvarRoteiro(id, d);
      if (r?.erro) setAviso({ tom: "erro", texto: r.erro });
      else {
        setSujo(false);
        setAviso({ tom: "ok", texto: "Salvo." });
      }
    });
  }, [id, d]);

  // Ctrl/⌘ + S salva; sair com alterações pede confirmação
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        salvar();
      }
    };
    const sair = (e: BeforeUnloadEvent) => {
      if (sujo) e.preventDefault();
    };
    window.addEventListener("keydown", tecla);
    window.addEventListener("beforeunload", sair);
    return () => {
      window.removeEventListener("keydown", tecla);
      window.removeEventListener("beforeunload", sair);
    };
  }, [salvar, sujo]);

  useEffect(() => {
    if (aviso?.tom !== "ok") return;
    const t = setTimeout(() => setAviso(null), 2500);
    return () => clearTimeout(t);
  }, [aviso]);

  return (
    <div className="flex flex-col gap-5">
      {/* Barra fixa: situação, salvar, PDF */}
      <div className="sticky top-0 z-10 -mx-4 flex flex-wrap items-center gap-2 border-b border-line bg-bg/95 px-4 py-2.5 backdrop-blur md:-mx-7 md:px-7">
        <Link href="/roteiros" className="text-[13px] text-muted hover:text-ink">
          ← Roteiros
        </Link>
        <select
          aria-label="Situação"
          value={d.situacao}
          onChange={(e) => mudar("situacao", e.target.value as SituacaoRoteiro)}
          className="rounded-lg border border-line bg-card px-2 py-1.5 text-[13px]"
        >
          {SITUACOES_ROTEIRO.map((s) => (
            <option key={s.id} value={s.id}>
              {s.rotulo}
            </option>
          ))}
        </select>
        <span className="flex-1" />
        {sujo && <small className="text-[12px] text-warn">Alterações não salvas</small>}
        {aviso && <small className={`text-[12px] ${aviso.tom === "ok" ? "text-ok" : "text-bad"}`}>{aviso.texto}</small>}
        <Botao pequeno variante="principal" disabled={salvando} onClick={salvar}>
          {salvando ? "Salvando…" : "Salvar"}
        </Botao>
        <a
          href={`/imprimir/roteiro/${id}`}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => {
            if (sujo && !confirm("Há alterações não salvas. O PDF sai com a última versão salva. Continuar?")) e.preventDefault();
          }}
          className="rounded-lg border border-line px-2.5 py-[5px] text-[12.5px] font-medium hover:border-ink"
        >
          Baixar PDF
        </a>
      </div>

      {aviso?.tom === "erro" && <Aviso tom="erro">{aviso.texto}</Aviso>}

      <textarea
        value={d.titulo}
        onChange={(e) => mudar("titulo", e.target.value.replace(/\n/g, " "))}
        maxLength={200}
        rows={1}
        aria-label="Título do roteiro"
        placeholder="Título do roteiro"
        className="w-full resize-none border-0 border-b border-transparent bg-transparent font-display text-[26px] font-bold leading-tight [field-sizing:content] focus:border-accent focus:outline-none"
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-[5px]">
          <span className={rotulo}>Cliente</span>
          <select value={d.client_id ?? ""} onChange={(e) => mudar("client_id", e.target.value || null)} className={classeEntrada}>
            <option value="">Interno da agência</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-[5px]">
          <span className={rotulo}>Formato</span>
          <select value={d.formato} onChange={(e) => mudar("formato", e.target.value)} className={classeEntrada}>
            {FORMATOS_VIDEO.map((f) => (
              <option key={f.id} value={f.id}>
                {f.rotulo}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-[5px]">
          <span className={rotulo}>Duração</span>
          <input value={d.duracao} onChange={(e) => mudar("duracao", e.target.value)} maxLength={40} placeholder="Ex.: 30 segundos" className={classeEntrada} />
        </label>
      </div>
      {conteudo && (
        <p className="-mt-2 text-[12.5px] text-muted">
          Ligado ao conteúdo{" "}
          <Link href={`/tarefas?aba=conteudo&tarefa=${conteudo.id}`} className="text-accent hover:underline">
            {conteudo.titulo}
          </Link>
        </p>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        <label className="flex flex-col gap-[5px]">
          <span className={rotulo}>Objetivo</span>
          <textarea value={d.objetivo} onChange={(e) => mudar("objetivo", e.target.value)} maxLength={2000} placeholder="O que o vídeo precisa causar em quem assiste" className={area} />
        </label>
        <label className="flex flex-col gap-[5px]">
          <span className={rotulo}>Referências</span>
          <textarea value={d.referencias} onChange={(e) => mudar("referencias", e.target.value)} maxLength={2000} placeholder="Links e observações" className={area} />
        </label>
      </div>

      {/* Cenas */}
      <section>
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="text-[16px] font-bold">Cenas</h2>
          <span className="font-mono text-[12px] text-muted">{d.cenas.length}</span>
        </div>
        <div className="hidden grid-cols-[34px_90px_repeat(4,minmax(0,1fr))_64px] gap-2 px-1 pb-1.5 lg:grid">
          <span />
          {COLUNAS_CENA.map((c) => (
            <span key={c.id} className={rotulo}>
              {c.rotulo}
            </span>
          ))}
          <span />
        </div>
        <ol className="flex flex-col gap-2">
          {d.cenas.map((c, i) => (
            <li key={i} className="grid grid-cols-1 gap-2 rounded-xl border border-line bg-card p-2.5 lg:grid-cols-[34px_90px_repeat(4,minmax(0,1fr))_64px] lg:items-start lg:rounded-none lg:border-0 lg:border-t lg:bg-transparent lg:px-1 lg:py-2">
              <span className="font-mono text-[13px] font-semibold text-muted lg:pt-2"><span className="lg:sr-only">Cena </span>{i + 1}</span>
              {COLUNAS_CENA.map((col) => (
                <label key={col.id} className="flex flex-col gap-1">
                  <span className={`${rotulo} lg:sr-only`}>{col.rotulo}</span>
                  <textarea
                    value={c[col.id]}
                    onChange={(e) => mudarCena(i, col.id, e.target.value)}
                    rows={col.id === "tempo" ? 1 : 2}
                    placeholder={col.dica}
                    className={`${classeEntrada} resize-y text-[13px] leading-[1.45] [field-sizing:content] ${col.id === "tempo" ? "font-mono" : "min-h-[52px]"}`}
                  />
                </label>
              ))}
              <span className="flex items-center gap-2 text-[13px] lg:flex-col lg:items-end lg:gap-1 lg:pt-1.5">
                <button type="button" onClick={() => moverCena(i, -1)} disabled={i === 0} aria-label={`Subir cena ${i + 1}`} className="text-muted hover:text-ink disabled:opacity-30">
                  ↑
                </button>
                <button type="button" onClick={() => moverCena(i, 1)} disabled={i === d.cenas.length - 1} aria-label={`Descer cena ${i + 1}`} className="text-muted hover:text-ink disabled:opacity-30">
                  ↓
                </button>
                <button type="button" onClick={() => mudar("cenas", [...d.cenas.slice(0, i + 1), { ...c }, ...d.cenas.slice(i + 1)])} className="text-[12px] text-muted hover:text-ink">
                  Duplicar
                </button>
                <button
                  type="button"
                  onClick={() => (!Object.values(c).some(Boolean) || confirm(`Remover a cena ${i + 1}?`)) && mudar("cenas", d.cenas.filter((_, j) => j !== i))}
                  className="text-[12px] text-bad hover:underline"
                >
                  Remover
                </button>
              </span>
            </li>
          ))}
        </ol>
        <button type="button" onClick={() => mudar("cenas", [...d.cenas, cenaVazia()])} className="mt-2 rounded-lg border border-dashed border-line px-3 py-2 text-[13px] font-medium hover:border-ink">
          + Adicionar cena
        </button>
      </section>

      <label className="flex flex-col gap-[5px]">
        <span className={rotulo}>Roteiro corrido (opcional)</span>
        <textarea value={d.texto_livre} onChange={(e) => mudar("texto_livre", e.target.value)} maxLength={20000} placeholder="Para quem prefere escrever o texto inteiro, sem dividir em cenas" className={`${area} min-h-[120px]`} />
      </label>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="flex flex-col gap-[5px]">
          <span className={rotulo}>Chamada para ação (CTA)</span>
          <textarea value={d.cta} onChange={(e) => mudar("cta", e.target.value)} maxLength={500} placeholder="Ex.: Comente QUERO para receber o link" className={area} />
        </label>
        <label className="flex flex-col gap-[5px]">
          <span className="flex items-baseline justify-between">
            <span className={rotulo}>Legenda sugerida</span>
            <span className={`font-mono text-[11.5px] ${d.legenda.length > 2200 ? "text-bad" : "text-muted"}`}>{d.legenda.length.toLocaleString("pt-BR")}/2.200</span>
          </span>
          <textarea value={d.legenda} onChange={(e) => mudar("legenda", e.target.value)} maxLength={2200} className={area} />
        </label>
      </div>

      <div className="flex flex-wrap gap-2 border-t border-line pt-4">
        <Botao pequeno variante="fantasma" onClick={() => iniciar(async () => setAviso((await duplicarRoteiro(id)) ? { tom: "erro", texto: "Não foi possível duplicar." } : null))}>
          Duplicar roteiro
        </Botao>
        {podeApagar && (
          <Botao
            pequeno
            variante="fantasma"
            className="text-bad"
            onClick={() => confirm("Apagar este roteiro? Não dá para desfazer.") && iniciar(async () => setAviso({ tom: "erro", texto: (await apagarRoteiro(id))?.erro ?? "" }))}
          >
            Apagar roteiro
          </Botao>
        )}
      </div>
    </div>
  );
}
