// Leitura para quem não edita (Criação)
export function Texto({ rotulo, valor }: { rotulo: string; valor?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11.5px] uppercase tracking-[0.04em] text-muted">{rotulo}</span>
      <p className="whitespace-pre-line">{valor || <span className="text-muted">Não preenchido.</span>}</p>
    </div>
  );
}
