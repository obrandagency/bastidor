import Link from "next/link";
import { notFound } from "next/navigation";
import { CabecalhoPagina } from "@/components/cabecalho-pagina";
import { Linha, Painel } from "@/components/painel";
import { dataBR, hojeSP, mesPorExtenso } from "@/lib/datas";
import { exigirTime } from "@/lib/sessao";
import { criarClienteServidor } from "@/lib/supabase/server";
import type { Ata, Briefing, ClienteCompleto, Contrato, Pessoa } from "@/types/banco";
import { AcoesPessoa } from "../../configuracoes/formularios";
import {
  BotaoApagarAta,
  DadosDoCliente,
  EdicaoContrato,
  FormAcessos,
  FormAta,
  FormBriefing,
  FormConviteCliente,
  FormIdentidade,
  FormTom,
} from "../formularios";
import { SeletorCliente } from "../seletor-cliente";

export const metadata = { title: "Central do cliente · Bastidor" };

// Leitura para quem não edita (Criação)
function Texto({ rotulo, valor }: { rotulo: string; valor?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11.5px] uppercase tracking-[0.04em] text-muted">{rotulo}</span>
      <p className="whitespace-pre-line">{valor || <span className="text-muted">Não preenchido.</span>}</p>
    </div>
  );
}

export default async function CentralDoCliente({ params }: { params: Promise<{ id: string }> }) {
  const eu = await exigirTime();
  const gestao = eu.perfil === "socio" || eu.perfil === "adm";
  const { id } = await params;
  const supabase = await criarClienteServidor();
  const hoje = hojeSP();

  const { data: cliente } = await supabase.from("clients").select("*").eq("id", id).maybeSingle<ClienteCompleto>();
  if (!cliente) notFound();

  const [{ data: todos }, { data: briefing }, { data: atas }, { data: pessoasTime }, contrato] = await Promise.all([
    supabase.from("clients").select("id, nome").eq("ativo", true).order("nome"),
    supabase.from("client_briefs").select("*").eq("client_id", id).maybeSingle<Briefing>(),
    supabase.from("meeting_notes").select("*").eq("client_id", id).order("data", { ascending: false }).returns<Ata[]>(),
    supabase.from("profiles").select("id, nome").neq("perfil", "cliente"),
    gestao ? dadosDoContrato(id, hoje) : null,
  ]);
  const autor = new Map((pessoasTime ?? []).map((p) => [p.id, p.nome]));
  const { data: pessoasCliente } = gestao
    ? await supabase.from("profiles").select("*").eq("client_id", id).order("nome").returns<Pessoa[]>()
    : { data: null };

  const opcoes = (todos ?? []).some((c) => c.id === id) ? todos! : [{ id, nome: cliente.nome }, ...(todos ?? [])];

  return (
    <>
      <CabecalhoPagina
        sobretitulo="Clientes"
        titulo="Central do cliente"
        descricao="Tudo o que alguém precisa saber para pegar a conta sem perguntar nada."
      />

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <SeletorCliente atual={id} clientes={opcoes} />
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pb-2 text-[13px]">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: cliente.cor }} />
            <span className="font-mono text-[12px] tracking-[0.04em]">{cliente.nome_curto}</span>
          </span>
          {cliente.instagram && (
            <a href={`https://instagram.com/${cliente.instagram}`} target="_blank" rel="noreferrer" className="text-accent hover:underline">
              @{cliente.instagram}
            </a>
          )}
          {cliente.drive_url && (
            <a href={cliente.drive_url} target="_blank" rel="noreferrer" className="text-accent hover:underline">
              Pasta no Drive
            </a>
          )}
          {!cliente.ativo && <span className="rounded-full bg-surface px-2 text-[11.5px] text-muted">Inativo</span>}
          {gestao && (
            <Link href={`/clientes/${id}/editar`} className="text-muted hover:text-ink hover:underline">
              Editar cadastro
            </Link>
          )}
        </div>
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,320px),1fr))] gap-4">
        <Painel titulo="Briefing">
          {gestao ? (
            <FormBriefing clientId={id} briefing={briefing} />
          ) : (
            <div className="flex flex-col gap-3">
              <Texto rotulo="O negócio" valor={briefing?.negocio} />
              <Texto rotulo="Público" valor={briefing?.publico} />
              <Texto rotulo="Objetivo com o marketing" valor={briefing?.objetivo} />
            </div>
          )}
        </Painel>

        <Painel titulo="Tom de voz">
          {gestao ? (
            <FormTom clientId={id} briefing={briefing} />
          ) : (
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <span className="text-[11.5px] uppercase tracking-[0.04em] text-muted">Como a marca soa</span>
                <div className="flex flex-wrap gap-1.5">
                  {briefing?.tom_voz?.length ? (
                    briefing.tom_voz.map((t) => (
                      <span key={t} className="rounded-full bg-accent-soft px-2.5 py-0.5 text-[12.5px] font-medium text-accent">
                        {t}
                      </span>
                    ))
                  ) : (
                    <span className="text-muted">Não preenchido.</span>
                  )}
                </div>
              </div>
              <Texto rotulo="O que evitar" valor={briefing?.evitar} />
            </div>
          )}
        </Painel>

        <Painel titulo="Identidade visual">
          {gestao ? (
            <FormIdentidade clientId={id} briefing={briefing} />
          ) : (
            <div className="flex flex-wrap gap-3">
              {briefing?.cores?.length ? (
                briefing.cores.map((c) => (
                  <div key={c} className="flex flex-col items-center gap-1">
                    <i className="h-11 w-11 rounded-lg border border-line" style={{ background: c }} />
                    <span className="font-mono text-[11.5px]">{c}</span>
                  </div>
                ))
              ) : (
                <span className="text-muted">Nenhuma cor cadastrada.</span>
              )}
            </div>
          )}
          <p className="mt-3 text-[12.5px] text-muted">
            Logo, fontes e manual de marca ficam na{" "}
            {cliente.drive_url ? (
              <a href={cliente.drive_url} target="_blank" rel="noreferrer" className="text-accent hover:underline">
                pasta do cliente no Drive
              </a>
            ) : (
              "pasta do cliente no Drive"
            )}
            .
          </p>
        </Painel>

        <Painel titulo="Acessos">
          {gestao ? (
            <FormAcessos clientId={id} briefing={briefing} />
          ) : (
            <ul>
              {(briefing?.acessos ?? []).map((a) => (
                <li key={a.nome} className="flex items-center gap-2 border-t border-line py-2 first:border-t-0">
                  <span className="flex-1">{a.nome}</span>
                  <span className={`text-[12px] ${a.liberado ? "text-ok" : "font-semibold text-bad"}`}>
                    {a.liberado ? "Liberado" : "Pendente"}
                  </span>
                </li>
              ))}
              {!briefing?.acessos?.length && <li className="text-muted">Nenhum acesso registrado.</li>}
            </ul>
          )}
        </Painel>

        {contrato && (
          <Painel titulo="Contrato" semPadding>
            {contrato.vigente ? (
              <div>
                <Linha rotulo="Conteúdos por mês">{contrato.vigente.conteudos_mes}</Linha>
                <Linha rotulo={`Ajustes em ${mesPorExtenso(hoje)}`}>
                  <span className={contrato.ajustes >= contrato.vigente.ajustes_mes ? "text-bad" : ""}>
                    {contrato.ajustes} de {contrato.vigente.ajustes_mes}
                  </span>
                </Linha>
                <Linha rotulo="Vigência">
                  {dataBR(contrato.vigente.inicio)} a {contrato.vigente.fim ? dataBR(contrato.vigente.fim) : "sem data de fim"}
                </Linha>
              </div>
            ) : (
              <p className="px-4 py-[18px] text-[13px] text-muted">Sem contrato vigente hoje.</p>
            )}
            {contrato.outros.length > 0 && (
              <div className="border-t border-line px-4 py-2.5 text-[12.5px] text-muted">
                Outros contratos:{" "}
                {contrato.outros.map((k) => `${dataBR(k.inicio)} a ${k.fim ? dataBR(k.fim) : "sem fim"}`).join(" · ")}
              </div>
            )}
            {eu.perfil === "socio" && <EdicaoContrato clientId={id} contrato={contrato.vigente ?? undefined} />}
          </Painel>
        )}

        <Painel titulo="Atas de reunião" semPadding>
          <div className="flex flex-col gap-2 px-4 py-3.5">
            {(atas ?? []).map((a) => (
              <div key={a.id} className="flex items-start gap-2.5 rounded-[10px] border border-line px-[11px] py-[9px]">
                <div className="min-w-0 flex-1 text-[13px] [overflow-wrap:anywhere]">
                  <p className="whitespace-pre-line">{a.resumo}</p>
                  <small className="block text-[11.5px] text-muted">
                    {dataBR(a.data)}
                    {a.autor_id && autor.get(a.autor_id) ? ` · ${autor.get(a.autor_id)}` : ""}
                  </small>
                </div>
                {gestao && <BotaoApagarAta id={a.id} clientId={id} />}
              </div>
            ))}
            {!atas?.length && <p className="text-[13px] text-muted">Nenhuma ata ainda.</p>}
          </div>
          {gestao && <FormAta clientId={id} hoje={hoje} />}
        </Painel>

        {gestao && (
          <Painel titulo="Pessoas do cliente" extra={<span className="text-[12px] text-muted">aprovam no portal</span>} semPadding>
            <ul>
              {(pessoasCliente ?? []).map((p) => (
                <li
                  key={p.id}
                  className={`flex flex-col gap-2 border-t border-line px-4 py-3 first:border-t-0 ${p.ativo ? "" : "opacity-60"}`}
                >
                  <div className="min-w-0">
                    <div className="font-medium">
                      {p.nome}
                      {!p.ativo && <span className="ml-2 text-[12px] font-normal text-muted">desativado</span>}
                    </div>
                    <div className="truncate text-[12.5px] text-muted">{p.email}</div>
                  </div>
                  <AcoesPessoa id={p.id} perfil={p.perfil} ativo={p.ativo} souEu={false} />
                </li>
              ))}
              {!pessoasCliente?.length && <li className="px-4 py-3.5 text-[13px] text-muted">Ninguém convidado ainda.</li>}
            </ul>
            <FormConviteCliente clientId={id} />
          </Painel>
        )}

        {eu.perfil === "socio" && (
          <Painel titulo="Dados do cliente (LGPD)">
            <DadosDoCliente clientId={id} nome={cliente.nome} />
          </Painel>
        )}
      </div>
    </>
  );
}

// Contrato vigente hoje, os demais e os ajustes usados no mês (só Sócio e Adm chegam aqui)
async function dadosDoContrato(clientId: string, hoje: string) {
  const supabase = await criarClienteServidor();
  const [{ data: contratos }, { data: ajustes }] = await Promise.all([
    supabase.from("contracts").select("*").eq("client_id", clientId).order("inicio", { ascending: false }).returns<Contrato[]>(),
    supabase.rpc("ajustes_do_mes", { p_client_id: clientId }),
  ]);
  const vigente = (contratos ?? []).find((k) => k.inicio <= hoje && (!k.fim || k.fim >= hoje)) ?? null;
  return {
    vigente,
    outros: (contratos ?? []).filter((k) => k.id !== vigente?.id),
    ajustes: (ajustes as number | null) ?? 0,
  };
}
