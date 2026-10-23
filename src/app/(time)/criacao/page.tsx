import Link from "next/link";
import { CabecalhoPagina, EstadoVazio } from "@/components/cabecalho-pagina";
import { Miniatura, SeloEtapa } from "@/components/tarefa";
import { linksDasArtes } from "@/lib/artes";
import { dataHoraSP, rotuloFormato } from "@/lib/dominio/tarefas";
import { exigirTime } from "@/lib/sessao";
import { criarClienteServidor } from "@/lib/supabase/server";
import type { Arte, ClienteCompleto, Nota, Tarefa } from "@/types/banco";
import { SeletorClienteCriacao } from "./seletor";
import { EditorCriacao } from "./editor";

export const metadata = { title: "Criação" };

export default async function Criacao({ searchParams }: { searchParams: Promise<{ cliente?: string; conteudo?: string }> }) {
  await exigirTime();
  const busca = await searchParams;
  const supabase = await criarClienteServidor();

  const { data: clientes } = await supabase.from("clients").select("*").eq("ativo", true).order("nome").returns<ClienteCompleto[]>();
  const cliente = (clientes ?? []).find((c) => c.id === busca.cliente) ?? clientes?.[0];

  const cabecalho = (
    <CabecalhoPagina
      sobretitulo="Operação"
      titulo="Criação"
      descricao="Escreva a legenda e veja como o post fica no feed do cliente enquanto produz."
    />
  );
  if (!cliente) return (<>{cabecalho}<EstadoVazio icone="clientes" acao={{ href: "/clientes", rotulo: "Abrir a Central do cliente" }}>Cadastre um cliente para começar a criar.</EstadoVazio></>);

  const [{ data: producao }, { data: publicados }] = await Promise.all([
    supabase.from("tasks").select("*").eq("client_id", cliente.id).eq("tipo", "conteudo")
      .not("etapa", "in", "(aprovado,agendado)").order("prazo", { nullsFirst: false }).returns<Tarefa[]>(),
    supabase.from("tasks").select("*").eq("client_id", cliente.id).eq("tipo", "conteudo")
      .in("etapa", ["aprovado", "agendado"]).order("updated_at", { ascending: false }).limit(20).returns<Tarefa[]>(),
  ]);
  const lista = producao ?? [];
  const atual = lista.find((t) => t.id === busca.conteudo) ?? lista[0];

  // Feed: aprovados e agendados, do mais novo para o mais antigo (dia da publicação ou prazo)
  const dia = (t: Tarefa) => (t.etapa === "agendado" && t.publicar_em ? dataHoraSP(t.publicar_em).data : (t.prazo ?? ""));
  const feedTarefas = (publicados ?? []).sort((a, b) => dia(b).localeCompare(dia(a))).slice(0, 8);

  const ids = [...(atual ? [atual.id] : []), ...feedTarefas.map((t) => t.id)];
  const [{ data: artes }, { data: notas }, { data: pessoas }] = await Promise.all([
    ids.length
      ? supabase.from("task_assets").select("*").in("task_id", ids).order("ordem").order("created_at").returns<Arte[]>()
      : Promise.resolve({ data: [] as Arte[] }),
    atual ? supabase.from("task_notes").select("*").eq("task_id", atual.id).order("created_at").returns<Nota[]>() : Promise.resolve({ data: [] as Nota[] }),
    supabase.from("profiles").select("id, nome").neq("perfil", "cliente"),
  ]);
  const artesDe = (id: string) => (artes ?? []).filter((a) => a.task_id === id);
  const links = await linksDasArtes([...(atual ? artesDe(atual.id) : []), ...feedTarefas.map((t) => artesDe(t.id)[0]).filter(Boolean)].map((a) => a.caminho));
  const autores = Object.fromEntries((pessoas ?? []).map((p) => [p.id, p.nome]));

  return (
    <>
      {cabecalho}
      <div className="mb-4">
        <SeletorClienteCriacao atual={cliente.id} clientes={(clientes ?? []).map((c) => ({ id: c.id, nome: c.nome }))} />
      </div>
      <div className="grid items-start gap-4 min-[1181px]:grid-cols-[240px_minmax(0,1fr)_320px] min-[861px]:grid-cols-[minmax(0,1fr)_300px]">
        <section className="min-w-0 rounded-xl border border-line bg-card min-[861px]:col-span-2 min-[1181px]:col-span-1">
          <div className="flex items-center justify-between border-b border-line px-4 py-3.5">
            <h2 className="text-[15px] font-bold">Em produção</h2>
            <span className="font-mono text-[12px] text-muted">{lista.length}</span>
          </div>
          <div className="max-h-[260px] overflow-y-auto min-[1181px]:max-h-none">
            {lista.map((t) => (
              <Link
                key={t.id}
                href={`/criacao?cliente=${cliente.id}&conteudo=${t.id}`}
                scroll={false}
                className={`flex items-center gap-2.5 border-t border-line px-3 py-2.5 first:border-t-0 ${t.id === atual?.id ? "bg-accent-soft" : "hover:bg-surface"}`}
              >
                <Miniatura cor={cliente.cor} />
                <div className="min-w-0">
                  <div className="text-[12.5px] font-semibold [overflow-wrap:anywhere]">{t.titulo}</div>
                  <SeloEtapa etapa={t.etapa} />
                </div>
              </Link>
            ))}
            {lista.length === 0 && <p className="px-4 py-[18px] text-[13px] text-muted">Nada em produção para este cliente.</p>}
          </div>
        </section>

        {atual ? (
          <EditorCriacao
            key={atual.id}
            tarefa={{
              id: atual.id,
              titulo: atual.titulo,
              texto: atual.texto,
              etapa: atual.etapa,
              detalhe: rotuloFormato(atual.formato),
              responsavel: (atual.responsavel_id && autores[atual.responsavel_id]) || "Sem responsável",
              clientId: cliente.id,
            }}
            artes={artesDe(atual.id).map((a) => ({ id: a.id, url: links.get(a.caminho) ?? null, tipo: a.tipo_midia }))}
            notas={notas ?? []}
            autores={autores}
            feed={feedTarefas.map((t) => {
              const a = artesDe(t.id)[0];
              return { id: t.id, titulo: t.titulo, url: a ? (links.get(a.caminho) ?? null) : null, tipo: a?.tipo_midia ?? null };
            })}
            cliente={{ nome: cliente.nome, instagram: cliente.instagram, cor: cliente.cor }}
          />
        ) : (
          <EstadoVazio icone="criacao" acao={{ href: "/tarefas?nova=1", rotulo: "Criar pauta" }}>Selecione um conteúdo ao lado ou crie uma pauta nova.</EstadoVazio>
        )}
      </div>
    </>
  );
}
