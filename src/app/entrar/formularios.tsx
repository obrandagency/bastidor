"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Aviso, Botao, Campo } from "@/components/formulario";
import { definirSenha, entrar, esqueciSenha, pedirLinkCliente, type Estado } from "./acoes";

function Retorno({ estado }: { estado: Estado }) {
  if (estado?.erro) return <Aviso tom="erro">{estado.erro}</Aviso>;
  if (estado?.ok) return <Aviso tom="ok">{estado.ok}</Aviso>;
  return null;
}

export function FormEntrar() {
  const [estado, acao, enviando] = useActionState(entrar, undefined);
  return (
    <form action={acao} className="flex flex-col gap-3.5">
      <Retorno estado={estado} />
      <Campo rotulo="E-mail" id="email" type="email" autoComplete="email" required autoFocus />
      <Campo rotulo="Senha" id="senha" type="password" autoComplete="current-password" required />
      <Botao variante="principal" disabled={enviando}>
        {enviando ? "Entrando…" : "Entrar"}
      </Botao>
      <div className="flex flex-wrap justify-between gap-2 text-[13px]">
        <Link href="/entrar/esqueci" className="text-accent hover:underline">
          Esqueci a senha
        </Link>
        <Link href="/entrar/cliente" className="text-muted hover:text-ink">
          Sou cliente
        </Link>
      </div>
    </form>
  );
}

export function FormLinkCliente() {
  const [estado, acao, enviando] = useActionState(pedirLinkCliente, undefined);
  return (
    <form action={acao} className="flex flex-col gap-3.5">
      <Retorno estado={estado} />
      <Campo rotulo="E-mail" id="email" type="email" autoComplete="email" required autoFocus />
      <Botao variante="principal" disabled={enviando}>
        {enviando ? "Enviando…" : "Receber link de acesso"}
      </Botao>
      <Link href="/entrar" className="text-[13px] text-muted hover:text-ink">
        Sou da equipe O.BRAND
      </Link>
    </form>
  );
}

export function FormEsqueci() {
  const [estado, acao, enviando] = useActionState(esqueciSenha, undefined);
  return (
    <form action={acao} className="flex flex-col gap-3.5">
      <Retorno estado={estado} />
      <Campo rotulo="E-mail" id="email" type="email" autoComplete="email" required autoFocus />
      <Botao variante="principal" disabled={enviando}>
        {enviando ? "Enviando…" : "Enviar link"}
      </Botao>
      <Link href="/entrar" className="text-[13px] text-muted hover:text-ink">
        Voltar para a entrada
      </Link>
    </form>
  );
}

export function FormDefinirSenha() {
  const [estado, acao, enviando] = useActionState(definirSenha, undefined);
  return (
    <form action={acao} className="flex flex-col gap-3.5">
      <Retorno estado={estado} />
      <Campo
        rotulo="Nova senha"
        id="senha"
        type="password"
        autoComplete="new-password"
        minLength={8}
        required
        autoFocus
        dica="Pelo menos 8 caracteres."
      />
      <Campo rotulo="Repita a senha" id="confirmacao" type="password" autoComplete="new-password" required />
      <Botao variante="principal" disabled={enviando}>
        {enviando ? "Salvando…" : "Salvar senha e entrar"}
      </Botao>
    </form>
  );
}
