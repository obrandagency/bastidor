// Peças de formulário no estilo do protótipo (.field, .inp, .btn)

export function Campo({
  rotulo,
  id,
  dica,
  ...props
}: { rotulo: string; id: string; dica?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="flex min-w-0 flex-col gap-[5px]">
      <label htmlFor={id} className="text-[11.5px] uppercase tracking-[0.04em] text-muted">
        {rotulo}
      </label>
      <input id={id} name={id} className={classeEntrada} {...props} />
      {dica && <small className="text-[12px] text-muted">{dica}</small>}
    </div>
  );
}

export function Selecao({
  rotulo,
  id,
  children,
  ...props
}: { rotulo: string; id: string } & React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="flex min-w-0 flex-col gap-[5px]">
      <label htmlFor={id} className="text-[11.5px] uppercase tracking-[0.04em] text-muted">
        {rotulo}
      </label>
      <select id={id} name={id} className={classeEntrada} {...props}>
        {children}
      </select>
    </div>
  );
}

export const classeEntrada =
  "w-full min-w-0 rounded-lg border border-line bg-card px-2.5 py-2 focus:border-accent focus:shadow-[0_0_0_3px_var(--color-accent-soft)] focus:outline-none";

const VARIANTES = {
  principal: "border-accent bg-accent text-accent-ink hover:brightness-110",
  normal: "border-line bg-card hover:border-ink",
  fantasma: "border-transparent bg-transparent hover:bg-surface",
};

export function Botao({
  variante = "normal",
  pequeno,
  className = "",
  ...props
}: { variante?: keyof typeof VARIANTES; pequeno?: boolean } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg border font-medium disabled:cursor-wait disabled:opacity-60 ${
        pequeno ? "px-2.5 py-[5px] text-[12.5px]" : "px-3.5 py-2"
      } ${VARIANTES[variante]} ${className}`}
      {...props}
    />
  );
}

const TONS = {
  erro: "bg-bad-soft text-bad",
  aviso: "bg-warn-soft text-warn",
  ok: "bg-ok-soft text-ok",
};

export function Aviso({ tom, children }: { tom: keyof typeof TONS; children: React.ReactNode }) {
  return (
    <div role={tom === "erro" ? "alert" : "status"} className={`rounded-lg px-3 py-2.5 text-[13px] ${TONS[tom]}`}>
      {children}
    </div>
  );
}
