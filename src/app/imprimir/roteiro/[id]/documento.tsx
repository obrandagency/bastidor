import { dataBR } from "@/lib/datas";
import { dataHoraSP } from "@/lib/dominio/tarefas";
import { COLUNAS_CENA, rotuloFormatoVideo, situacaoRoteiro, type Cena, type Roteiro } from "@/lib/dominio/roteiros";
import { BotaoImprimir } from "./imprimir";

export type Docs = { nome_agencia: string; logo: string | null; cor: string; timbrado: string | null; margem_topo: number; margem_base: number; rodape: string };

const LARGURA: Partial<Record<string, string>> = { tempo: "w-[17mm]", texto_tela: "w-[26mm]", audio: "w-[24mm]" };

function Bloco({ titulo, texto }: { titulo: string; texto: string }) {
  if (!texto.trim()) return null;
  return (
    <section className="mt-5 break-inside-avoid">
      <h2 className="mb-1 text-[11pt] font-bold uppercase tracking-[0.06em] text-accent">{titulo}</h2>
      <p className="whitespace-pre-line text-[10.5pt] leading-[1.5]">{texto}</p>
    </section>
  );
}

// Folha A4 do roteiro: com timbrado (imagem de fundo em todas as páginas) ou com logo e rodapé
// timbrado e logo já vêm como endereço da imagem
export function DocumentoRoteiro({ r, cenas, docs, cliente, timbrado, logo }: { r: Roteiro; cenas: Cena[]; docs: Docs | null; cliente: string | null; timbrado: string | null; logo: string | null }) {
  const topo = docs?.margem_topo ?? 35;
  const base = docs?.margem_base ?? 25;
  const lista = cenas.filter((c) => Object.values(c).some((v) => v.trim()));
  const colunas = COLUNAS_CENA.filter((col) => lista.some((c) => c[col.id].trim())); // só as colunas usadas
  // Rodapé e número da página nas margens da folha (caixas de margem do @page)
  const textoCss = (t: string) => `"${t.replace(/[\\"]/g, "").replace(/[\r\n]+/g, " ")}"`;
  // O timbrado é o fundo da folha inteira, repetido em todas as páginas. O Chrome conta a posição a partir
  // do canto da área de texto, por isso o deslocamento negativo igual às margens
  const fundo = timbrado ? `background: url("${encodeURI(timbrado)}") no-repeat -16mm -${topo}mm / 210mm 297mm;` : "";
  const numero = timbrado ? "" : `@bottom-right { content: counter(page) " / " counter(pages); font-size: 8pt; color: #6B7280; }`;
  const rodape = !timbrado && docs?.rodape ? `@bottom-center { content: ${textoCss(docs.rodape)}; font-size: 8pt; color: #6B7280; }` : "";

  return (
    <div className="mx-auto max-w-[210mm] px-4 py-6 print:max-w-none print:p-0">
      {/* Margens da página = área livre do timbrado; o fundo é posicionado sobre a folha inteira */}
      <style>{`
        @page { size: A4; margin: ${topo}mm 16mm ${base}mm 16mm; ${fundo} ${rodape} ${numero} }
        @media print {
          html, body { background: transparent !important; }
          * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          thead { display: table-header-group; }
          tr { break-inside: avoid; }
        }
      `}</style>
      <BotaoImprimir />

      {/* Pré-carrega o timbrado para a impressão não sair sem ele */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {timbrado && <img src={timbrado} alt="" className="hidden" />}

      <article className="relative text-[10.5pt] text-ink" style={{ fontFamily: "var(--font-sans)" }}>
        {!timbrado && (
          <header className="mb-6 flex items-center justify-between gap-4 border-b-2 border-accent pb-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {logo ? <img src={logo} alt={docs?.nome_agencia} className="h-[14mm] w-auto object-contain" /> : <b className="font-display text-[16pt]">{docs?.nome_agencia}</b>}
            <span className="text-[9pt] uppercase tracking-[0.1em] text-muted">Roteiro de vídeo</span>
          </header>
        )}

        <h1 className="font-display text-[20pt] font-bold leading-tight">{r.titulo}</h1>
        <dl className="mt-3 grid grid-cols-[auto_1fr_auto_1fr] gap-x-4 gap-y-1 text-[9.5pt]">
          <dt className="text-muted">Cliente</dt>
          <dd>{cliente ?? "Interno da agência"}</dd>
          <dt className="text-muted">Formato</dt>
          <dd>
            {rotuloFormatoVideo(r.formato)}
            {r.duracao ? ` · ${r.duracao}` : ""}
          </dd>
          <dt className="text-muted">Situação</dt>
          <dd>{situacaoRoteiro(r.situacao).rotulo}</dd>
          <dt className="text-muted">Atualizado em</dt>
          <dd>{dataBR(dataHoraSP(r.updated_at).data)}</dd>
        </dl>

        <Bloco titulo="Objetivo" texto={r.objetivo} />
        <Bloco titulo="Referências" texto={r.referencias} />

        {lista.length > 0 && (
          <section className="mt-6">
            <h2 className="mb-2 text-[11pt] font-bold uppercase tracking-[0.06em] text-accent">Cenas</h2>
            <table className="w-full border-collapse text-[9.5pt] leading-[1.4]">
              <thead>
                <tr className="text-left">
                  <th className="w-[9mm] border-b-2 border-accent py-1.5 pr-2 align-bottom">#</th>
                  {colunas.map((col) => (
                    <th key={col.id} className={`border-b-2 border-accent py-1.5 pr-2 align-bottom font-semibold ${LARGURA[col.id] ?? ""}`}>
                      {col.rotulo}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lista.map((c, i) => (
                  <tr key={i} className="border-b border-line align-top">
                    <td className="py-2 pr-2 font-mono font-semibold text-muted">{i + 1}</td>
                    {colunas.map((col) => (
                      <td key={col.id} className={`whitespace-pre-line break-words py-2 pr-2 ${col.id === "tempo" ? "font-mono" : ""}`}>
                        {c[col.id]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        <Bloco titulo="Roteiro" texto={r.texto_livre} />
        <Bloco titulo="Chamada para ação" texto={r.cta} />
        <Bloco titulo="Legenda sugerida" texto={r.legenda} />
      </article>

      {!timbrado && docs?.rodape && <footer className="mt-8 border-t border-line pt-2 text-center text-[8pt] text-muted print:hidden">{docs.rodape}</footer>}
    </div>
  );
}
