"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Aviso, Botao, Campo, classeEntrada } from "@/components/formulario";
import type { Estado } from "@/app/entrar/acoes";
import type { Acesso, Briefing, ClienteCompleto, Contrato } from "@/types/banco";
import { convidar } from "../configuracoes/acoes";
import { adicionarAta, apagarAta, apagarCliente, apagarContrato, salvarBriefing, salvarCliente, salvarContrato, salvarDrive } from "./acoes";

function Retorno({ estado }: { estado: Estado }) {
  if (estado?.erro) return <Aviso tom="erro">{estado.erro}</Aviso>;
  if (estado?.ok) return <small className="text-[12.5px] text-ok">{estado.ok}</small>;
  return null;
}

function AreaTexto({ rotulo, id, ...props }: { rotulo: string; id: string } & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <div className="flex min-w-0 flex-col gap-[5px]">
      <label htmlFor={id} className="text-[11.5px] uppercase tracking-[0.04em] text-muted">
        {rotulo}
      </label>
      <textarea id={id} name={id} rows={2} className={`${classeEntrada} resize-y leading-[1.55]`} {...props} />
    </div>
  );
}

function Rodape({ enviando, estado }: { enviando: boolean; estado: Estado }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Botao variante="principal" pequeno disabled={enviando}>
        {enviando ? "Salvando…" : "Salvar"}
      </Botao>
      <Retorno estado={estado} />
    </div>
  );
}

