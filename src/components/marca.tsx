import { urlMarca, type Identidade } from "@/lib/marca";

// Logo (ou a inicial do sistema) + nome do sistema + linha de baixo (nome da agência, por padrão).
// textoClasse esconde o nome quando o menu está recolhido
export function Marca({ identidade, subtitulo, textoClasse = "" }: { identidade: Identidade; subtitulo?: string; textoClasse?: string }) {
  const logo = urlMarca(identidade.logo);
  return (
    <div className="flex items-center gap-2.5 px-1.5 py-0.5">
      {logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logo} alt={identidade.nome_agencia} className="h-[34px] w-auto max-w-[96px] flex-none object-contain" />
      ) : (
        <span className="grid h-[30px] w-[30px] flex-none place-items-center rounded-lg bg-accent font-display text-[17px] font-bold text-accent-ink">
          {identidade.nome_sistema.charAt(0).toUpperCase()}
        </span>
      )}
      <div className={`min-w-0 ${textoClasse}`}>
        <div className="truncate font-display text-[19px] font-bold leading-tight tracking-[-0.02em]">{identidade.nome_sistema}</div>
        <div className="truncate text-[11px] uppercase tracking-[0.06em] text-rail-muted">{subtitulo ?? identidade.nome_agencia}</div>
      </div>
    </div>
  );
}
