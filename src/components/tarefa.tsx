import { urlMarca } from "@/lib/marca";
import { corDaEtapa, diasEntre, estaAtrasada, FINALIZADAS, rotuloEtapa, type Etapa } from "@/lib/dominio/tarefas";
import { diaMes } from "@/lib/datas";

// Foto da pessoa (bucket "marca") ou as iniciais, quando não tem foto
export function Avatar({ iniciais, nome, grande, foto, classe }: { iniciais: string; nome?: string; grande?: boolean; foto?: string | null; classe?: string }) {
  const tamanho = classe ?? (grande ? "h-11 w-11 text-[15px]" : "h-[26px] w-[26px] text-[10.5px]");
  const url = urlMarca(foto);
  if (url)
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={url} alt={nome ?? ""} title={nome} loading="lazy" className={`inline-block flex-none rounded-full bg-surface object-cover ${tamanho}`} />
    );
  return (
    <span title={nome} className={`inline-grid flex-none place-items-center rounded-full bg-ink font-semibold tracking-[0.02em] text-bg ${tamanho}`}>
      {iniciais}
    </span>
  );
}

// Logo do cliente (bucket "marca") ou a bolinha com a cor e a inicial
export function LogoCliente({ nome, cor, logo, classe = "h-6 w-6 text-[11px]" }: { nome: string; cor: string; logo?: string | null; classe?: string }) {
  const url = urlMarca(logo);
  if (url)
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={url} alt="" title={nome} loading="lazy" className={`inline-block flex-none rounded-full border border-line bg-card object-contain ${classe}`} />
    );
  return (
    <span title={nome} className={`grid flex-none place-items-center rounded-full font-semibold text-white ${classe}`} style={{ background: cor }}>
      {nome.charAt(0).toUpperCase()}
    </span>
  );
}

export function SeloEtapa({ etapa }: { etapa: Etapa }) {
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-full border px-[9px] py-px text-[11.5px] font-medium ${corDaEtapa(etapa)}`}>
      {rotuloEtapa(etapa)}
    </span>
  );
}

// "Atrasado 3d", "Hoje" ou a data dd/mm
export function Prazo({ prazo, etapa, hoje }: { prazo: string | null; etapa: Etapa; hoje: string }) {
  if (!prazo) return <span className="text-muted">Sem prazo</span>;
  if (FINALIZADAS.includes(etapa)) return <span className="font-mono">{diaMes(prazo)}</span>;
  if (estaAtrasada({ prazo, etapa }, hoje)) return <span className="font-semibold text-bad">Atrasado {diasEntre(prazo, hoje)}d</span>;
  if (prazo === hoje) return <span className="font-semibold text-warn">Hoje</span>;
  return <span className="font-mono">{diaMes(prazo)}</span>;
}

// Bolinha com a cor do cliente
export function PontoCliente({ cor }: { cor: string }) {
  return <span className="h-2 w-2 flex-none rounded-full" style={{ background: cor }} />;
}

// Miniatura 4:5 do post na cor do cliente (.tile.sm) ou sigla da área da demanda (.dthumb)
export function Miniatura({ cor, sigla }: { cor: string; sigla?: string }) {
  if (sigla)
    return (
      <span className="grid aspect-[4/5] w-11 flex-none place-items-center rounded-[5px] bg-accent-soft font-display text-[14px] font-bold tracking-[0.02em] text-accent">
        {sigla}
      </span>
    );
  return (
    <span
      className="aspect-[4/5] w-11 flex-none rounded-[5px]"
      style={{ background: `linear-gradient(165deg, color-mix(in srgb, ${cor} 85%, white), color-mix(in srgb, ${cor} 45%, black))` }}
    />
  );
}
