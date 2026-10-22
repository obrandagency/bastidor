export function Marca({ subtitulo }: { subtitulo: string }) {
  return (
    <div className="flex items-center gap-2.5 px-1.5 py-0.5">
      <span className="grid h-[30px] w-[30px] place-items-center rounded-lg bg-accent font-display text-[17px] font-bold text-accent-ink">
        B
      </span>
      <div>
        <div className="font-display text-[19px] font-bold leading-tight tracking-[-0.02em]">Bastidor</div>
        <div className="text-[11px] uppercase tracking-[0.06em] text-rail-muted">{subtitulo}</div>
      </div>
    </div>
  );
}
