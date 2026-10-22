import Link from "next/link";
import { CabecalhoPagina } from "@/components/cabecalho-pagina";
import { exigirTime } from "@/lib/sessao";
import { criarClienteServidor } from "@/lib/supabase/server";
import type { CanalChat, MensagemChat } from "@/types/banco";
import { ArquivarCanal, NovoCanal } from "./canais";
import { Conversa } from "./conversa";

export const metadata = { title: "Chat · Bastidor" };

export default async function Chat({ searchParams }: { searchParams: Promise<{ canal?: string }> }) {
  const eu = await exigirTime();
  const gestao = eu.perfil === "socio" || eu.perfil === "adm";
  const { canal: pedido } = await searchParams;
  const supabase = await criarClienteServidor();

  const [{ data: canaisBrutos }, { data: pessoas }, { data: naoLidas }, { data: clientes }] = await Promise.all([
    supabase.from("chat_canais").select("id, nome, client_id, arquivado").order("nome").returns<CanalChat[]>(),
    supabase.from("profiles").select("id, nome, iniciais").neq("perfil", "cliente").eq("ativo", true).order("nome"),
    supabase.rpc("chat_nao_lidas"),
    supabase.from("clients").select("id, nome, cor").eq("ativo", true).order("nome"),
  ]);
  const todos = canaisBrutos ?? [];
  // #geral primeiro; depois os demais em ordem alfabética
  const canais = todos.filter((c) => !c.arquivado).sort((a, b) => (a.nome === "geral" ? -1 : b.nome === "geral" ? 1 : a.nome.localeCompare(b.nome)));
  const atual = todos.find((c) => c.id === pedido) ?? canais[0];
  const contagem = new Map(((naoLidas ?? []) as { canal_id: string; total: number }[]).map((n) => [n.canal_id, Number(n.total)]));
  const corDe = new Map((clientes ?? []).map((c) => [c.id, c.cor]));

  const { data: mensagens } = atual
    ? await supabase
        .from("chat_mensagens")
        .select("*")
        .eq("canal_id", atual.id)
        .order("created_at", { ascending: false })
        .limit(150)
        .returns<MensagemChat[]>()
    : { data: [] as MensagemChat[] };

  return (
    <>
      <CabecalhoPagina sobretitulo="Operação" titulo="Chat" descricao="Conversa do time junto do trabalho. Clientes não veem o chat." />
      <section className="grid h-[min(680px,calc(100dvh-190px))] min-h-[440px] grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-xl border border-line bg-card md:grid-cols-[220px_minmax(0,1fr)] md:grid-rows-1">
        <nav aria-label="Canais" className="flex gap-0.5 overflow-x-auto border-b border-line p-2.5 md:flex-col md:overflow-y-auto md:border-b-0 md:border-r">
          {canais.map((c) => {
            const n = contagem.get(c.id) ?? 0;
            const ativo = c.id === atual?.id;
            return (
              <Link
                key={c.id}
                href={`/chat?canal=${c.id}`}
                aria-current={ativo ? "page" : undefined}
                className={`flex flex-none items-center gap-2 whitespace-nowrap rounded-lg px-2.5 py-[7px] text-[13px] ${
                  ativo ? "bg-accent-soft font-semibold text-ink" : n ? "font-semibold text-ink hover:bg-surface" : "text-muted hover:bg-surface"
                }`}
              >
                {c.client_id ? (
                  <span className="h-2 w-2 flex-none rounded-full" style={{ background: corDe.get(c.client_id) ?? "#5A6275" }} />
                ) : (
                  <span className="font-mono text-muted">#</span>
                )}
                <span className="min-w-0 truncate">{c.nome}</span>
                {n > 0 && !ativo && <span className="ml-auto rounded-full bg-accent px-1.5 font-mono text-[10.5px] text-accent-ink">{n}</span>}
              </Link>
            );
          })}
          {gestao && (
            <div className="flex-none md:mt-2">
              <NovoCanal clientes={(clientes ?? []).map((c) => ({ id: c.id, nome: c.nome }))} />
            </div>
          )}
        </nav>
        {atual ? (
          <div className="flex min-h-0 min-w-0 flex-col">
            <Conversa
              key={atual.id}
              canalId={atual.id}
              titulo={`#${atual.nome}`}
              iniciais={[...(mensagens ?? [])].reverse()}
              eu={eu.id}
              podeApagarTudo={eu.perfil === "socio"}
              pessoas={pessoas ?? []}
              arquivado={atual.arquivado}
            />
            {gestao && atual.nome !== "geral" && !atual.arquivado && (
              <div className="border-t border-line px-4 py-1.5 text-right">
                <ArquivarCanal id={atual.id} nome={atual.nome} />
              </div>
            )}
          </div>
        ) : (
          <p className="p-4 text-muted">Nenhum canal.</p>
        )}
      </section>
    </>
  );
}
