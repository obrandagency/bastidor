import { redirect } from "next/navigation";
import { CartaoEntrada } from "@/components/cartao-entrada";
import { ROTULO_PERFIL, type Perfil } from "@/lib/permissoes";
import { pessoaAtual } from "@/lib/sessao";
import { criarClienteServidor } from "@/lib/supabase/server";

export const metadata = { title: "Verificação de acesso" };

// Consulta cada tabela com a sessão de quem está logado (o mesmo que a API faria com o token
// dessa pessoa) e compara com o que o perfil deveria enxergar. Serve para testar a RLS em produção.
const TABELAS = [
  "clients",
  "profiles",
  "convites",
  "contracts",
  "client_briefs",
  "meeting_notes",
  "tasks",
  "task_assets",
  "task_notes",
  "task_events",
  "stage_defaults",
  "app_settings",
  "notifications",
] as const;
type Tabela = (typeof TABELAS)[number];

// O que cada perfil pode ver: "tudo", "nada" ou uma regra específica
type Regra = "tudo" | "nada" | "proprio";
const ESPERADO: Record<Perfil, Partial<Record<Tabela, Regra>>> = {
  socio: {},
  adm: {},
  criacao: { contracts: "nada", convites: "nada" },
  cliente: Object.fromEntries(TABELAS.map((t) => [t, "nada"])) as Record<Tabela, Regra>,
};
ESPERADO.cliente.clients = "proprio";
ESPERADO.cliente.profiles = "proprio";
ESPERADO.cliente.notifications = "proprio";
ESPERADO.criacao.profiles = "proprio"; // só o time, sem pessoas de cliente

export default async function VerificacaoAcesso() {
  const eu = await pessoaAtual();
  if (!eu) redirect("/entrar");
  const supabase = await criarClienteServidor();

  const linhas = await Promise.all(
    TABELAS.map(async (tabela) => {
      const { data, error } = await supabase.from(tabela).select("*").limit(500);
      const lidas = (data ?? []) as Record<string, unknown>[];
      const regra = ESPERADO[eu.perfil][tabela] ?? "tudo";
      let ok: boolean;
      let detalhe: string;
      if (regra === "nada") {
        ok = lidas.length === 0;
        detalhe = ok ? "nenhuma linha" : `${lidas.length} linha(s) visíveis`;
      } else if (regra === "proprio") {
        const alheias = lidas.filter((l) =>
          tabela === "clients"
            ? l.id !== eu.client_id
            : tabela === "notifications"
              ? l.destinatario_id !== eu.id
              : eu.perfil === "cliente"
                ? l.id !== eu.id
                : l.perfil === "cliente",
        );
        ok = alheias.length === 0;
        detalhe = ok ? `${lidas.length} linha(s), todas permitidas` : `${alheias.length} linha(s) que não deveria ver`;
      } else {
        ok = !error;
        detalhe = `${lidas.length} linha(s)`;
      }
      if (error) detalhe += ` · ${error.message}`;
      return { tabela, regra, ok, detalhe };
    }),
  );

  const { data: clientes } = await supabase.from("clients").select("nome").order("nome");
  const tudoCerto = linhas.every((l) => l.ok);

  return (
    <CartaoEntrada
      titulo="Verificação de acesso"
      descricao={`${eu.nome} · ${ROTULO_PERFIL[eu.perfil]} · leitura direta do banco com a sua sessão`}
    >
      <div
        className={`mb-4 rounded-lg px-3 py-2.5 text-[13px] font-medium ${tudoCerto ? "bg-ok-soft text-ok" : "bg-bad-soft text-bad"}`}
      >
        {tudoCerto ? "Tudo certo: este perfil só vê o que pode ver." : "Atenção: há tabelas com acesso indevido."}
      </div>
      <p className="mb-3 text-[12.5px] text-muted">
        Clientes visíveis: {(clientes ?? []).map((c) => c.nome).join(", ") || "nenhum"}
      </p>
      <ul className="divide-y divide-line rounded-lg border border-line">
        {linhas.map((l) => (
          <li key={l.tabela} className="flex items-center gap-2.5 px-3 py-2 text-[13px]">
            <span className={l.ok ? "text-ok" : "text-bad"}>{l.ok ? "✓" : "✗"}</span>
            <span className="font-mono text-[12px]">{l.tabela}</span>
            <span className="ml-auto text-right text-[12px] text-muted">{l.detalhe}</span>
          </li>
        ))}
      </ul>
    </CartaoEntrada>
  );
}
