import { redirect } from "next/navigation";
import { Aviso } from "@/components/formulario";
import { CartaoEntrada } from "@/components/cartao-entrada";
import { pessoaAtual } from "@/lib/sessao";
import { ERROS } from "./erros";
import { FormEntrar } from "./formularios";

export const metadata = { title: "Entrar · Bastidor" };

export default async function Entrar({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  if (await pessoaAtual()) redirect("/");
  const { erro } = await searchParams;
  return (
    <CartaoEntrada titulo="Entrar" descricao="Acesso da equipe O.BRAND.">
      {erro && ERROS[erro] && (
        <div className="mb-3.5">
          <Aviso tom="erro">{ERROS[erro]}</Aviso>
        </div>
      )}
      <FormEntrar />
    </CartaoEntrada>
  );
}
