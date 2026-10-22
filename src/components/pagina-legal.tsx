import Link from "next/link";
import { Marca } from "@/components/marca";

export function PaginaLegal({ titulo, atualizada, children }: { titulo: string; atualizada: string; children: React.ReactNode }) {
  return (
    <div className="min-h-full bg-bg">
      <div className="mx-auto max-w-[720px] px-4 pb-16 pt-8 md:px-7">
        <Link href="/" className="inline-block">
          <Marca subtitulo="O.BRAND" />
        </Link>
        <h1 className="mt-8 text-[28px] font-bold leading-tight">{titulo}</h1>
        <p className="mt-1 text-[12.5px] text-muted">Atualizada em {atualizada}</p>
        <div className="mt-6 flex flex-col gap-4 leading-[1.65] [&_h2]:mt-3 [&_h2]:text-[17px] [&_h2]:font-bold [&_li]:ml-5 [&_li]:list-disc">
          {children}
        </div>
        <p className="mt-10 text-[12.5px] text-muted">
          <Link href="/privacidade" className="hover:underline">Política de privacidade</Link> ·{" "}
          <Link href="/termos" className="hover:underline">Termos de uso</Link>
        </p>
      </div>
    </div>
  );
}
