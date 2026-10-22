import { Marca } from "@/components/marca";

export function CartaoEntrada({
  titulo,
  descricao,
  children,
}: {
  titulo: string;
  descricao?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid min-h-full place-items-center bg-surface px-4 py-10">
      <div className="w-full max-w-[400px]">
        <div className="mb-6">
          <Marca subtitulo="O.BRAND" />
        </div>
        <div className="rounded-xl border border-line bg-card p-6">
          <h1 className="text-[22px] font-bold leading-tight">{titulo}</h1>
          {descricao && <p className="mt-1.5 text-muted">{descricao}</p>}
          <div className="mt-5">{children}</div>
        </div>
      </div>
    </div>
  );
}
