import { CabecalhoPagina } from "@/components/cabecalho-pagina";
import { ROTULO_PERFIL } from "@/lib/permissoes";
import { exigirTime } from "@/lib/sessao";
import { criarClienteAdmin } from "@/lib/supabase/admin";
import { criarClienteServidor } from "@/lib/supabase/server";
import type { Cliente, Pessoa } from "@/types/banco";
import { ETAPAS_CONTEUDO } from "@/lib/dominio/tarefas";
import { dataBR } from "@/lib/datas";
import { dataHoraSP } from "@/lib/dominio/tarefas";
import { AcoesPessoa, FormConvite, FormLembrete, FormResponsaveisPadrao } from "./formularios";

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
  const [{ data: pessoas }, { data: clientes }, acessos, { data: padroes }, { data: config }, { data: envios }, { data: uso }] = await Promise.all([
    supabase.from("profiles").select("*").order("nome").returns<Pessoa[]>(),
    supabase.from("clients").select("id, nome, nome_curto, cor, ativo").eq("ativo", true).order("nome").returns<Cliente[]>(),
    primeirosAcessos(),
    supabase.from("stage_defaults").select("etapa, responsavel_id"),
    supabase.from("app_settings").select("dias_lembrete").eq("id", 1).maybeSingle(),
    supabase.from("envios_email").select("id, tipo, email, assunto, ok, erro, created_at").order("created_at", { ascending: false }).limit(15),
    supabase.rpc("uso_armazenamento"),
  ]);
  const usoPor = new Map(((uso ?? []) as { bucket: string; arquivos: number; bytes: number }[]).map((u) => [u.bucket, u]));
  const totalBytes = [...usoPor.values()].reduce((a, u) => a + Number(u.bytes), 0);
  const mb = (b: number) => (b / 1024 / 1024).toLocaleString("pt-BR", { maximumFractionDigits: b < 10 * 1024 * 1024 ? 1 : 0 });
  const LIMITE_PLANO = 1024 * 1024 * 1024; // plano gratuito do Supabase
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
        <section className="rounded-xl border border-line bg-card">
          <div className="border-b border-line px-4 py-3.5">
            <h2 className="text-[15px] font-bold">Responsável padrão por etapa</h2>
            <p className="text-[12.5px] text-muted">Quando um conteúdo muda de etapa, ele passa para esta pessoa.</p>
          </div>
          <div className="px-4 py-3.5">
            <FormResponsaveisPadrao
              etapas={ETAPAS_CONTEUDO}
              atuais={Object.fromEntries((padroes ?? []).map((p) => [p.etapa, p.responsavel_id]))}
              time={time.filter((p) => p.ativo).map((p) => ({ id: p.id, nome: p.nome }))}
            />
          </div>
        </section>
        <section className="rounded-xl border border-line bg-card">
          <div className="border-b border-line px-4 py-3.5">
            <h2 className="text-[15px] font-bold">Lembrete de aprovação</h2>
            <p className="text-[12.5px] text-muted">E-mail para o cliente quando um conteúdo fica parado com ele. No máximo um por dia, às 10h.</p>
          </div>
          <div className="px-4 pt-3.5">
            <FormLembrete dias={config?.dias_lembrete ?? 2} />
          </div>
        </section>
        <Lista titulo="Time" pessoas={time} eu={eu.id} acessos={acessos} clientes={nomesClientes} />
        <Lista titulo="Pessoas de clientes" pessoas={deClientes} eu={eu.id} acessos={acessos} clientes={nomesClientes} />
        <section className="rounded-xl border border-line bg-card">
          <div className="border-b border-line px-4 py-3.5">
            <h2 className="text-[15px] font-bold">Armazenamento</h2>
            <p className="text-[12.5px] text-muted">Artes e anexos do chat. O plano gratuito do Supabase tem 1 GB.</p>
          </div>
          <div className="flex flex-col gap-2.5 px-4 py-3.5 text-[13px]">
            <div className="h-2 overflow-hidden rounded-full bg-surface" role="progressbar" aria-valuenow={Math.round((totalBytes / LIMITE_PLANO) * 100)} aria-valuemin={0} aria-valuemax={100}>
              <div
                className={`h-full rounded-full ${totalBytes > LIMITE_PLANO * 0.8 ? "bg-bad" : "bg-accent"}`}
                style={{ width: `${Math.min(100, (totalBytes / LIMITE_PLANO) * 100)}%` }}
              />
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-1">
              <span>
                <b className="font-mono">{mb(totalBytes)} MB</b> de 1.024 MB
              </span>
              {[
                ["artes", "Artes"],
                ["chat", "Anexos do chat"],
              ].map(([id, rotulo]) => (
                <span key={id} className="text-muted">
                  {rotulo}: <span className="font-mono">{mb(Number(usoPor.get(id)?.bytes ?? 0))} MB</span> ({usoPor.get(id)?.arquivos ?? 0} arquivos)
                </span>
              ))}
            </div>
          </div>
        </section>
        <section className="rounded-xl border border-line bg-card">
          <div className="border-b border-line px-4 py-3.5">
            <h2 className="text-[15px] font-bold">Últimos e-mails enviados</h2>
            <p className="text-[12.5px] text-muted">Para conferir se os avisos estão saindo.</p>
          </div>
          <ul>
            {(envios ?? []).map((e) => {
              const { data, hora } = dataHoraSP(e.created_at);
              return (
                <li key={e.id} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 border-t border-line px-4 py-2.5 text-[13px] first:border-t-0">
                  <span className="w-[86px] font-mono text-[11.5px] text-muted">
                    {dataBR(data).slice(0, 5)} {hora}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{e.assunto}</span>
                  <span className="truncate text-[12.5px] text-muted">{e.email}</span>
                  <span className={`text-[12px] font-semibold ${e.ok ? "text-ok" : "text-bad"}`} title={e.erro ?? undefined}>
                    {e.ok ? "Enviado" : "Falhou"}
                  </span>
                </li>
              );
            })}
            {!envios?.length && <li className="px-4 py-[18px] text-[13px] text-muted">Nenhum e-mail enviado ainda.</li>}
          </ul>
        </section>
      </div>
    </>
  );
}
