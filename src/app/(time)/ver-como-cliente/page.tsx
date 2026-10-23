import Link from "next/link";
import { CabecalhoPagina, EstadoVazio } from "@/components/cabecalho-pagina";
import { exigirTime } from "@/lib/sessao";
import { criarClienteServidor } from "@/lib/supabase/server";

export const metadata = { title: "Ver como cliente" };

export default async function VerComoCliente() {
  await exigirTime(["socio", "adm"]);
  const supabase = await criarClienteServidor();
  const { data: clientes } = await supabase.from("clients").select("id, nome, nome_curto, cor").eq("ativo", true).order("nome");
  return (
    <>
      <CabecalhoPagina
        sobretitulo="Clientes"
        titulo="Ver como cliente"
        descricao="Abre o portal com os dados de um cliente, do jeito que ele vê, sem permitir aprovar em nome dele."
      />
      {!clientes?.length ? (
        <EstadoVazio icone="portal" acao={{ href: "/clientes", rotulo: "Abrir a Central do cliente" }}>Nenhum cliente ativo para ver o portal.</EstadoVazio>
      ) : (
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,240px),1fr))] gap-3">
          {clientes.map((c) => (
            <li key={c.id}>
              <Link href={`/ver-como-cliente/${c.id}`} className="flex items-center gap-2 rounded-xl border border-line bg-card px-4 py-3.5 hover:border-muted">
                <span className="h-2.5 w-2.5 flex-none rounded-full" style={{ background: c.cor }} />
                <span className="truncate font-medium">{c.nome}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
