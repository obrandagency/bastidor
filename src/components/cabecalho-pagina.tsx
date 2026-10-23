import Link from "next/link";
import { IconeQuadrado, type NomeIcone } from "./icone";

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
  // Título grande, uma linha cinza explicando a tela e o botão principal no canto superior direito.
  // O sobretítulo (seção do menu) fica só para leitores de tela.
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
      <div className="min-w-0">
        <div className="sr-only">{sobretitulo}</div>
        <h1 className="text-[26px] font-bold leading-[1.1] tracking-[-0.02em] md:text-[30px]">{titulo}</h1>
        {descricao && <p className="mt-1.5 max-w-[70ch] text-[14px] text-muted">{descricao}</p>}
      </div>
      {acoes && <div className="flex flex-wrap items-center gap-2">{acoes}</div>}
    </div>
  );
}

// Estado vazio: ícone, uma frase curta e (quando houver o que fazer) um botão
export function EstadoVazio({
  children,
  icone = "lista",
  acao,
}: {
  children: React.ReactNode;
  icone?: NomeIcone;
  acao?: { href: string; rotulo: string } | React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-line bg-card px-4 py-10 text-center">
      <IconeQuadrado nome={icone} tom="cinza" grande />
      <p className="max-w-[44ch] text-[14px] text-muted">{children}</p>
      {acao &&
        (typeof acao === "object" && acao !== null && "href" in acao ? (
          <Link href={acao.href} className="rounded-lg border border-accent bg-accent px-3.5 py-2 text-[13.5px] font-medium text-accent-ink hover:border-accent-hover hover:bg-accent-hover">
            {acao.rotulo}
          </Link>
        ) : (
          acao
        ))}
    </div>
  );
}
