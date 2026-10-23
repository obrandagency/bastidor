import { CabecalhoPagina } from "@/components/cabecalho-pagina";
import { ROTULO_PERFIL, type Perfil } from "@/lib/permissoes";
import { exigirTime } from "@/lib/sessao";
import { criarClienteServidor } from "@/lib/supabase/server";
import type { MensagemChat, ReacaoChat } from "@/types/banco";
import { Conversa } from "./conversa";
import { ListaCanais, type CanalLista } from "./lista-canais";
import { MembrosCanal, MenuCanal } from "./membros";

export const metadata = { title: "Chat" };

type Canal = { id: string; nome: string; client_id: string | null; arquivado: boolean; todos: boolean };

export default async function Chat({ searchParams }: { searchParams: Promise<{ canal?: string; msg?: string }> }) {
  const eu = await exigirTime();
  const gestao = eu.perfil === "socio" || eu.perfil === "adm";
  const { canal: pedido, msg } = await searchParams;
  const supabase = await criarClienteServidor();

  // A RLS só devolve os canais de que a pessoa é membro (Sócio e Adm veem todos)
  const [{ data: canaisBrutos }, { data: pessoasBrutas }, { data: naoLidas }, { data: clientes }, { data: membrosBrutos }] = await Promise.all([
    supabase.from("chat_canais").select("id, nome, client_id, arquivado, todos").order("nome").returns<Canal[]>(),
    supabase.from("profiles").select("id, nome, iniciais, foto, cargo, perfil").neq("perfil", "cliente").eq("ativo", true).order("nome"),
    supabase.rpc("chat_nao_lidas"),
    supabase.from("clients").select("id, nome").order("nome"),
    supabase.from("chat_membros").select("canal_id, pessoa_id"),
  ]);
  const pessoas = (pessoasBrutas ?? []).map((p) => ({ id: p.id, nome: p.nome, iniciais: p.iniciais, foto: p.foto, cargo: p.cargo || ROTULO_PERFIL[p.perfil as Perfil] }));
  const todos = canaisBrutos ?? [];
  // #geral primeiro; depois os demais em ordem alfabética
  const ordenados = [...todos].sort((a, b) => (a.nome === "geral" ? -1 : b.nome === "geral" ? 1 : a.nome.localeCompare(b.nome)));
  const abertos = ordenados.filter((c) => !c.arquivado);
  const atual = todos.find((c) => c.id === pedido) ?? abertos[0];
  const contagem = new Map(((naoLidas ?? []) as { canal_id: string; total: number }[]).map((n) => [n.canal_id, Number(n.total)]));
  const nomeCliente = new Map((clientes ?? []).map((c) => [c.id, c.nome]));
  const membrosDe = (canalId: string) => new Set((membrosBrutos ?? []).filter((m) => m.canal_id === canalId).map((m) => m.pessoa_id));

  const lista: CanalLista[] = ordenados.map((c) => ({
    id: c.id,
    nome: c.nome,
    cliente: c.client_id ? (nomeCliente.get(c.client_id) ?? "Cliente") : null,
    arquivado: c.arquivado,
    restrito: !c.todos && pessoas.some((p) => !membrosDe(c.id).has(p.id)),
    naoLidas: contagem.get(c.id) ?? 0,
  }));

  const { data: mensagens } = atual
    ? await supabase
        .from("chat_mensagens")
        .select("*, chat_reacoes(mensagem_id, pessoa_id, emoji)")
        .eq("canal_id", atual.id)
        .order("created_at", { ascending: false })
        .limit(150)
        .returns<(MensagemChat & { chat_reacoes: ReacaoChat[] })[]>()
    : { data: [] as (MensagemChat & { chat_reacoes: ReacaoChat[] })[] };
  const reacoes = (mensagens ?? []).flatMap((m) => m.chat_reacoes ?? []);
  const membrosAtual = atual ? pessoas.filter((p) => membrosDe(atual.id).has(p.id)) : [];

  return (
    <>
      <CabecalhoPagina sobretitulo="Operação" titulo="Chat" descricao="Conversa do time junto do trabalho. Cada canal tem os seus membros; clientes não veem o chat." />
      <section className="grid h-[min(720px,calc(100dvh-170px))] min-h-[460px] grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-xl border border-line bg-card md:grid-cols-[auto_minmax(0,1fr)] md:grid-rows-1">
        <div className="min-h-0 md:h-full md:[&>nav:not(.hidden)]:w-[260px]">
          <ListaCanais
            canais={lista}
            atual={atual?.id ?? null}
            gestao={gestao}
            eu={eu.id}
            clientes={(clientes ?? []).map((c) => ({ id: c.id, nome: c.nome }))}
            pessoas={pessoas.map((p) => ({ id: p.id, nome: p.nome }))}
          />
        </div>
        {atual ? (
          <div className="flex min-h-0 min-w-0 flex-col">
            <Conversa
              key={atual.id}
              canalId={atual.id}
              titulo={`#${atual.nome}`}
              iniciais={[...(mensagens ?? [])].reverse().map((m) => {
                const so = { ...m } as Partial<typeof m>;
                delete so.chat_reacoes; // as reações vão à parte
                return so as MensagemChat;
              })}
              reacoesIniciais={reacoes}
              canais={abertos.map((c) => ({ id: c.id, nome: c.nome }))}
              eu={eu.id}
              podeApagarTudo={eu.perfil === "socio"}
              pessoas={pessoas}
              arquivado={atual.arquivado}
              destacar={msg}
              menuCanal={gestao && atual.nome !== "geral" && !atual.arquivado ? <MenuCanal key="menu" id={atual.id} nome={atual.nome} /> : undefined}
              membros={<MembrosCanal key="membros" canalId={atual.id} todos={atual.todos} membros={membrosAtual} time={pessoas} podeEditar={gestao} />}
            />
          </div>
        ) : (
          <p className="p-4 text-muted">Nenhum canal.</p>
        )}
      </section>
    </>
  );
}
