import { cookies } from "next/headers";
import { Suspense } from "react";
import { Lembretes } from "@/components/lembretes";
import { Rastreador, type ContagemLigada, type ContagemRecente } from "@/components/rastreador";
import { hojeSP } from "@/lib/datas";
import { FINALIZADAS } from "@/lib/dominio/tarefas";
import { segundosEntre } from "@/lib/dominio/tempo";
import { MenuLateral } from "@/components/menu-lateral";
import { lerIdentidade } from "@/lib/identidade";
import { exigirTime } from "@/lib/sessao";
import { criarClienteServidor } from "@/lib/supabase/server";
import type { Lembrete } from "./lembretes/acoes";

export default async function LayoutTime({ children }: { children: React.ReactNode }) {
  const pessoa = await exigirTime();
  const supabase = await criarClienteServidor();
  const inicioHoje = new Date(`${hojeSP()}T00:00:00-03:00`).toISOString();
  const [{ count }, { data: naoLidas }, identidade, { data: lembretes }, { data: clientes }, { data: abertas }, { data: contagens }] = await Promise.all([
    supabase.from("notifications").select("id", { count: "exact", head: true }).is("lida_em", null),
    supabase.rpc("chat_nao_lidas"),
    lerIdentidade(),
    supabase.from("lembretes").select("id, texto, quando, repetir, client_id, task_id, avisado_em").is("concluido_em", null).order("quando").returns<Lembrete[]>(),
    supabase.from("clients").select("id, nome").eq("ativo", true).order("nome"),
    // Rastreador: tarefas em aberto para escolher e as minhas contagens recentes
    supabase
      .from("tasks")
      .select("id, tipo, titulo, responsavel_id, clients(nome)")
      .not("etapa", "in", `(${FINALIZADAS.join(",")})`)
      .order("prazo", { nullsFirst: false })
      .limit(500)
      .returns<{ id: string; tipo: string; titulo: string; responsavel_id: string | null; clients: { nome: string } | null }[]>(),
    supabase
      .from("tempo_registros")
      .select("id, task_id, inicio, fim, tasks(titulo, tipo, clients(nome))")
      .eq("pessoa_id", pessoa.id)
      .order("inicio", { ascending: false })
      .limit(40)
      .returns<{ id: string; task_id: string; inicio: string; fim: string | null; tasks: { titulo: string; tipo: string; clients: { nome: string } | null } | null }[]>(),
  ]);
  const nomeCliente = (c: { nome: string } | null | undefined) => c?.nome ?? "Interno da agência";
  const minhas = contagens ?? [];
  const aberta = minhas.find((r) => !r.fim);
  const ligada: ContagemLigada | null = aberta
    ? { taskId: aberta.task_id, tipo: aberta.tasks?.tipo ?? "demanda", titulo: aberta.tasks?.titulo ?? "Tarefa", cliente: nomeCliente(aberta.tasks?.clients), inicio: aberta.inicio }
    : null;
  const encerradas = minhas.filter((r) => r.fim);
  const hojeSegundos = encerradas.filter((r) => r.inicio >= inicioHoje).reduce((a, r) => a + segundosEntre(r.inicio, r.fim), 0);
  const vistas = new Set<string>();
  const recentes: ContagemRecente[] = encerradas
    .filter((r) => !vistas.has(r.task_id) && vistas.add(r.task_id))
    .slice(0, 5)
    .map((r) => ({ id: r.id, taskId: r.task_id, tipo: r.tasks?.tipo ?? "demanda", titulo: r.tasks?.titulo ?? "Tarefa", cliente: nomeCliente(r.tasks?.clients), segundos: segundosEntre(r.inicio, r.fim) }));
  const chat = ((naoLidas ?? []) as { total: number }[]).reduce((a, n) => a + Number(n.total), 0);
  return (
    <>
      <MenuLateral
        pessoa={{ nome: pessoa.nome, iniciais: pessoa.iniciais, perfil: pessoa.perfil, foto: pessoa.foto }}
        identidade={identidade}
        avisos={count ?? 0}
        contagens={{ "/chat": chat }}
        recolhidoInicial={(await cookies()).get("menu_recolhido")?.value === "1"}
      >
        {children}
      </MenuLateral>
      {/* Botão flutuante de lembretes (pessoais; usa a tarefa aberta na URL) */}
      <Suspense>
        <Lembretes lembretes={lembretes ?? []} clientes={clientes ?? []} />
        <Rastreador
          tarefas={(abertas ?? []).map((t) => ({ id: t.id, tipo: t.tipo, titulo: t.titulo, cliente: nomeCliente(t.clients), minha: t.responsavel_id === pessoa.id }))}
          ligada={ligada}
          hoje={hojeSegundos}
          recentes={recentes}
        />
      </Suspense>
    </>
  );
}
