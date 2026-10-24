import type { NomeIcone, TomIcone } from "@/components/icone";
import { diaMes, hojeSP, mesPorExtenso, somarMes } from "@/lib/datas";
import { estaAtrasada, FINALIZADAS, type Etapa } from "@/lib/dominio/tarefas";
import { segundosEntre } from "@/lib/dominio/tempo";
import type { Pessoa, Tarefa } from "@/types/banco";
import type { TarefaResumo } from "../../inicio/resumo";
import { DetalheTarefa } from "../../tarefas/detalhe-tarefa";
import { lerCliente } from "./dados";
import { GuiaOnboarding, lerOnboarding } from "./guia-onboarding";
import { TelaInicioCliente } from "./tela-inicio";

export const metadata = { title: "Central do cliente" };

const EM_PRODUCAO: Etapa[] = ["pauta", "copy", "layout", "revisao", "ajuste"];

// Início do cliente: o que está acontecendo com a conta agora
export default async function InicioCliente({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tarefa?: string }> }) {
  const { id } = await params;
  const { tarefa } = await searchParams;
  const { eu, gestao, cliente, supabase } = await lerCliente(id);
  const hoje = hojeSP();
  const mes = hoje.slice(0, 7);
  const base = `/clientes/${id}`;

  const [{ data: abertas }, { data: comHoras }, { data: time }, onboarding] = await Promise.all([
    supabase.from("tasks").select("*").eq("client_id", id).not("etapa", "in", "(aprovado,concluido)").order("prazo").returns<Tarefa[]>(),
    // Contagens do rastreador encerradas no mês, em tarefas deste cliente
    supabase
      .from("tempo_registros")
      .select("pessoa_id, inicio, fim, tasks!inner(client_id)")
      .eq("tasks.client_id", id)
      .not("fim", "is", null)
      .gte("inicio", new Date(`${mes}-01T00:00:00-03:00`).toISOString())
      .lt("inicio", new Date(`${somarMes(mes, 1)}-01T00:00:00-03:00`).toISOString()),
    supabase.from("profiles").select("*").neq("perfil", "cliente").returns<Pessoa[]>(),
    lerOnboarding(supabase, id),
  ]);
  const lista = abertas ?? [];
  const pessoaPor = new Map((time ?? []).map((p) => [p.id, p]));

  const demandas = lista.filter((t) => t.tipo === "demanda");
  const producao = lista.filter((t) => t.tipo === "conteudo" && EM_PRODUCAO.includes(t.etapa));
  const aprovar = lista.filter((t) => t.etapa === "cliente");
  const agendados = lista.filter((t) => t.etapa === "agendado");
  const atrasadas = lista.filter((t) => estaAtrasada(t, hoje));
  const horasPor = new Map<string, number>();
  for (const r of comHoras ?? []) {
    const k = r.pessoa_id ?? "";
    horasPor.set(k, (horasPor.get(k) ?? 0) + segundosEntre(r.inicio, r.fim) / 3600);
  }
  const horasMes = [...horasPor.values()].reduce((a, n) => a + n, 0);
  const pendentes = demandas.length + producao.length;

  const resumo = (t: Tarefa): TarefaResumo => {
    const r = t.responsavel_id ? pessoaPor.get(t.responsavel_id) : null;
    return {
      id: t.id,
      titulo: t.titulo,
      cliente: { nome: cliente.nome, cor: cliente.cor, logo: cliente.logo ?? null },
      etapa: t.etapa,
      prazo: t.prazo ? diaMes(t.prazo) : null,
      atrasada: estaAtrasada(t, hoje),
      minha: t.responsavel_id === eu.id,
      resp: r ? { nome: r.nome, iniciais: r.iniciais, foto: r.foto } : null,
      href: `${base}?tarefa=${t.id}`,
    };
  };

  const frase = [
    `${demandas.length} tarefa${demandas.length === 1 ? "" : "s"} pendente${demandas.length === 1 ? "" : "s"}`,
    `${aprovar.length} conteúdo${aprovar.length === 1 ? "" : "s"} aguardando aprovação`,
  ].join(" e ");
  const numeros: [number | string, string, NomeIcone, TomIcone][] = [
    [demandas.length, "Tarefas pendentes", "tarefas", "azul"],
    [producao.length, "Em produção", "roteiros", "violeta"],
    [aprovar.length, "Aguardando aprovação", "relogio", "ambar"],
    [agendados.length, "Agendados", "calendario", "verde"],
    [atrasadas.length, "Atrasadas", "alerta", "vermelho"],
    [horasMes.toLocaleString("pt-BR", { maximumFractionDigits: 1 }), "Horas no mês", "dashboards", "cinza"],
  ];
  const tempo = [...horasPor.entries()]
    .map(([pid, h]) => ({ pessoa: pid ? pessoaPor.get(pid) : undefined, horas: h }))
    .sort((a, b) => b.horas - a.horas);

  return (
    <>
      <TelaInicioCliente
        id={id}
        cliente={{ nome: cliente.nome, cor: cliente.cor, logo: cliente.logo ?? null }}
        frase={frase}
        pendentes={pendentes}
        guia={<GuiaOnboarding clientId={id} dados={onboarding} gestao={gestao} />}
        numeros={numeros}
        demandas={demandas.map(resumo)}
        conteudos={lista.filter((t) => t.tipo === "conteudo" && !FINALIZADAS.includes(t.etapa)).map(resumo)}
        tempo={tempo.map(({ pessoa, horas }) => ({ pessoa: pessoa ? { id: pessoa.id, nome: pessoa.nome, iniciais: pessoa.iniciais, foto: pessoa.foto } : null, horas }))}
        horasMes={horasMes}
        mes={mesPorExtenso(hoje)}
      />
      {tarefa && <DetalheTarefa id={tarefa} fechar={base} podeExcluir={gestao} />}
    </>
  );
}
