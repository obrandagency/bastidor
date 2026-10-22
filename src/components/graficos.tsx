// Gráficos simples de uma série (barras), no padrão do protótipo e do guia de visualização:
// uma cor (azul da marca), barras finas com ponta arredondada e base reta, valor em texto ao lado.

export type Barra = { rotulo: string; valor: number; detalhe?: string; cor?: string };

const numero = (n: number) => n.toLocaleString("pt-BR");

// Lista de barras horizontais (ranking): rótulo, barra e valor
export function BarrasHorizontais({ itens, unidade, vazio = "Sem dados no período." }: { itens: Barra[]; unidade?: string; vazio?: string }) {
  if (itens.length === 0) return <p className="text-[13px] text-muted">{vazio}</p>;
  const maior = Math.max(1, ...itens.map((i) => i.valor));
  return (
    <ul className="flex flex-col gap-[7px]">
      {itens.map((i) => (
        <li
          key={i.rotulo}
          title={`${i.rotulo}: ${numero(i.valor)}${unidade ? ` ${unidade}` : ""}${i.detalhe ? ` · ${i.detalhe}` : ""}`}
          className="grid grid-cols-[minmax(0,120px)_minmax(0,1fr)_auto] items-center gap-2.5 rounded-md px-1 py-0.5 text-[12.5px] hover:bg-surface"
        >
          <span className="flex min-w-0 items-center gap-1.5">
            {i.cor && <span className="h-2 w-2 flex-none rounded-full" style={{ background: i.cor }} />}
            <span className="truncate">{i.rotulo}</span>
          </span>
          <span className="h-2.5 min-w-0">
            <i className="block h-full rounded-r-[4px] bg-accent" style={{ width: `${Math.max(i.valor > 0 ? 2 : 0, (i.valor / maior) * 100)}%` }} />
          </span>
          <span className="text-right font-mono text-[12px] text-ink">
            {numero(i.valor)}
            {i.detalhe && <span className="text-muted"> {i.detalhe}</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}

// Colunas verticais (ex.: alcance por semana), valor em cima de cada coluna
export function Colunas({ itens }: { itens: Barra[] }) {
  if (itens.length === 0) return <p className="text-[13px] text-muted">Sem dados no período.</p>;
  const maior = Math.max(1, ...itens.map((i) => i.valor));
  return (
    <div className="flex h-[180px] items-end gap-3">
      {itens.map((i) => (
        <div key={i.rotulo} title={`${i.rotulo}: ${numero(i.valor)}`} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1.5">
          <span className="font-mono text-[11.5px] text-ink">{numero(i.valor)}</span>
          <span className="flex min-h-0 w-full flex-1 items-end justify-center">
            <i className="block w-full max-w-[24px] rounded-t-[4px] bg-accent" style={{ height: `${Math.max(2, (i.valor / maior) * 100)}%` }} />
          </span>
          <small className="w-full border-t border-line pt-1 text-center text-[11px] text-muted">{i.rotulo}</small>
        </div>
      ))}
    </div>
  );
}

// Número em destaque com rótulo (bloco do topo das telas)
export function Numero({
  valor,
  rotulo,
  destaque,
  alerta,
  extra,
}: {
  valor: string;
  rotulo: React.ReactNode;
  destaque?: boolean;
  alerta?: boolean;
  extra?: React.ReactNode;
}) {
  return (
    <div className={`rounded-xl border px-4 py-3.5 ${destaque ? "border-ink bg-ink text-bg" : "border-line bg-card"}`}>
      <b className={`block font-display text-[26px] font-bold leading-[1.1] tabular-nums md:text-[30px] ${alerta ? "text-bad" : ""}`}>{valor}</b>
      <span className="text-[12.5px] opacity-75">{rotulo}</span>
      {extra}
    </div>
  );
}
