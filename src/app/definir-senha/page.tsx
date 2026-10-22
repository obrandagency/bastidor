import { CartaoEntrada } from "@/components/cartao-entrada";
import { exigirTime } from "@/lib/sessao";
import { FormDefinirSenha } from "../entrar/formularios";

export const metadata = { title: "Definir senha · Bastidor" };

export default async function DefinirSenha() {
  const pessoa = await exigirTime();
  return (
    <CartaoEntrada titulo={`Olá, ${pessoa.nome}`} descricao="Crie a sua senha para entrar no Bastidor.">
      <FormDefinirSenha />
    </CartaoEntrada>
  );
}
