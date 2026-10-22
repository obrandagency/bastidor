"use client";

import { useActionState, useState } from "react";
import { Aviso, Botao, Campo, Selecao, classeEntrada } from "@/components/formulario";
import { ROTULO_PERFIL, type Perfil } from "@/lib/permissoes";
import type { Estado } from "@/app/entrar/acoes";
import { alternarAcesso, convidar, mudarPerfil, reenviarAcesso, salvarDiasLembrete, salvarResponsaveisPadrao } from "./acoes";

function iniciaisDe(nome: string) {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "";
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

export function FormConvite({ clientes }: { clientes: { id: string; nome: string }[] }) {
  const [estado, acao, enviando] = useActionState(convidar, undefined);
  const [nome, setNome] = useState("");
  const [iniciais, setIniciais] = useState("");
  const [mexeuIniciais, setMexeuIniciais] = useState(false);
  const [perfil, setPerfil] = useState<Perfil>("criacao");

  return (
    <form
      action={acao}
      key={estado?.ok}
      className="grid grid-cols-1 gap-3.5 sm:grid-cols-2"
      onSubmit={() => setMexeuIniciais(false)}
    >
      <div className="sm:col-span-2">
        {estado?.erro && <Aviso tom="erro">{estado.erro}</Aviso>}
        {estado?.ok && <Aviso tom="ok">{estado.ok}</Aviso>}
      </div>
      <Campo
        rotulo="Nome"
        id="nome"
        required
        value={nome}
        onChange={(e) => {
          setNome(e.target.value);
          if (!mexeuIniciais) setIniciais(iniciaisDe(e.target.value));
        }}
      />
      <Campo rotulo="E-mail" id="email" type="email" required />
      <Campo
        rotulo="Iniciais"
        id="iniciais"
        required
        maxLength={3}
        value={iniciais}
        onChange={(e) => {
          setMexeuIniciais(true);
          setIniciais(e.target.value.toUpperCase());
        }}
        dica="Aparecem no calendário e nos cards."
      />
      <Campo rotulo="Cargo" id="cargo" placeholder="Ex.: Layout" />
      <Selecao rotulo="Perfil" id="perfil" value={perfil} onChange={(e) => setPerfil(e.target.value as Perfil)}>
        {(["socio", "adm", "criacao", "cliente"] as Perfil[]).map((p) => (
          <option key={p} value={p}>
            {ROTULO_PERFIL[p]}
          </option>
        ))}
      </Selecao>
      {perfil === "cliente" && (
        <Selecao rotulo="Cliente" id="client_id" required defaultValue="">
          <option value="" disabled>
            {clientes.length ? "Escolha o cliente" : "Nenhum cliente cadastrado"}
          </option>
          {clientes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </Selecao>
      )}
      <div className="flex items-end sm:col-span-2">
        <Botao variante="principal" disabled={enviando}>
          {enviando ? "Enviando convite…" : "Enviar convite"}
        </Botao>
      </div>
    </form>
  );
}

// Ações de cada linha da lista de pessoas, com o retorno logo abaixo
function useAcao(acao: (e: Estado, f: FormData) => Promise<Estado>) {
  return useActionState(acao, undefined);
}

export function AcoesPessoa({
  id,
  perfil,
  ativo,
  souEu,
}: {
  id: string;
  perfil: Perfil;
  ativo: boolean;
  souEu: boolean;
}) {
  const [ePerfil, aPerfil, pPerfil] = useAcao(mudarPerfil);
  const [eAcesso, aAcesso, pAcesso] = useAcao(alternarAcesso);
  const [eReenvio, aReenvio, pReenvio] = useAcao(reenviarAcesso);
  const retorno = [ePerfil, eAcesso, eReenvio].find((e) => e?.erro || e?.ok);

  return (
    <div className="flex flex-col items-start gap-1.5 sm:items-end">
      <div className="flex flex-wrap items-center gap-1.5">
        {perfil !== "cliente" && (
          <form action={aPerfil}>
            <input type="hidden" name="id" value={id} />
            <select
              key={ePerfil?.erro ?? ePerfil?.ok ?? perfil}
              name="perfil"
              aria-label="Perfil"
              defaultValue={perfil}
              disabled={pPerfil || !ativo}
              onChange={(e) => e.currentTarget.form?.requestSubmit()}
              className={`${classeEntrada} !w-auto !py-[5px] text-[12.5px]`}
            >
              <option value="socio">Sócio</option>
              <option value="adm">Administrativo</option>
              <option value="criacao">Criação</option>
            </select>
          </form>
        )}
        {ativo && (
          <form action={aReenvio}>
            <input type="hidden" name="id" value={id} />
            <Botao pequeno variante="fantasma" disabled={pReenvio}>
              Reenviar acesso
            </Botao>
          </form>
        )}
        {!souEu && (
          <form action={aAcesso}>
            <input type="hidden" name="id" value={id} />
            <Botao pequeno disabled={pAcesso}>
              {ativo ? "Desativar" : "Reativar"}
            </Botao>
          </form>
        )}
      </div>
      {retorno?.erro && <small className="text-[12px] text-bad">{retorno.erro}</small>}
      {retorno?.ok && <small className="text-[12px] text-ok">{retorno.ok}</small>}
    </div>
  );
}

export function FormResponsaveisPadrao({
  etapas,
  atuais,
  time,
}: {
  etapas: { id: string; rotulo: string }[];
  atuais: Record<string, string | null>;
  time: { id: string; nome: string }[];
}) {
  const [estado, acao, enviando] = useActionState(salvarResponsaveisPadrao, undefined);
  return (
    <form action={acao} className="flex flex-col gap-3.5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {etapas.map((e) => (
          <Selecao key={e.id} rotulo={e.rotulo} id={e.id} defaultValue={atuais[e.id] ?? ""}>
            <option value="">Ninguém</option>
            {time.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
          </Selecao>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Botao variante="principal" pequeno disabled={enviando}>
          {enviando ? "Salvando…" : "Salvar"}
        </Botao>
        {estado?.erro && <small className="text-[12.5px] text-bad">{estado.erro}</small>}
        {estado?.ok && <small className="text-[12.5px] text-ok">{estado.ok}</small>}
      </div>
    </form>
  );
}

export function FormLembrete({ dias }: { dias: number }) {
  const [estado, acao, enviando] = useActionState(salvarDiasLembrete, undefined);
  return (
    <form action={acao} className="flex flex-wrap items-end gap-3">
      <div className="w-[160px]">
        <Campo rotulo="Lembrar o cliente após" id="dias_lembrete" type="number" min={1} max={30} defaultValue={dias} dica="dias com o conteúdo parado" />
      </div>
      <Botao variante="principal" pequeno disabled={enviando} className="mb-6">
        Salvar
      </Botao>
      {estado?.ok && <small className="mb-7 text-[12.5px] text-ok">{estado.ok}</small>}
      {estado?.erro && <small className="mb-7 text-[12.5px] text-bad">{estado.erro}</small>}
    </form>
  );
}
