import { IconeQuadrado, type NomeIcone, type TomIcone } from "./icone";

// Card branco com borda fina e cantos de 12 px; o ícone fica num quadradinho colorido ao lado do título
export function Painel({
  titulo,
  extra,
  children,
  semPadding,
  icone,
  tom,
}: {
  titulo: string;
  extra?: React.ReactNode;
  children: React.ReactNode;
  semPadding?: boolean;
  icone?: NomeIcone;
  tom?: TomIcone;
}) {
  return (
    <section className="min-w-0 rounded-xl border border-line bg-card">
      <div className="flex items-center justify-between gap-2.5 border-b border-line px-4 py-3">
        <h2 className="flex min-w-0 items-center gap-2.5 text-[15px] font-bold">
          {icone && <IconeQuadrado nome={icone} tom={tom} />}
          {titulo}
        </h2>
        {extra}
      </div>
      <div className={semPadding ? "" : "px-4 py-3.5"}>{children}</div>
    </section>
  );
}

// Linha "rótulo ... valor" (.row do protótipo)
export function Linha({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 border-t border-line px-4 py-[11px] first:border-t-0">
      <div className="min-w-0 flex-1">{rotulo}</div>
      <b className="font-mono font-medium">{children}</b>
    </div>
  );
}
