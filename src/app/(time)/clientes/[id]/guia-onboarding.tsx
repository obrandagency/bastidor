import Link from "next/link";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Icone } from "@/components/icone";
import { iniciarDaCentral } from "../../onboarding/acoes";

type Onboarding = { id: string; etapa_id: string; concluido_em: string | null };
type TarefaOnb = { etapa_id: string; texto: string; feito_em: string | null; ordem: number };

export async function lerOnboarding(supabase: SupabaseClient, clientId: string) {
  const [{ data: onb }, { data: etapas }] = await Promise.all([
    supabase.from("onboardings").select("id, etapa_id, concluido_em").eq("client_id", clientId).maybeSingle<Onboarding>(),
    supabase.from("onboarding_etapas").select("id, nome, ordem").order("ordem").returns<{ id: string; nome: string; ordem: number }[]>(),
  ]);
  const { data: tarefas } = onb
    ? await supabase.from("onboarding_tarefas").select("etapa_id, texto, feito_em, ordem").eq("onboarding_id", onb.id).order("ordem").returns<TarefaOnb[]>()
    : { data: [] as TarefaOnb[] };
  return { onb, etapas: etapas ?? [], tarefas: tarefas ?? [] };
}

// Resumo do onboarding: etapas com ✓, a atual em destaque, barra de progresso e o próximo passo
export function GuiaOnboarding({
  clientId,
  dados,
  gestao,
  sempre,
}: {
  clientId: string;
  dados: Awaited<ReturnType<typeof lerOnboarding>>;
  gestao: boolean;
  sempre?: boolean; // mostra mesmo concluído (página Onboarding)
}) {
  const { onb, etapas, tarefas } = dados;
  if (!onb) {
    if (!gestao && !sempre) return null;
    return (
      <section className="flex flex-wrap items-center gap-3 rounded-xl border border-dashed border-line bg-card px-5 py-4">
        <span className="min-w-0 flex-1 text-[14px] text-muted">Este cliente ainda não tem onboarding.</span>
        {gestao && (
          <form action={iniciarDaCentral}>
            <input type="hidden" name="client_id" value={clientId} />
            <button className="rounded-lg border border-accent bg-accent px-3.5 py-2 text-[13.5px] font-medium text-accent-ink hover:bg-accent-hover">Iniciar onboarding</button>
          </form>
        )}
      </section>
    );
  }
  if (onb.concluido_em && !sempre) return null;

  const ordemAtual = etapas.find((e) => e.id === onb.etapa_id)?.ordem ?? 0;
  const feita = (e: { id: string; ordem: number }) => {
    const da = tarefas.filter((t) => t.etapa_id === e.id);
    return !!onb.concluido_em || e.ordem < ordemAtual || (da.length > 0 && da.every((t) => t.feito_em));
  };
  const prontas = etapas.filter(feita).length;
  const proxima = tarefas.find((t) => t.etapa_id === onb.etapa_id && !t.feito_em) ?? tarefas.find((t) => !t.feito_em);

  return (
    <section className="rounded-xl border border-line bg-card p-5">
      <div className="mb-3 flex flex-wrap items-center gap-2.5">
        <h2 className="text-[16px] font-bold">Guia de onboarding</h2>
        <span className="rounded-full bg-surface px-2 font-mono text-[12px] text-muted">
          {prontas}/{etapas.length}
        </span>
        <span className="flex-1" />
        <Link href={`/onboarding/${onb.id}`} className="text-[13px] text-muted hover:text-ink">
          Abrir onboarding →
        </Link>
      </div>
      <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-surface" role="progressbar" aria-valuemin={0} aria-valuemax={etapas.length} aria-valuenow={prontas} aria-label="Progresso do onboarding">
        <div className="h-full rounded-full bg-accent" style={{ width: `${etapas.length ? (prontas / etapas.length) * 100 : 0}%` }} />
      </div>
      <ol className="flex items-start gap-1 overflow-x-auto pb-1">
        {etapas.map((e, i) => {
          const ok = feita(e);
          const atual = e.id === onb.etapa_id && !onb.concluido_em;
          return (
            <li key={e.id} className="flex min-w-[88px] flex-1 items-start">
              <div className="flex w-full flex-col items-center gap-1.5 text-center">
                <span
                  className={`grid h-10 w-10 place-items-center rounded-full text-[13px] font-semibold ${
                    ok ? "bg-ok text-white" : atual ? "bg-accent text-accent-ink ring-4 ring-accent-soft" : "bg-surface text-muted"
                  }`}
                >
                  {ok ? <Icone nome="portal" className="!h-4 !w-4" /> : i + 1}
                </span>
                <span className={`text-[12px] leading-tight ${ok ? "font-medium text-ok" : atual ? "font-semibold text-accent" : "text-muted"}`}>{e.nome}</span>
              </div>
              {i < etapas.length - 1 && <span aria-hidden="true" className={`mt-5 h-0.5 w-6 flex-none ${ok ? "bg-ok" : "bg-line"}`} />}
            </li>
          );
        })}
      </ol>
      {onb.concluido_em ? (
        <p className="mt-3 border-t border-line pt-3 text-[13.5px] font-medium text-ok">Onboarding concluído.</p>
      ) : (
        proxima && (
          <p className="mt-3 flex items-center gap-2 border-t border-line pt-3 text-[13.5px] text-muted">
            <span className="text-accent">›</span> Próximo passo: <span className="text-ink">{proxima.texto}</span>
          </p>
        )
      )}
    </section>
  );
}
