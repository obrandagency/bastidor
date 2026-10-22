import { CabecalhoPagina } from "@/components/cabecalho-pagina";
import { ROTULO_PERFIL } from "@/lib/permissoes";
import { exigirTime } from "@/lib/sessao";
import { criarClienteAdmin } from "@/lib/supabase/admin";
import { criarClienteServidor } from "@/lib/supabase/server";
import type { Cliente, Pessoa } from "@/types/banco";
import { AcoesPessoa, FormConvite } from "./formularios";

export const metadata = { title: "Configurações · Bastidor" };

// Último acesso de cada pessoa vem do Auth (só o servidor enxerga)
async function primeirosAcessos() {
  try {
    const { data } = await criarClienteAdmin().auth.admin.listUsers({ perPage: 1000 });
    return new Map(data.users.map((u) => [u.id, u.last_sign_in_at ?? null]));
  } catch {
    return null;
  }
}

function Situacao({ pessoa, acessos }: { pessoa: Pessoa; acessos: Map<string, string | null> | null }) {
  if (!pessoa.ativo) return <span className="rounded-full bg-surface px-2 text-[11.5px] text-muted">Desativado</span>;
  if (acessos && !acessos.get(pessoa.id))
    return <span className="rounded-full bg-warn-soft px-2 text-[11.5px] text-warn">Aguardando primeiro acesso</span>;
  return null;
}

function Lista({
  titulo,
  pessoas,
  eu,
  acessos,
  clientes,
}: {
  titulo: string;
  pessoas: Pessoa[];
  eu: string;
  acessos: Map<string, string | null> | null;
  clientes: Map<string, string>;
}) {
  return (
    <section className="rounded-xl border border-line bg-card">
      <div className="flex items-center justify-between border-b border-line px-4 py-3.5">
        <h2 className="text-[15px] font-bold">{titulo}</h2>
        <span className="font-mono text-[12px] text-muted">{pessoas.length}</span>
      </div>
      {pessoas.length === 0 && <p className="px-4 py-[18px] text-[13px] text-muted">Ninguém por aqui ainda.</p>}
      <ul>
        {pessoas.map((p) => (
          <li
            key={p.id}
            className={`flex flex-col gap-3 border-t border-line px-4 py-3 first:border-t-0 sm:flex-row sm:items-center ${
              p.ativo ? "" : "opacity-60"
            }`}
          >
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <span className="grid h-[26px] w-[26px] flex-none place-items-center rounded-full bg-ink text-[10.5px] font-semibold text-bg">
                {p.iniciais}
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 font-medium">
                  {p.nome}
                  {p.id === eu && <span className="text-[12px] font-normal text-muted">(você)</span>}
                  <Situacao pessoa={p} acessos={acessos} />
                </div>
                <div className="truncate text-[12.5px] text-muted">
                  {p.email}
                  {p.perfil === "cliente"
                    ? ` · ${clientes.get(p.client_id!) ?? "Cliente"}`
                    : p.cargo
                      ? ` · ${p.cargo}`
                      : ""}
                </div>
              </div>
            </div>
            <AcoesPessoa id={p.id} perfil={p.perfil} ativo={p.ativo} souEu={p.id === eu} />
          </li>
        ))}
      </ul>
    </section>
  );
}

export default async function Configuracoes() {
  const eu = await exigirTime(["socio"]);
  const supabase = await criarClienteServidor();
  const [{ data: pessoas }, { data: clientes }, acessos] = await Promise.all([
    supabase.from("profiles").select("*").order("nome").returns<Pessoa[]>(),
    supabase.from("clients").select("id, nome, nome_curto, cor, ativo").eq("ativo", true).order("nome").returns<Cliente[]>(),
    primeirosAcessos(),
  ]);
  const time = (pessoas ?? []).filter((p) => p.perfil !== "cliente");
  const deClientes = (pessoas ?? []).filter((p) => p.perfil === "cliente");
  const nomesClientes = new Map((clientes ?? []).map((c) => [c.id, c.nome]));

  return (
    <>
      <CabecalhoPagina
        sobretitulo="Conta"
        titulo="Configurações"
        descricao={`Pessoas e perfis de acesso. Perfis: ${Object.values(ROTULO_PERFIL).join(", ")}.`}
      />
      <div className="flex flex-col gap-4">
        <section className="rounded-xl border border-line bg-card">
          <div className="border-b border-line px-4 py-3.5">
            <h2 className="text-[15px] font-bold">Convidar pessoa</h2>
            <p className="text-[12.5px] text-muted">
              A pessoa recebe um e-mail. O time cria uma senha; o cliente entra pelo link, sem senha.
            </p>
          </div>
          <div className="px-4 py-3.5">
            <FormConvite clientes={(clientes ?? []).map((c) => ({ id: c.id, nome: c.nome }))} />
          </div>
        </section>
        <Lista titulo="Time" pessoas={time} eu={eu.id} acessos={acessos} clientes={nomesClientes} />
        <Lista titulo="Pessoas de clientes" pessoas={deClientes} eu={eu.id} acessos={acessos} clientes={nomesClientes} />
      </div>
    </>
  );
}
