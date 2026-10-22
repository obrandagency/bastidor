export function CabecalhoPagina({
  sobretitulo,
  titulo,
  descricao,
  acoes,
}: {
  sobretitulo: string;
  titulo: string;
  descricao?: string;
  acoes?: React.ReactNode;
}) {
  return (
    <div className="mb-[22px] flex flex-wrap items-end justify-between gap-4">
      <div>
        <div className="mb-1.5 text-[11px] uppercase tracking-[0.12em] text-muted">{sobretitulo}</div>
        <h1 className="text-[25px] font-bold leading-[1.1] md:text-[30px]">{titulo}</h1>
        {descricao && <p className="mt-1.5 max-w-[62ch] text-muted">{descricao}</p>}
      </div>
      {acoes}
    </div>
  );
}

export function EstadoVazio({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-line bg-surface px-4 py-10 text-center text-[13px] text-muted">
      {children}
    </div>
  );
}
