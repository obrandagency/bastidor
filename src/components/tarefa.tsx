import { corDaEtapa, diasEntre, estaAtrasada, FINALIZADAS, rotuloEtapa, type Etapa } from "@/lib/dominio/tarefas";
import { diaMes } from "@/lib/datas";

export function Avatar({ iniciais, nome, grande }: { iniciais: string; nome?: string; grande?: boolean }) {
  return (
    <span
      title={nome}
      className={`inline-grid flex-none place-items-center rounded-full bg-ink font-semibold tracking-[0.02em] text-bg ${
        grande ? "h-11 w-11 text-[15px]" : "h-[26px] w-[26px] text-[10.5px]"
      }`}
    >
      {iniciais}
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
