import { CartaoEntrada } from "@/components/cartao-entrada";
import { lerIdentidade } from "@/lib/identidade";
import { exigirTime } from "@/lib/sessao";
import { FormDefinirSenha } from "../entrar/formularios";

export const metadata = { title: "Definir senha" };

export default async function DefinirSenha() {
  const pessoa = await exigirTime();
  return (
    <CartaoEntrada titulo={`Olá, ${pessoa.nome}`} descricao={`Crie a sua senha para entrar no ${(await lerIdentidade()).nome_sistema}.`}>
      <FormDefinirSenha />
    </CartaoEntrada>
  );
}
