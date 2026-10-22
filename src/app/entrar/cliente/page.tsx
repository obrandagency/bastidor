import { redirect } from "next/navigation";
import { Aviso } from "@/components/formulario";
import { CartaoEntrada } from "@/components/cartao-entrada";
import { pessoaAtual } from "@/lib/sessao";
import { ERROS } from "../erros";
import { FormLinkCliente } from "../formularios";

export const metadata = { title: "Portal do cliente · Bastidor" };

export default async function EntrarCliente({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  if (await pessoaAtual()) redirect("/");
  const { erro } = await searchParams;
  return (
    <CartaoEntrada
      titulo="Portal do cliente"
      descricao="Digite o seu e-mail e enviamos um link para entrar, sem senha."
    >
      {erro && ERROS[erro] && (
        <div className="mb-3.5">
          <Aviso tom="erro">{ERROS[erro]}</Aviso>
        </div>
      )}
      <FormLinkCliente />
    </CartaoEntrada>
  );
}