// ---------------------------------------------------------------- cadastro do cliente
export function FormCliente({ cliente }: { cliente?: ClienteCompleto }) {
  const [estado, acao, enviando] = useActionState(salvarCliente, undefined);
  const [cor, setCor] = useState(cliente?.cor ?? "#2563EB");
  return (
    <form action={acao} className="grid max-w-[640px] grid-cols-1 gap-3.5 sm:grid-cols-2">
      {cliente && <input type="hidden" name="id" value={cliente.id} />}
      {estado?.erro && (
        <div className="sm:col-span-2">
          <Aviso tom="erro">{estado.erro}</Aviso>
        </div>
      )}
      <Campo rotulo="Nome" id="nome" required defaultValue={cliente?.nome} placeholder="Ótica Barbosa" />
      <Campo
        rotulo="Nome curto"
        id="nome_curto"
        required
        maxLength={20}
        defaultValue={cliente?.nome_curto}
        placeholder="ÓTICA BARBOSA"
        dica="Aparece no calendário."
      />
      <Campo rotulo="Instagram" id="instagram" defaultValue={cliente?.instagram ?? ""} placeholder="@oticabarbosa" />
      <Campo rotulo="Segmento" id="segmento" defaultValue={cliente?.segmento ?? ""} placeholder="Ótica" />
      <div className="flex min-w-0 flex-col gap-[5px]">
        <label htmlFor="cor" className="text-[11.5px] uppercase tracking-[0.04em] text-muted">
          Cor no sistema
        </label>
        <div className="flex gap-2">
          <input
            type="color"
            aria-label="Escolher cor"
            value={/^#[0-9A-Fa-f]{6}$/.test(cor) ? cor : "#2563EB"}
            onChange={(e) => setCor(e.target.value.toUpperCase())}
            className="h-[38px] w-[46px] flex-none cursor-pointer rounded-lg border border-line bg-card p-1"
          />
          <input id="cor" name="cor" value={cor} onChange={(e) => setCor(e.target.value)} className={`${classeEntrada} font-mono`} />
        </div>
      </div>
      <div className="sm:col-span-2">
        <Campo
          rotulo="Pasta no Drive"
          id="drive_url"
          type="url"
          defaultValue={cliente?.drive_url ?? ""}
          placeholder="https://drive.google.com/…"
          dica="Logo, fontes e manual de marca ficam lá."
        />
      </div>
      {cliente && (
        <label className="flex items-center gap-2 sm:col-span-2">
          <input type="checkbox" name="ativo" defaultChecked={cliente.ativo} className="h-4 w-4 accent-[var(--color-accent)]" />
          Cliente ativo
        </label>
      )}
      <div className="sm:col-span-2">
        <Botao variante="principal" disabled={enviando}>
          {enviando ? "Salvando…" : cliente ? "Salvar" : "Cadastrar cliente"}
        </Botao>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------- briefing
export function FormBriefing({ clientId, briefing }: { clientId: string; briefing: Briefing | null }) {
  const [estado, acao, enviando] = useActionState(salvarBriefing, undefined);
  return (
    <form action={acao} className="flex flex-col gap-3">
      <input type="hidden" name="client_id" value={clientId} />
      <input type="hidden" name="grupo" value="briefing" />
      <AreaTexto rotulo="O negócio" id="negocio" defaultValue={briefing?.negocio} />
      <AreaTexto rotulo="Objetivo com o marketing" id="objetivo" defaultValue={briefing?.objetivo} />
      <Rodape enviando={enviando} estado={estado} />
    </form>
  );
}

export function FormPublico({ clientId, briefing }: { clientId: string; briefing: Briefing | null }) {
  const [estado, acao, enviando] = useActionState(salvarBriefing, undefined);
  return (
    <form action={acao} className="flex flex-col gap-3">
      <input type="hidden" name="client_id" value={clientId} />
      <input type="hidden" name="grupo" value="publico" />
      <AreaTexto rotulo="Quem é o público" id="publico" defaultValue={briefing?.publico} />
      <Rodape enviando={enviando} estado={estado} />
    </form>
  );
}

export function FormDrive({ clientId, link }: { clientId: string; link: string | null }) {
  const [estado, acao, enviando] = useActionState(salvarDrive, undefined);
  return (
    <form action={acao} className="flex flex-col gap-3">
      <input type="hidden" name="client_id" value={clientId} />
      <Campo rotulo="Link da pasta no Drive" id="drive_url" type="url" defaultValue={link ?? ""} placeholder="https://drive.google.com/…" />
      <Rodape enviando={enviando} estado={estado} />
    </form>
  );
}

// Etiquetas que se adicionam com Enter e se removem no ×
function Etiquetas({
  nome,
  rotulo,
  inicial,
  placeholder,
  validar,
  cor,
}: {
  nome: string;
  rotulo: string;
  inicial: string[];
  placeholder: string;
  validar?: (v: string) => string | null;
  cor?: boolean;
}) {
  const [itens, setItens] = useState(inicial);
  const [novo, setNovo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const adicionar = () => {
    const v = novo.trim();
    if (!v) return;
    const problema = validar?.(v);
    if (problema) return setErro(problema);
    if (!itens.includes(v)) setItens([...itens, v]);
    setNovo("");
    setErro(null);
  };
  return (
    <div className="flex min-w-0 flex-col gap-[5px]">
      <span className="text-[11.5px] uppercase tracking-[0.04em] text-muted">{rotulo}</span>
      <input type="hidden" name={nome} value={JSON.stringify(itens)} />
      <div className="flex flex-wrap items-center gap-1.5">
        {itens.map((t, i) => (
          <span
            key={t}
            className={`inline-flex items-center gap-1.5 rounded-full py-0.5 pl-2.5 pr-1 text-[12.5px] font-medium ${
              cor ? "border border-line bg-surface" : "bg-accent-soft text-accent"
            }`}
          >
            {cor && <i className="h-3 w-3 rounded-full border border-line" style={{ background: t }} />}
            <span className={cor ? "font-mono" : ""}>{t}</span>
            <button
              type="button"
              aria-label={`Remover ${t}`}
              onClick={() => setItens(itens.filter((_, j) => j !== i))}
              className="grid h-5 w-5 place-items-center rounded-full opacity-70 hover:bg-line hover:opacity-100"
            >
              ×
            </button>
          </span>
        ))}
        <input
          value={novo}
          onChange={(e) => setNovo(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              adicionar();
            }
          }}
          onBlur={adicionar}
          placeholder={placeholder}
          aria-label={placeholder}
          className={`${classeEntrada} !w-[130px] !py-1 text-[12.5px] ${cor ? "font-mono" : ""}`}
        />
      </div>
      {erro && <small className="text-[12px] text-bad">{erro}</small>}
    </div>
  );
}

export function FormTom({ clientId, briefing }: { clientId: string; briefing: Briefing | null }) {
  const [estado, acao, enviando] = useActionState(salvarBriefing, undefined);
  return (
    <form action={acao} className="flex flex-col gap-3">
      <input type="hidden" name="client_id" value={clientId} />
      <input type="hidden" name="grupo" value="tom" />
      <Etiquetas nome="tom_voz" rotulo="Como a marca soa" inicial={briefing?.tom_voz ?? []} placeholder="Adicionar" />
      <AreaTexto rotulo="O que evitar" id="evitar" defaultValue={briefing?.evitar} />
      <Rodape enviando={enviando} estado={estado} />
    </form>
  );
}

export function FormIdentidade({ clientId, briefing }: { clientId: string; briefing: Briefing | null }) {
  const [estado, acao, enviando] = useActionState(salvarBriefing, undefined);
  return (
    <form action={acao} className="flex flex-col gap-3">
      <input type="hidden" name="client_id" value={clientId} />
      <input type="hidden" name="grupo" value="identidade" />
      <Etiquetas
        nome="cores"
        rotulo="Cores da marca"
        inicial={briefing?.cores ?? []}
        placeholder="#RRGGBB"
        cor
        validar={(v) => (/^#[0-9A-Fa-f]{6}$/.test(v) ? null : "Use o formato #RRGGBB, por exemplo #0B3D91.")}
      />
      <Rodape enviando={enviando} estado={estado} />
    </form>
  );
}

const ACESSOS_PADRAO = ["Instagram", "Meta Business", "Google Drive", "Site"];

export function FormAcessos({ clientId, briefing }: { clientId: string; briefing: Briefing | null }) {
  const [estado, acao, enviando] = useActionState(salvarBriefing, undefined);
  const [acessos, setAcessos] = useState<Acesso[]>(
    briefing?.acessos?.length ? briefing.acessos : ACESSOS_PADRAO.map((nome) => ({ nome, liberado: false })),
  );
  const [novo, setNovo] = useState("");
  return (
    <form action={acao} className="flex flex-col gap-3">
      <input type="hidden" name="client_id" value={clientId} />
      <input type="hidden" name="grupo" value="acessos" />
      <input type="hidden" name="acessos" value={JSON.stringify(acessos)} />
      <ul className="flex flex-col">
        {acessos.map((a, i) => (
          <li key={a.nome} className="flex items-center gap-2.5 border-t border-line py-2 first:border-t-0">
            <input
              type="checkbox"
              id={`acesso-${i}`}
              checked={a.liberado}
              onChange={() => setAcessos(acessos.map((x, j) => (j === i ? { ...x, liberado: !x.liberado } : x)))}
              className="h-4 w-4 accent-[var(--color-accent)]"
            />
            <label htmlFor={`acesso-${i}`} className="flex-1">
              {a.nome}
            </label>
            <span className={`text-[12px] ${a.liberado ? "text-ok" : "font-semibold text-bad"}`}>
              {a.liberado ? "Liberado" : "Pendente"}
            </span>
            <button
              type="button"
              aria-label={`Remover ${a.nome}`}
              onClick={() => setAcessos(acessos.filter((_, j) => j !== i))}
              className="grid h-6 w-6 place-items-center rounded-full text-muted hover:bg-surface hover:text-ink"
            >
              ×
            </button>
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        <input
          value={novo}
          onChange={(e) => setNovo(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (novo.trim() && !acessos.some((a) => a.nome === novo.trim())) {
                setAcessos([...acessos, { nome: novo.trim(), liberado: false }]);
                setNovo("");
              }
            }
          }}
          placeholder="Outro acesso (Enter para adicionar)"
          aria-label="Outro acesso"
          className={`${classeEntrada} text-[13px]`}
        />
      </div>
      <p className="text-[12px] text-muted">Senhas não ficam aqui. Use um gerenciador de senhas compartilhado.</p>
      <Rodape enviando={enviando} estado={estado} />
    </form>
  );
}

// ---------------------------------------------------------------- contrato
export function FormContrato({ clientId, contrato, aoFechar }: { clientId: string; contrato?: Contrato; aoFechar?: () => void }) {
  const [estado, acao, enviando] = useActionState(salvarContrato, undefined);
  return (
    <form action={acao} className="grid grid-cols-2 gap-3 px-4 py-3.5">
      <input type="hidden" name="client_id" value={clientId} />
      {contrato && <input type="hidden" name="id" value={contrato.id} />}
      <Campo rotulo="Início" id="inicio" type="date" required defaultValue={contrato?.inicio} />
      <Campo rotulo="Fim" id="fim" type="date" defaultValue={contrato?.fim ?? ""} dica="Vazio = sem data de fim." />
      <Campo rotulo="Conteúdos por mês" id="conteudos_mes" type="number" min={0} required defaultValue={contrato?.conteudos_mes ?? ""} />
      <Campo rotulo="Ajustes por mês" id="ajustes_mes" type="number" min={0} required defaultValue={contrato?.ajustes_mes ?? ""} />
      <div className="col-span-2">
        <Campo
          rotulo="Valor mensal (R$)"
          id="valor_mensal"
          inputMode="decimal"
          defaultValue={contrato?.valor_mensal ?? ""}
          placeholder="3500"
          dica="Só Sócio e Administrativo veem. O cliente nunca vê no portal."
          className={`${classeEntrada} font-mono`}
        />
      </div>
      <div className="col-span-2 flex flex-wrap items-center gap-2">
        <Botao variante="principal" pequeno disabled={enviando}>
          {enviando ? "Salvando…" : "Salvar contrato"}
        </Botao>
        {aoFechar && (
          <Botao type="button" pequeno variante="fantasma" onClick={aoFechar}>
            Cancelar
          </Botao>
        )}
        <Retorno estado={estado} />
      </div>
    </form>
  );
}

export function EdicaoContrato({ clientId, contrato }: { clientId: string; contrato?: Contrato }) {
  const [modo, setModo] = useState<"editar" | "novo" | null>(null);
  const [estadoApagar, apagar, apagando] = useActionState(apagarContrato, undefined);
  if (modo)
    return (
      <div className="border-t border-line">
        <p className="px-4 pt-3 text-[12.5px] text-muted">
          {modo === "novo" ? "Novo contrato (renovação). O anterior precisa terminar antes do início deste." : "Editando o contrato vigente."}
        </p>
        <FormContrato clientId={clientId} contrato={modo === "editar" ? contrato : undefined} aoFechar={() => setModo(null)} />
      </div>
    );
  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-line px-4 py-2.5">
      {contrato && (
        <Botao pequeno onClick={() => setModo("editar")}>
          Editar contrato
        </Botao>
      )}
      <Botao pequeno onClick={() => setModo("novo")}>
        Novo contrato
      </Botao>
      {contrato && (
        <form
          action={apagar}
          onSubmit={(e) => {
            if (!confirm("Apagar este contrato?")) e.preventDefault();
          }}
        >
          <input type="hidden" name="id" value={contrato.id} />
          <input type="hidden" name="client_id" value={clientId} />
          <Botao pequeno variante="fantasma" disabled={apagando}>
            Apagar
          </Botao>
        </form>
      )}
      <Retorno estado={estadoApagar} />
    </div>
  );
}

// ---------------------------------------------------------------- atas
export function FormAta({ clientId, hoje }: { clientId: string; hoje: string }) {
  const [estado, acao, enviando] = useActionState(adicionarAta, undefined);
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (estado?.ok) form.current?.reset();
  }, [estado]);
  return (
    <form ref={form} action={acao} className="flex flex-col gap-2 border-t border-line px-4 py-3.5">
      <input type="hidden" name="client_id" value={clientId} />
      <div className="flex flex-wrap gap-2">
        <input type="date" name="data" aria-label="Data da reunião" defaultValue={hoje} required className={`${classeEntrada} !w-[160px]`} />
        <input name="resumo" aria-label="Resumo da reunião" placeholder="Resumo da reunião" required className={`${classeEntrada} min-w-[180px] flex-1`} />
        <Botao className="border-ink bg-ink text-bg" disabled={enviando}>
          {enviando ? "Salvando…" : "Salvar"}
        </Botao>
      </div>
      <Retorno estado={estado} />
    </form>
  );
}

export function BotaoApagarAta({ id, clientId }: { id: string; clientId: string }) {
  const [, acao, apagando] = useActionState(apagarAta, undefined);
  return (
    <form
      action={acao}
      onSubmit={(e) => {
        if (!confirm("Apagar esta ata?")) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="client_id" value={clientId} />
      <button aria-label="Apagar ata" disabled={apagando} className="grid h-6 w-6 place-items-center rounded-full text-muted hover:bg-surface hover:text-ink">
        ×
      </button>
    </form>
  );
}

// ---------------------------------------------------------------- pessoas do cliente (quem aprova no portal)
export function FormConviteCliente({ clientId }: { clientId: string }) {
  const [estado, acao, enviando] = useActionState(convidar, undefined);
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (estado?.ok) form.current?.reset();
  }, [estado]);
  return (
    <form ref={form} action={acao} className="flex flex-col gap-2 border-t border-line px-4 py-3.5">
      <input type="hidden" name="perfil" value="cliente" />
      <input type="hidden" name="client_id" value={clientId} />
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1.4fr_70px_auto]">
        <input name="nome" aria-label="Nome" placeholder="Nome" required className={classeEntrada} />
        <input name="email" type="email" aria-label="E-mail" placeholder="E-mail" required className={classeEntrada} />
        <input name="iniciais" aria-label="Iniciais" placeholder="Inic." required maxLength={3} className={`${classeEntrada} uppercase`} />
        <Botao variante="principal" disabled={enviando}>
          {enviando ? "Enviando…" : "Convidar"}
        </Botao>
      </div>
      {estado?.erro && <Aviso tom="erro">{estado.erro}</Aviso>}
      {estado?.ok && <small className="text-[12.5px] text-ok">{estado.ok} A pessoa entra no portal pelo link do e-mail.</small>}
    </form>
  );
}

// ---------------------------------------------------------------- LGPD (só Sócio)
export function DadosDoCliente({ clientId, nome }: { clientId: string; nome: string }) {
  const [estado, acao, apagando] = useActionState(apagarCliente, undefined);
  const [aberto, setAberto] = useState(false);
  return (
    <div className="flex flex-col gap-3">
      <p className="text-[12.5px] text-muted">
        Ao encerrar um contrato, a pedido do cliente: exporte os dados e depois apague tudo do sistema.
      </p>
      <div className="flex flex-wrap gap-2">
        <a href={`/api/clientes/${clientId}/exportar`} className="rounded-lg border border-line px-3 py-[5px] text-[12.5px] font-medium hover:border-ink">
          Exportar dados (JSON)
        </a>
        {!aberto && (
          <Botao pequeno variante="fantasma" className="text-bad" onClick={() => setAberto(true)}>
            Apagar cliente e dados
          </Botao>
        )}
      </div>
      {aberto && (
        <form action={acao} className="flex flex-col gap-2 rounded-lg border border-bad/35 bg-bad-soft p-3">
          <input type="hidden" name="client_id" value={clientId} />
          <p className="text-[12.5px] text-bad">
            Apaga para sempre: tarefas, artes, comentários, histórico, contratos, briefing, atas e os acessos das pessoas do cliente. Não dá
            para desfazer. Para confirmar, digite <b>{nome}</b>.
          </p>
          <input name="confirmacao" aria-label="Nome do cliente para confirmar" autoComplete="off" className={classeEntrada} />
          <div className="flex flex-wrap items-center gap-2">
            <Botao pequeno className="border-bad bg-bad text-white" disabled={apagando}>
              {apagando ? "Apagando…" : "Apagar para sempre"}
            </Botao>
            <Botao type="button" pequeno variante="fantasma" onClick={() => setAberto(false)}>
              Cancelar
            </Botao>
          </div>
          {estado?.erro && <small className="text-[12.5px] text-bad">{estado.erro}</small>}
        </form>
      )}
    </div>
  );
}
