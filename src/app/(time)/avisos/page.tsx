import { CabecalhoPagina, EstadoVazio } from "@/components/cabecalho-pagina";
import { dataBR } from "@/lib/datas";
import { dataHoraSP } from "@/lib/dominio/tarefas";
import { exigirTime } from "@/lib/sessao";
import { criarClienteServidor } from "@/lib/supabase/server";
import { abrirAviso, marcarTodasLidas } from "./acoes";

export const metadata = { title: "Avisos" };

export default async function Avisos() {
  await exigirTime();
  const supabase = await criarClienteServidor();
  const { data: avisos } = await supabase
    .from("notifications")
    .select("id, tipo, texto, link, lida_em, created_at")
    .order("created_at", { ascending: false })
    .limit(60);
  const naoLidos = (avisos ?? []).filter((a) => !a.lida_em).length;

  return (
    <>
      <CabecalhoPagina
        sobretitulo="Operação"
        titulo="Avisos"
        descricao="Aprovações, pedidos de ajuste e tarefas que chegaram para você. Os mesmos avisos vão por e-mail."
        acoes={
          naoLidos > 0 && (
            <form action={marcarTodasLidas}>
              <button className="rounded-lg border border-line bg-card px-3.5 py-2 font-medium hover:border-ink">Marcar todos como lidos</button>
            </form>
          )
        }
      />
      {!avisos?.length ? (
        <EstadoVazio icone="sino" acao={{ href: "/inicio", rotulo: "Voltar ao Início" }}>Nenhum aviso ainda. Aprovações, ajustes e tarefas que chegarem para você aparecem aqui.</EstadoVazio>
      ) : (
        <ul className="rounded-xl border border-line bg-card">
          {avisos.map((a) => {
            const { data, hora } = dataHoraSP(a.created_at);
            return (
              <li key={a.id} className="border-t border-line first:border-t-0">
                <form action={abrirAviso}>
                  <input type="hidden" name="id" value={a.id} />
                  <input type="hidden" name="link" value={a.link ?? ""} />
                  <button className={`flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-surface ${a.lida_em ? "text-muted" : ""}`}>
                    <span className={`mt-1.5 h-2 w-2 flex-none rounded-full ${a.lida_em ? "bg-transparent" : "bg-accent"}`} />
                    <span className={`min-w-0 flex-1 [overflow-wrap:anywhere] ${a.lida_em ? "" : "font-medium"}`}>{a.texto}</span>
                    <span className="flex-none font-mono text-[11.5px] text-muted">
                      {dataBR(data).slice(0, 5)} {hora}
                    </span>
                  </button>
                </form>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
